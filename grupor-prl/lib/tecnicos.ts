// grupor-prl/lib/tecnicos.ts
export type Tecnico = {
  usuario: string;
  nombre: string;
  email: string;
  hash: string;
};

export function cargarTecnicos(): Tecnico[] {
  const b64 = process.env.TECNICOS_B64;
  const raw = b64
    ? Buffer.from(b64, "base64").toString("utf8")
    : process.env.TECNICOS_JSON;

  if (!raw) {
    console.error("[tecnicos] Falta TECNICOS_B64 (o TECNICOS_JSON)");
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("TECNICOS_JSON no es un array");
    return parsed as Tecnico[];
  } catch (e) {
    console.error("[tecnicos] TECNICOS_JSON mal formado:", e);
    return [];
  }
}

/** Técnico sin el hash — seguro para exponer al cliente. */
export function buscarTecnicoPublico(
  usuario: string
): { usuario: string; nombre: string; email: string } | null {
  const t = cargarTecnicos().find(
    (t) => t.usuario.toLowerCase() === usuario.trim().toLowerCase()
  );
  if (!t) return null;
  return { usuario: t.usuario, nombre: t.nombre, email: t.email };
}