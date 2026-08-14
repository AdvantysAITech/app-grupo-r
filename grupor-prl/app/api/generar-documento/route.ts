import { NextResponse } from "next/server";
import HTMLtoDOCX from "html-to-docx";
import { createClient } from "@supabase/supabase-js";
import { getTecnicoId } from "@/lib/auth";
import { sustituirMarcadoresFoto, type MapaFotos, type Dimensiones } from "@/lib/documentos/sustituir-fotos";
import { cargarReferencia } from "@/lib/documentos/referencia";
import { buildSystemPromptDocumento, buildUserPromptDocumento } from "@/lib/documentos/prompt";
import { DOCUMENTOS_META, documentosDisponibles } from "@/lib/documentos/tipos";
import {
  aplicarEstilos,
  normalizarSaltos,
  construirPortada,
  CABECERA_HTML,
  PIE_HTML,
  opcionesDocx,
} from "@/lib/documentos/marca";
import { DOCUMENTOS_VALIDOS, type Checklist, type TipoDocumento } from "@/lib/checklist/types";

export const runtime = "nodejs";
export const maxDuration = 180;

type FotoEntrada = { id: string; mime: string; base64: string; width?: number; height?: number };
type BodyEntrada = {
  visitaId: string;
  tipoDocumento: TipoDocumento;
  checklist: Checklist;
  fotos: FotoEntrada[];
};

type BloqueSistema = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
type BloqueContenido =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export async function POST(req: Request) {
  const usuario = await getTecnicoId();
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: BodyEntrada;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON de entrada inválido" }, { status: 400 });
  }

  if (!body?.visitaId || !DOCUMENTOS_VALIDOS.includes(body.tipoDocumento) || !body?.checklist) {
    return NextResponse.json({ error: "Faltan datos o el tipo de documento no es válido" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en el entorno" }, { status: 500 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno" }, { status: 500 });
  }

  const meta = DOCUMENTOS_META[body.tipoDocumento];
  const sectorNombre = body.checklist.visita.empresa.sector;

  if (!documentosDisponibles(body.checklist.visita.tipo).includes(body.tipoDocumento)) {
    return NextResponse.json(
      { error: `"${meta.titulo}" no está disponible para visitas de tipo "${body.checklist.visita.tipo}".` },
      { status: 400 }
    );
  }

  const referencia = await cargarReferencia(body.tipoDocumento, body.checklist.visita.tipo);

  const systemPrompt = buildSystemPromptDocumento(body.tipoDocumento, sectorNombre, !!referencia.pdfBase64);
  const userPrompt = buildUserPromptDocumento({ checklist: body.checklist, notasAdicionales: referencia.notas });

  // El bloque de sistema (reglas fijas + PDF de referencia) es el mismo para todas
  // las visitas de este tipo de documento: con cache_control, a partir de la segunda
  // generación del mismo tipo Anthropic lo sirve cacheado (~10% del coste de entrada).
  const systemBlocks: BloqueSistema[] = [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }];

  const contenido: BloqueContenido[] = [];
  if (referencia.pdfBase64) {
    contenido.push({ type: "text", text: `EJEMPLO DE REFERENCIA — ${meta.titulo} ya redactado y aprobado por el cliente:` });
    contenido.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: referencia.pdfBase64 } });
  }
  contenido.push({ type: "text", text: userPrompt });

  for (const foto of body.fotos ?? []) {
    contenido.push({ type: "text", text: `IMAGEN ${foto.id}` });
    contenido.push({ type: "image", source: { type: "base64", media_type: foto.mime || "image/jpeg", data: foto.base64 } });
  }

  const modelo = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  let htmlGenerado: string;
  let truncado = false;
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
        system: systemBlocks,
        messages: [{ role: "user", content: contenido }],
      }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`Anthropic respondió ${res.status}: ${detalle.slice(0, 500)}`);
    }

    const data: { stop_reason?: string; content?: Array<{ type: string; text?: string }> } = await res.json();
    truncado = data.stop_reason === "max_tokens";
    const bloqueTexto = (data.content ?? []).find((b) => b.type === "text");
    if (!bloqueTexto?.text) throw new Error("La respuesta de Claude no contiene texto.");
    htmlGenerado = bloqueTexto.text;
  } catch (e) {
    console.error(`[generar-documento:${body.tipoDocumento}] Error llamando a Claude:`, e);
    return NextResponse.json(
      { error: `Error generando "${meta.titulo}" con la IA`, detalle: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  // --- Separar avisos del documento (Claude los devuelve dentro de <!--AVISOS-->...<!--FIN_AVISOS--> al principio) ---
  const matchAvisos = htmlGenerado.match(/<!--AVISOS-->([\s\S]*?)<!--FIN_AVISOS-->/);
  const avisosDocumento = matchAvisos
    ? Array.from(matchAvisos[1].matchAll(/<li>([\s\S]*?)<\/li>/g)).map((m) => m[1].trim())
    : [];
  const htmlSinAvisos = htmlGenerado.replace(/<!--AVISOS-->[\s\S]*?<!--FIN_AVISOS-->/, "").trim();

  // --- Sustitución de marcadores de foto ---
  const mapaFotos: MapaFotos = Object.fromEntries((body.fotos ?? []).map((f) => [f.id, { base64: f.base64, mime: f.mime }]));
  const dimensiones: Dimensiones = Object.fromEntries(
    (body.fotos ?? []).filter((f) => f.width && f.height).map((f) => [f.id, { width: f.width!, height: f.height! }])
  );
  const { html: htmlConFotos, noEncontradas } = sustituirMarcadoresFoto(htmlSinAvisos, mapaFotos, dimensiones);

  // --- Identidad de marca: portada + estilos corporativos inline ---
  // El HTML de la IA es semántico y sin estilos; aquí se le aplica la marca de Grupo R.
  const empresa = body.checklist.visita.empresa;
  const portada = construirPortada({
    razonSocial: empresa.razon_social,
    nombreComercial: empresa.nombre_comercial,
    direccion: empresa.direccion_centro,
    nif: empresa.nif,
    titulo: meta.titulo,
    anio: String(new Date(body.checklist.visita.fecha || Date.now()).getFullYear()),
  });

  const cuerpo = aplicarEstilos(normalizarSaltos(htmlConFotos));
  const htmlFinal = portada + "\n" + cuerpo;

  // --- Conversión a DOCX ---
  let documentoGenerado: ArrayBuffer | Blob;
  try {
    documentoGenerado = await HTMLtoDOCX(htmlFinal, CABECERA_HTML, opcionesDocx(meta.titulo), PIE_HTML);
  } catch (e) {
    console.error(`[generar-documento:${body.tipoDocumento}] Error convirtiendo a DOCX:`, e);
    return NextResponse.json(
      { error: `"${meta.titulo}" se generó pero no se pudo convertir a Word`, detalle: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  // --- Subida al buffer temporal de Supabase Storage ---
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const path = `visitas/${body.visitaId}/${body.tipoDocumento}.docx`;
  const { error } = await supabase.storage.from("documentos-visitas").upload(path, documentoGenerado, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: true,
  });

  if (error) {
    console.error(`[generar-documento:${body.tipoDocumento}] Error subiendo a Supabase Storage:`, error);
    return NextResponse.json(
      { error: `"${meta.titulo}" se generó pero no se pudo subir al buffer`, detalle: error.message },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    path,
    avisos: [
      ...(truncado ? [`⚠️ "${meta.titulo}" puede estar incompleto: la respuesta se cortó por longitud (max_tokens).`] : []),
      ...avisosDocumento,
      ...(noEncontradas.length ? [`Marcadores sin foto correspondiente: ${noEncontradas.join(", ")}`] : []),
    ],
  });
}