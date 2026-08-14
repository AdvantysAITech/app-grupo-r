// grupor-prl/lib/checklist/types.ts
// Contrato central — Esquema Checklist v1.0
// Ver docs/Esquema_Checklist_v1.md. Cualquier cambio de campos incrementa SCHEMA_VERSION.

export const SCHEMA_VERSION = "1.1";

// ---------- Enumeraciones ----------

export type TipoVisita = "inicial" | "revision" | "extraordinaria";

export type TipoDocumento =
  | "plan_prevencion" | "evaluacion_riesgos" | "planificacion"
  | "programa" | "entrega" | "memoria";

export type TipoItem = "snp" | "texto" | "numero" | "seleccion" | "multiseleccion";

export type ValorSNP = "si" | "no" | "na";

export type EstadoItem = "ia" | "pendiente" | "editado" | "confirmado";

export type Fuente = string; // "foto_XX" | "audio_XX" | "notas" | "inferido"

export type Probabilidad = "baja" | "media" | "alta";
export type Consecuencias = "ligeramente_danino" | "danino" | "extremadamente_danino";
export type Valoracion = "trivial" | "tolerable" | "moderado" | "importante" | "intolerable";

export type SeccionDestino = "fichas_riesgo" | "descripcion_centro" | "anexo_i";

export type TipoAviso = "contradiccion" | "dato_pendiente" | "hallazgo_audio" | "fuera_checklist";

export const TIPOS_ITEM: TipoItem[] = ["snp", "texto", "numero", "seleccion", "multiseleccion"];
export const ESTADOS_ITEM: EstadoItem[] = ["ia", "pendiente", "editado", "confirmado"];
export const TIPOS_AVISO: TipoAviso[] = ["contradiccion", "dato_pendiente", "hallazgo_audio", "fuera_checklist"];
export const DOCUMENTOS_VALIDOS: TipoDocumento[] = [
  "plan_prevencion", "evaluacion_riesgos", "planificacion", "programa", "entrega", "memoria",
];

// ---------- Cabecera ----------

export type Tecnico = { usuario: string; nombre: string; email: string };

/** v1.1: la evaluación es de un CENTRO de trabajo concreto, no de la empresa.
 *  Una misma empresa puede tener varios centros, cada uno con su dirección y
 *  su responsable. Los campos de centro son los que se imprimen en la portada
 *  y en el apartado de datos identificativos de los documentos. */
export type Empresa = {
  ghl_id: string | null;
  razon_social: string;
  nombre_comercial: string | null;
  nif: string | null;
  cnae: string | null;
  actividad: string | null;
  direccion_fiscal: string | null;   // domicilio social de la empresa
  centro_nombre: string | null;      // identificador del centro visitado
  direccion_centro: string | null;   // dirección física del centro evaluado
  responsable_centro: string | null; // interlocutor del centro a efectos de PRL
  telefono_centro: string | null;
  email_centro: string | null;
  sector: string;
  num_trabajadores: number | null;
};

export type Visita = {
  id: string;
  fecha: string;   // YYYY-MM-DD
  tipo: TipoVisita;
  tecnico: Tecnico;
  empresa: Empresa;
};

// ---------- Items y bloques ----------

export type ValorItem = ValorSNP | string | number | string[] | null;

export type Item = {
  id: string;                    // {bloque}_{item}, ej. b3_em05
  label: string;
  pregunta: string;
  tipo: TipoItem;
  opciones?: string[];           // solo seleccion / multiseleccion
  valor: ValorItem;
  detalle_no: string[];          // solo con valor "no"
  observaciones: string | null;
  obligatorio: boolean;
  estado: EstadoItem;
  fuente: Fuente[];
};

export type Bloque = {
  id: string;
  titulo: string;
  aplicable: boolean;
  items: Item[];
  observaciones_bloque: string | null;
};

// ---------- Puestos ----------

export type Riesgo = {
  codigo: string;                // catálogo INSHT
  nombre: string;
  probabilidad: Probabilidad;
  consecuencias: Consecuencias;
  valoracion: Valoracion;
  zona: string | null;
  factores: string[];
  estado: EstadoItem;
  fuente: Fuente[];
};

export type Puesto = {
  id: string;
  nombre: string;
  num_trabajadores: number | null;
  descripcion_operativa: string | null;
  riesgos: Riesgo[];
};

// ---------- Imágenes y avisos ----------

export type ImagenChecklist = {
  id: string;                    // foto_01…
  descripcion: string;
  hallazgos: string[];
  items_relacionados: string[];
  secciones_destino: SeccionDestino[];
};

export type Aviso = { tipo: TipoAviso; texto: string; refs: string[] };

// ---------- Raíz ----------

export type Checklist = {
  schema_version: string;
  visita: Visita;
  documentos_solicitados: TipoDocumento[];
  bloques: Bloque[];
  modulo_sectorial: Bloque | Record<string, never>;
  puestos: Puesto[];
  imagenes: ImagenChecklist[];
  avisos: Aviso[];
};

// ---------- Helpers ----------

/** Bloque sectorial si viene informado (la IA puede devolver {} si no aplica). */
export function bloqueSectorial(c: Checklist): Bloque | null {
  const m = c.modulo_sectorial as Bloque;
  return m && typeof m === "object" && Array.isArray(m.items) ? m : null;
}

/** Todos los items evaluables: bloques aplicables + módulo sectorial. */
export function todosLosItems(c: Checklist): Item[] {
  const sectorial = bloqueSectorial(c);
  const bloques = [...c.bloques, ...(sectorial ? [sectorial] : [])];
  return bloques.filter((b) => b.aplicable !== false).flatMap((b) => b.items);
}

function vacio(v: ValorItem): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Items obligatorios sin valor: bloquean la confirmación. */
export function itemsPendientes(c: Checklist): Item[] {
  return todosLosItems(c).filter((i) => i.obligatorio && vacio(i.valor));
}

export function puedeConfirmar(c: Checklist): boolean {
  return itemsPendientes(c).length === 0;
}

/** Items rellenados por inferencia: la UI los resalta para revisión. */
export function itemsInferidos(c: Checklist): Item[] {
  return todosLosItems(c).filter((i) => i.fuente?.includes("inferido"));
}

/** Marca un item como editado por el técnico (fuente se vacía: ya no es de la IA). */
export function marcarEditado(item: Item, valor: ValorItem): Item {
  return { ...item, valor, estado: "editado", fuente: [] };
}

/** Devuelve una copia con todos los estados en "confirmado". */
export function confirmarChecklist(c: Checklist): Checklist {
  const conf = (b: Bloque): Bloque => ({
    ...b,
    items: b.items.map((i) => ({ ...i, estado: "confirmado" as EstadoItem })),
  });
  const sectorial = bloqueSectorial(c);
  return {
    ...c,
    bloques: c.bloques.map(conf),
    modulo_sectorial: sectorial ? conf(sectorial) : {},
    puestos: c.puestos.map((p) => ({
      ...p,
      riesgos: p.riesgos.map((r) => ({ ...r, estado: "confirmado" as EstadoItem })),
    })),
  };
}

/** Quita los base64: el objeto que viaja a la Llamada 2 no los lleva. */
export function sinImagenesPesadas(c: Checklist): Checklist {
  return { ...c, imagenes: c.imagenes.map(({ ...img }) => img) };
}

// ---------- Parseo tolerante de la respuesta de la IA ----------

export class ErrorChecklist extends Error {
  constructor(message: string, public readonly detalles: string[] = []) {
    super(message);
    this.name = "ErrorChecklist";
  }
}

/** Extrae el JSON aunque venga con vallas markdown o texto alrededor. */
function extraerJSON(texto: string): string {
  let t = texto.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const ini = t.indexOf("{");
  const fin = t.lastIndexOf("}");
  if (ini === -1 || fin === -1 || fin <= ini) {
    throw new ErrorChecklist("La respuesta no contiene un objeto JSON.");
  }
  return t.slice(ini, fin + 1);
}

function normalizarItem(raw: any, bloqueId: string, idx: number, errores: string[]): Item {
  const id = typeof raw?.id === "string" && raw.id ? raw.id : `${bloqueId}_i${idx + 1}`;
  const tipo: TipoItem = TIPOS_ITEM.includes(raw?.tipo) ? raw.tipo : "texto";

  let valor: ValorItem = raw?.valor ?? null;
  if (tipo === "snp" && valor !== null && !["si", "no", "na"].includes(String(valor))) {
    errores.push(`${id}: valor "${valor}" no válido para tipo snp, se pone a null.`);
    valor = null;
  }
  if (tipo === "numero" && valor !== null && Number.isNaN(Number(valor))) {
    errores.push(`${id}: valor no numérico, se pone a null.`);
    valor = null;
  }

  const sinValor = vacio(valor);
  let estado: EstadoItem = ESTADOS_ITEM.includes(raw?.estado) ? raw.estado : (sinValor ? "pendiente" : "ia");
  if (sinValor && estado === "ia") estado = "pendiente";

  return {
    id,
    label: String(raw?.label ?? raw?.pregunta ?? id),
    pregunta: String(raw?.pregunta ?? raw?.label ?? ""),
    tipo,
    ...(Array.isArray(raw?.opciones) ? { opciones: raw.opciones.map(String) } : {}),
    valor,
    detalle_no: Array.isArray(raw?.detalle_no) ? raw.detalle_no.map(String) : [],
    observaciones: raw?.observaciones ?? null,
    obligatorio: Boolean(raw?.obligatorio),
    estado,
    fuente: Array.isArray(raw?.fuente) ? raw.fuente.map(String) : [],
  };
}

function normalizarBloque(raw: any, idx: number, errores: string[]): Bloque {
  const id = typeof raw?.id === "string" && raw.id ? raw.id : `b${idx}`;
  return {
    id,
    titulo: String(raw?.titulo ?? id),
    aplicable: raw?.aplicable !== false,
    items: Array.isArray(raw?.items)
      ? raw.items.map((it: any, i: number) => normalizarItem(it, id, i, errores))
      : [],
    observaciones_bloque: raw?.observaciones_bloque ?? null,
  };
}

/**
 * Parsea la respuesta de la Llamada 1 y la normaliza al Esquema v1.0.
 * `base` aporta visita y documentos_solicitados: NO se toman de la IA.
 */
export function parseChecklistResponse(
  respuesta: string,
  base: { visita: Visita; documentos_solicitados: TipoDocumento[] }
): { checklist: Checklist; avisosParseo: string[] } {
  const errores: string[] = [];

  let raw: any;
  try {
    raw = JSON.parse(extraerJSON(respuesta));
  } catch (e) {
    throw new ErrorChecklist(
      `No se pudo interpretar la respuesta de la IA: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const bloques: Bloque[] = Array.isArray(raw?.bloques)
    ? raw.bloques.map((b: any, i: number) => normalizarBloque(b, i, errores))
    : [];

  if (bloques.length === 0) errores.push("La IA no devolvió ningún bloque.");

  const sectorialRaw = raw?.modulo_sectorial;
  const modulo_sectorial: Bloque | Record<string, never> =
    sectorialRaw && Array.isArray(sectorialRaw.items)
      ? normalizarBloque(sectorialRaw, bloques.length, errores)
      : {};

  const puestos: Puesto[] = Array.isArray(raw?.puestos)
    ? raw.puestos.map((p: any, i: number) => ({
        id: String(p?.id ?? `puesto_${i + 1}`),
        nombre: String(p?.nombre ?? `Puesto ${i + 1}`),
        num_trabajadores: p?.num_trabajadores ?? null,
        descripcion_operativa: p?.descripcion_operativa ?? null,
        riesgos: Array.isArray(p?.riesgos)
          ? p.riesgos.map((r: any) => ({
              codigo: String(r?.codigo ?? ""),
              nombre: String(r?.nombre ?? ""),
              probabilidad: r?.probabilidad ?? "baja",
              consecuencias: r?.consecuencias ?? "danino",
              valoracion: r?.valoracion ?? "tolerable",
              zona: r?.zona ?? null,
              factores: Array.isArray(r?.factores) ? r.factores.map(String) : [],
              estado: ESTADOS_ITEM.includes(r?.estado) ? r.estado : "ia",
              fuente: Array.isArray(r?.fuente) ? r.fuente.map(String) : [],
            }))
          : [],
      }))
    : [];

  const imagenes: ImagenChecklist[] = Array.isArray(raw?.imagenes)
    ? raw.imagenes.map((im: any) => ({
        id: String(im?.id ?? ""),
        descripcion: String(im?.descripcion ?? ""),
        hallazgos: Array.isArray(im?.hallazgos) ? im.hallazgos.map(String) : [],
        items_relacionados: Array.isArray(im?.items_relacionados) ? im.items_relacionados.map(String) : [],
        secciones_destino: Array.isArray(im?.secciones_destino) ? im.secciones_destino : [],
      }))
    : [];

  const avisos: Aviso[] = Array.isArray(raw?.avisos)
    ? raw.avisos
        .filter((a: any) => a && typeof a.texto === "string")
        .map((a: any) => ({
          tipo: TIPOS_AVISO.includes(a?.tipo) ? a.tipo : "dato_pendiente",
          texto: String(a.texto),
          refs: Array.isArray(a?.refs) ? a.refs.map(String) : [],
        }))
    : [];

  // Referencias a fotos inexistentes: aviso, no error.
  const idsImg = new Set(imagenes.map((i) => i.id));
  const idsItem = new Set([...bloques, ...(Array.isArray((modulo_sectorial as Bloque).items) ? [modulo_sectorial as Bloque] : [])].flatMap((b) => b.items.map((i) => i.id)));
  for (const img of imagenes) {
    for (const ref of img.items_relacionados) {
      if (!idsItem.has(ref)) errores.push(`Imagen ${img.id} referencia el item inexistente "${ref}".`);
    }
  }
  for (const b of bloques) {
    for (const it of b.items) {
      for (const f of it.fuente) {
        if (f.startsWith("foto_") && !idsImg.has(f)) {
          errores.push(`Item ${it.id} cita la fuente "${f}", que no está en imagenes.`);
        }
      }
    }
  }

  // ids de item duplicados
  const vistos = new Set<string>();
  for (const id of idsItem) {
    if (vistos.has(id)) errores.push(`Id de item duplicado: ${id}`);
    vistos.add(id);
  }

  return {
    checklist: {
      schema_version: SCHEMA_VERSION,
      visita: base.visita,
      documentos_solicitados: base.documentos_solicitados,
      bloques,
      modulo_sectorial,
      puestos,
      imagenes,
      avisos,
    },
    avisosParseo: errores,
  };
}