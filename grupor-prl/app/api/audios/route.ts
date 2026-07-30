import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTecnicoId } from "@/lib/auth";

/**
 * POST /api/audios
 * FormData: file (obligatorio), visita_id (obligatorio), seccion (opcional)
 *
 * Sube el audio a un bucket 'audios-visitas' (crear en Supabase Storage
 * si no existe todavía) y registra la fila en visita_audios. La
 * transcripción (columna 'transcripcion') la rellena n8n más adelante,
 * no esta ruta.
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
  // Límite generoso para notas de voz; ajustar si hace falta
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "El audio no puede superar 20MB" }, { status: 400 });
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

  const extension = file.name.split(".").pop() || "m4a";
  const storagePath = `${visitaId}/${Date.now()}-${seccion ?? "nota"}.${extension}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("audios-visitas")
    .upload(storagePath, arrayBuffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: audioInsertado, error: insertError } = await supabase
    .from("visita_audios")
    .insert({ visita_id: visitaId, storage_path: storagePath, seccion })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: audioInsertado.id, storage_path: storagePath });
}