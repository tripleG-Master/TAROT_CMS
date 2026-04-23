const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");
const { normalizeAppConfigPayload, appConfigEtag, APP_CONFIG_SCHEMA_VERSION } = require("../services/appConfig");

const majorImgDir = path.join(__dirname, "..", "..", "public", "img");
const majorThumbDir = path.join(majorImgDir, "thumbs");
const minorImgDir = path.join(majorImgDir, "minor");
const minorThumbDir = path.join(minorImgDir, "thumbs");

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

function resolveMajorImageUrl(numero, imagenUrl) {
  const current = String(imagenUrl || "").trim();
  if (current) return current;
  if (!Number.isInteger(numero)) return "";
  const n = String(numero);
  const candidates = [`${n}.webp`, `${n}.jpg`, `${n}.jpeg`, `${n}.png`];
  const existing = candidates.find((f) => fs.existsSync(path.join(majorImgDir, f)));
  return existing ? `/public/img/${existing}` : "";
}

function resolveMajorThumbUrl(numero, imagenThumbUrl, imagenUrlResolved) {
  const current = String(imagenThumbUrl || "").trim();
  if (current) return current;
  if (Number.isInteger(numero)) {
    const n = String(numero);
    const candidates = [`${n}.thumb.webp`, `${n}.thumb.jpg`, `${n}.thumb.jpeg`, `${n}.thumb.png`];
    const existing = candidates.find((f) => fs.existsSync(path.join(majorThumbDir, f)));
    if (existing) return `/public/img/thumbs/${existing}`;
  }
  const img = String(imagenUrlResolved || "").trim();
  const m = img.match(/^\/public\/img\/(.+)$/);
  if (!m) return "";
  const base = m[1].replace(/\.[^.]+$/, "");
  const candidates2 = [`${base}.thumb.webp`, `${base}.thumb.jpg`, `${base}.thumb.jpeg`, `${base}.thumb.png`];
  const existing2 = candidates2.find((f) => fs.existsSync(path.join(majorThumbDir, f)));
  return existing2 ? `/public/img/thumbs/${existing2}` : "";
}

function resolveMinorImageUrl(numero, imagenUrl) {
  const current = String(imagenUrl || "").trim();
  if (current) return current;
  if (!Number.isInteger(numero)) return "";
  const n = String(numero);
  const candidates = [`${n}.webp`, `${n}.jpg`, `${n}.jpeg`, `${n}.png`];
  const existing = candidates.find((f) => fs.existsSync(path.join(minorImgDir, f)));
  return existing ? `/public/img/minor/${existing}` : "";
}

function resolveMinorThumbUrl(numero, imagenThumbUrl, imagenUrlResolved) {
  const current = String(imagenThumbUrl || "").trim();
  if (current) return current;
  if (Number.isInteger(numero)) {
    const n = String(numero);
    const candidates = [`${n}.thumb.webp`, `${n}.thumb.jpg`, `${n}.thumb.jpeg`, `${n}.thumb.png`];
    const existing = candidates.find((f) => fs.existsSync(path.join(minorThumbDir, f)));
    if (existing) return `/public/img/minor/thumbs/${existing}`;
  }
  const img = String(imagenUrlResolved || "").trim();
  const m = img.match(/^\/public\/img\/minor\/(.+)$/);
  if (!m) return "";
  const base = m[1].replace(/\.[^.]+$/, "");
  const candidates2 = [`${base}.thumb.webp`, `${base}.thumb.jpg`, `${base}.thumb.jpeg`, `${base}.thumb.png`];
  const existing2 = candidates2.find((f) => fs.existsSync(path.join(minorThumbDir, f)));
  return existing2 ? `/public/img/minor/thumbs/${existing2}` : "";
}

async function getAndroidCards(req, res) {
  const majorRows = await db.MajorArcana.findAll({ order: [["numero", "ASC"]], raw: true });
  const minorRows = await db.MinorArcana.findAll({ order: [["numero", "ASC"]], raw: true });

  const major_arcana = majorRows.map((r) => {
    const image_url = resolveMajorImageUrl(Number(r.numero), r.imagen_url);
    const image_thumb_url = resolveMajorThumbUrl(Number(r.numero), r.imagen_thumb_url, image_url);
    return {
      id: Number(r.numero),
      number: String(r.numero),
      name: r.nombre,
      arcana_type: "major",
      keywords: String(r.palabras_clave || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      meanings: {
        upright: { general: r.significado_luz || "" },
        reversed: { general: r.significado_sombra || "" }
      },
      visual_description: r.descripcion_visual || "",
      image_url,
      image_thumb_url,
      extra: r.extra && typeof r.extra === "object" ? r.extra : {}
    };
  });

  const minor_arcana = minorRows.map((r) => {
    const image_url = resolveMinorImageUrl(Number(r.numero), r.imagen_url);
    const image_thumb_url = resolveMinorThumbUrl(Number(r.numero), r.imagen_thumb_url, image_url);
    return {
      id: Number(r.numero),
      number: String(r.numero),
      name: r.nombre,
      arcana_type: "minor",
      suit: String(r.palo || ""),
      rank: String(r.valor || ""),
      keywords: String(r.palabras_clave || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      meanings: {
        upright: { general: r.significado_luz || "" },
        reversed: { general: r.significado_sombra || "" }
      },
      visual_description: r.descripcion_visual || "",
      image_url,
      image_thumb_url,
      extra: r.extra && typeof r.extra === "object" ? r.extra : {}
    };
  });

  const majorUpdatedAt = await db.MajorArcana.max("updatedAt").catch(() => null);
  const minorUpdatedAt = await db.MinorArcana.max("updatedAt").catch(() => null);
  const updated_at =
    majorUpdatedAt && minorUpdatedAt
      ? new Date(majorUpdatedAt) > new Date(minorUpdatedAt)
        ? majorUpdatedAt
        : minorUpdatedAt
      : majorUpdatedAt || minorUpdatedAt || new Date().toISOString();

  const payload = {
    ok: true,
    updated_at: new Date(updated_at).toISOString(),
    cards: {
      major_arcana,
      minor_arcana
    }
  };

  return replyWithEtag(req, res, payload, null, payload.updated_at);
}

module.exports = { getAppConfig, getManifest, getAndroidCards };
