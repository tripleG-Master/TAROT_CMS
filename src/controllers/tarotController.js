const db = require("../db");
const { normalizeAppConfigPayload, appConfigEtag, APP_CONFIG_SCHEMA_VERSION } = require("../services/appConfig");

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

    const decks = await db.models.Deck.findAll({
      where: { is_active: true },
      attributes: ["id", "slug", "nombre"],
      order: [["id", "ASC"]],
      raw: true
    });
    const deckCards = decks.length
      ? await db.models.DeckCard.findAll({
          where: { deck_id: decks.map((d) => d.id), card_kind: "major", enabled: true },
          attributes: ["deck_id", "card_numero"],
          order: [["deck_id", "ASC"], ["card_numero", "ASC"]],
          raw: true
        })
      : [];
    const byDeck = new Map();
    for (const r of deckCards) {
      const id = Number(r.deck_id);
      if (!byDeck.has(id)) byDeck.set(id, []);
      byDeck.get(id).push(Number(r.card_numero));
    }
    const deckOptions = decks.map((d) => ({
      id: d.id,
      slug: d.slug,
      nombre: d.nombre,
      card_numeros: byDeck.get(d.id) || []
    }));
    const defaultDeck = deckOptions.find((d) => d.slug === "default") || deckOptions[0] || null;

    const temaRows = await db.models.ArcanaMessage.findAll({
      attributes: ["contexto"],
      group: ["contexto"],
      raw: true
    });
    const temasSet = new Set(
      temaRows
        .map((r) => String(r?.contexto || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const temaOrder = ["general", "amor", "dinero", "salud"];
    const temasSorted = Array.from(temasSet).sort((a, b) => {
      const ia = temaOrder.indexOf(a);
      const ib = temaOrder.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });
    const selectedTema = temasSorted.includes("general") ? "general" : temasSorted[0] || "";
    const temas = temasSorted.map((value) => ({
      value,
      label: value ? value.charAt(0).toUpperCase() + value.slice(1) : value,
      selected: value === selectedTema
    }));

    const tonoRowsMessages = await db.models.ArcanaMessage.findAll({
      attributes: ["perfil_tono"],
      group: ["perfil_tono"],
      raw: true
    });
    const tonoRowsConnectors = await db.models.Connector.findAll({
      attributes: ["perfil"],
      group: ["perfil"],
      raw: true
    });
    const tonosSet = new Set(
      [...tonoRowsMessages.map((r) => r?.perfil_tono), ...tonoRowsConnectors.map((r) => r?.perfil)]
        .map((v) => String(v || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const tonoOrder = ["general", "empatico", "directo", "mistico"];
    const tonosSorted = Array.from(tonosSet).sort((a, b) => {
      const ia = tonoOrder.indexOf(a);
      const ib = tonoOrder.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });
    const tonoLabels = new Map([
      ["general", "General"],
      ["empatico", "Empático"],
      ["directo", "Directo"],
      ["mistico", "Místico"]
    ]);
    const tonos = tonosSorted.map((value) => ({
      value,
      label: tonoLabels.get(value) || (value ? value.charAt(0).toUpperCase() + value.slice(1) : value)
    }));

    res.render("tarot/lectura", {
      title: "Lectura (3 cartas)",
      arcanos,
      hasArcanos: arcanos.length > 0,
      temas,
      tonos,
      decks: deckOptions,
      defaultDeckId: defaultDeck ? defaultDeck.id : null
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

async function showContent(req, res, next) {
  try {
    const row = await db.models.AppConfig.findByPk(1, { raw: true });
    const payload = normalizeAppConfigPayload(row?.payload || {});
    const payloadText = JSON.stringify(payload, null, 2);
    res.render("tarot/content", {
      title: "Contenido App",
      saved: String(req.query?.saved || "").trim() === "1",
      error: String(req.query?.error || "").trim() || "",
      app_config: {
        id: 1,
        schema_version: row?.schema_version ?? APP_CONFIG_SCHEMA_VERSION,
        etag: appConfigEtag(payload),
        updatedAt: row?.updatedAt || null
      },
      payloadText
    });
  } catch (err) {
    next(err);
  }
}

async function updateAppConfig(req, res) {
  try {
    const raw = String(req.body?.payload || "").trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.redirect(`/tarot/content?error=${encodeURIComponent("JSON inválido")}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return res.redirect(`/tarot/content?error=${encodeURIComponent("payload debe ser un objeto JSON")}`);
    }

    const normalized = normalizeAppConfigPayload(parsed);
    normalized.updated_at = new Date().toISOString();
    const schema_version = APP_CONFIG_SCHEMA_VERSION;
    const etag = appConfigEtag(normalized);

    const row = await db.models.AppConfig.findByPk(1);
    if (row) {
      row.schema_version = schema_version;
      row.payload = normalized;
      row.etag = etag;
      await row.save();
    } else {
      await db.models.AppConfig.create({ id: 1, schema_version, payload: normalized, etag });
    }

    return res.redirect("/tarot/content?saved=1");
  } catch (err) {
    return res.redirect(`/tarot/content?error=${encodeURIComponent(err?.message || "error guardando")}`);
  }
}

async function showTarotTypes(req, res, next) {
  try {
    const decks = await db.models.Deck.findAll({
      where: { is_active: true },
      attributes: ["id", "slug", "nombre"],
      order: [["id", "ASC"]],
      raw: true
    });
    const deckCards = decks.length
      ? await db.models.DeckCard.findAll({
          where: { deck_id: decks.map((d) => d.id), card_kind: "major", enabled: true },
          attributes: ["deck_id", "card_numero"],
          order: [["deck_id", "ASC"], ["card_numero", "ASC"]],
          raw: true
        })
      : [];
    const byDeck = new Map();
    for (const r of deckCards) {
      const id = Number(r.deck_id);
      if (!byDeck.has(id)) byDeck.set(id, []);
      byDeck.get(id).push(Number(r.card_numero));
    }
    const deckOptions = decks.map((d) => ({
      id: d.id,
      slug: d.slug,
      nombre: d.nombre,
      card_numeros: byDeck.get(d.id) || []
    }));
    const defaultDeck = deckOptions.find((d) => d.slug === "default") || deckOptions[0] || null;

    res.render("tarot/types", {
      title: "Tarot · Tipos (Android)",
      decks: deckOptions,
      defaultDeckId: defaultDeck ? defaultDeck.id : null
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showCalculo,
  showLectura,
  showTarotTypes,
  showGemini,
  showGeminiGenerations,
  showGeminiTemplates,
  showUsers,
  showContent,
  updateAppConfig
};
