// grupor-prl/lib/sectores.ts
import type { TipoDocumento } from "./visitas/store";

export const SECTORES = [
  { id: "hosteleria", nombre: "Hostelería" },
  { id: "farmacia_sanitario", nombre: "Farmacia / Sanitario" },
  { id: "comercio_retail", nombre: "Comercio / Retail" },
  { id: "oficina_administrativo", nombre: "Oficina / Administrativo" },
  { id: "construccion", nombre: "Construcción" },
  { id: "agroalimentario", nombre: "Agroalimentario" },
  { id: "industrial_almacen", nombre: "Industrial / Almacén" },
  { id: "otros", nombre: "Otros (especificar)" },
] as const;

export const SECTOR_OTROS = "otros";

export const DOCUMENTOS: { id: TipoDocumento; nombre: string }[] = [
  { id: "plan_prevencion", nombre: "Plan de Prevención" },
  { id: "evaluacion_riesgos", nombre: "Acta de Revisión / Evaluación de Riesgos" },
  { id: "planificacion", nombre: "Planificación de la Actividad Preventiva" },
  { id: "programa", nombre: "Programa" },
  { id: "entrega", nombre: "Entrega" },
  { id: "memoria", nombre: "Memoria" },
];

/** Nombre legible del sector, usando el texto libre cuando es "otros". */
export function nombreSector(sectorId: string, sectorOtro?: string | null): string {
  if (sectorId === SECTOR_OTROS) return sectorOtro?.trim() || "Otros";
  return SECTORES.find((s) => s.id === sectorId)?.nombre ?? sectorId;
}