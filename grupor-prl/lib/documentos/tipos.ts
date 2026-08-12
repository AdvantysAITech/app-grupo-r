import type { TipoDocumento } from "@/lib/checklist/types";

/**
 * Metadatos de cada tipo de documento. "carpeta" es el nombre exacto de la
 * subcarpeta en docs/documentos/ donde vivirá el PDF de ejemplo (ejemplo.pdf)
 * y notas específicas opcionales (notas.md). Mientras esa carpeta esté vacía,
 * el sistema genera igualmente el documento, pero avisando que no tiene
 * referencia — nunca bloquea el flujo.
 */
export const DOCUMENTOS_META: Record<TipoDocumento, { titulo: string; carpeta: string }> = {
  plan_prevencion: { titulo: "Plan de Prevención", carpeta: "plan_prevencion" },
  evaluacion_riesgos: { titulo: "Evaluación de Riesgos Laborales", carpeta: "evaluacion_riesgos" },
  planificacion: { titulo: "Planificación de la Actividad Preventiva", carpeta: "planificacion" },
  programa: { titulo: "Programa", carpeta: "programa" },
  entrega: { titulo: "Entrega", carpeta: "entrega" },
  memoria: { titulo: "Memoria", carpeta: "memoria" },
};