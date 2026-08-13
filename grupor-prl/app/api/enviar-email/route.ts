// grupor-prl/app/api/enviar-email/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer";
import { createClient } from "@supabase/supabase-js";
import { getTecnicoId } from "@/lib/auth";
import { buscarTecnicoPublico } from "@/lib/tecnicos";

export const runtime = "nodejs";
export const maxDuration = 60;

type BodyEntrada = { visitaId: string; empresaNombre?: string };

function gmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Faltan GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET o GMAIL_REFRESH_TOKEN en el entorno");
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function POST(req: Request) {
  const usuario = await getTecnicoId();
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const tecnico = buscarTecnicoPublico(usuario);
  if (!tecnico) return NextResponse.json({ error: "Técnico no reconocido" }, { status: 401 });

  let body: BodyEntrada;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON de entrada inválido" }, { status: 400 });
  }
  if (!body?.visitaId) {
    return NextResponse.json({ error: "Falta visitaId" }, { status: 400 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno" }, { status: 500 });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const carpeta = `visitas/${body.visitaId}`;

  // --- Listar y descargar todos los .docx generados para esta visita ---
  const { data: listado, error: errList } = await supabase.storage.from("documentos-visitas").list(carpeta);
  if (errList) {
    console.error("[enviar-email] Error listando bucket:", errList);
    return NextResponse.json({ error: "No se pudo leer el bucket de documentos", detalle: errList.message }, { status: 502 });
  }
  const archivos = (listado ?? []).filter((f) => f.name.endsWith(".docx"));
  if (archivos.length === 0) {
    return NextResponse.json({ error: "No hay documentos generados para esta visita" }, { status: 404 });
  }

  const adjuntos: { filename: string; content: Buffer }[] = [];
  for (const archivo of archivos) {
    const ruta = `${carpeta}/${archivo.name}`;
    const { data: blob, error: errDownload } = await supabase.storage.from("documentos-visitas").download(ruta);
    if (errDownload || !blob) {
      console.error(`[enviar-email] Error descargando ${ruta}:`, errDownload);
      return NextResponse.json({ error: `No se pudo descargar "${archivo.name}"`, detalle: errDownload?.message }, { status: 502 });
    }
    adjuntos.push({ filename: archivo.name, content: Buffer.from(await blob.arrayBuffer()) });
  }

  // --- Construir el mensaje MIME con adjuntos (solo construcción, no envío) ---
  const asunto = `Documentos PRL generados${body.empresaNombre ? ` — ${body.empresaNombre}` : ""}`;
  const mail = new MailComposer({
    from: process.env.GMAIL_SENDER_EMAIL,
    to: tecnico.email,
    subject: asunto,
    text: `Hola ${tecnico.nombre},\n\nSe adjuntan los documentos generados para la visita. Revísalos antes de entregarlos al cliente.\n\nGRUPO R DE SALUD LABORAL, S.L.`,
    attachments: adjuntos,
  });

  let rawMensaje: Buffer;
  try {
    rawMensaje = await new Promise<Buffer>((resolve, reject) => {
      mail.compile().build((err, message) => (err ? reject(err) : resolve(message)));
    });
  } catch (e) {
    console.error("[enviar-email] Error construyendo el mensaje:", e);
    return NextResponse.json({ error: "Error construyendo el email", detalle: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const rawBase64Url = rawMensaje
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // --- Envío real vía Gmail API ---
  try {
    const gmail = gmailClient();
    await gmail.users.messages.send({ userId: "me", requestBody: { raw: rawBase64Url } });
  } catch (e) {
    console.error("[enviar-email] Error enviando con Gmail API:", e);
    return NextResponse.json({ error: "Error enviando el email", detalle: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  // --- Limpieza: borrar los documentos del bucket tras el envío ---
  const rutas = archivos.map((f) => `${carpeta}/${f.name}`);
  const { error: errDelete } = await supabase.storage.from("documentos-visitas").remove(rutas);
  if (errDelete) {
    // No es fatal: el email ya salió. Solo lo registramos.
    console.error("[enviar-email] Email enviado pero no se pudo limpiar el bucket:", errDelete);
  }

  return NextResponse.json({ ok: true, enviadoA: tecnico.email, documentos: archivos.map((f) => f.name) });
}