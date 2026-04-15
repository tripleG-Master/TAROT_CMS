const crypto = require("node:crypto");

const APP_CONFIG_SCHEMA_VERSION = 2;

function nowIso() {
  return new Date().toISOString();
}

function defaultAppConfigPayload() {
  return {
    schema_version: APP_CONFIG_SCHEMA_VERSION,
    updated_at: nowIso(),
    copy: {
      tarot_daily_guest: "Hola. Bienvenido a MITAROT. Hoy el Tarot tiene 3 cartas para ti.",
      tarot_daily_registered: "Hola, {name}. Hoy el Tarot tiene 3 mensajes para ti.",
      onboarding_title: "Bienvenido a MITAROT",
      onboarding_subtitle: "Explora tu energía diaria con una lectura guiada.",
      error_network_friendly: "No pudimos conectar con el servidor. Intenta nuevamente.",
      section_titles: {
        tarot_daily: "Tarot del día",
        major_arcana: "Arcanos mayores",
        profile: "Tu perfil"
      }
    },
    features: {
      tarot_daily_enabled: true,
      tarot_three_cards_enabled: true,
      paywall_enabled: false,
      experiments_enabled: false
    },
    ui: {
      home_sections_order: ["tarot_daily", "major_arcana", "profile"],
      modules_visibility: {
        tarot_daily: true,
        major_arcana: true,
        profile: true
      }
    },
    policies: {
      refresh_interval_minutes: 60,
      retry_max_attempts: 3,
      paywall_after_actions: 7
    },
    paywall_copy: {
      title: "Desbloquea Premium",
      subtitle: "Accede a lecturas ampliadas y contenido personalizado.",
      cta: "Ver planes"
    },
    support_links: {
      help_url: "",
      privacy_url: "",
      terms_url: "",
      contact_email: ""
    },
    min_app_version: {
      android: "1.0.0",
      force_update: false,
      message: ""
    },
    experiments: {
      enabled: false,
      rules: []
    }
  };
}

function asObject(input) {
  return input && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function asString(input, fallback = "") {
  return typeof input === "string" ? input : fallback;
}

function asBoolean(input, fallback = false) {
  return typeof input === "boolean" ? input : fallback;
}

function asInt(input, fallback = 0) {
  const n = Number(input);
  return Number.isInteger(n) ? n : fallback;
}

function asStringArray(input, fallback = []) {
  if (!Array.isArray(input)) return fallback.slice();
  return input.map((v) => String(v || "").trim()).filter(Boolean);
}

function normalizeAppConfigPayload(input) {
  const base = defaultAppConfigPayload();
  const src = asObject(input);
  const copy = asObject(src.copy);
  const copySectionTitles = asObject(copy.section_titles);
  const features = asObject(src.features);
  const ui = asObject(src.ui);
  const modulesVisibility = asObject(ui.modules_visibility);
  const policies = asObject(src.policies);
  const paywallCopy = asObject(src.paywall_copy);
  const supportLinks = asObject(src.support_links);
  const minAppVersion = asObject(src.min_app_version);
  const experiments = asObject(src.experiments);
  const expRules = Array.isArray(experiments.rules) ? experiments.rules : [];

  return {
    schema_version: APP_CONFIG_SCHEMA_VERSION,
    updated_at: asString(src.updated_at, nowIso()),
    copy: {
      tarot_daily_guest: asString(copy.tarot_daily_guest, base.copy.tarot_daily_guest),
      tarot_daily_registered: asString(copy.tarot_daily_registered, base.copy.tarot_daily_registered),
      onboarding_title: asString(copy.onboarding_title, base.copy.onboarding_title),
      onboarding_subtitle: asString(copy.onboarding_subtitle, base.copy.onboarding_subtitle),
      error_network_friendly: asString(copy.error_network_friendly, base.copy.error_network_friendly),
      section_titles: {
        tarot_daily: asString(copySectionTitles.tarot_daily, base.copy.section_titles.tarot_daily),
        major_arcana: asString(copySectionTitles.major_arcana, base.copy.section_titles.major_arcana),
        profile: asString(copySectionTitles.profile, base.copy.section_titles.profile)
      }
    },
    features: {
      tarot_daily_enabled: asBoolean(features.tarot_daily_enabled, base.features.tarot_daily_enabled),
      tarot_three_cards_enabled: asBoolean(features.tarot_three_cards_enabled, base.features.tarot_three_cards_enabled),
      paywall_enabled: asBoolean(features.paywall_enabled, base.features.paywall_enabled),
      experiments_enabled: asBoolean(features.experiments_enabled, base.features.experiments_enabled)
    },
    ui: {
      home_sections_order: asStringArray(ui.home_sections_order, base.ui.home_sections_order),
      modules_visibility: {
        tarot_daily: asBoolean(modulesVisibility.tarot_daily, base.ui.modules_visibility.tarot_daily),
        major_arcana: asBoolean(modulesVisibility.major_arcana, base.ui.modules_visibility.major_arcana),
        profile: asBoolean(modulesVisibility.profile, base.ui.modules_visibility.profile)
      }
    },
    policies: {
      refresh_interval_minutes: Math.max(1, asInt(policies.refresh_interval_minutes, base.policies.refresh_interval_minutes)),
      retry_max_attempts: Math.max(0, asInt(policies.retry_max_attempts, base.policies.retry_max_attempts)),
      paywall_after_actions: Math.max(0, asInt(policies.paywall_after_actions, base.policies.paywall_after_actions))
    },
    paywall_copy: {
      title: asString(paywallCopy.title, base.paywall_copy.title),
      subtitle: asString(paywallCopy.subtitle, base.paywall_copy.subtitle),
      cta: asString(paywallCopy.cta, base.paywall_copy.cta)
    },
    support_links: {
      help_url: asString(supportLinks.help_url, base.support_links.help_url),
      privacy_url: asString(supportLinks.privacy_url, base.support_links.privacy_url),
      terms_url: asString(supportLinks.terms_url, base.support_links.terms_url),
      contact_email: asString(supportLinks.contact_email, base.support_links.contact_email)
    },
    min_app_version: {
      android: asString(minAppVersion.android, base.min_app_version.android),
      force_update: asBoolean(minAppVersion.force_update, base.min_app_version.force_update),
      message: asString(minAppVersion.message, base.min_app_version.message)
    },
    experiments: {
      enabled: asBoolean(experiments.enabled, base.experiments.enabled),
      rules: expRules.map((r) => asObject(r))
    }
  };
}

function appConfigEtag(payload) {
  const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return `"${hash}"`;
}

module.exports = {
  APP_CONFIG_SCHEMA_VERSION,
  defaultAppConfigPayload,
  normalizeAppConfigPayload,
  appConfigEtag
};

