// scripts/gen.js — genera credenciales en base64 (inmune a la expansión de .env)
const bcrypt = require("bcryptjs");

const TECNICOS = [
  { usuario: "admin", nombre: "admin", email: "alexorenga20@gmai.com", password: "admin1234" },
  // Añade aquí los técnicos reales: { usuario, nombre, email, password }
];

const salida = TECNICOS.map(({ usuario, nombre, email, password }) => ({
  usuario,
  nombre,
  email,
  hash: bcrypt.hashSync(password, 10),
}));

// Verificación en el mismo proceso
salida.forEach((t, i) => {
  const ok = bcrypt.compareSync(TECNICOS[i].password, t.hash);
  console.log(`${t.usuario.padEnd(12)} hash ${t.hash.length} chars  verifica: ${ok}`);
});

const b64 = Buffer.from(JSON.stringify(salida), "utf8").toString("base64");

console.log("\n--- LÍNEA PARA .env.local (copiar tal cual) ---\n");
console.log(`TECNICOS_B64=${b64}`);
console.log("");