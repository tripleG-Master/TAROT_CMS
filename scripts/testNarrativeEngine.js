require("dotenv").config();

const { initDb } = require("../src/db");
const { seedNarrativeData } = require("../src/seed/narrativeSeed");
const { buildReading } = require("../src/services/narrativeEngine");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickDistinct(count, min, max) {
  const set = new Set();
  while (set.size < count) set.add(randomInt(min, max));
  return Array.from(set);
}

async function runForUser(user) {
  const themes = ["amor", "salud", "dinero", "general"];
  const results = [];

  for (let i = 0; i < 5; i += 1) {
    const [a, b, c] = pickDistinct(3, 0, 21);
    const tema = themes[i % themes.length];
    const cards = [
      { id: a, posicion: "pasado", orientacion: i % 2 === 0 ? "upright" : "reversed" },
      { id: b, posicion: "presente", orientacion: i % 3 === 0 ? "reversed" : "upright" },
      { id: c, posicion: "futuro", orientacion: i % 4 === 0 ? "reversed" : "upright" }
    ];

    const reading = await buildReading({
      user,
      tirada: { cards },
      tema,
      perfil_tono: "mistico"
    });

    assert(reading.ok === true, "No se pudo construir la lectura.");
    assert(typeof reading.lectura === "string" && reading.lectura.length > 40, "Lectura vacía o muy corta.");

    results.push(reading.lectura);
  }

  return results;
}

async function main() {
  await initDb();
  await seedNarrativeData();

  const mujer = { nombre: "Lucía", genero: "mujer", nacimiento: "1991-02-16" };
  const hombre = { nombre: "Diego", genero: "hombre", nacimiento: "1991-02-16" };

  const mujerReadings = await runForUser(mujer);
  const hombreReadings = await runForUser(hombre);

  for (const t of mujerReadings) {
    assert(!t.includes("{o/a}") && !t.includes("{e/a}") && !t.includes("{nombre}"), "Placeholders sin reemplazar (mujer).");
    assert(t.includes("preparada"), "No se detectó 'preparada' para mujer.");
  }

  for (const t of hombreReadings) {
    assert(!t.includes("{o/a}") && !t.includes("{e/a}") && !t.includes("{nombre}"), "Placeholders sin reemplazar (hombre).");
    assert(t.includes("preparado"), "No se detectó 'preparado' para hombre.");
  }

  console.log("OK: Narrative Engine test pasó (5 tiradas por usuario).");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
