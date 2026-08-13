// scripts/check-bucket.mjs
// ⚠️ TEMPORAL — solo para verificar el bucket de Supabase Storage. Borrar tras usarlo.
// Ejecutar con: node scripts/check-bucket.mjs

import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const BUCKET = "documentos-visitas";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log(`Comprobando bucket "${BUCKET}" en ${SUPABASE_URL}...\n`);

// 1. ¿Existe el bucket, y es privado?
const { data: buckets, error: errList } = await supabase.storage.listBuckets();
if (errList) {
  console.error("❌ No se pudo listar buckets (revisa que la Service Role Key es correcta):", errList.message);
  process.exit(1);
}
const bucket = buckets.find((b) => b.name === BUCKET);
if (!bucket) {
  console.error(`❌ El bucket "${BUCKET}" NO EXISTE. Créalo en Supabase Dashboard → Storage → New bucket, marcado como privado.`);
  process.exit(1);
}
console.log(`✅ El bucket "${BUCKET}" existe.`);
console.log(bucket.public ? `❌ Es PÚBLICO — debería ser privado. Cámbialo en Dashboard → Storage → ${BUCKET} → Edit bucket.` : `✅ Es privado, correcto.`);

// 2. ¿Puede escribir la Service Role Key?
const rutaPrueba = `_prueba/check-${Date.now()}.txt`;
const { error: errUpload } = await supabase.storage.from(BUCKET).upload(rutaPrueba, new Blob(["prueba de escritura"]), {
  contentType: "text/plain",
});
if (errUpload) {
  console.error("❌ No se pudo escribir en el bucket (permiso de escritura insuficiente):", errUpload.message);
  process.exit(1);
}
console.log("✅ Escritura correcta.");

// 3. ¿Puede leer lo que acaba de escribir?
const { data: descarga, error: errDownload } = await supabase.storage.from(BUCKET).download(rutaPrueba);
if (errDownload) {
  console.error("❌ No se pudo leer el archivo recién escrito:", errDownload.message);
} else {
  console.log("✅ Lectura correcta:", await descarga.text());
}

// 4. Limpieza — borra el archivo de prueba
const { error: errDelete } = await supabase.storage.from(BUCKET).remove([rutaPrueba]);
console.log(errDelete ? `⚠️ No se pudo borrar el archivo de prueba (${rutaPrueba}), bórralo a mano.` : "✅ Archivo de prueba borrado, todo limpio.");

console.log("\n🎉 Bucket listo para usarse desde /api/generar-documento.");