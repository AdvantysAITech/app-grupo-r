import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';
import { supabaseAdmin } from "@/lib/supabase";
import { construirPrompt } from "@/lib/prompt";
import { construirPayload } from "@/lib/payload";
import { cabeceraHtml, marcoNormativoHtml, CSS_DOCUMENTO } from "@/lib/plantilla-fija";

const openrouter = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

const MODELO = 'gemini-3.5-flash';

export async function POST(req: NextRequest) {
    const { visita_id } = await req.json();

    if (!visita_id) {
        return NextResponse.json({ error: 'Falta visita_id' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    interface VisitaConTecnico {
        id: string;
        empresa_nombre: string;
        sector: string;
        centro_direccion: string | null;
        num_trabajadores: number | null;
        respuestas: Record<string, { valor: 'S' | 'N' | 'NP' | ''; observacion: string }>;
        observaciones_generales: string | null;
        tecnico_id: string;
        tecnicos: { nombre: string } | { nombre: string }[] | null;
    }

    const { data, error: errVisita } = await supabase
        .from('visitas')
        .select('id, empresa_nombre, sector, centro_direccion, num_trabajadores, respuestas, observaciones_generales, tecnico_id, tecnicos(nombre)')
        .eq('id', visita_id)
        .single();
    
    const visita = data as unknown as VisitaConTecnico | null;

    if (errVisita || !visita) {
        return NextResponse.json({ error: 'Visita no encontrada' }, { status: 404 });
    }

    const tecnico = Array.isArray(visita.tecnicos) ? visita.tecnicos[0] : visita.tecnicos;

    const { data: docInsertado, error: errInsert } = await supabase
        .from('documentos')
        .insert({ visita_id, estado: 'generado', modelo_usado: MODELO })
        .select('id')
        .single();

    if (errInsert || !docInsertado) {
        return NextResponse.json({ error: 'No se pudo iniciar la generación' }, { status: 500 });
    }

    await supabase.from('visitas').update({ estado: 'generado' }).eq('id', visita_id);

    try {
        const payload = construirPayload({
            empresaNombre: visita.empresa_nombre,
            sector: visita.sector,
            centroDireccion: visita.centro_direccion,
            numTrabajadores: visita.num_trabajadores,
            respuestas: visita.respuestas as Record<string, { valor: 'S' | 'N' | 'NP' | ''; observacion: string }>,
            observacionesGenerales: visita.observaciones_generales ?? '',
        });

        const prompt = construirPrompt(payload);

        const completion = await openrouter.chat.completions.create({
            model: MODELO,
            messages: [{ role: 'user', content: prompt }],
        });

        const seccionesVariables = completion.choices[0]?.message?.content ?? '';

        const htmlCompleto = `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><style>${CSS_DOCUMENTO}</style></head>
          <body>
            ${cabeceraHtml({
              empresaNombre: visita.empresa_nombre,
              sector: visita.sector,
              centroDireccion: visita.centro_direccion ?? '',
              numTrabajadores: visita.num_trabajadores,
              tecnicoNombre: tecnico?.nombre ?? 'Técnico PRL',
              fecha: new Date().toLocaleDateString('es-ES'),
            })}
            ${seccionesVariables}
            ${marcoNormativoHtml()}
          </body>
          </html>
        `;

        await supabase
            .from('documentos')
            .update({
                html_content: htmlCompleto,
                estado: 'listo',
                tokens_input: completion.usage?.prompt_tokens,
                tokens_output: completion.usage?.completion_tokens,
                updated_at: new Date().toISOString(),
            })
            .eq('id', docInsertado.id);

        await supabase.from('visitas').update({ estado: 'listo' }).eq('id', visita_id);

        return NextResponse.json({ documento_id: docInsertado.id, estado: 'listo' });
    } catch (err: any){
        await supabase
            .from('documentos')
            .update({ estado: 'error', error_msg: err.message ?? 'Error desconocido' })

        await supabase.from('visitas').update({ estado: 'error' }).eq('id', visita_id);

        return NextResponse.json({ error: 'Error al generar el documento' }, { status: 500 });
    }
}