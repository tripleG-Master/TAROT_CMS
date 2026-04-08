const { buildReading } = require("../services/narrativeEngine");
const { seedNarrativeData } = require("../seed/narrativeSeed");
const db = require("../db");

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

module.exports = { threeCards, seed };

async function showConnectors(req, res, next) {
  try {
    const tipo = String(req.query?.tipo || "").trim();
    const polaridad = String(req.query?.polaridad || "").trim();
    const where = {};
    if (tipo) where.tipo = tipo;
    if (polaridad) where.polaridad = polaridad;
    const rows = await db.models.Connector.findAll({
      where,
      order: [["tipo", "ASC"], ["polaridad", "ASC"], ["id", "ASC"]],
      raw: true
    });
    res.render("narrative/connectors", {
      title: "Conectores",
      rows,
      filters: { tipo, polaridad }
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
    const where = {};
    if (Number.isInteger(arcano_id)) where.arcano_id = arcano_id;
    if (posicion) where.posicion = posicion;
    if (contexto) where.contexto = contexto;
    if (perfil_tono) where.perfil_tono = perfil_tono;
    const rows = await db.models.ArcanaMessage.findAll({
      where,
      order: [["arcano_id", "ASC"], ["posicion", "ASC"], ["contexto", "ASC"], ["perfil_tono", "ASC"], ["id", "ASC"]],
      raw: true
    });
    res.render("narrative/messages", {
      title: "Mensajes",
      rows,
      filters: { arcano_id: Number.isInteger(arcano_id) ? arcano_id : "", posicion, contexto, perfil_tono }
    });
  } catch (err) {
    next(err);
  }
}

module.exports.showConnectors = showConnectors;
module.exports.showMessages = showMessages;
