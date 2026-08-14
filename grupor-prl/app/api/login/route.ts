// grupor-prl/app/api/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cargarTecnicos } from "@/lib/tecnicos";

export const runtime = "nodejs";
export const preferredRegion = "cdg1"; // París: cerca de los técnicos y del bucket de Supabase en la UE

const HASH_DUMMY = bcrypt.hashSync("dummy-" + Math.random().toString(36), 10);

export async function POST(req: Request) {
  try {
    const { usuario, password } = await req.json();

    if (typeof usuario !== "string" || typeof password !== "string" || !usuario || !password) {
      return NextResponse.json({ ok: false, error: "Credenciales incompletas" }, { status: 400 });
    }

    const tecnicos = cargarTecnicos();
    const tecnico = tecnicos.find(
      (t) => t.usuario.toLowerCase() === usuario.trim().toLowerCase()
    );

    const valido = await bcrypt.compare(password, tecnico?.hash ?? HASH_DUMMY);

    if (!tecnico || !valido) {
      return NextResponse.json({ ok: false, error: "Usuario o contraseña incorrectos" }, { status: 401 });
    }

    const res = NextResponse.json({
      ok: true,
      tecnico: { usuario: tecnico.usuario, nombre: tecnico.nombre, email: tecnico.email },
    });

    res.cookies.set("tecnico_id", tecnico.usuario, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (e) {
    console.error("[login] Error inesperado:", e);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}