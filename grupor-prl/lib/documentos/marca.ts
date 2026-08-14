// grupor-prl/lib/documentos/marca.ts
// Identidad visual de GRUPO R aplicada a los DOCX generados.
//
// Restricciones REALES de html-to-docx (verificadas contra la librería, no supuestas):
//   - Los bloques <style> se ignoran por completo. SOLO se respeta style="" inline.
//     Por eso los estilos se inyectan tag por tag con aplicarEstilos().
//   - El salto de página SOLO funciona con <div class="page-break"></div> o un <div>
//     con style="page-break-after:always". En un <p> o un <h1> NO hace nada, y el
//     contenido del div se descarta.
//   - <figure>/<figcaption> se descartan silenciosamente.
//   - Las imágenes necesitan width/height explícitos.
//   - pageNumber:true añade el número de página AL FINAL del párrafo del pie, así que
//     el texto del pie termina en "Pág. " a propósito.

// Logo de GRUPO R extraído del propio PDF de referencia del cliente
// (docs/documentos/primer-año/PLAN DE PREVENCION MODELO.pdf), por lo que la
// fidelidad es exactamente la misma que la de los documentos que ya emiten.
// Si el cliente facilita un PNG de más resolución, basta con sustituir esta
// constante — no hay que tocar nada más.
const LOGO_BASE64 = [
  "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",
  "EPFOUCbgRgAAAABJRU5ErkJggg==",
].join("");

export const LOGO_SRC = `data:image/png;base64,${LOGO_BASE64}`;

// ---------- Paleta ----------
export const MARCA = {
  azul: "#1F3B73",
  rojo: "#C00000",
  gris: "#7F8CA6",
  grisTexto: "#666666",
  fuente: "Arial",
} as const;

// ---------- Estilos por etiqueta ----------
const ESTILOS: Record<string, string> = {
  h1: `font-family:${MARCA.fuente};font-size:14pt;color:${MARCA.azul};font-weight:bold;margin-top:18pt;margin-bottom:8pt;`,
  h2: `font-family:${MARCA.fuente};font-size:12pt;color:${MARCA.azul};font-weight:bold;margin-top:14pt;margin-bottom:6pt;`,
  h3: `font-family:${MARCA.fuente};font-size:11pt;color:${MARCA.rojo};font-weight:bold;margin-top:10pt;margin-bottom:4pt;`,
  h4: `font-family:${MARCA.fuente};font-size:10.5pt;color:${MARCA.azul};font-weight:bold;margin-top:8pt;margin-bottom:4pt;`,
  p: `font-family:${MARCA.fuente};font-size:10.5pt;text-align:justify;margin-bottom:6pt;line-height:1.25;`,
  li: `font-family:${MARCA.fuente};font-size:10.5pt;text-align:justify;margin-bottom:3pt;`,
  table: `border-collapse:collapse;width:100%;margin-top:6pt;margin-bottom:10pt;`,
  th: `background-color:${MARCA.azul};color:#FFFFFF;font-family:${MARCA.fuente};font-size:9.5pt;font-weight:bold;border:1px solid ${MARCA.gris};padding:4pt;text-align:left;`,
  td: `border:1px solid ${MARCA.gris};font-family:${MARCA.fuente};font-size:9.5pt;padding:4pt;vertical-align:top;`,
};

/**
 * Inyecta el style="" inline correspondiente en cada etiqueta del HTML que
 * devuelve la IA. Respeta cualquier style que ya venga puesto (p. ej. los pies
 * de foto que genera sustituirMarcadoresFoto).
 */
export function aplicarEstilos(html: string): string {
  let salida = html;
  for (const [tag, estilo] of Object.entries(ESTILOS)) {
    salida = salida.replace(
      new RegExp(`<${tag}(\\s[^>]*)?>`, "gi"),
      (coincidencia, atributos?: string) => {
        const attrs = atributos ?? "";
        if (/style\s*=/i.test(attrs)) return coincidencia;
        return `<${tag}${attrs} style="${estilo}">`;
      }
    );
  }
  return salida;
}

/** Salto de página que html-to-docx sí entiende. */
export const SALTO_PAGINA = `<div class="page-break"></div>`;

/**
 * Normaliza los saltos de página que pida la IA: si escribe el marcador
 * [[SALTO]] lo convertimos al div correcto; si intenta usar page-break en un
 * <p> o un <h1> (donde no funciona) lo reemplazamos por el div.
 */
export function normalizarSaltos(html: string): string {
  return html
    .replace(/\[\[SALTO\]\]/g, SALTO_PAGINA)
    .replace(/<p[^>]*page-break-after[^>]*>\s*<\/p>/gi, SALTO_PAGINA);
}

// ---------- Portada ----------
export type DatosPortada = {
  razonSocial: string;
  nombreComercial: string | null;
  direccion: string | null;
  nif: string | null;
  titulo: string;
  anio: string;
};

export function construirPortada(d: DatosPortada): string {
  const linea = (
    contenido: string,
    estilo: string
  ) => `<p style="text-align:center;font-family:${MARCA.fuente};${estilo}">${contenido}</p>`;

  // html-to-docx ignora margin-top en párrafos: el aire vertical de la portada
  // se hace con párrafos vacíos, que sí ocupan alto de línea.
  const hueco = (n: number) => Array.from({ length: n }, () => `<p>&nbsp;</p>`).join("");

  return [
    hueco(4),
    `<p style="text-align:center;"><img src="${LOGO_SRC}" width="150" height="111" /></p>`,
    hueco(3),
    linea(escapar(d.razonSocial), `font-size:24pt;font-weight:bold;color:${MARCA.azul};`),
    d.nombreComercial ? linea(escapar(d.nombreComercial), `font-size:13pt;font-weight:bold;color:${MARCA.rojo};`) : "",
    d.direccion ? linea(escapar(d.direccion), `font-size:11pt;font-weight:bold;`) : "",
    d.nif ? linea(`NIF: ${escapar(d.nif)}`, `font-size:10pt;color:${MARCA.grisTexto};`) : "",
    hueco(3),
    linea(escapar(d.titulo).toUpperCase(), `font-size:18pt;`),
    hueco(2),
    linea(escapar(d.anio), `font-size:12pt;font-weight:bold;`),
    SALTO_PAGINA,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------- Cabecera y pie ----------
export const CABECERA_HTML =
  `<p style="margin:0;"><img src="${LOGO_SRC}" width="52" height="38" />` +
  `<span style="font-family:${MARCA.fuente};font-size:7pt;color:${MARCA.rojo};font-weight:bold;">` +
  ` EVALUACIÓN DE RIESGOS LABORALES Y PLANIFICACIÓN DE LA PREVENCIÓN</span></p>`;

// pageNumber:true engancha el número justo detrás de este texto -> "... · Pág. 3"
export const PIE_HTML =
  `<p style="text-align:center;font-family:${MARCA.fuente};font-size:8pt;color:${MARCA.grisTexto};">` +
  `GRUPO R DE SALUD LABORAL, S.L. · Pág. </p>`;

// ---------- Opciones de página ----------
/** A4 vertical, márgenes 2,5 cm / 2 cm, Arial 10,5 pt, cabecera y pie activos. */
export function opcionesDocx(titulo: string) {
  return {
    orientation: "portrait" as const,
    pageSize: { width: 11906, height: 16838 }, // A4 en twips
    margins: { top: 1418, right: 1134, bottom: 1418, left: 1134, header: 567, footer: 567, gutter: 0 },
    font: MARCA.fuente,
    fontSize: 21, // medios puntos -> 10,5 pt
    header: true,
    footer: true,
    pageNumber: true,
    skipFirstHeaderFooter: true, // la portada va limpia
    table: { row: { cantSplit: true } },
    title: titulo,
    creator: "GRUPO R DE SALUD LABORAL, S.L.",
    lastModifiedBy: "GRUPO R DE SALUD LABORAL, S.L.",
  };
}

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}