import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/plantillas?tipo_visita=inicial|revision
 *
 * Devuelve los tipos de documento que aplican al multiselect de la
 * Pantalla 1, filtrados por tipo de visita, leyendo el registro de
 * plantillas (tabla plantillas_documento).
 */
export async function GET(req: NextRequest) {
  const tipoVisita = req.nextUrl.searchParams.get("tipo_visita");

  if (!tipoVisita || !["inicial", "revision"].includes(tipoVisita)) {
    return NextResponse.json(
      { error: "tipo_visita debe ser inicial o revision" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  const columna = tipoVisita === "revision" ? "aplica_revision" : "aplica_inicial";

  const { data, error } = await supabase
    .from("plantillas_documento")
    .select("tipo_documento, nombre_visible")
    .eq("activo", true)
    .eq(columna, true);

  if (error) {
    console.error("Error leyendo plantillas_documento:", error);
    return NextResponse.json({ error: "Error leyendo plantillas" }, { status: 500 });
  }

  return NextResponse.json({ plantillas: data });
}