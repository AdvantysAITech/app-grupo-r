// grupor-prl/app/api/tecnico/route.ts
import { NextResponse } from "next/server";
import { getTecnicoId } from "@/lib/auth";
import { buscarTecnicoPublico } from "@/lib/tecnicos";

export const runtime = "nodejs";
export const preferredRegion = "cdg1"; // París: cerca de los técnicos y del bucket de Supabase en la UE

export async function GET() {
  const usuario = await getTecnicoId();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const tecnico = buscarTecnicoPublico(usuario);
  if (!tecnico) {
    return NextResponse.json({ error: "Técnico no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ tecnico });
}