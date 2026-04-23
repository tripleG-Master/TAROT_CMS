const db = require("../db");
const { normalizeAppConfigPayload, appConfigEtag, APP_CONFIG_SCHEMA_VERSION } = require("../services/appConfig");
const { parseBirthdate, getZodiacByBirthdate } = require("../services/zodiac");
const { lifePathNumber, birthArcanaFromBirthdate } = require("../services/numerology");
const { Op } = require("sequelize");

function showCalculo(req, res) {
  res.render("tarot/calculo", {
    title: "Cálculo de Tarot"
  });
}

function normalizeGenero(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (["m", "masculino", "hombre", "male"].includes(raw)) return "hombre";
  if (["f", "femenino", "mujer", "female"].includes(raw)) return "mujer";
  return "neutro";
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

async function showTarotTypes(req, res, next) {
  try {
    const decks = await db.models.Deck.findAll({
      where: { is_active: true },
      attributes: ["id", "slug", "nombre"],
      order: [["id", "ASC"]],
      raw: true
    });
    const defaultDeck = decks.find((d) => d.slug === "default") || decks[0] || null;

    res.render("tarot/types", {
      title: "Tipos (Android)",
      decks,
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
    const user_id = Number(req.query?.user_id);
    const where = {};
    if (Number.isInteger(user_id) && user_id > 0) where.user_id = user_id;
    const generations = await db.models.GeminiGeneration.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: 100,
      raw: true
    });
    res.render("tarot/gemini_generations", {
      title: "Gemini · Generaciones",
      generations,
      filters: { user_id: Number.isInteger(user_id) && user_id > 0 ? String(user_id) : "" }
    });
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
    const filterUserId = Number(req.query?.user_id);
    const q = String(req.query?.q || "").trim();
    const saved = String(req.query?.saved || "").trim() === "1";
    const deleted = Number(req.query?.deleted);
    const error = String(req.query?.error || "").trim();
    const where =
      Number.isInteger(filterUserId) && filterUserId > 0
        ? { id: filterUserId }
        : q
          ? { external_id: { [Op.iLike]: `%${q}%` } }
          : {};
    const users = await db.models.User.findAll({
      where,
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

    res.render("tarot/users", {
      title: "Usuarios",
      rows,
      period,
      saved,
      deleted: Number.isFinite(deleted) ? deleted : null,
      error,
      filters: {
        user_id: Number.isInteger(filterUserId) && filterUserId > 0 ? String(filterUserId) : "",
        q
      }
    });
  } catch (err) {
    next(err);
  }
}

async function showUserEdit(req, res, next) {
  try {
    const id = Number(req.params?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).render("notFound", { title: "No encontrado" });
    const error = String(req.query?.error || "").trim();

    const user = await db.models.User.findByPk(id, { raw: true });
    if (!user) return res.status(404).render("notFound", { title: "No encontrado" });

    const profile = await db.models.UserProfile.findOne({ where: { user_id: id }, raw: true });
    const entitlement = await db.models.Entitlement.findOne({ where: { user_id: id }, order: [["createdAt", "DESC"]], raw: true });

    res.render("tarot/user_edit", {
      title: `Editar Usuario ${id}`,
      formAction: `/tarot/users/${id}?_method=PUT`,
      deleteAction: `/tarot/users/${id}?_method=DELETE`,
      user,
      profile: profile || null,
      entitlement: entitlement || null,
      error
    });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const id = Number(req.params?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).render("notFound", { title: "No encontrado" });

    const user = await db.models.User.findByPk(id);
    if (!user) return res.status(404).render("notFound", { title: "No encontrado" });

    const external_id = String(req.body?.external_id ?? "").trim();
    const provider = String(req.body?.provider ?? "").trim();

    if (external_id && external_id !== String(user.external_id || "")) {
      const existing = await db.models.User.findOne({ where: { external_id, id: { [Op.ne]: id } }, raw: true });
      if (existing) return res.redirect(`/tarot/users/${id}/edit?error=${encodeURIComponent("external_id ya existe")}`);
      user.external_id = external_id;
    }
    if (provider) user.provider = provider;
    await user.save();

    const nombre = String(req.body?.nombre ?? "").trim();
    const genero = normalizeGenero(req.body?.genero);
    const birthdateRaw = String(req.body?.birthdate ?? "").trim();
    const birthdateParsed = birthdateRaw ? parseBirthdate(birthdateRaw) : null;
    if (birthdateRaw && !birthdateParsed) {
      return res.redirect(`/tarot/users/${id}/edit?error=${encodeURIComponent("birthdate inválida (YYYY-MM-DD o DD/MM/YYYY o DD-MM-YYYY)")}`);
    }

    const zodiac = birthdateParsed ? getZodiacByBirthdate(birthdateRaw) : null;
    const lifePath = birthdateParsed ? lifePathNumber(birthdateParsed) : null;
    const life_path = Number.isInteger(lifePath?.value) ? lifePath.value : null;
    const birthArcana = birthdateParsed ? birthArcanaFromBirthdate(birthdateParsed) : null;
    const birth_arcana = birthArcana && Number.isInteger(birthArcana.major_arcana_numero) ? birthArcana.major_arcana_numero : null;

    const birthdateIso = birthdateParsed
      ? zodiac
        ? zodiac.birthdate
        : `${String(birthdateParsed.year).padStart(4, "0")}-${String(birthdateParsed.month).padStart(2, "0")}-${String(birthdateParsed.day).padStart(2, "0")}`
      : null;
    const zodiacText = zodiac ? String(zodiac.sign?.name_es || "").trim() : "";

    const profileRow = await db.models.UserProfile.findOne({ where: { user_id: id } });
    if (profileRow) {
      profileRow.nombre = nombre;
      profileRow.genero = genero;
      profileRow.birthdate = birthdateIso;
      profileRow.zodiac = zodiacText;
      profileRow.life_path = life_path;
      profileRow.birth_arcana = birth_arcana;
      await profileRow.save();
    } else {
      await db.models.UserProfile.create({
        user_id: id,
        nombre,
        genero,
        birthdate: birthdateIso,
        zodiac: zodiacText,
        life_path,
        birth_arcana
      });
    }

    const plan = String(req.body?.plan ?? "").trim().toLowerCase();
    const status = String(req.body?.status ?? "").trim().toLowerCase();
    const expires_at_raw = String(req.body?.expires_at ?? "").trim();
    const expires_at = expires_at_raw ? new Date(expires_at_raw) : null;
    const expires_at_value = expires_at && !Number.isNaN(expires_at.getTime()) ? expires_at.toISOString() : null;

    if (plan || status || expires_at_raw) {
      const current = await db.models.Entitlement.findOne({ where: { user_id: id }, order: [["createdAt", "DESC"]], raw: true });
      const nextPlan = plan || String(current?.plan || "free");
      const nextStatus = status || String(current?.status || "active");
      const currentExpires = current?.expires_at ? new Date(current.expires_at).toISOString() : null;
      const changed = nextPlan !== String(current?.plan || "") || nextStatus !== String(current?.status || "") || currentExpires !== expires_at_value;
      if (changed) {
        await db.models.Entitlement.create({
          user_id: id,
          plan: nextPlan || "free",
          status: nextStatus || "active",
          provider: "manual_cms",
          product_id: "",
          purchase_token: "",
          expires_at: expires_at_value,
          last_validated_at: new Date().toISOString()
        });
      }
    }

    return res.redirect(`/tarot/users?user_id=${encodeURIComponent(String(id))}&saved=1`);
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const id = Number(req.params?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).render("notFound", { title: "No encontrado" });
    await db.models.UserProfile.destroy({ where: { user_id: id } });
    await db.models.Entitlement.destroy({ where: { user_id: id } });
    await db.models.UsageCounter.destroy({ where: { user_id: id } });
    await db.models.GeminiGeneration.update({ user_id: null }, { where: { user_id: id } }).catch(() => null);
    const deleted = await db.models.User.destroy({ where: { id } });
    return res.redirect(`/tarot/users?deleted=${encodeURIComponent(String(deleted || 0))}`);
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

module.exports = {
  showCalculo,
  showLectura,
  showTarotTypes,
  showGemini,
  showGeminiGenerations,
  showGeminiTemplates,
  showUsers,
  showUserEdit,
  updateUser,
  deleteUser,
  showContent,
  updateAppConfig
};
