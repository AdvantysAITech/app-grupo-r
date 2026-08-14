// grupor-prl/lib/fotos/subir.ts
"use client";

import type { FotoVisita } from "@/lib/visitas/store";

/**
 * Sube a Supabase Storage las fotos de una visita que aún no estén subidas.
 *
 * Decisión deliberada: NO se sube en el momento de capturar la foto, sino
 * justo antes de llamar a la IA. Los técnicos trabajan en centros donde la
 * cobertura puede ser mala, y la captura debe seguir funcionando sin red —
 * IndexedDB sigue siendo la fuente de verdad. En el momento de generar el
 * checklist la conexión hace falta igualmente.
 *
 * Es idempotente: las fotos que ya tienen `path` se saltan, así que reintentar
 * tras un fallo parcial solo sube lo que falta.
 */
export async function subirFotosPendientes(
  visitaId: string,
  fotos: FotoVisita[],
  onProgreso?: (subidas: number, total: number) => void
): Promise<FotoVisita[]> {
  const pendientes = fotos.filter((f) => !f.path);
  if (pendientes.length === 0) return fotos;

  const res = await fetch("/api/fotos/firmar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitaId,
      fotos: pendientes.map((f) => ({ id: f.id, mime: f.mime })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status} al preparar la subida de fotos`);

  const firmadas: { id: string; path: string; signedUrl: string }[] = data.firmadas ?? [];
  const porId = new Map(firmadas.map((f) => [f.id, f]));

  const resultado = [...fotos];
  let subidas = 0;
  onProgreso?.(0, pendientes.length);

  for (const foto of pendientes) {
    const firma = porId.get(foto.id);
    if (!firma) throw new Error(`No se pudo preparar la subida de ${foto.id}`);

    // PUT directo a Supabase: los bytes no pasan por la función serverless.
    const put = await fetch(firma.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": foto.mime || "image/jpeg" },
      body: base64ABlob(foto.base64, foto.mime || "image/jpeg"),
    });
    if (!put.ok) {
      const detalle = await put.text().catch(() => "");
      throw new Error(`Error subiendo ${foto.id} (${put.status}) ${detalle.slice(0, 200)}`);
    }

    const i = resultado.findIndex((f) => f.id === foto.id);
    if (i !== -1) resultado[i] = { ...resultado[i], path: firma.path };
    subidas++;
    onProgreso?.(subidas, pendientes.length);
  }

  return resultado;
}

/** Referencia ligera de foto: lo único que viaja ya en el body de las rutas de IA. */
export function referenciasFoto(fotos: FotoVisita[]) {
  return fotos.map((f) => ({
    id: f.id,
    mime: f.mime,
    width: f.width,
    height: f.height,
    path: f.path ?? null,
    // Solo como red de seguridad si alguna foto no llegó a subirse.
    base64: f.path ? undefined : f.base64,
  }));
}

function base64ABlob(base64: string, mime: string): Blob {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}