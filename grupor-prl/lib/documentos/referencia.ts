// grupor-prl/lib/documentos/referencia.ts
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { TipoDocumento, TipoVisita } from "@/lib/checklist/types";
import { DOCUMENTOS_META, grupoDocumental } from "./tipos";

export type ReferenciaDocumento = {
  pdfBase64: string | null;
  notas: string | null;
};

/**
 * Carga el PDF de referencia real para un tipo de documento y una visita.
 * Los PDF viven sueltos (sin subcarpetas por tipo) dentro de:
 *   grupor-prl/docs/documentos/{primer-año|segundo-año}/{archivo exacto}
 * El nombre exacto de archivo por tipo+grupo está en DOCUMENTOS_META.
 * Notas opcionales por tipo+grupo (si algún día hacen falta):
 *   grupor-prl/docs/documentos/{primer-año|segundo-año}/notas-{tipo}.md
 */
export async function cargarReferencia(
  tipo: TipoDocumento,
  tipoVisita: TipoVisita
): Promise<ReferenciaDocumento> {
  const grupo = grupoDocumental(tipoVisita);
  const nombreArchivo = DOCUMENTOS_META[tipo].archivo[grupo];

  if (!nombreArchivo) {
    return { pdfBase64: null, notas: null };
  }

  const carpetaGrupo = path.join(process.cwd(), "docs", "documentos", grupo);
  const pdfPath = path.join(carpetaGrupo, nombreArchivo);
  const notasPath = path.join(carpetaGrupo, `notas-${tipo}.md`);

  const pdfBase64 = existsSync(pdfPath) ? (await readFile(pdfPath)).toString("base64") : null;
  const notas = existsSync(notasPath) ? await readFile(notasPath, "utf8") : null;

  return { pdfBase64, notas };
}