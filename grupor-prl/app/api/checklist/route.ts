// grupor-prl/app/api/checklist/route.ts
import { NextResponse } from "next/server";
import { getTecnicoId } from "@/lib/auth";
import { buscarTecnicoPublico } from "@/lib/tecnicos";
import { transcribirAudio } from "@/lib/gemini";
import { buildSystemPrompt, buildUserPromptTexto } from "@/lib/checklist/prompt";
import {
  parseChecklistResponse, ErrorChecklist, DOCUMENTOS_VALIDOS,
  type TipoDocumento, type TipoVisita, type Visita,
} from "@/lib/checklist/types";
import { nombreSector } from "@/lib/sectores";
import { documentosDisponibles } from "@/lib/documentos/tipos";
import { resolverFotos, type FotoReferencia } from "@/lib/fotos/servidor";

export const runtime = "nodejs";
export const preferredRegion = "cdg1"; // París: cerca de los técnicos y del bucket de Supabase en la UE
export const maxDuration = 300; // transcripción + visión con hasta 20 fotos; 120 s se agotaban

// Las fotos llegan como referencia al bucket, no como bytes en el body.
type FotoEntrada = FotoReferencia;

type BodyEntrada = {
  visitaId: string;
  fecha: string;
  tipoVisita: TipoVisita;
  empresa: {
    ghlId: string | null;
    razonSocial: string;
    nombreComercial: string | null;
    nif: string | null;
    cnae: string | null;
    actividad: string | null;
    direccionFiscal: string | null;
    centro: {
      nombre: string | null;
      direccion: string | null;
      responsable: string | null;
      telefono: string | null;
      email: string | null;
    };
  };
  sector: string;
  sectorOtro: string | null;
  numTrabajadores: number | null;
  documentosSolicitados: TipoDocumento[];
  notas: string;
  fotos: FotoEntrada[];
  audio: { base64: string; mime: string } | null;
};

export async function POST(req: Request) {
  // --- Auth: el técnico se deriva SIEMPRE de la cookie, nunca del body ---
  const usuario = await getTecnicoId();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const tecnico = buscarTecnicoPublico(usuario);
  if (!tecnico) {
    return NextResponse.json({ error: "Técnico no reconocido" }, { status: 401 });
  }

  let body: BodyEntrada;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON de entrada inválido" }, { status: 400 });
  }

  if (!body?.visitaId || !body?.empresa?.razonSocial) {
    return NextResponse.json({ error: "Faltan datos de la visita o la empresa" }, { status: 400 });
  }
  const disponibles = documentosDisponibles(body.tipoVisita);
  const documentos = (body.documentosSolicitados ?? []).filter((d) => DOCUMENTOS_VALIDOS.includes(d) && disponibles.includes(d));
  if (documentos.length === 0) {
    return NextResponse.json({ error: "No se ha seleccionado ningún documento válido" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en el entorno" }, { status: 500 });
  }

  const sectorNombre = nombreSector(body.sector, body.sectorOtro);

  // --- Transcripción de audio (no bloqueante) ---
  let transcripcionAudio: string | null = null;
  let avisoTranscripcion: string | null = null;
  if (body.audio?.base64) {
    try {
      transcripcionAudio = await transcribirAudio(body.audio.base64, body.audio.mime);
    } catch (e) {
      console.error("[checklist] Error transcribiendo audio:", e);
      avisoTranscripcion = "No se pudo transcribir el audio grabado; revísalo manualmente si aporta información relevante.";
    }
  }

  // Descarga de las fotos desde Supabase Storage (ya no vienen en el body).
  const { resueltas: fotosResueltas, fallidas: fotosFallidas } = await resolverFotos(body.fotos);
  const avisoFotos = fotosFallidas.length
    ? `No se pudieron recuperar ${fotosFallidas.length} fotografía(s) (${fotosFallidas.join(", ")}); el checklist se ha generado sin ellas.`
    : null;

  // --- Prompt ---
  const systemPrompt = buildSystemPrompt(sectorNombre, body.sector);
  const textoUsuario = buildUserPromptTexto({
    empresa: {
      razonSocial: body.empresa.razonSocial,
      nombreComercial: body.empresa.nombreComercial,
      nif: body.empresa.nif,
      cnae: body.empresa.cnae,
      actividad: body.empresa.actividad,
      direccionFiscal: body.empresa.direccionFiscal,
      centroNombre: body.empresa.centro?.nombre ?? null,
      centroDireccion: body.empresa.centro?.direccion ?? null,
      centroResponsable: body.empresa.centro?.responsable ?? null,
    },
    sectorNombre,
    fecha: body.fecha,
    tipoVisita: body.tipoVisita,
    tecnicoNombre: tecnico.nombre,
    numTrabajadores: body.numTrabajadores,
    documentos,
    notas: body.notas ?? "",
    transcripcionAudio,
    numFotos: fotosResueltas.length,
  });

  type BloqueContenido =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

  const contenido: BloqueContenido[] = [{ type: "text", text: textoUsuario }];

  for (const foto of fotosResueltas) {
    contenido.push({ type: "text", text: `IMAGEN ${foto.id}` });
    contenido.push({
      type: "image",
      source: { type: "base64", media_type: foto.mime || "image/jpeg", data: foto.base64 },
    });
  }

  // --- Llamada a Claude ---
  const modelo = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  let respuestaIA: string;
  let truncada = false;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 32000,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: contenido }],
      }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`Anthropic respondió ${res.status}: ${detalle.slice(0, 500)}`);
    }

    const data: { stop_reason?: string; content?: Array<{ type: string; text?: string }> } = await res.json();
    truncada = data.stop_reason === "max_tokens";
    const bloqueTexto = (data.content ?? []).find((b) => b.type === "text");
    if (!bloqueTexto?.text) throw new Error("La respuesta de Claude no contiene texto.");
    respuestaIA = bloqueTexto.text;
  } catch (e) {
    console.error("[checklist] Error llamando a Claude:", e);
    return NextResponse.json(
      { error: "Error generando el checklist con la IA", detalle: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  // --- Parseo y normalización ---
  const visita: Visita = {
    id: body.visitaId,
    fecha: body.fecha,
    tipo: body.tipoVisita,
    tecnico: { usuario: tecnico.usuario, nombre: tecnico.nombre, email: tecnico.email },
    empresa: {
      ghl_id: body.empresa.ghlId,
      razon_social: body.empresa.razonSocial,
      nombre_comercial: body.empresa.nombreComercial,
      nif: body.empresa.nif,
      cnae: body.empresa.cnae,
      actividad: body.empresa.actividad,
      direccion_fiscal: body.empresa.direccionFiscal,
      centro_nombre: body.empresa.centro?.nombre ?? null,
      direccion_centro: body.empresa.centro?.direccion ?? null,
      responsable_centro: body.empresa.centro?.responsable ?? null,
      telefono_centro: body.empresa.centro?.telefono ?? null,
      email_centro: body.empresa.centro?.email ?? null,
      sector: sectorNombre,
      num_trabajadores: body.numTrabajadores,
    },
  };

  try {
    const { checklist, avisosParseo } = parseChecklistResponse(respuestaIA, {
      visita,
      documentos_solicitados: documentos,
    });

    const avisosFinal = [
      ...(truncada ? ["La respuesta de la IA se cortó por longitud (max_tokens). Puede haber bloques incompletos: revisa con atención o reintenta."] : []),
      ...(avisoTranscripcion ? [avisoTranscripcion] : []),
      ...(avisoFotos ? [avisoFotos] : []),
      ...avisosParseo,
    ];

    return NextResponse.json({ checklist, avisosParseo: avisosFinal });
  } catch (e) {
    if (e instanceof ErrorChecklist) {
      console.error(`[checklist] Respuesta de la IA no parseable (truncada=${truncada}):`, e.message, respuestaIA.slice(0, 1000));
      return NextResponse.json(
        {
          error: truncada
            ? "La respuesta de la IA se cortó por longitud (max_tokens) antes de completar el JSON. Sube max_tokens o reduce el número de fotos."
            : "La IA no devolvió un checklist válido. Puedes reintentar.",
          detalle: e.message,
        },
        { status: 502 }
      );
    }
    throw e;
  }
}