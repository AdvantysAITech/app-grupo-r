// grupor-prl/lib/documentos/sustituir-fotos.ts
// Sustituye [[FOTO:id|pie]] por <img> real. html-to-docx ignora <figure>/<figcaption>
// y <style> (solo respeta style="" inline), así que usamos <img> con width/height
// explícitos + un <p> aparte para el pie.

export type MapaFotos = Record<string, { base64: string; mime: string }>;
export type Dimensiones = Record<string, { width: number; height: number }>;

const REGEX_MARCADOR = /\[\[FOTO:([a-zA-Z0-9_]+)(?:\|([^\]]*))?\]\]/g;
const ANCHO_PX = 480;

export function sustituirMarcadoresFoto(
  html: string,
  mapa: MapaFotos,
  dimensiones: Dimensiones = {}
): { html: string; noEncontradas: string[]; usadas: Set<string> } {
  const noEncontradas: string[] = [];
  const usadas = new Set<string>();

  const salida = html.replace(REGEX_MARCADOR, (_m, id: string, pie = "") => {
    const foto = mapa[id];
    if (!foto) {
      noEncontradas.push(id);
      return `<p><em>[Foto ${id} no disponible]</em></p>`;
    }
    usadas.add(id);
    const dim = dimensiones[id];
    const width = dim?.width ?? ANCHO_PX;
    const height = dim?.height ?? Math.round(ANCHO_PX * 0.75);
    const pieEscapado = escapeHtml(pie.trim());
    return (
      `<img src="data:${foto.mime};base64,${foto.base64}" width="${width}" height="${height}" style="width:${width}px;height:${height}px;" />` +
      (pieEscapado ? `<p style="font-size:9pt;font-style:italic;">${pieEscapado}</p>` : "")
    );
  });

  return { html: salida, noEncontradas, usadas };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}