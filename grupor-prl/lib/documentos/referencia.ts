import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export type ReferenciaDocumento = {
  pdfBase64: string | null;
  notas: string | null;
};

/**
 * Carpeta esperada (crear cuando llegue el primer ejemplo real):
 *   grupor-prl/docs/documentos/{carpeta}/ejemplo.pdf   — documento real ya redactado y aprobado
 *   grupor-prl/docs/documentos/{carpeta}/notas.md      — instrucciones extra opcionales para ese tipo
 */
export async function cargarReferencia(carpeta: string): Promise<ReferenciaDocumento> {
  const base = path.join(process.cwd(), "docs", "documentos", carpeta);
  const pdfPath = path.join(base, "ejemplo.pdf");
  const notasPath = path.join(base, "notas.md");

  const pdfBase64 = existsSync(pdfPath) ? (await readFile(pdfPath)).toString("base64") : null;
  const notas = existsSync(notasPath) ? await readFile(notasPath, "utf8") : null;

  return { pdfBase64, notas };
}