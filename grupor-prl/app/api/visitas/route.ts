import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTecnicoId } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const tecnicoId = await getTecnicoId();
    if(!tecnicoId) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const {
        empresa_nombre,
        sector,
        centro_direccion,
        contacto_nombre,
        contacto_tel,
        num_trabajadores,
        respuestas,
        fotos,
        observaciones_generales,
    } = body;

    if (!empresa_nombre || !sector) {
        return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
        .from('visitas')
        .insert({
            tecnico_id: tecnicoId,
            empresa_id: 'temp',
            empresa_nombre,
            sector,
            centro_direccion,
            contacto_nombre,
            contacto_tel,
            num_trabajadores,
            respuestas,
            fotos,
            observaciones_generales,
            estado: 'pendiente',
        })
        .select('id')
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}