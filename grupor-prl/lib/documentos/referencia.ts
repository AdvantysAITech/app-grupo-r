// grupor-prl/lib/documentos/referencia.ts
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { TipoVisita } from "@/lib/checklist/types";

export type ReferenciaDocumento = {
  pdfBase64: string | null;
  notas: string | null;
};

/** Grupo de PDF de referencia. Si en el futuro se añade un PDF propio para
 *  "extraordinaria", crear el tipo "extraordinaria" aquí y en grupoReferencia(). */
export type GrupoReferencia = "inicial" | "anual";

/** inicial -> inicial; revision -> anual; extraordinaria -> anual (fallback,
 *  se parece más a una revisión que a una alta nueva). */
export function grupoReferencia(tipoVisita: TipoVisita): GrupoReferencia {
  return tipoVisita === "inicial" ? "inicial" : "anual";
}

/**
 * Carpeta esperada (crear cuando lleguen los PDF reales):
 *   grupor-prl/docs/documentos/{carpeta}/{inicial|anual}/ejemplo.pdf
 *   grupor-prl/docs/documentos/{carpeta}/{inicial|anual}/notas.md   (opcional)
 *
 * Compatibilidad: si no existe la subcarpeta agrupada, se prueba la ruta
 * plana antigua docs/documentos/{carpeta}/ejemplo.pdf, para no romper la
 * generación mientras se suben los PDF por grupos de forma incremental.
 */
export async function cargarReferencia(
  carpeta: string,
  tipoVisita: TipoVisita
): Promise<ReferenciaDocumento> {
  const grupo = grupoReferencia(tipoVisita);

  const baseAgrupada = path.join(process.cwd(), "docs", "documentos", carpeta, grupo);
  const basePlana = path.join(process.cwd(), "docs", "documentos", carpeta);

  const base = existsSync(path.join(baseAgrupada, "ejemplo.pdf")) ? baseAgrupada : basePlana;

  const pdfPath = path.join(base, "ejemplo.pdf");
  const notasPath = path.join(base, "notas.md");

  const pdfBase64 = existsSync(pdfPath) ? (await readFile(pdfPath)).toString("base64") : null;
  const notas = existsSync(notasPath) ? await readFile(notasPath, "utf8") : null;

  return { pdfBase64, notas };
}