const crypto = require("node:crypto");
const db = require("../db");
const { normalizeAppConfigPayload, appConfigEtag, APP_CONFIG_SCHEMA_VERSION } = require("../services/appConfig");

function shaEtag(obj) {
  const body = typeof obj === "string" ? obj : JSON.stringify(obj);
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  return `"${hash}"`;
}

function replyWithEtag(req, res, payload, etag, lastModified) {
  const computed = etag || shaEtag(payload);
  res.setHeader("ETag", computed);
  res.setHeader("Cache-Control", "public, max-age=60");
  if (lastModified) res.setHeader("Last-Modified", new Date(lastModified).toUTCString());
  if (req.headers["if-none-match"] === computed) {
    res.status(304).end();
    return;
  }
  res.json(payload);
}

async function getAppConfig(req, res) {
  const row = await db.models.AppConfig.findByPk(1, { raw: true });
  const payload = normalizeAppConfigPayload(row?.payload || {});
  replyWithEtag(req, res, payload, appConfigEtag(payload), row?.updatedAt || null);
}

async function getManifest(req, res) {
  const cfgRow = await db.models.AppConfig.findByPk(1, { raw: true });
  const cfgPayload = normalizeAppConfigPayload(cfgRow?.payload || {});
  const cfgEtag = appConfigEtag(cfgPayload);
  const cfgUpdatedAt = cfgRow?.updatedAt || null;

  const arcUpdatedAt = await db.MajorArcana.max("updatedAt").catch(() => null);
  const arcRows = await db.MajorArcana.findAll({ order: [["numero", "ASC"]], raw: true });
  const arcEtag = shaEtag(arcRows);
  const arcUpdated = arcUpdatedAt || new Date().toISOString();

  const updatedAt = cfgUpdatedAt && arcUpdated ? (new Date(cfgUpdatedAt) > new Date(arcUpdated) ? cfgUpdatedAt : arcUpdated) : cfgUpdatedAt || arcUpdated;
  const payload = {
    schema_version: APP_CONFIG_SCHEMA_VERSION,
    revision: 1,
    updated_at: new Date(updatedAt || Date.now()).toISOString(),
    resources: [
      { key: "app_config", etag: cfgEtag, updated_at: cfgUpdatedAt ? new Date(cfgUpdatedAt).toISOString() : null, url: "/api/app-config" },
      { key: "major_arcana_export_v2", etag: arcEtag, updated_at: arcUpdated ? new Date(arcUpdated).toISOString() : null, url: "/api/arcanos/export/v2/arcanos.json" }
    ]
  };

  replyWithEtag(req, res, payload, null, payload.updated_at);
}

module.exports = { getAppConfig, getManifest };
