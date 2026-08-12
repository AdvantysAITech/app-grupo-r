// grupor-prl/app/api/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

type Tecnico = {
  usuario: string;
  nombre: string;
  email: string;
  hash: string;
};

// Hash dummy para igualar tiempos cuando el usuario no existe (evita enumeración por timing).
const HASH_DUMMY = bcrypt.hashSync("dummy-" + Math.random().toString(36), 10);

function cargarTecnicos(): Tecnico[] {
  const b64 = process.env.TECNICOS_B64;
  const raw = b64
    ? Buffer.from(b64, "base64").toString("utf8")
    : process.env.TECNICOS_JSON;

  if (!raw) {
    console.error("[login] Falta TECNICOS_B64 (o TECNICOS_JSON)");
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("TECNICOS_JSON no es un array");
    return parsed as Tecnico[];
  } catch (e) {
    console.error("[login] TECNICOS_JSON mal formado:", e);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { usuario, password } = await req.json();

    if (typeof usuario !== "string" || typeof password !== "string" || !usuario || !password) {
      return NextResponse.json({ ok: false, error: "Credenciales incompletas" }, { status: 400 });
    }

    const tecnicos = cargarTecnicos();
    console.log("[login] usuarios cargados:", tecnicos.map((t) => t.usuario), "| buscado:", usuario);
    const tecnico = tecnicos.find(
      (t) => t.usuario.toLowerCase() === usuario.trim().toLowerCase()
    );

    console.log("[login] hash:", tecnico?.hash?.slice(0, 7), "| longitud:", tecnico?.hash?.length);

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
      maxAge: 60 * 60 * 12, // 12 h, una jornada
    });

    return res;
  } catch (e) {
    console.error("[login] Error inesperado:", e);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}