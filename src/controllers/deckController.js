const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");

const imgDir = path.join(__dirname, "..", "..", "public", "img");
const thumbDir = path.join(imgDir, "thumbs");

function cleanText(input) {
  return String(input || "").trim();
}

function slugifyDash(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveImageUrl(numero, nombre, imagenUrl) {
  const current = cleanText(imagenUrl);
  if (current) return current;

  if (Number.isInteger(numero)) {
    const n = String(numero);
    const candidates = [`${n}.webp`, `${n}.png`, `${n}.jpg`, `${n}.jpeg`];
    const existing = candidates.find((f) => fs.existsSync(path.join(imgDir, f)));
    const fileName = existing || candidates[0];
    return `/public/img/${fileName}`;
  }

  const base = slugifyDash(nombre);
  const candidates = [`${base}.webp`, `${base}.png`, `${base}.jpg`, `${base}.jpeg`];
  const existing = candidates.find((f) => fs.existsSync(path.join(imgDir, f)));
  const fileName = existing || candidates[0];
  return `/public/img/${fileName}`;
}

function resolveThumbUrl(numero, nombre, imagenThumbUrl, imagenUrlResolved) {
  const current = cleanText(imagenThumbUrl);
  if (current) return current;
  const source = cleanText(imagenUrlResolved);
  if (!source.startsWith("/public/img/")) return "";
  const file = source.replace(/^\/public\/img\//, "");
  const base = file.replace(/\.(png|jpe?g|webp)$/i, "");
  const candidate = `${base}.thumb.webp`;
  const candidatePath = path.join(thumbDir, candidate);
  if (fs.existsSync(candidatePath)) return `/public/img/thumbs/${candidate}`;
  if (Number.isInteger(numero)) return `/public/img/thumbs/${String(numero)}.thumb.webp`;
  return `/public/img/thumbs/${slugifyDash(nombre)}.thumb.webp`;
}

function normalizeDeckCsvKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeDeckCsvRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    const nk = normalizeDeckCsvKey(k);
    if (!nk) continue;
    out[nk] = v;
  }
  return out;
}

function detectDelimiter(line) {
  const sample = String(line || "");
  const commas = (sample.match(/,/g) || []).length;
  const semis = (sample.match(/;/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return "\t";
  if (semis >= commas && semis > 0) return ";";
  return ",";
}

function parseSeparatedValues(text, delimiter) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    const row = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (!inQuotes && ch === delimiter) {
        row.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    out.push(row);
  }
  return out;
}

function csvToObjects(csvText) {
  const normalized = String(csvText || "").trim();
  if (!normalized) return [];
  const firstLine = normalized.split(/\r?\n/, 1)[0] || "";
  const delimiter = detectDelimiter(firstLine);
  const table = parseSeparatedValues(normalized, delimiter);
  if (table.length < 2) return [];
  const headers = table[0].map((h) => String(h || "").trim());
  const objects = [];
  for (let i = 1; i < table.length; i += 1) {
    const row = table[i];
    const obj = {};
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c];
      if (!key) continue;
      obj[key] = row[c] ?? "";
    }
    objects.push(obj);
  }
  return objects;
}

function decodeUploadedTextBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return "";
  const utf8 = buffer.toString("utf8");
  if (utf8.includes("�")) return buffer.toString("latin1");
  return utf8;
}

function parseCsvBoolean(input, fallback = true) {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "t", "si", "sí", "yes", "y", "x"].includes(raw)) return true;
  if (["0", "false", "f", "no", "n"].includes(raw)) return false;
  return fallback;
}

function normalizeCardKind(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (["minor", "menor", "menores"].includes(raw)) return "minor";
  return "major";
}

async function index(req, res, next) {
  try {
    const decks = await db.models.Deck.findAll({
      where: { is_active: true },
      attributes: ["id", "slug", "nombre"],
      order: [["id", "ASC"]],
      raw: true
    });

    const deckIdRaw = req.query?.deck_id ?? req.query?.deckId;
    const deckId = Number(deckIdRaw);
    const defaultDeck = decks.find((d) => d.slug === "default") || decks[0] || null;
    const selectedDeck =
      Number.isInteger(deckId) && deckId > 0 ? decks.find((d) => d.id === deckId) || defaultDeck : defaultDeck;

    const deckCards = selectedDeck
      ? await db.models.DeckCard.findAll({
          where: { deck_id: selectedDeck.id, card_kind: "major", enabled: true },
          attributes: ["card_numero", "imagen_url", "imagen_thumb_url", "extra"],
          order: [["card_numero", "ASC"]],
          raw: true
        })
      : [];

    const numeros = deckCards.map((r) => Number(r.card_numero)).filter((n) => Number.isInteger(n));
    const byNumeroDeck = new Map(deckCards.map((r) => [Number(r.card_numero), r]));

    const arcanosRaw = numeros.length
      ? await db.MajorArcana.findAll({ where: { numero: numeros }, order: [["numero", "ASC"]], raw: true })
      : [];

    const arcanos = [];
    for (const a of arcanosRaw) {
      const override = byNumeroDeck.get(a.numero) || null;
      const overrideUrl = override ? String(override.imagen_url || "").trim() : "";
      const overrideThumb = override ? String(override.imagen_thumb_url || "").trim() : "";

      const baseImagenUrl = overrideUrl || resolveImageUrl(a.numero, a.nombre, a.imagen_url);
      const baseThumbUrl = overrideThumb || resolveThumbUrl(a.numero, a.nombre, a.imagen_thumb_url, baseImagenUrl);

      arcanos.push({
        ...a,
        imagen_url_resolved: baseImagenUrl,
        imagen_thumb_url_resolved: baseThumbUrl
      });
    }

    const import_created = Number(req.query?.import_created);
    const import_updated = Number(req.query?.import_updated);
    const import_skipped = Number(req.query?.import_skipped);
    const import_error = String(req.query?.import_error || "").trim();

    res.render("decks/index", {
      title: "Mazos",
      arcanos,
      hasArcanos: arcanos.length > 0,
      decks,
      selectedDeckId: selectedDeck ? selectedDeck.id : null,
      importResult:
        Number.isFinite(import_created) || Number.isFinite(import_updated) || Number.isFinite(import_skipped) || import_error
          ? {
              created: Number.isFinite(import_created) ? import_created : null,
              updated: Number.isFinite(import_updated) ? import_updated : null,
              skipped: Number.isFinite(import_skipped) ? import_skipped : null,
              error: import_error || null
            }
          : null
    });
  } catch (err) {
    next(err);
  }
}

async function importDeckCardsCsvFile(req, res) {
  try {
    const deck_id = Number(req.body?.deck_id ?? req.body?.deckId ?? req.query?.deck_id ?? req.query?.deckId);
    if (!Number.isInteger(deck_id) || deck_id <= 0) {
      return res.redirect(`/decks?import_error=${encodeURIComponent("deck_id inválido")}`);
    }

    const deck = await db.models.Deck.findByPk(deck_id, { raw: true });
    if (!deck) {
      return res.redirect(`/decks?import_error=${encodeURIComponent("mazo no encontrado")}`);
    }

    const csv = decodeUploadedTextBuffer(req.file?.buffer);
    const rows = csvToObjects(csv).map(normalizeDeckCsvRow);
    if (rows.length === 0) {
      return res.redirect(`/decks?deck_id=${deck_id}&import_error=${encodeURIComponent("CSV vacío")}`);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const r of rows) {
      const card_kind = normalizeCardKind(r.card_kind ?? r.kind ?? r.tipo ?? r.arcana_type);
      const card_numero = Number(r.card_numero ?? r.numero ?? r.id ?? r.card_id ?? r.arcano_id);
      if (!Number.isInteger(card_numero)) {
        skipped += 1;
        continue;
      }
      const enabled = parseCsvBoolean(r.enabled ?? r.activo ?? r.habilitado, true);
      const imagen_url = String(r.imagen_url ?? r.image_url ?? r.url ?? "").trim();
      const imagen_thumb_url = String(r.imagen_thumb_url ?? r.image_thumb_url ?? r.thumb_url ?? "").trim();

      const where = { deck_id, card_kind, card_numero };
      const existing = await db.models.DeckCard.findOne({ where, paranoid: false });
      if (existing) {
        if (existing.deletedAt) await existing.restore();
        existing.enabled = enabled;
        existing.imagen_url = imagen_url;
        existing.imagen_thumb_url = imagen_thumb_url;
        await existing.save();
        updated += 1;
      } else {
        await db.models.DeckCard.create({ deck_id, card_kind, card_numero, enabled, imagen_url, imagen_thumb_url, extra: {} });
        created += 1;
      }
    }

    return res.redirect(
      `/decks?deck_id=${deck_id}&import_created=${encodeURIComponent(String(created))}&import_updated=${encodeURIComponent(
        String(updated)
      )}&import_skipped=${encodeURIComponent(String(skipped))}`
    );
  } catch (err) {
    return res.redirect(`/decks?import_error=${encodeURIComponent(err?.message || "error importando CSV")}`);
  }
}

module.exports = { index, importDeckCardsCsvFile };

