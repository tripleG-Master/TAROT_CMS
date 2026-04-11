const db = require("../db");

function showCalculo(req, res) {
  res.render("tarot/calculo", {
    title: "Cálculo de Tarot"
  });
}

async function showLectura(req, res, next) {
  try {
    const arcanos = await db.MajorArcana.findAll({
      attributes: ["numero", "nombre"],
      order: [["numero", "ASC"]],
      raw: true
    });

    res.render("tarot/lectura", {
      title: "Lectura (3 cartas)",
      arcanos,
      hasArcanos: arcanos.length > 0
    });
  } catch (err) {
    next(err);
  }
}

function showGemini(req, res) {
  res.render("tarot/gemini", {
    title: "Gemini (Prueba)"
  });
}

async function showGeminiGenerations(req, res, next) {
  try {
    const generations = await db.models.GeminiGeneration.findAll({
      order: [["createdAt", "DESC"]],
      limit: 100,
      raw: true
    });
    res.render("tarot/gemini_generations", { title: "Gemini · Generaciones", generations });
  } catch (err) {
    next(err);
  }
}

async function showGeminiTemplates(req, res, next) {
  try {
    const templates = await db.models.GeminiTemplate.findAll({
      order: [["createdAt", "DESC"]],
      raw: true
    });
    res.render("tarot/gemini_templates", { title: "Gemini · Plantillas", templates });
  } catch (err) {
    next(err);
  }
}

function todayUtcDateOnly() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function showUsers(req, res, next) {
  try {
    const users = await db.models.User.findAll({
      order: [["createdAt", "DESC"]],
      limit: 200,
      raw: true
    });
    const userIds = users.map((u) => u.id);

    const profiles = userIds.length
      ? await db.models.UserProfile.findAll({ where: { user_id: userIds }, raw: true })
      : [];
    const byUserIdProfile = new Map(profiles.map((p) => [p.user_id, p]));

    const entitlements = userIds.length
      ? await db.models.Entitlement.findAll({
          where: { user_id: userIds },
          order: [
            ["user_id", "ASC"],
            ["createdAt", "DESC"]
          ],
          raw: true
        })
      : [];
    const byUserIdEntitlement = new Map();
    for (const e of entitlements) {
      if (!byUserIdEntitlement.has(e.user_id)) byUserIdEntitlement.set(e.user_id, e);
    }

    const period = todayUtcDateOnly();
    const usage = userIds.length ? await db.models.UsageCounter.findAll({ where: { user_id: userIds, period }, raw: true }) : [];
    const byUserIdUsage = new Map(usage.map((u) => [u.user_id, u]));

    const rows = users.map((u) => {
      const p = byUserIdProfile.get(u.id) || null;
      const e = byUserIdEntitlement.get(u.id) || null;
      const us = byUserIdUsage.get(u.id) || null;
      return {
        id: u.id,
        external_id: u.external_id,
        provider: u.provider,
        createdAt: u.createdAt,
        profile: p
          ? {
              nombre: p.nombre,
              genero: p.genero,
              birthdate: p.birthdate,
              zodiac: p.zodiac,
              life_path: p.life_path,
              birth_arcana: p.birth_arcana
            }
          : null,
        entitlement: e ? { plan: e.plan, status: e.status, expires_at: e.expires_at } : null,
        usage: us ? { period: us.period, requests: us.requests, tokens_total: us.tokens_total } : { period, requests: 0, tokens_total: 0 }
      };
    });

    res.render("tarot/users", { title: "Usuarios", rows, period });
  } catch (err) {
    next(err);
  }
}

module.exports = { showCalculo, showLectura, showGemini, showGeminiGenerations, showGeminiTemplates, showUsers };
