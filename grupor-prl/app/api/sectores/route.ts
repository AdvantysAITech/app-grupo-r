import { NextResponse } from "next/server";
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
        .from('sectores')
        .select('id, slug, nombre, checklist')
        .eq('activo', true)
        .order('nombre');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}