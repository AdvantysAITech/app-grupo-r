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

export const runtime = "nodejs";
export const maxDuration = 120; // varias imágenes + JSON grande puede tardar

type FotoEntrada = { id: string; mime: string; base64: string };

type BodyEntrada = {
  visitaId: string;
  fecha: string;
  tipoVisita: TipoVisita;
  empresa: {
    ghlId: string | null;
    razonSocial: string;
    nif: string | null;
    direccion: string | null;
    actividad: string | null;
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

  // --- Prompt ---
  const systemPrompt = buildSystemPrompt(sectorNombre, body.sector);
  const textoUsuario = buildUserPromptTexto({
    empresa: {
      razonSocial: body.empresa.razonSocial,
      nif: body.empresa.nif,
      direccion: body.empresa.direccion,
      actividad: body.empresa.actividad,
    },
    sectorNombre,
    fecha: body.fecha,
    tipoVisita: body.tipoVisita,
    tecnicoNombre: tecnico.nombre,
    numTrabajadores: body.numTrabajadores,
    documentos,
    notas: body.notas ?? "",
    transcripcionAudio,
    numFotos: body.fotos?.length ?? 0,
  });

  type BloqueContenido =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

  const contenido: BloqueContenido[] = [{ type: "text", text: textoUsuario }];

  for (const foto of body.fotos ?? []) {
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
        max_tokens: 16000,
        temperature: 0.2,
        system: systemPrompt,
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
      nombre_comercial: null,
      nif: body.empresa.nif,
      direccion_centro: body.empresa.direccion,
      actividad: body.empresa.actividad,
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
      ...avisosParseo,
    ];

    return NextResponse.json({ checklist, avisosParseo: avisosFinal });
  } catch (e) {
    if (e instanceof ErrorChecklist) {
      console.error("[checklist] Respuesta de la IA no parseable:", e.message, respuestaIA.slice(0, 1000));
      return NextResponse.json(
        { error: "La IA no devolvió un checklist válido. Puedes reintentar.", detalle: e.message },
        { status: 502 }
      );
    }
    throw e;
  }
}