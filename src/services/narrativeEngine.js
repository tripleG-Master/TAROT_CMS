const db = require("../db");

const POSITIONS = new Set(["pasado", "presente", "futuro"]);
const CONTEXTS = new Set(["amor", "salud", "dinero", "general"]);
const TONES = new Set(["empático", "directo", "místico"]);

function normalizeGender(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "neutro";
  if (["m", "masculino", "hombre", "male"].includes(raw)) return "hombre";
  if (["f", "femenino", "mujer", "female"].includes(raw)) return "mujer";
  return "neutro";
}

function applyPlaceholders(text, { nombre, genero }) {
  const name = String(nombre || "").trim();
  const g = normalizeGender(genero);
  const o = g === "mujer" ? "a" : g === "hombre" ? "o" : "o/a";
  const e = g === "mujer" ? "a" : g === "hombre" ? "e" : "e/a";

  return String(text || "")
    .replace(/\{nombre\}/g, name || "tu")
    .replace(/\{o\/a\}/g, o)
    .replace(/\{e\/a\}/g, e)
    .replace(/\s+/g, " ")
    .trim();
}

function polarityFromOrientation(orientation) {
  const raw = String(orientation || "").trim().toLowerCase();
  if (["upright", "derecho", "positivo", "pos", "light", "luz"].includes(raw)) return "positivo";
  if (["reversed", "invertido", "negativo", "neg", "shadow", "sombra"].includes(raw)) return "negativo";
  return "neutro";
}

function connectorPolarity(a, b) {
  if (a === "neutro" || b === "neutro") return "neutro";
  if (a === "positivo" && b === "positivo") return "positivo_positivo";
  if (a === "positivo" && b === "negativo") return "positivo_negativo";
  if (a === "negativo" && b === "positivo") return "negativo_positivo";
  if (a === "negativo" && b === "negativo") return "negativo_negativo";
  return "neutro";
}

function normalizeContext(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (CONTEXTS.has(raw)) return raw;
  return "general";
}

function normalizeTone(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "empatico") return "empático";
  if (TONES.has(raw)) return raw;
  return "";
}

function randomTone() {
  const all = ["empático", "directo", "místico"];
  return all[Math.floor(Math.random() * all.length)];
}

async function pickRandomConnector(tipo, polaridad) {
  const { Connector } = db.models;
  const row =
    (await Connector.findOne({
      where: { tipo, polaridad },
      order: db.sequelize.random(),
      raw: true
    })) ||
    (await Connector.findOne({
      where: { tipo, polaridad: "neutro" },
      order: db.sequelize.random(),
      raw: true
    })) ||
    (await Connector.findOne({
      where: { tipo },
      order: db.sequelize.random(),
      raw: true
    }));
  return row;
}

async function pickRandomArcanaMessage({ arcano_id, posicion, contexto, perfil_tono }) {
  const { ArcanaMessage } = db.models;

  const tone = normalizeTone(perfil_tono);
  const whereBase = { arcano_id, posicion };
  const ctx = normalizeContext(contexto);

  const variants = [];
  if (tone) variants.push({ ...whereBase, contexto: ctx, perfil_tono: tone });
  variants.push({ ...whereBase, contexto: ctx });
  if (tone) variants.push({ ...whereBase, contexto: "general", perfil_tono: tone });
  variants.push({ ...whereBase, contexto: "general" });

  for (const where of variants) {
    const row = await ArcanaMessage.findOne({ where, order: db.sequelize.random(), raw: true });
    if (row) return row;
  }

  return null;
}

function normalizeCard(input) {
  const id = Number(input?.id ?? input?.arcano_id ?? input?.arcanoId ?? input?.numero);
  const arcano_id = Number.isInteger(id) ? id : null;
  const posicion = String(input?.posicion || "").trim().toLowerCase();
  const orientation = input?.orientacion ?? input?.orientation ?? "";
  if (!arcano_id && arcano_id !== 0) return null;
  if (!POSITIONS.has(posicion)) return null;
  return { arcano_id, posicion, orientation };
}

function ensureThreeCards(cards) {
  const normalized = (Array.isArray(cards) ? cards : []).map(normalizeCard).filter(Boolean);
  const byPos = new Map(normalized.map((c) => [c.posicion, c]));
  const pasado = byPos.get("pasado");
  const presente = byPos.get("presente");
  const futuro = byPos.get("futuro");
  if (!pasado || !presente || !futuro) return null;
  return { pasado, presente, futuro };
}

async function buildReading({ user, tirada, tema, perfil_tono }) {
  const cards = ensureThreeCards(tirada?.cards);
  if (!cards) {
    return {
      ok: false,
      error: "tirada inválida. Se requiere cards con 3 entradas: pasado/presente/futuro."
    };
  }

  const context = normalizeContext(tema);
  const tone = normalizeTone(perfil_tono) || randomTone();

  const p1 = polarityFromOrientation(cards.pasado.orientation);
  const p2 = polarityFromOrientation(cards.presente.orientation);
  const p3 = polarityFromOrientation(cards.futuro.orientation);

  const conn12 = await pickRandomConnector("pasado_presente", connectorPolarity(p1, p2));
  const conn23 = await pickRandomConnector("presente_futuro", connectorPolarity(p2, p3));
  const cierre = await pickRandomConnector("cierre", p3 === "neutro" ? "neutro" : p3 === "positivo" ? "positivo_positivo" : "negativo_negativo");

  const m1 = await pickRandomArcanaMessage({
    arcano_id: cards.pasado.arcano_id,
    posicion: "pasado",
    contexto: context,
    perfil_tono: tone
  });
  const m2 = await pickRandomArcanaMessage({
    arcano_id: cards.presente.arcano_id,
    posicion: "presente",
    contexto: context,
    perfil_tono: tone
  });
  const m3 = await pickRandomArcanaMessage({
    arcano_id: cards.futuro.arcano_id,
    posicion: "futuro",
    contexto: context,
    perfil_tono: tone
  });

  if (!m1 || !m2 || !m3) {
    return {
      ok: false,
      error: "No hay mensajes suficientes en mensajes_arcanos para armar la tirada."
    };
  }

  const ctx = { nombre: user?.nombre ?? user?.name, genero: user?.genero ?? user?.gender };

  const parts = [
    applyPlaceholders(m1.contenido, ctx),
    conn12 ? applyPlaceholders(conn12.texto, ctx) : "",
    applyPlaceholders(m2.contenido, ctx),
    conn23 ? applyPlaceholders(conn23.texto, ctx) : "",
    applyPlaceholders(m3.contenido, ctx),
    cierre ? applyPlaceholders(cierre.texto, ctx) : ""
  ].filter(Boolean);

  const text = parts.join(" ").replace(/\s+/g, " ").trim();

  return {
    ok: true,
    tema: context,
    perfil_tono: tone,
    lectura: text,
    debug: {
      cards: {
        pasado: { ...cards.pasado, polaridad: p1 },
        presente: { ...cards.presente, polaridad: p2 },
        futuro: { ...cards.futuro, polaridad: p3 }
      },
      message_ids: { pasado: m1.id, presente: m2.id, futuro: m3.id },
      connector_ids: {
        pasado_presente: conn12 ? conn12.id : null,
        presente_futuro: conn23 ? conn23.id : null,
        cierre: cierre ? cierre.id : null
      }
    }
  };
}

module.exports = { buildReading };
