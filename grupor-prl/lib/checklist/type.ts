// grupor-prl/lib/checklist/types.ts
// Tipos del Esquema Checklist v1.0 — mantener sincronizado con docs/Esquema_Checklist_v1.md

export type TipoVisita = 'inicial' | 'revision' | 'extraordinaria';

export type DocumentoTipo =
  | 'plan_prevencion'
  | 'evaluacion_riesgos'
  | 'planificacion'
  | 'programa'
  | 'entrega'
  | 'memoria';

export type EstadoItem = 'ia' | 'pendiente' | 'editado' | 'confirmado';

export type TipoItem = 'snp' | 'texto' | 'numero' | 'seleccion' | 'multiseleccion';

export type ValorSNP = 'si' | 'no' | 'na';

export interface Visita {
  id: string;
  fecha: string; // ISO YYYY-MM-DD
  tipo: TipoVisita;
  tecnico: { usuario: string; nombre: string; email: string };
  empresa: {
    ghl_id: string;
    razon_social: string;
    nombre_comercial: string;
    nif: string | null;
    direccion_centro: string;
    actividad: string;
    sector: string;
    num_trabajadores: number | null;
  };
}

export interface ChecklistItem {
  id: string; // convención: {bloque}_{item}, ej. "b3_em05"
  label: string;
  pregunta: string;
  tipo: TipoItem;
  opciones?: string[]; // solo seleccion / multiseleccion
  valor: ValorSNP | string | number | string[] | null;
  detalle_no?: string[]; // solo cuando tipo=snp y valor="no"
  observaciones: string | null;
  obligatorio: boolean;
  estado: EstadoItem;
  fuente: string[]; // "foto_XX" | "audio_XX" | "notas" | "inferido"
}

export interface Bloque {
  id: string; // "b0".."b11" | "modulo_sectorial"
  titulo: string;
  aplicable: boolean;
  items: ChecklistItem[];
  observaciones_bloque: string | null;
}

export type Probabilidad = 'baja' | 'media' | 'alta';
export type Consecuencias = 'ligeramente_danino' | 'danino' | 'extremadamente_danino';
export type Valoracion = 'trivial' | 'tolerable' | 'moderado' | 'importante' | 'intolerable';

export interface RiesgoDetectado {
  codigo: string; // catálogo INSHT
  nombre: string;
  probabilidad: Probabilidad;
  consecuencias: Consecuencias;
  valoracion: Valoracion;
  zona: string;
  factores: string[];
  estado: EstadoItem;
  fuente: string[];
}

export interface Puesto {
  id: string; // kebab-case (normalizarId)
  nombre: string;
  num_trabajadores: number | null;
  descripcion_operativa: string | null;
  riesgos: RiesgoDetectado[];
}

export type SeccionDestino = 'fichas_riesgo' | 'descripcion_centro' | 'anexo_i';

export interface ImagenChecklist {
  id: string; // "foto_01"... asignado por el frontend
  descripcion: string; // escrita por la IA (pie de foto)
  hallazgos: string[];
  items_relacionados: string[];
  secciones_destino: SeccionDestino[];
}

export type TipoAviso = 'contradiccion' | 'dato_pendiente' | 'hallazgo_audio' | 'fuera_checklist';

export interface Aviso {
  tipo: TipoAviso;
  texto: string;
  refs: string[];
}

export interface Checklist {
  schema_version: '1.0';
  visita: Visita;
  documentos_solicitados: DocumentoTipo[];
  bloques: Bloque[];
  modulo_sectorial: Bloque;
  puestos: Puesto[];
  imagenes: ImagenChecklist[];
  avisos: Aviso[];
}

// ---------------------------------------------------------------------------
// Helpers de validación
// ---------------------------------------------------------------------------

/** Items obligatorios sin valor en bloques aplicables + módulo sectorial. */
export function itemsPendientes(c: Checklist): ChecklistItem[] {
  const bloques = [...c.bloques, c.modulo_sectorial].filter((b) => b.aplicable);
  return bloques.flatMap((b) => b.items).filter((i) => i.obligatorio && i.valor === null);
}

/** Regla de la pantalla de revisión: habilita el botón de confirmar. */
export function puedeConfirmar(c: Checklist): boolean {
  return itemsPendientes(c).length === 0;
}

/** Al confirmar: todos los items pasan a estado "confirmado". */
export function confirmarChecklist(c: Checklist): Checklist {
  const marcar = (b: Bloque): Bloque => ({
    ...b,
    items: b.items.map((i) => ({ ...i, estado: 'confirmado' as const })),
  });
  return {
    ...c,
    bloques: c.bloques.map(marcar),
    modulo_sectorial: marcar(c.modulo_sectorial),
    puestos: c.puestos.map((p) => ({
      ...p,
      riesgos: p.riesgos.map((r) => ({ ...r, estado: 'confirmado' as const })),
    })),
  };
}

/** Parseo tolerante de la respuesta de la Llamada 1 (limpia fences y reintenta). */
export function parseChecklistResponse(raw: string): Checklist {
  const clean = raw.replace(/```json|```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Respuesta sin JSON detectable');
  return JSON.parse(clean.slice(start, end + 1)) as Checklist;
}