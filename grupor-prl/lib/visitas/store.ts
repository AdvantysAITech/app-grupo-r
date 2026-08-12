// grupor-prl/lib/visitas/store.ts
export type EstadoVisita = "borrador" | "checklist_pendiente" | "generando" | "completada" | "error";

export type TipoDocumento =
  | "plan_prevencion" | "evaluacion_riesgos" | "planificacion"
  | "programa" | "entrega" | "memoria";

export type VisitaResumen = {
  id: string;
  empresaId: string;
  empresaNombre: string;
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
export type FotoVisita = { id: string; nombre: string; mime: string; base64: string };

export type DatosVisita = {
  id: string;                 // mismo id que VisitaResumen
  fotos: FotoVisita[];
  notas: string;
  audioBase64: string | null;
  audioMime: string | null;
};

const DB_NAME = "grupor-prl";
const DB_VERSION = 2;
const STORE = "visitas";
const STORE_DATOS = "datos";

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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listarVisitas(): Promise<VisitaResumen[]> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => {
      const v = (req.result as VisitaResumen[]) ?? [];
      v.sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn));
      resolve(v);
    };
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

export async function borrarVisita(id: string): Promise<void> {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, STORE_DATOS], "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.objectStore(STORE_DATOS).delete(id);
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
    req.onsuccess = () => resolve((req.result as DatosVisita) ?? null);
    req.onerror = () => reject(req.error);
  });
}