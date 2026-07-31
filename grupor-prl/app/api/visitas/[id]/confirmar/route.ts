import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTecnicoId } from "@/lib/auth";

/**
 * POST /api/visitas/[id]/confirmar
 *
 * Toma el checklist YA EDITADO por el técnico (guardado antes vía PATCH
 * .../checklist) y dispara el webhook checklist-confirmado de n8n, que
 * genera los documentos seleccionados usando ese contenido confirmado
 * - nunca el original de la IA sin revisar.
 */
export async function POST(
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
    .select("id, empresa_id, empresa_nombre, sector, tipo_visita, documentos_seleccionados")
    .eq("id", id)
    .eq("tecnico_id", tecnicoId)
    .single();

  if (errVisita || !visita) {
    return NextResponse.json({ error: "Visita no encontrada" }, { status: 404 });
  }

  const { data: checklist, error: errChecklist } = await supabase
    .from("checklists")
    .select("contenido, estado")
    .eq("visita_id", id)
    .single();

  if (errChecklist || !checklist) {
    return NextResponse.json(
      { error: "Todavía no hay checklist generado para esta visita" },
      { status: 400 }
    );
  }

  if (checklist.estado === "confirmado") {
    return NextResponse.json({ error: "Este checklist ya se confirmó" }, { status: 409 });
  }

  const { data: tecnico } = await supabase
    .from("tecnicos")
    .select("nombre, email")
    .eq("id", tecnicoId)
    .single();

  const webhookUrl = process.env.N8N_WEBHOOK_CHECKLIST_CONFIRMADO;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Falta N8N_WEBHOOK_CHECKLIST_CONFIRMADO en el entorno" },
      { status: 500 }
    );
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visita_id: visita.id,
        empresa_id: visita.empresa_id,
        empresa_nombre: visita.empresa_nombre,
        sector: visita.sector,
        tipo_visita: visita.tipo_visita,
        documentos_seleccionados: visita.documentos_seleccionados,
        checklist_confirmado: checklist.contenido,
        tecnico_nombre: tecnico?.nombre,
        tecnico_email: tecnico?.email,
      }),
    });
  } catch (err) {
    console.error("Error llamando al webhook checklist-confirmado:", err);
    return NextResponse.json(
      { error: "No se pudo iniciar la generación de documentos" },
      { status: 502 }
    );
  }

  await supabase
    .from("checklists")
    .update({ estado: "confirmado", updated_at: new Date().toISOString() })
    .eq("visita_id", id);

  await supabase.from("visitas").update({ status: "confirmado" }).eq("id", id);

  return NextResponse.json({ estado: "documentos_generando" });
}