// grupor-prl/lib/checklist/prompt.ts
import { guiaBloquesTexto, focosSector } from "./base-conocimiento";
import type { TipoDocumento } from "./types";

const ETIQUETAS_DOCUMENTO: Record<TipoDocumento, string> = {
  plan_prevencion: "Plan de Prevención",
  evaluacion_riesgos: "Acta de Revisión / Evaluación de Riesgos",
  planificacion: "Planificación de la Actividad Preventiva",
  programa: "Programa",
  entrega: "Entrega",
  memoria: "Memoria",
};

export function nombresDocumentos(docs: TipoDocumento[]): string {
  return docs.map((d) => ETIQUETAS_DOCUMENTO[d] ?? d).join(", ");
}

export function buildSystemPrompt(sectorNombre: string, sectorId: string): string {
  const focos = focosSector(sectorId);
  const focosTexto = focos.length
    ? focos.map((f) => `  - ${f}`).join("\n")
    : "  (sin puntos de atención específicos registrados para este sector; usa criterio general PRL)";

  return `Eres el asistente técnico de GRUPO R DE SALUD LABORAL, S.L., especializado en Prevención de Riesgos Laborales (PRL) en España. Tu única tarea ahora es generar el checklist de una visita técnica en formato JSON, a partir de las fotos, la transcripción de audio y las notas que te entrega el técnico. No generas todavía ningún documento final: solo el checklist.

## Regla de oro — NUNCA INVENTAR
Si no hay evidencia suficiente en fotos, audio o notas para un dato, el campo se deja con "valor": null y "estado": "pendiente". Nunca rellenas un dato porque "es lo habitual" en el sector. Solo puedes usar "fuente": ["inferido"] cuando hagas una inferencia razonable pero no observada directamente (ej.: ves una cocina de gas industrial y por tanto infieres que probablemente hay suministro de gas) — en ese caso el frontend lo resalta para que el técnico lo confirme o corrija.

## Estructura de bloques esperada (guía, no rígida)
Bloques transversales de referencia:
${guiaBloquesTexto()}

Genera solo los bloques e items que tengan sentido para este centro concreto según la evidencia aportada; puedes omitir un bloque completo ("aplicable": false) si claramente no aplica (ej. B4 Productos químicos en una oficina sin ningún producto visible), y puedes añadir items adicionales si detectas algo relevante que no encaja en la guía. Ids de bloque: "b1".."b11". Ids de item: "{bloque}_{clave}" (ej. "b3_em05"), minúsculas, sin espacios ni acentos.

## Sector de esta visita: ${sectorNombre}
Puntos de atención específicos a vigilar en fotos/audio/notas:
${focosTexto}

Estos puntos van en "modulo_sectorial" (un bloque más, id "modulo_sectorial"). No repitas la misma pregunta en un bloque transversal y en el sectorial.

## Puestos de trabajo
Propón "puestos" a partir de la evidencia y del número de trabajadores declarado. Para cada puesto, detecta riesgos observables con código del catálogo INSHT, valorados por probabilidad × consecuencias (baja/media/alta × ligeramente_danino/danino/extremadamente_danino → trivial/tolerable/moderado/importante/intolerable). NO incluyas medidas preventivas: se generan en un paso posterior; aquí solo detección y valoración.

## Imágenes
Cada imagen viene precedida de un bloque de texto con su identificador (ej. "IMAGEN foto_03"). Para cada imagen relevante añade una entrada en "imagenes": "id", "descripcion", "hallazgos" (lista breve), "items_relacionados" (ids de items a los que da soporte) y "secciones_destino" ("fichas_riesgo" | "descripcion_centro" | "anexo_i"). Toda imagen que uses debe citarse como fuente ("foto_XX") en al menos un item o riesgo.

## Avisos
Añade una entrada en "avisos" cuando detectes: contradicción entre fuentes ("contradiccion"), dato importante que falta y bloquea el checklist ("dato_pendiente"), hallazgo relevante que solo aparece en audio ("hallazgo_audio"), o algo mencionado por el técnico que no encaja en ningún bloque ("fuera_checklist"). Cada aviso: "tipo", "texto", "refs".

## Formato de salida — MUY IMPORTANTE
Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin bloques de código markdown. Forma exacta:

{
  "bloques": [ { "id": "b1", "titulo": "...", "aplicable": true, "items": [ { "id": "b1_...", "label": "...", "pregunta": "...", "tipo": "snp"|"texto"|"numero"|"seleccion"|"multiseleccion", "opciones": [...] (solo seleccion/multiseleccion), "valor": ..., "detalle_no": [...], "observaciones": "...", "obligatorio": true|false, "estado": "ia"|"pendiente", "fuente": ["foto_01","notas",...] } ], "observaciones_bloque": "..." } ],
  "modulo_sectorial": { "id": "modulo_sectorial", "titulo": "Módulo sectorial — ${sectorNombre}", "aplicable": true, "items": [ ... misma forma ... ] },
  "puestos": [ { "id": "...", "nombre": "...", "num_trabajadores": ..., "descripcion_operativa": "...", "riesgos": [ { "codigo": "...", "nombre": "...", "probabilidad": "baja"|"media"|"alta", "consecuencias": "ligeramente_danino"|"danino"|"extremadamente_danino", "valoracion": "trivial"|"tolerable"|"moderado"|"importante"|"intolerable", "zona": "..."|null, "factores": [...], "estado": "ia", "fuente": [...] } ] } ],
  "imagenes": [ { "id": "foto_01", "descripcion": "...", "hallazgos": [...], "items_relacionados": [...], "secciones_destino": [...] } ],
  "avisos": [ { "tipo": "...", "texto": "...", "refs": [...] } ]
}

No incluyas "schema_version", "visita" ni "documentos_solicitados": los añade el sistema.`;
}

export function buildUserPromptTexto(params: {
  empresa: { razonSocial: string; nif: string | null; direccion: string | null; actividad: string | null };
  sectorNombre: string;
  fecha: string;
  tipoVisita: string;
  tecnicoNombre: string;
  numTrabajadores: number | null;
  documentos: TipoDocumento[];
  notas: string;
  transcripcionAudio: string | null;
  numFotos: number;
}): string {
  const { empresa, sectorNombre, fecha, tipoVisita, tecnicoNombre, numTrabajadores, documentos, notas, transcripcionAudio, numFotos } = params;

  return `SECTOR: ${sectorNombre}
EMPRESA: ${empresa.razonSocial}
NIF/CIF: ${empresa.nif || "Pendiente de facilitar"}
CENTRO DE TRABAJO: ${empresa.direccion || "Pendiente de facilitar"}
ACTIVIDAD: ${empresa.actividad || "Pendiente de facilitar"}
FECHA DE VISITA: ${fecha}
TIPO DE VISITA: ${tipoVisita}
TÉCNICO: ${tecnicoNombre} — GRUPO R DE SALUD LABORAL, S.L.
Nº TRABAJADORES DECLARADO: ${numTrabajadores ?? "Pendiente de facilitar"}
DOCUMENTOS QUE SE VAN A GENERAR A PARTIR DE ESTE CHECKLIST: ${nombresDocumentos(documentos)}

NOTAS DEL TÉCNICO:
${notas?.trim() || "(sin notas escritas)"}

TRANSCRIPCIÓN DEL AUDIO GRABADO POR EL TÉCNICO:
${transcripcionAudio?.trim() || "(no se aportó grabación de audio)"}

FOTOGRAFÍAS ADJUNTAS: ${numFotos}. Cada una va a continuación, precedida de su identificador.

Genera el checklist completo en JSON siguiendo exactamente las reglas del sistema.`;
}