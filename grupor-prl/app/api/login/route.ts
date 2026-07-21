import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    const { usuario, password } = await req.json();

    if (!usuario || !password) {
        return NextResponse.json({ error: 'Faltan credenciales' }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data: tecnico, error } = await supabase
        .from('tecnicos')
        .select('id, nombre, usuario, password_hash')
        .eq('usuario', usuario)
        .single();

        if (error || !tecnico) {
            return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
        }

        const passwordOK = await bcrypt.compare(password, tecnico.password_hash);
        if (!passwordOK) {
            return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 });
        }

        const response = NextResponse.json({ id: tecnico.id, nombre: tecnico.nombre });
        response.cookies.set('tecnico_id', tecnico.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
        });

        return response;
}