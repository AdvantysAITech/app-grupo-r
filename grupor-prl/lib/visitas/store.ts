// grupor-prl/lib/visitas/store.ts
export type EstadoVisita = "borrador" | "checklist_pendiente" | "generando" | "completada" | "error";

export type TipoDocumento =
  | "plan_prevencion" | "evaluacion_riesgos" | "planificacion"
  | "programa" | "entrega" | "memoria";

export type TipoVisita = "inicial" | "revision" | "extraordinaria";

export type VisitaResumen = {
  id: string;
  empresaId: string;          // id de GHL, o "" si la empresa se introdujo a mano
  empresaNombre: string;      // razón social
  centroNombre: string | null; // nombre del centro de trabajo inspeccionado
  sector: string;
  sectorOtro: string | null;
  tecnico: string;
  estado: EstadoVisita;
  creadaEn: string;
  actualizadaEn: string;
  documentosSolicitados: TipoDocumento[];
  numFotos: number;
};

/** Foto con id estable: el mismo que usarán los marcadores [[FOTO:id|pie]] */
export type FotoVisita = {
  id: string; nombre: string; mime: string; base64: string; width: number; height: number;
  /** Ruta dentro del bucket de Supabase una vez subida. null/undefined = solo local. */
  path?: string | null;
};

/**
 * Centro de trabajo concreto que se inspecciona. Una misma empresa puede tener
 * varios, y la evaluación de riesgos es SIEMPRE de un centro, no de la empresa:
 * de ahí que estos datos vayan aparte y sean editables aunque la empresa venga
 * de GHL.
 */
export type CentroTrabajo = {
  nombre: string | null;       // "Centro Sant Cugat", "Almacén 2"…
  direccion: string | null;    // dirección física del centro (va en la portada)
  responsable: string | null;  // responsable del centro a efectos de PRL
  telefono: string | null;
  email: string | null;
};

/** Datos de la empresa (entidad legal) + el centro visitado. */
export type EmpresaSnapshot = {
  ghlId: string | null;             // null cuando se ha introducido manualmente
  razonSocial: string;
  nombreComercial: string | null;
  nif: string | null;
  cnae: string | null;
  actividad: string | null;
  direccionFiscal: string | null;   // domicilio social, distinto del centro
  centro: CentroTrabajo;
};

export type DatosVisita = {
  id: string;                 // mismo id que VisitaResumen
  fotos: FotoVisita[];
  notas: string;
  audioBase64: string | null;
  audioMime: string | null;
  empresa: EmpresaSnapshot;
  numTrabajadores: number | null;
  tipoVisita: TipoVisita;
  fecha: string;               // YYYY-MM-DD
};

/** Checklist generado/editado para una visita — se guarda tal cual el tipo Checklist de lib/checklist/types. */
export type ChecklistGuardado = {
  id: string;               // mismo id que la visita
  checklist: unknown;       // se tipa como Checklist en el punto de uso (evita dependencia circular aquí)
  avisosParseo: string[];
  generadoEn: string;
};

const DB_NAME = "grupor-prl";
const DB_VERSION = 3;
const STORE = "visitas";
const STORE_DATOS = "datos";
const STORE_CHECKLIST = "checklists";

function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" }).createIndex("actualizadaEn", "actualizadaEn");
      }
      if (!db.objectStoreNames.contains(STORE_DATOS)) {
        db.createObjectStore(STORE_DATOS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CHECKLIST)) {
        db.createObjectStore(STORE_CHECKLIST, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- Migración de datos ya guardados ----------
// Las visitas creadas antes de separar empresa y centro guardaban
// { ghlId, nombre, nif, cnae, direccion, actividad }. No se migra la base de
// datos entera (IndexedDB es por dispositivo y no merece un upgrade de versión):
// se normaliza al leer, que además es idempotente.

type EmpresaLegacy = {
  ghlId?: string | null;
  nombre?: string;
  nif?: string | null;
  cnae?: string | null;
  direccion?: string | null;
  actividad?: string | null;
};

export function normalizarEmpresa(e: EmpresaSnapshot | EmpresaLegacy | undefined | null): EmpresaSnapshot {
  const nueva = e as Partial<EmpresaSnapshot> | null | undefined;
  if (nueva?.centro && typeof nueva.centro === "object") {
    return nueva as EmpresaSnapshot;
  }
  const vieja = (e ?? {}) as EmpresaLegacy;
  return {
    ghlId: vieja.ghlId ?? null,
    razonSocial: vieja.nombre ?? "(sin nombre)",
    nombreComercial: null,
    nif: vieja.nif ?? null,
    cnae: vieja.cnae ?? null,
    actividad: vieja.actividad ?? null,
    direccionFiscal: vieja.direccion ?? null,
    centro: {
      nombre: null,
      direccion: vieja.direccion ?? null,
      responsable: null,
      telefono: null,
      email: null,
    },
  };
}

function normalizarResumen(v: VisitaResumen & { centroNombre?: string | null }): VisitaResumen {
  return { ...v, centroNombre: v.centroNombre ?? null };
}

export async function listarVisitas(): Promise<VisitaResumen[]> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => {
      const v = ((req.result as VisitaResumen[]) ?? []).map(normalizarResumen);
      v.sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn));
      resolve(v);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function leerVisita(id: string): Promise<VisitaResumen | null> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ? normalizarResumen(req.result as VisitaResumen) : null);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarVisita(v: VisitaResumen): Promise<void> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function actualizarEstadoVisita(id: string, estado: EstadoVisita): Promise<void> {
  const v = await leerVisita(id);
  if (!v) return;
  await guardarVisita({ ...v, estado, actualizadaEn: new Date().toISOString() });
}

export async function borrarVisita(id: string): Promise<void> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, STORE_DATOS, STORE_CHECKLIST], "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.objectStore(STORE_DATOS).delete(id);
    tx.objectStore(STORE_CHECKLIST).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function guardarDatosVisita(d: DatosVisita): Promise<void> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DATOS, "readwrite");
    tx.objectStore(STORE_DATOS).put(d);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function leerDatosVisita(id: string): Promise<DatosVisita | null> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_DATOS, "readonly").objectStore(STORE_DATOS).get(id);
    req.onsuccess = () => {
      const d = req.result as DatosVisita | undefined;
      resolve(d ? { ...d, empresa: normalizarEmpresa(d.empresa) } : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function guardarChecklist(c: ChecklistGuardado): Promise<void> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHECKLIST, "readwrite");
    tx.objectStore(STORE_CHECKLIST).put(c);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function leerChecklist(id: string): Promise<ChecklistGuardado | null> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_CHECKLIST, "readonly").objectStore(STORE_CHECKLIST).get(id);
    req.onsuccess = () => resolve((req.result as ChecklistGuardado) ?? null);
    req.onerror = () => reject(req.error);
  });
}