import { NextResponse } from "next/server";
import HTMLtoDOCX from "html-to-docx";
import { createClient } from "@supabase/supabase-js";
import { getTecnicoId } from "@/lib/auth";
import { sustituirMarcadoresFoto, type MapaFotos, type Dimensiones } from "@/lib/documentos/sustituir-fotos";
import { cargarReferencia } from "@/lib/documentos/referencia";
import { buildSystemPromptDocumento, buildUserPromptDocumento } from "@/lib/documentos/prompt";
import { DOCUMENTOS_META } from "@/lib/documentos/tipos";
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
  const referencia = await cargarReferencia(meta.carpeta, body.checklist.visita.tipo);

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
        system: systemBlocks,
        messages: [{ role: "user", content: contenido }],
      }),
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`Anthropic respondió ${res.status}: ${detalle.slice(0, 500)}`);
    }

    const data: { content?: Array<{ type: string; text?: string }> } = await res.json();
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

  // --- Sustitución de marcadores de foto ---
  const mapaFotos: MapaFotos = Object.fromEntries((body.fotos ?? []).map((f) => [f.id, { base64: f.base64, mime: f.mime }]));
  const dimensiones: Dimensiones = Object.fromEntries(
    (body.fotos ?? []).filter((f) => f.width && f.height).map((f) => [f.id, { width: f.width!, height: f.height! }])
  );
  const { html: htmlFinal, noEncontradas } = sustituirMarcadoresFoto(htmlGenerado, mapaFotos, dimensiones);

  // --- Conversión a DOCX ---
  let documentoGenerado: ArrayBuffer | Blob;
  try {
    documentoGenerado = await HTMLtoDOCX(htmlFinal, undefined, { footer: false, pageNumber: true });
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
    avisos: noEncontradas.length ? [`Marcadores sin foto correspondiente: ${noEncontradas.join(", ")}`] : [],
  });
}