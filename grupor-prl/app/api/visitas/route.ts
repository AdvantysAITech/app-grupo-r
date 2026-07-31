import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTecnicoId } from "@/lib/auth";

/**
 * POST /api/visitas
 *
 * Crea la fila de la visita EN CUANTO el técnico pulsa "Continuar" en la
 * Pantalla 1 (no se espera a que termine la Pantalla 2). Esto es un cambio
 * respecto a lo que comenté al entregar la Pantalla 1 originalmente -
 * entonces dije que la visita se creaba solo al confirmar el checklist, para
 * no generar "visitas fantasma". Pero para poder subir fotos/audio ligados
 * a un visita_id real desde la Pantalla 2 (siguiente paso), hace falta que
 * la fila ya exista. Si de verdad preocupan las visitas abandonadas a medias,
 * se puede añadir luego un cron que borre las que llevan X horas en
 * 'pendiente_checklist' sin fotos asociadas.
 */
export async function POST(req: NextRequest) {
  const tecnicoId = await getTecnicoId();
  if (!tecnicoId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const { empresa, sector, tipo_visita, documentos_seleccionados } = body;

  if (!empresa?.id || !empresa?.nombre || !sector || !tipo_visita) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  if (!["inicial", "revision"].includes(tipo_visita)) {
    return NextResponse.json({ error: "tipo_visita inválido" }, { status: 400 });
  }

  if (!Array.isArray(documentos_seleccionados) || documentos_seleccionados.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos un documento" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("visitas")
    .insert({
      tecnico_id: tecnicoId,
      empresa_id: empresa.id,
      empresa_nombre: empresa.nombre,
      sector,
      tipo_visita,
      documentos_seleccionados,
      estado: "pendiente_checklist",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creando visita:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}