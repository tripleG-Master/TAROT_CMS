const db = require("../db");
const { parseBirthdate, getZodiacByBirthdate } = require("../services/zodiac");
const { lifePathNumber, birthArcanaFromBirthdate } = require("../services/numerology");
const crypto = require("node:crypto");

function normalizeGenero(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (["m", "masculino", "hombre", "male"].includes(raw)) return "hombre";
  if (["f", "femenino", "mujer", "female"].includes(raw)) return "mujer";
  return "neutro";
}

function todayUtcDateOnly() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function ensureFreeEntitlement(user_id) {
  const row = await db.models.Entitlement.findOne({
    where: { user_id },
    order: [["createdAt", "DESC"]],
    raw: true
  });
  if (row) return row;
  const created = await db.models.Entitlement.create({
    user_id,
    plan: "free",
    status: "active",
    provider: "google_play",
    product_id: "",
    purchase_token: "",
    expires_at: null,
    last_validated_at: null
  });
  return created.get({ plain: true });
}

async function register(req, res) {
  try {
    const name = String(req.body?.name ?? req.body?.nombre ?? "").trim();
    const genero = normalizeGenero(req.body?.genero ?? req.body?.gender);
    const birthdateRaw = req.body?.birthdate ?? req.body?.fecha_nacimiento ?? req.body?.date;
    const external_id = String(req.body?.external_id ?? req.body?.device_id ?? req.body?.installation_id ?? "").trim();
    const externalId = external_id || crypto.randomUUID();

    const parsed = parseBirthdate(birthdateRaw);
    if (!parsed) {
      return res.status(400).json({
        ok: false,
        error: "birthdate inválida. Formatos soportados: YYYY-MM-DD o DD/MM/YYYY o DD-MM-YYYY."
      });
    }

    const zodiac = getZodiacByBirthdate(birthdateRaw);
    const lifePath = lifePathNumber(parsed);
    const lifePathValue = Number.isInteger(lifePath?.value) ? lifePath.value : null;
    const birthArcana = birthArcanaFromBirthdate(parsed);

    const arcano = await db.MajorArcana.findOne({
      where: { numero: birthArcana.major_arcana_numero },
      attributes: ["numero", "nombre", "imagen_url", "imagen_thumb_url"],
      raw: true
    });

    const user = await db.models.User.findOne({ where: { external_id: externalId } });
    const userRow = user ? user : await db.models.User.create({ external_id: externalId, provider: "android" });
    const user_id = userRow.id;

    const birthdateIso = zodiac
      ? zodiac.birthdate
      : `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
    const zodiacText = zodiac ? String(zodiac.sign?.name_es || "").trim() : "";

    const existingProfile = await db.models.UserProfile.findOne({ where: { user_id } });
    if (existingProfile) {
      existingProfile.nombre = name;
      existingProfile.genero = genero;
      existingProfile.birthdate = birthdateIso;
      existingProfile.zodiac = zodiacText;
      existingProfile.life_path = lifePathValue;
      existingProfile.birth_arcana = birthArcana.major_arcana_numero;
      await existingProfile.save();
    } else {
      await db.models.UserProfile.create({
        user_id,
        nombre: name,
        genero,
        birthdate: birthdateIso,
        zodiac: zodiacText,
        life_path: lifePathValue,
        birth_arcana: birthArcana.major_arcana_numero
      });
    }

    const entitlement = await ensureFreeEntitlement(user_id);

    return res.json({
      ok: true,
      user: { user_id, external_id: externalId, name, birthdate: birthdateIso, genero },
      zodiac: zodiac ? zodiac.sign : null,
      numerology: {
        life_path: lifePathValue
      },
      entitlement: {
        plan: entitlement.plan,
        status: entitlement.status,
        expires_at: entitlement.expires_at || null
      },
      birth_arcana: {
        total: birthArcana.total,
        major_arcana_numero: birthArcana.major_arcana_numero,
        arcana_22: birthArcana.arcana_22,
        is_master: birthArcana.is_master,
        steps: birthArcana.steps,
        arcano: arcano
          ? {
              numero: arcano.numero,
              nombre: arcano.nombre,
              imagen_url: arcano.imagen_url,
              imagen_thumb_url: arcano.imagen_thumb_url
            }
          : null
      }
    });
  } catch (err) {
    const msg = err?.message || "Error registrando usuario.";
    return res.status(500).json({ ok: false, error: msg });
  }
}

async function getProfile(req, res) {
  try {
    const user_id = Number(req.params?.id);
    if (!Number.isInteger(user_id) || user_id <= 0) return res.status(400).json({ ok: false, error: "user_id inválido" });
    const user = await db.models.User.findByPk(user_id, { raw: true });
    if (!user) return res.status(404).json({ ok: false, error: "no encontrado" });
    const profile = await db.models.UserProfile.findOne({ where: { user_id }, raw: true });
    const entitlement = await db.models.Entitlement.findOne({ where: { user_id }, order: [["createdAt", "DESC"]], raw: true });
    const period = todayUtcDateOnly();
    const usage = await db.models.UsageCounter.findOne({ where: { user_id, period }, raw: true });
    return res.json({
      ok: true,
      user: { id: user.id, external_id: user.external_id, provider: user.provider },
      profile: profile
        ? {
            nombre: profile.nombre,
            genero: profile.genero,
            birthdate: profile.birthdate,
            zodiac: profile.zodiac,
            life_path: profile.life_path,
            birth_arcana: profile.birth_arcana
          }
        : null,
      entitlement: entitlement ? { plan: entitlement.plan, status: entitlement.status, expires_at: entitlement.expires_at || null } : null,
      usage: usage
        ? { period: usage.period, requests: usage.requests, tokens_prompt: usage.tokens_prompt, tokens_output: usage.tokens_output, tokens_total: usage.tokens_total }
        : { period, requests: 0, tokens_prompt: 0, tokens_output: 0, tokens_total: 0 }
    });
  } catch (err) {
    const msg = err?.message || "Error obteniendo perfil.";
    return res.status(500).json({ ok: false, error: msg });
  }
}

async function setEntitlement(req, res) {
  try {
    const user_id = Number(req.body?.user_id);
    if (!Number.isInteger(user_id) || user_id <= 0) return res.status(400).json({ ok: false, error: "user_id inválido" });
    const plan = String(req.body?.plan || "free").trim().toLowerCase();
    const status = String(req.body?.status || "active").trim().toLowerCase();
    const provider = String(req.body?.provider || "google_play").trim() || "google_play";
    const product_id = String(req.body?.product_id || "").trim();
    const purchase_token = String(req.body?.purchase_token || "").trim();
    const expires_at = req.body?.expires_at ? new Date(req.body.expires_at) : null;

    if (!["free", "premium"].includes(plan)) return res.status(400).json({ ok: false, error: "plan inválido" });
    if (!["active", "expired", "canceled", "grace"].includes(status)) return res.status(400).json({ ok: false, error: "status inválido" });

    const created = await db.models.Entitlement.create({
      user_id,
      plan,
      status,
      provider,
      product_id,
      purchase_token,
      expires_at: expires_at && !Number.isNaN(expires_at.getTime()) ? expires_at : null,
      last_validated_at: null
    });

    return res.json({ ok: true, entitlement: { id: created.id, user_id, plan, status, expires_at: created.expires_at || null } });
  } catch (err) {
    const msg = err?.message || "Error seteando entitlement.";
    return res.status(500).json({ ok: false, error: msg });
  }
}

module.exports = { register, getProfile, setEntitlement };
