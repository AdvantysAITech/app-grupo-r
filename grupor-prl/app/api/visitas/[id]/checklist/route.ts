import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTecnicoId } from "@/lib/auth";

/**
 * GET /api/visitas/[id]/checklist
 * Devuelve el checklist generado por la IA para esta visita.
 * Si n8n todavía no lo ha guardado, responde estado:"generando" (no es un error).
 *
 * PATCH /api/visitas/[id]/checklist
 * Guarda el checklist editado por el técnico en la Pantalla 3.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tecnicoId = await getTecnicoId();
  if (!tecnicoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = supabaseAdmin();

  const { data: visita, error: errVisita } = await supabase
    .from("visitas")
    .select("id")
    .eq("id", id)
    .eq("tecnico_id", tecnicoId)
    .single();

  if (errVisita || !visita) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  const { data: checklist } = await supabase
    .from("checklists")
    .select("contenido, estado, error_msg")
    .eq("visita_id", id)
    .single();

  if (!checklist) {
    // n8n aún no ha terminado la Llamada 1 - no es un error, el frontend hace polling
    return NextResponse.json({ estado: "generando", contenido: null });
  }

  let contenidoParsed = checklist.contenido;
  if (typeof contenidoParsed === "string") {
    try {
      contenidoParsed = JSON.parse(contenidoParsed);
    } catch {
      return NextResponse.json({
        estado: "error",
        contenido: null,
        error_msg: "El checklist guardado no tiene un formato JSON válido.",
      });
    }
  }

  return NextResponse.json(checklist);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tecnicoId = await getTecnicoId();
  if (!tecnicoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const { contenido } = await req.json();

  if (!contenido) {
    return NextResponse.json({ error: "Falta el contenido del checklist" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: visita, error: errVisita } = await supabase
    .from("visitas")
    .select("id")
    .eq("id", id)
    .eq("tecnico_id", tecnicoId)
    .single();

  if (errVisita || !visita) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  const { data: checklistActual } = await supabase
    .from("checklists")
    .select("estado")
    .eq("visita_id", id)
    .single();

  if (checklistActual?.estado === "confirmado") {
    return NextResponse.json(
      { error: "El checklist ya se confirmó y no se puede editar" },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("checklists")
    .update({ contenido, updated_at: new Date().toISOString() })
    .eq("visita_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}