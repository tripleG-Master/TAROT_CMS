const { buildReading } = require("../services/narrativeEngine");
const { seedNarrativeData } = require("../seed/narrativeSeed");
const db = require("../db");
const crypto = require("node:crypto");

async function threeCards(req, res) {
  const user = req.body?.user_data ?? req.body?.user ?? {};
  const tirada = req.body?.tirada ?? {};
  const tema = req.body?.tema ?? req.body?.contexto ?? "general";
  const perfil_tono = req.body?.perfil_tono ?? req.body?.tono ?? "";

  const result = await buildReading({ user, tirada, tema, perfil_tono });
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
}

async function seed(req, res) {
  const result = await seedNarrativeData();
  return res.json({ ok: true, result });
}

function todayInTimezoneDateOnly(timeZone) {
  const tz = String(timeZone || "").trim() || "UTC";
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

function pickDistinctFromHash(pool, count, hashHex) {
  const list = Array.isArray(pool) ? pool.slice() : [];
  const out = [];
  const seen = new Set();
  let cursor = 0;
  while (out.length < count && out.length < list.length) {
    const chunk = hashHex.slice(cursor, cursor + 8) || "0";
    cursor += 8;
    const n = parseInt(chunk, 16);
    const idx = Number.isFinite(n) ? n % list.length : 0;
    const val = list[idx];
    if (!seen.has(val)) {
      seen.add(val);
      out.push(val);
    } else {
      cursor += 8;
    }
  }
  if (out.length < count) {
    for (const v of list) {
      if (out.length >= count) break;
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}

async function dailyTarot(req, res) {
  try {
    const external_id = String(req.body?.external_id ?? req.body?.externalId ?? req.query?.external_id ?? req.query?.externalId ?? "").trim();
    let user_id = Number(req.body?.user_id ?? req.body?.userId ?? req.query?.user_id ?? req.query?.userId);
    const timezone = String(req.body?.timezone ?? req.query?.timezone ?? "UTC").trim() || "UTC";
    const locale = String(req.body?.locale ?? req.query?.locale ?? "es-CL").trim() || "es-CL";

    if ((!Number.isInteger(user_id) || user_id <= 0) && !external_id) {
      return res.status(400).json({ ok: false, error: "Se requiere external_id o user_id." });
    }

    if (!Number.isInteger(user_id) || user_id <= 0) {
      const existing = await db.models.User.findOne({ where: { external_id }, raw: true });
      if (existing) user_id = existing.id;
      else {
        const created = await db.models.User.create({ external_id, provider: "android" });
        user_id = created.id;
      }
    }

    const profile = await db.models.UserProfile.findOne({ where: { user_id }, raw: true });
    const user = {
      nombre: profile ? profile.nombre : "",
      genero: profile ? profile.genero : "neutro"
    };

    const dayKey = todayInTimezoneDateOnly(timezone);
    const seed = `${external_id || user_id}|${dayKey}|${locale}`;
    const hashHex = crypto.createHash("sha256").update(seed).digest("hex");

    const arcanaRows = await db.MajorArcana.findAll({ attributes: ["numero"], order: [["numero", "ASC"]], raw: true });
    const pool = arcanaRows.length ? arcanaRows.map((r) => Number(r.numero)).filter((n) => Number.isInteger(n)) : Array.from({ length: 22 }, (_, i) => i);
    const picked = pickDistinctFromHash(pool, 3, hashHex);
    if (picked.length !== 3) return res.status(400).json({ ok: false, error: "No hay suficientes arcanos para generar la tirada." });

    const oriBits = parseInt(hashHex.slice(0, 2), 16);
    const o1 = oriBits & 1 ? "reversed" : "upright";
    const o2 = oriBits & 2 ? "reversed" : "upright";
    const o3 = oriBits & 4 ? "reversed" : "upright";

    const ctxRows = await db.models.ArcanaMessage.findAll({ attributes: ["contexto"], group: ["contexto"], raw: true });
    const temas = ctxRows
      .map((r) => String(r?.contexto || "").trim().toLowerCase())
      .filter(Boolean);
    const tema = temas.includes("general") ? "general" : temas[0] || "general";

    const toneRowsMessages = await db.models.ArcanaMessage.findAll({ attributes: ["perfil_tono"], group: ["perfil_tono"], raw: true });
    const toneRowsConnectors = await db.models.Connector.findAll({ attributes: ["perfil"], group: ["perfil"], raw: true });
    const tones = Array.from(
      new Set(
        [...toneRowsMessages.map((r) => r?.perfil_tono), ...toneRowsConnectors.map((r) => r?.perfil)]
          .map((v) => String(v || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
    const pickTone = ["empatico", "directo", "mistico", "general"].find((t) => tones.includes(t));
    const perfil_tono = pickTone || "";

    const tirada = {
      cards: [
        { id: picked[0], posicion: "pasado", orientacion: o1 },
        { id: picked[1], posicion: "presente", orientacion: o2 },
        { id: picked[2], posicion: "futuro", orientacion: o3 }
      ]
    };

    const result = await buildReading({ user, tirada, tema, perfil_tono });
    if (!result.ok) return res.status(400).json(result);

    return res.json({
      ok: true,
      date: dayKey,
      timezone,
      locale,
      user_id,
      message: result?.reading?.intro || result?.lectura || "",
      cards: picked,
      reading: result.reading || undefined,
      tema: result.tema,
      perfil_tono: result.perfil_tono
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Error generando tarot diario." });
  }
}

module.exports = { threeCards, seed };
module.exports.dailyTarot = dailyTarot;

async function showConnectors(req, res, next) {
  try {
    const tipo = String(req.query?.tipo || "").trim();
    const polaridad = String(req.query?.polaridad || "").trim();
    const perfil = String(req.query?.perfil || "").trim();
    const deleted = Number(req.query?.deleted);
    const where = {};
    if (tipo) where.tipo = tipo;
    if (polaridad) where.polaridad = polaridad;
    if (perfil) where.perfil = perfil;
    const rows = await db.models.Connector.findAll({
      where,
      order: [["tipo", "ASC"], ["polaridad", "ASC"], ["perfil", "ASC"], ["peso", "DESC"], ["id", "ASC"]],
      raw: true
    });
    res.render("narrative/connectors", {
      title: "Conectores",
      rows,
      deleted: Number.isFinite(deleted) ? deleted : null,
      filters: { tipo, polaridad, perfil }
    });
  } catch (err) {
    next(err);
  }
}

async function showMessages(req, res, next) {
  try {
    const arcano_id = Number(req.query?.arcano_id);
    const posicion = String(req.query?.posicion || "").trim();
    const contexto = String(req.query?.contexto || "").trim();
    const perfil_tono = String(req.query?.perfil_tono || "").trim();
    const polaridad = String(req.query?.polaridad || "").trim();
    const sentido = String(req.query?.sentido || "").trim();
    const luz_sombra = String(req.query?.luz_sombra || "").trim();
    const deleted = Number(req.query?.deleted);
    const where = {};
    if (Number.isInteger(arcano_id)) where.arcano_id = arcano_id;
    if (posicion) where.posicion = posicion;
    if (contexto) where.contexto = contexto;
    if (perfil_tono) where.perfil_tono = perfil_tono;
    if (polaridad) where.polaridad = polaridad;
    if (sentido) where.sentido = sentido;
    if (luz_sombra) where.luz_sombra = luz_sombra;
    const rows = await db.models.ArcanaMessage.findAll({
      where,
      order: [
        ["arcano_id", "ASC"],
        ["posicion", "ASC"],
        ["contexto", "ASC"],
        ["perfil_tono", "ASC"],
        ["polaridad", "ASC"],
        ["sentido", "ASC"],
        ["luz_sombra", "ASC"],
        ["id", "ASC"]
      ],
      raw: true
    });
    res.render("narrative/messages", {
      title: "Mensajes",
      rows,
      deleted: Number.isFinite(deleted) ? deleted : null,
      filters: {
        arcano_id: Number.isInteger(arcano_id) ? arcano_id : "",
        posicion,
        contexto,
        perfil_tono,
        polaridad,
        sentido,
        luz_sombra
      }
    });
  } catch (err) {
    next(err);
  }
}

async function deleteAllConnectors(req, res, next) {
  try {
    const deleted = await db.models.Connector.destroy({ where: {}, truncate: true, force: true });
    return res.redirect(`/tarot/conectores?deleted=${encodeURIComponent(String(deleted || 0))}`);
  } catch (err) {
    next(err);
  }
}

async function deleteAllMessages(req, res, next) {
  try {
    const deleted = await db.models.ArcanaMessage.destroy({ where: {}, truncate: true, force: true });
    return res.redirect(`/tarot/mensajes?deleted=${encodeURIComponent(String(deleted || 0))}`);
  } catch (err) {
    next(err);
  }
}

module.exports.showConnectors = showConnectors;
module.exports.showMessages = showMessages;
module.exports.deleteAllConnectors = deleteAllConnectors;
module.exports.deleteAllMessages = deleteAllMessages;
