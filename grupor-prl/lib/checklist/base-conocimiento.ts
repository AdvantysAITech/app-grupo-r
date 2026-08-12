// grupor-prl/lib/checklist/base-conocimiento.ts
// Guía de referencia para el prompt de la Llamada 1. No es un esqueleto rígido
// (eso requeriría portar Checklist_Base_PRL_Multisector.md entero a código,
// pendiente): es contexto que orienta a la IA para que genere una estructura
// consistente entre visitas del mismo sector. Fuente: script.js del proyecto, condensado.

export const BLOQUES_TRANSVERSALES: { codigo: string; titulo: string; cubre: string }[] = [
  { codigo: "B1", titulo: "Instalación general", cubre: "Accesos y tránsito, orden y almacenamiento, instalación eléctrica, emergencias/incendios/evacuación, condiciones ambientales (iluminación, climatización, ruido, ventilación), botiquín." },
  { codigo: "B2", titulo: "Puestos de trabajo", cubre: "Un bloque por cada puesto/tarea diferenciada: nº trabajadores, tareas, postura, PVD, manipulación manual de cargas, trabajo en altura, herramientas cortantes, químicos, biológicos, atención al público, trabajo en solitario, carga mental." },
  { codigo: "B3", titulo: "Equipos, máquinas y herramientas", cubre: "Listado de equipos relevantes, marcado CE, mantenimiento, formación específica, resguardos de seguridad." },
  { codigo: "B4", titulo: "Productos químicos y agentes peligrosos", cubre: "Solo si aplica: listado de productos, fichas de datos de seguridad, etiquetado, almacenamiento, EPIs específicos, procedimiento ante derrames." },
  { codigo: "B5", titulo: "Agentes biológicos", cubre: "Solo si aplica (sanitario, atención al público, limpieza, alimentación): tipo de exposición, higiene, procedimiento ante pinchazo/corte, gestión de residuos biosanitarios." },
  { codigo: "B6", titulo: "Coordinación de actividades empresariales (CAE)", cubre: "Solo si operan contratas: empresas externas, intercambio de información preventiva, horarios de concurrencia, riesgos derivados." },
  { codigo: "B7", titulo: "Trabajadores especialmente sensibles", cubre: "Procedimiento de comunicación confidencial (embarazo, lactancia, discapacidad), restricciones conocidas, adaptaciones implementadas." },
  { codigo: "B8", titulo: "Vigilancia de la salud y formación", cubre: "Modalidad de vigilancia de la salud, registro de aptitudes, formación preventiva recibida (general y por puesto), última fecha de formación." },
  { codigo: "B9", titulo: "EPIs", cubre: "EPIs entregados por puesto/tarea, registro de entrega, estado de conservación, EPIs adicionales no cubiertos." },
  { codigo: "B10", titulo: "Riesgo de violencia externa / atraco", cubre: "Solo si hay atención al público o manejo de efectivo: visibilidad del efectivo, procedimiento ante atraco/agresión, historial de incidentes." },
  { codigo: "B11", titulo: "Hallazgos generales del recorrido", cubre: "Observaciones transversales del centro que no encajan en ningún otro bloque." },
];

/** Puntos de atención específicos por sector (claves = ids de lib/sectores.ts). */
export const SECTOR_FOCOS: Record<string, string[]> = {
  hosteleria: [
    "Cocina: quemaduras, cortes, suelos grasos, extracción de humos",
    "Cámaras frigoríficas: temperatura y riesgo de encierro accidental",
    "Manipulación de alimentos: normativa APPCC aplicable",
    "Terrazas/exteriores: condiciones meteorológicas y tránsito de clientes",
  ],
  farmacia_sanitario: [
    "Cadena de frío de medicamentos/vacunas",
    "Medicamentos peligrosos (citotóxicos, hormonales)",
    "Servicios asistenciales puntuales (glucosa, tensión, inyectables) y gestión de punzantes",
    "Gestión SIGRE de caducados",
  ],
  comercio_retail: [
    "Reposición en altura y escaleras de mano",
    "Manipulación manual de cargas en recepción de pedidos",
    "Atención al público en caja y manejo de efectivo",
  ],
  oficina_administrativo: [
    "Ergonomía de puesto PVD (silla, pantalla, teclado, iluminación)",
    "Carga mental y factores psicosociales",
    "Archivo y almacenamiento de documentación",
  ],
  construccion: [
    "Trabajos en altura y sistemas anticaída",
    "Maquinaria pesada y vehículos de obra",
    "Riesgo de caída de objetos y de personas a distinto nivel",
    "Coordinación de actividades empresariales entre contratas",
    "Exposición a polvo, ruido y vibraciones",
  ],
  agroalimentario: [
    "Maquinaria agrícola y de proceso",
    "Productos fitosanitarios: almacenamiento, EPIs y procedimiento de aplicación",
    "Manipulación manual de cargas en campo y almacén",
    "Exposición a condiciones ambientales extremas (calor, frío, intemperie)",
  ],
  industrial_almacen: [
    "Carretillas elevadoras y tráfico interior de vehículos",
    "Ruido industrial y necesidad de protección auditiva",
    "Trabajo en altura en estanterías industriales",
    "Manipulación mecánica de cargas (cintas, grúas, polipastos)",
  ],
};

export function focosSector(sectorId: string): string[] {
  return SECTOR_FOCOS[sectorId] ?? [];
}

export function guiaBloquesTexto(): string {
  return BLOQUES_TRANSVERSALES.map((b) => `- ${b.codigo} "${b.titulo}": ${b.cubre}`).join("\n");
}