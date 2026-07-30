import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTecnicoId } from "@/lib/auth";

/**
 * PATCH /api/visitas/[id]
 * Body: { notas?: string }
 *
 * Se llama desde el botón "Enviar visita" de la Pantalla 2, una vez
 * subidas las fotos (mínimo obligatorio) y, opcionalmente, el audio.
 * Guarda las notas, y dispara el webhook de n8n (N8N_WEBHOOK_VISITA_NUEVA)
 * que arranca la transcripción + Llamada 1 (checklist).
 *
 * PENDIENTE EN EL LADO DE N8N: el nodo "Construir prompt Llamada 1" todavía
 * tiene el contenido en placeholder y solo lee $json.audio_url (un único
 * audio). Aquí ya mando el array completo de 'fotos' con URLs firmadas,
 * listo para cuando montemos el bucle real de fotos en n8n - de momento
 * ese campo llega pero no se usa todavía.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tecnicoId = await getTecnicoId();
  if (!tecnicoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const { notas } = await req.json();

  const supabase = supabaseAdmin();

  const { data: visita, error: errVisita } = await supabase
    .from("visitas")
    .select("id, sector, tipo_visita, documentos_seleccionados, empresa_nombre, tecnico_id")
    .eq("id", id)
    .eq("tecnico_id", tecnicoId)
    .single();

  if (errVisita || !visita) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  const { data: fotos } = await supabase
    .from("visita_fotos")
    .select("storage_path, seccion")
    .eq("visita_id", id);

  if (!fotos || fotos.length === 0) {
    return NextResponse.json(
      { error: "La visita necesita al menos una foto antes de enviarse" },
      { status: 400 }
    );
  }

  const { data: audios } = await supabase
    .from("visita_audios")
    .select("storage_path")
    .eq("visita_id", id);

  await supabase.from("visitas").update({ notas }).eq("id", id);

  // URLs firmadas (7 dias) para que n8n pueda descargar fotos/audio
  const fotosConUrl = await Promise.all(
    fotos.map(async (f) => {
      const { data } = await supabase.storage
        .from("fotos-visitas")
        .createSignedUrl(f.storage_path, 60 * 60 * 24 * 7);
      return { url: data?.signedUrl, seccion: f.seccion };
    })
  );

  let audioUrl: string | null = null;
  if (audios && audios.length > 0) {
    const { data } = await supabase.storage
      .from("audios-visitas")
      .createSignedUrl(audios[0].storage_path, 60 * 60 * 24 * 7);
    audioUrl = data?.signedUrl ?? null;
  }

  const webhookUrl = process.env.N8N_WEBHOOK_VISITA_NUEVA;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Falta N8N_WEBHOOK_VISITA_NUEVA en el entorno" }, { status: 500 });
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visita_id: visita.id,
        empresa_nombre: visita.empresa_nombre,
        sector: visita.sector,
        tipo_visita: visita.tipo_visita,
        documentos_seleccionados: visita.documentos_seleccionados,
        notas,
        fotos: fotosConUrl,
        audio_url: audioUrl,
      }),
    });
  } catch (err) {
    console.error("Error llamando al webhook de n8n:", err);
    return NextResponse.json({ error: "No se pudo iniciar la generación" }, { status: 502 });
  }

  return NextResponse.json({ status: "checklist_generando" });
}