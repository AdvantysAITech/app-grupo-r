import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTecnicoId } from "@/lib/auth";

/**
 * POST /api/fotos
 * FormData: file (obligatorio), visita_id (obligatorio), seccion (opcional)
 *
 * Sube la foto al bucket 'fotos-visitas' (crear en Supabase Storage si no
 * existe todavía) y registra la fila en visita_fotos. Este endpoint NO
 * dispara nada en n8n ni marca la visita como enviada — eso lo hace
 * PATCH /api/visitas/[id] cuando el técnico pulsa "Enviar visita".
 */
export async function POST(req: NextRequest) {
  const tecnicoId = await getTecnicoId();
  if (!tecnicoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const visitaId = formData.get("visita_id") as string | null;
  const seccion = (formData.get("seccion") as string | null) ?? null;

  if (!file) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (!visitaId) {
    return NextResponse.json({ error: "Falta visita_id" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "El archivo debe ser una imagen" }, { status: 400 });
  }
  // Límite generoso para fotos de móvil; ajustar si hace falta
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "La foto no puede superar 15MB" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: visita, error: errVisita } = await supabase
    .from("visitas")
    .select("id")
    .eq("id", visitaId)
    .eq("tecnico_id", tecnicoId)
    .single();

  if (errVisita || !visita) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  const extension = file.name.split(".").pop() || "jpg";
  const storagePath = `${visitaId}/${Date.now()}-${seccion ?? "foto"}.${extension}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("fotos-visitas")
    .upload(storagePath, arrayBuffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: fotoInsertada, error: insertError } = await supabase
    .from("visita_fotos")
    .insert({ visita_id: visitaId, storage_path: storagePath, seccion })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: fotoInsertada.id, storage_path: storagePath });
}