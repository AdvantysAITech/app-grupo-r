import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = supabaseAdmin();

    const { data } = await supabase
        .from('documentos')
        .select('id, estadom, html_content, error_msg')
        .eq('visita_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    return NextResponse.json(data ?? null);
}