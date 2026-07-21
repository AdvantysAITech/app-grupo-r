import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTecnicoId } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const tecnicoId = await getTecnicoId();
    if (!tecnicoId) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 400 })
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const preguntaId = formData.get('pregunta_id') as string | null;

    if (!file) {
        return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'La foto no puede superar 5MB' }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const extension = file.name.split('.').pop() || 'jpg';
    const nombreArchivo = `${tecnicoId}/${Date.now()}-${preguntaId ?? 'general'}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
        .from('fotos-visitas')
        .upload(nombreArchivo, arrayBuffer, { contentType: file.type });

    if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signedData, error: signedError } = await supabase.storage
        .from('fotos-visitas')
        .createSignedUrl(nombreArchivo, 60 * 60 * 24 * 365);
    
        if (signedError || !signedData) {
            return NextResponse.json({ error: 'Error al generar URL de la foto' }, { status: 500 });
        }

    return NextResponse.json({ path: nombreArchivo, url: signedData.signedUrl });
}