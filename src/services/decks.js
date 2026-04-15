const db = require("../db");

async function getDefaultDeck() {
  const row = await db.models.Deck.findOne({ where: { slug: "default" }, raw: true });
  return row || null;
}

async function getDeckById(deck_id) {
  const id = Number(deck_id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const row = await db.models.Deck.findByPk(id, { raw: true });
  return row || null;
}

async function resolveDeck(deck_id) {
  const byId = await getDeckById(deck_id);
  if (byId) return byId;
  return getDefaultDeck();
}

async function getDeckAllowedCardNumeros(deck_id, card_kind) {
  const deck = await resolveDeck(deck_id);
  if (!deck) return [];
  const kind = String(card_kind || "major").trim().toLowerCase() === "minor" ? "minor" : "major";
  const rows = await db.models.DeckCard.findAll({
    where: { deck_id: deck.id, card_kind: kind, enabled: true },
    attributes: ["card_numero"],
    order: [["card_numero", "ASC"]],
    raw: true
  });
  return rows.map((r) => Number(r.card_numero)).filter((n) => Number.isInteger(n));
}

async function assertCardsInDeck({ deck_id, card_kind, numeros }) {
  const list = Array.isArray(numeros) ? numeros : [];
  if (list.length === 0) return { ok: true, deck: await resolveDeck(deck_id) };
  const deck = await resolveDeck(deck_id);
  if (!deck) return { ok: false, error: "deck no encontrado" };
  const allowed = new Set(await getDeckAllowedCardNumeros(deck.id, card_kind));
  const invalid = list.filter((n) => !allowed.has(n));
  if (invalid.length > 0) {
    return { ok: false, error: `cartas fuera del mazo: ${invalid.slice(0, 10).join(", ")}` };
  }
  return { ok: true, deck };
}

async function resolveCardImage({ deck_id, card_kind, card_numero }) {
  const deck = await resolveDeck(deck_id);
  const kind = String(card_kind || "major").trim().toLowerCase() === "minor" ? "minor" : "major";
  const numero = Number(card_numero);
  if (!deck || !Number.isInteger(numero)) return null;
  const row = await db.models.DeckCard.findOne({
    where: { deck_id: deck.id, card_kind: kind, card_numero: numero },
    attributes: ["imagen_url", "imagen_thumb_url", "extra"],
    raw: true
  });
  if (!row) return null;
  const imagen_url = String(row.imagen_url || "").trim();
  const imagen_thumb_url = String(row.imagen_thumb_url || "").trim();
  const extra = row.extra && typeof row.extra === "object" ? row.extra : {};
  const gallery = Array.isArray(extra.image_gallery) ? extra.image_gallery : [];
  return { imagen_url, imagen_thumb_url, image_gallery: gallery };
}

module.exports = {
  resolveDeck,
  getDeckAllowedCardNumeros,
  assertCardsInDeck,
  resolveCardImage
};

