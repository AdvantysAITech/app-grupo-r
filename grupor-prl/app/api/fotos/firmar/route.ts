// grupor-prl/app/api/fotos/firmar/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTecnicoId } from "@/lib/auth";
import { BUCKET_DOCUMENTOS, rutaFoto } from "@/lib/fotos/rutas";

export const runtime = "nodejs";

type BodyEntrada = { visitaId: string; fotos: { id: string; mime: string }[] };

/**
 * POST /api/fotos/firmar
 *
 * Devuelve una URL de subida firmada por cada foto. El navegador sube los
 * bytes DIRECTAMENTE a Supabase Storage con un PUT a esa URL, sin pasar por
 * Vercel: así se esquiva el límite de ~4,5 MB del body de las funciones
 * serverless, que con 15-20 fotos en base64 se superaba con facilidad.
 *
 * Esta ruta solo mueve URLs firmadas, nunca imágenes, así que su payload es
 * de unos pocos KB pase lo que pase.
 */
export async function POST(req: Request) {
  const usuario = await getTecnicoId();
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: BodyEntrada;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON de entrada inválido" }, { status: 400 });
  }

  if (!body?.visitaId || !Array.isArray(body.fotos) || body.fotos.length === 0) {
    return NextResponse.json({ error: "Faltan visitaId o fotos" }, { status: 400 });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno" },
      { status: 500 }
    );
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const firmadas: { id: string; path: string; signedUrl: string }[] = [];
  const fallidas: { id: string; error: string }[] = [];

  for (const foto of body.fotos) {
    // El id lo genera la propia app (foto_01, foto_02…), pero se sanea igual:
    // acaba formando parte de una ruta del bucket.
    if (!/^[a-zA-Z0-9_-]+$/.test(foto.id)) {
      fallidas.push({ id: foto.id, error: "Identificador de foto no válido" });
      continue;
    }
    const path = rutaFoto(body.visitaId, foto.id);
    // upsert: true para que reintentar una subida fallida no dé error de duplicado.
    const { data, error } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      fallidas.push({ id: foto.id, error: error?.message ?? "No se pudo firmar la subida" });
      continue;
    }
    firmadas.push({ id: foto.id, path: data.path, signedUrl: data.signedUrl });
  }

  if (firmadas.length === 0) {
    return NextResponse.json(
      { error: "No se pudo firmar ninguna subida", detalle: fallidas },
      { status: 502 }
    );
  }

  return NextResponse.json({ firmadas, fallidas });
}