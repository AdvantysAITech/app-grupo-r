// grupor-prl/lib/fotos/servidor.ts
import { createClient } from "@supabase/supabase-js";
import { BUCKET_DOCUMENTOS } from "./rutas";

/** Lo que llega en el body de /api/checklist y /api/generar-documento. */
export type FotoReferencia = {
  id: string;
  mime: string;
  width?: number;
  height?: number;
  path?: string | null;
  base64?: string; // solo si la subida al bucket no llegó a completarse
};

export type FotoResuelta = {
  id: string;
  mime: string;
  base64: string;
  width?: number;
  height?: number;
};

/**
 * Convierte las referencias de foto en base64 listo para la API de Anthropic.
 *
 * Las fotos viajan ahora por Supabase Storage, no en el body: aquí se
 * descargan del bucket. Se acepta `base64` inline como respaldo para no
 * romper visitas antiguas ni el caso de una subida incompleta.
 *
 * Nunca lanza por una foto suelta: una imagen ilegible no debe tumbar la
 * generación entera. Las que fallan se devuelven en `fallidas` para que la
 * ruta las reporte como aviso.
 */
export async function resolverFotos(
  fotos: FotoReferencia[] | undefined
): Promise<{ resueltas: FotoResuelta[]; fallidas: string[] }> {
  const entrada = fotos ?? [];
  if (entrada.length === 0) return { resueltas: [], fallidas: [] };

  const resueltas: FotoResuelta[] = [];
  const fallidas: string[] = [];

  const conPath = entrada.filter((f) => f.path);
  const supabase =
    conPath.length > 0 && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      : null;

  for (const foto of entrada) {
    if (!foto.path) {
      if (foto.base64) {
        resueltas.push({ id: foto.id, mime: foto.mime, base64: foto.base64, width: foto.width, height: foto.height });
      } else {
        fallidas.push(foto.id);
      }
      continue;
    }

    if (!supabase) {
      fallidas.push(foto.id);
      continue;
    }

    try {
      const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).download(foto.path);
      if (error || !data) throw error ?? new Error("descarga vacía");
      const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
      resueltas.push({ id: foto.id, mime: foto.mime || "image/jpeg", base64, width: foto.width, height: foto.height });
    } catch (e) {
      console.error(`[fotos] No se pudo descargar ${foto.path}:`, e);
      fallidas.push(foto.id);
    }
  }

  return { resueltas, fallidas };
}