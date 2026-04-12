const db = require("../db");

const POSITIONS = new Set(["pasado", "presente", "futuro"]);
const CONTEXTS = new Set(["amor", "salud", "dinero", "general"]);
const PROFILES = new Set(["empatico", "directo", "mistico", "general"]);

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

function messagePolarityFromOrientation(orientation) {
  const p = polarityFromOrientation(orientation);
  if (p === "positivo") return "favorable";
  if (p === "negativo") return "desafiante";
  return "neutra";
}

function sentidoFromOrientation(orientation) {
  const raw = String(orientation || "").trim().toLowerCase();
  if (["upright", "derecho", "positivo", "pos", "light", "luz"].includes(raw)) return "derecho";
  if (["reversed", "invertido", "invertida", "negativo", "neg", "shadow", "sombra"].includes(raw)) return "invertido";
  return "neutro";
}

function connectorPolarity(a, b) {
  if (a === "neutro" || b === "neutro") return "neutro";
  if (a === "positivo" && b === "positivo") return "pos_pos";
  if (a === "positivo" && b === "negativo") return "pos_neg";
  if (a === "negativo" && b === "positivo") return "neg_pos";
  if (a === "negativo" && b === "negativo") return "neg_neg";
  return "neutro";
}

function normalizeContext(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (CONTEXTS.has(raw)) return raw;
  return "general";
}

function normalizeProfile(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "empático") return "empatico";
  if (raw === "místico") return "mistico";
  if (PROFILES.has(raw)) return raw;
  return "";
}

function randomProfile() {
  const all = ["empatico", "directo", "mistico"];
  return all[Math.floor(Math.random() * all.length)];
}

function pickWeighted(rows) {
  const items = (rows || []).map((r) => ({ row: r, peso: Number(r.peso) || 1 }));
  const total = items.reduce((acc, x) => acc + Math.max(1, x.peso), 0);
  if (total <= 0 || items.length === 0) return null;
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(1, item.peso);
    if (roll <= 0) return item.row;
  }
  return items[items.length - 1].row;
}

async function pickRandomConnector(tipo, polaridad, perfil) {
  const { Connector } = db.models;

  const p = normalizeProfile(perfil) || "general";
  const fallbacks = [
    { tipo, polaridad, perfil: p },
    { tipo, polaridad, perfil: "general" },
    { tipo, polaridad: "neutro", perfil: p },
    { tipo, polaridad: "neutro", perfil: "general" },
    { tipo, perfil: p },
    { tipo, perfil: "general" },
    { tipo }
  ];

  for (const where of fallbacks) {
    const rows = await Connector.findAll({ where, raw: true });
    if (rows.length > 0) return pickWeighted(rows);
  }
  return null;
}

async function pickRandomArcanaMessage({ arcano_id, posicion, contexto, perfil_tono, polaridad, sentido }) {
  const { ArcanaMessage } = db.models;

  const tone = normalizeProfile(perfil_tono);
  const whereBase = { arcano_id, posicion };
  const ctx = normalizeContext(contexto);
  const polRaw = String(polaridad || "").trim().toLowerCase();
  const senRaw = String(sentido || "").trim().toLowerCase();
  const polarities = ["favorable", "desafiante", "neutra"].includes(polRaw) ? [polRaw] : [];
  const senses = ["derecho", "invertido", "neutro"].includes(senRaw) ? [senRaw] : [];

  const variants = [];
  if (tone && polarities.length > 0 && senses.length > 0) {
    for (const p of polarities) for (const s of senses) variants.push({ ...whereBase, contexto: ctx, perfil_tono: tone, polaridad: p, sentido: s });
  }
  if (polarities.length > 0 && senses.length > 0) {
    for (const p of polarities) for (const s of senses) variants.push({ ...whereBase, contexto: ctx, polaridad: p, sentido: s });
  }
  if (tone) variants.push({ ...whereBase, contexto: ctx, perfil_tono: tone });
  variants.push({ ...whereBase, contexto: ctx });
  if (tone && polarities.length > 0 && senses.length > 0) {
    for (const p of polarities) for (const s of senses) variants.push({ ...whereBase, contexto: "general", perfil_tono: tone, polaridad: p, sentido: s });
  }
  if (polarities.length > 0 && senses.length > 0) {
    for (const p of polarities) for (const s of senses) variants.push({ ...whereBase, contexto: "general", polaridad: p, sentido: s });
  }
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
  const profile = normalizeProfile(perfil_tono) || randomProfile();

  const p1 = polarityFromOrientation(cards.pasado.orientation);
  const p2 = polarityFromOrientation(cards.presente.orientation);
  const p3 = polarityFromOrientation(cards.futuro.orientation);
  const s1 = sentidoFromOrientation(cards.pasado.orientation);
  const s2 = sentidoFromOrientation(cards.presente.orientation);
  const s3 = sentidoFromOrientation(cards.futuro.orientation);

  const intro = await pickRandomConnector("intro", "neutro", profile);
  const conn12 = await pickRandomConnector("pasado_presente", connectorPolarity(p1, p2), profile);
  const conn23 = await pickRandomConnector("presente_futuro", connectorPolarity(p2, p3), profile);
  const cierre = await pickRandomConnector(
    "cierre",
    p3 === "neutro" ? "neutro" : p3 === "positivo" ? "pos_pos" : "neg_neg",
    profile
  );

  const m1 = await pickRandomArcanaMessage({
    arcano_id: cards.pasado.arcano_id,
    posicion: "pasado",
    contexto: context,
    perfil_tono: profile,
    polaridad: messagePolarityFromOrientation(cards.pasado.orientation),
    sentido: s1
  });
  const m2 = await pickRandomArcanaMessage({
    arcano_id: cards.presente.arcano_id,
    posicion: "presente",
    contexto: context,
    perfil_tono: profile,
    polaridad: messagePolarityFromOrientation(cards.presente.orientation),
    sentido: s2
  });
  const m3 = await pickRandomArcanaMessage({
    arcano_id: cards.futuro.arcano_id,
    posicion: "futuro",
    contexto: context,
    perfil_tono: profile,
    polaridad: messagePolarityFromOrientation(cards.futuro.orientation),
    sentido: s3
  });

  if (!m1 || !m2 || !m3) {
    return {
      ok: false,
      error: "No hay mensajes suficientes en mensajes_arcanos para armar la tirada."
    };
  }

  const ctx = { nombre: user?.nombre ?? user?.name, genero: user?.genero ?? user?.gender };

  const reading = {
    intro: intro ? applyPlaceholders(intro.texto, ctx) : "",
    pasado: applyPlaceholders(m1.contenido, ctx),
    presente: applyPlaceholders(m2.contenido, ctx),
    futuro: applyPlaceholders(m3.contenido, ctx),
    cierre: cierre ? applyPlaceholders(cierre.texto, ctx) : ""
  };

  const parts = [reading.intro, reading.pasado, conn12 ? applyPlaceholders(conn12.texto, ctx) : "", reading.presente, conn23 ? applyPlaceholders(conn23.texto, ctx) : "", reading.futuro, reading.cierre].filter(Boolean);

  const text = parts.join(" ").replace(/\s+/g, " ").trim();

  return {
    ok: true,
    tema: context,
    perfil_tono: profile,
    lectura: text,
    reading,
    debug: {
      cards: {
        pasado: { ...cards.pasado, polaridad: messagePolarityFromOrientation(cards.pasado.orientation), sentido: s1 },
        presente: { ...cards.presente, polaridad: messagePolarityFromOrientation(cards.presente.orientation), sentido: s2 },
        futuro: { ...cards.futuro, polaridad: messagePolarityFromOrientation(cards.futuro.orientation), sentido: s3 }
      },
      message_ids: { pasado: m1.id, presente: m2.id, futuro: m3.id },
      connector_ids: {
        intro: intro ? intro.id : null,
        pasado_presente: conn12 ? conn12.id : null,
        presente_futuro: conn23 ? conn23.id : null,
        cierre: cierre ? cierre.id : null
      }
    }
  };
}

module.exports = { buildReading };
