// grupor-prl/app/api/documentos/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTecnicoId } from "@/lib/auth";

export const runtime = "nodejs";
export const preferredRegion = "cdg1"; // París: cerca de los técnicos y del bucket de Supabase en la UE

const BUCKET = "documentos-visitas";
const CADUCIDAD_SEGUNDOS = 60 * 60; // 1 hora

/**
 * GET /api/documentos?visitaId=...
 *
 * Lista los DOCX que hay ahora mismo en el buffer de Supabase Storage para una
 * visita y devuelve una URL firmada por cada uno, para que el técnico pueda
 * descargarlos desde la pantalla de detalle sin esperar al email.
 *
 * El bucket es privado: nunca se devuelve una URL pública, solo firmadas y
 * caducables. Si el email ya se envió, la carpeta estará vacía (se borra tras
 * el envío) y se devuelve una lista vacía, no un error.
 */
export async function GET(req: Request) {
  const usuario = await getTecnicoId();
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const visitaId = new URL(req.url).searchParams.get("visitaId");
  if (!visitaId) return NextResponse.json({ error: "Falta visitaId" }, { status: 400 });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno" },
      { status: 500 }
    );
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const carpeta = `visitas/${visitaId}`;

  const { data: listado, error: errList } = await supabase.storage.from(BUCKET).list(carpeta);
  if (errList) {
    console.error("[documentos] Error listando el bucket:", errList);
    return NextResponse.json(
      { error: "No se pudo leer el buffer de documentos", detalle: errList.message },
      { status: 502 }
    );
  }

  const archivos = (listado ?? []).filter((f) => f.name.endsWith(".docx"));
  if (archivos.length === 0) return NextResponse.json({ documentos: [] });

  const { data: firmadas, error: errFirma } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(archivos.map((f) => `${carpeta}/${f.name}`), CADUCIDAD_SEGUNDOS);

  if (errFirma) {
    console.error("[documentos] Error firmando URLs:", errFirma);
    return NextResponse.json(
      { error: "No se pudieron generar los enlaces de descarga", detalle: errFirma.message },
      { status: 502 }
    );
  }

  const documentos = (firmadas ?? [])
    .filter((f) => f.signedUrl && !f.error)
    .map((f) => {
      const nombre = (f.path ?? "").split("/").pop() ?? "";
      const archivo = archivos.find((a) => a.name === nombre);
      return {
        tipo: nombre.replace(/\.docx$/, ""),
        nombre,
        url: f.signedUrl as string,
        // metadata.size no siempre viene informado según la versión del bucket
        tamano: (archivo?.metadata as { size?: number } | undefined)?.size ?? 0,
      };
    });

  return NextResponse.json({ documentos });
}