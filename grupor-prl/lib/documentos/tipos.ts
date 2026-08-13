// grupor-prl/lib/documentos/tipos.ts
import type { TipoDocumento, TipoVisita } from "@/lib/checklist/types";

export type GrupoDocumental = "primer-año" | "segundo-año";

/** inicial -> primer-año; revision/extraordinaria -> segundo-año (fallback:
 *  una visita extraordinaria se trata como revisión a efectos de plantilla). */
export function grupoDocumental(tipoVisita: TipoVisita): GrupoDocumental {
  return tipoVisita === "inicial" ? "primer-año" : "segundo-año";
}

/**
 * Metadatos de cada tipo de documento. "archivo" es el nombre EXACTO del
 * PDF dentro de docs/documentos/{primer-año|segundo-año}/ — sin subcarpetas
 * por tipo, los PDF viven sueltos dentro de la carpeta de su año.
 * Si un tipo no tiene entrada para un grupo, no está disponible ese año
 * (ej. "entrega" no existe en segundo-año) — ver documentosDisponibles().
 */
export const DOCUMENTOS_META: Record<
  TipoDocumento,
  { titulo: string; archivo: Partial<Record<GrupoDocumental, string>> }
> = {
  plan_prevencion: {
    titulo: "Plan de Prevención",
    archivo: { "primer-año": "PLAN DE PREVENCION MODELO.pdf" },
  },
  evaluacion_riesgos: {
    titulo: "Acta de Revisión / Evaluación de Riesgos",
    archivo: { "segundo-año": "2026 ACTA DE REVISION.pdf" },
  },
  planificacion: {
    titulo: "Planificación de la Actividad Preventiva",
    archivo: {
      "primer-año": "PLANIFICACION ACTIVIDAD PREVENTIVA 2025-2026.pdf",
      "segundo-año": "PLANIFICACION ACTIVIDAD PREVENTIVA 2026-2027.pdf",
    },
  },
  programa: {
    titulo: "Programa",
    archivo: {
      "primer-año": "PROGRAMA ACTIVIDADES PREVENTIVAS 2025-2026.pdf",
      "segundo-año": "PROGRAMA ACTIVIDADES PREVENTIVAS 2026-2027.pdf",
    },
  },
  entrega: {
    titulo: "Entrega",
    archivo: { "primer-año": "ENTREGA DE PLAN DE PREVENCION 2025-2026.pdf" },
  },
  memoria: {
    titulo: "Memoria",
    archivo: { "segundo-año": "(164) MEMORIA 2023-2024.pdf" },
  },
};

/** Tipos de documento seleccionables para un tipo de visita dado — solo los
 *  que tienen PDF real subido para el grupo (año) correspondiente. */
export function documentosDisponibles(tipoVisita: TipoVisita): TipoDocumento[] {
  const grupo = grupoDocumental(tipoVisita);
  return (Object.keys(DOCUMENTOS_META) as TipoDocumento[]).filter(
    (tipo) => grupo in DOCUMENTOS_META[tipo].archivo
  );
}