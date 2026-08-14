// grupor-prl/lib/fotos/rutas.ts
// Convenciones de ruta dentro del bucket, en un único sitio para que el
// cliente, las rutas de IA y la limpieza posterior no se desincronicen.

/** Se reutiliza el bucket que ya existe para los DOCX: no hace falta crear otro. */
export const BUCKET_DOCUMENTOS = "documentos-visitas";

/** Carpeta raíz de una visita: contiene los .docx sueltos y la subcarpeta fotos/. */
export function carpetaVisita(visitaId: string): string {
  return `visitas/${visitaId}`;
}

/** Subcarpeta de fotos. Al ser subcarpeta, el list() de los DOCX no la ve. */
export function carpetaFotos(visitaId: string): string {
  return `${carpetaVisita(visitaId)}/fotos`;
}

export function rutaFoto(visitaId: string, fotoId: string): string {
  return `${carpetaFotos(visitaId)}/${fotoId}.jpg`;
}