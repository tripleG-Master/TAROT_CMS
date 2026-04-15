import crypto from "node:crypto";
import express from "express";
import pg from "pg";

const { Pool } = pg;

const port = Number(process.env.PORT || "4000");
const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: databaseUrl });

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

async function fetchSingleton(table) {
  const { rows } = await pool.query(`select payload, etag, updated_at from ${table} where id = 1 limit 1`);
  return rows[0] || null;
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "mitarot-backend-reference" });
});

app.get("/api/app-config", async (req, res) => {
  const row = await fetchSingleton("app_config");
  const payload =
    row?.payload ||
    {
      schema_version: 1,
      updated_at: new Date().toISOString(),
      features: { tarot_daily_enabled: true, tarot_three_cards_enabled: true },
      copy: {
        tarot_daily_guest: "Hola. Bienvenido a MITAROT. Hoy el Tarot tiene 3 cartas para ti.",
        tarot_daily_registered: "Hola, {name}. Hoy el Tarot tiene 3 mensajes para ti."
      },
      ui: { home_sections_order: ["tarot_daily", "major_arcana", "profile"] }
    };
  replyWithEtag(req, res, payload, row?.etag || null, row?.updated_at || null);
});

app.get("/api/arcanos/export/v2/arcanos.json", async (req, res) => {
  const row = await fetchSingleton("major_arcana_export");
  const payload = row?.payload || { arcanos: [] };
  replyWithEtag(req, res, payload, row?.etag || null, row?.updated_at || null);
});

app.get("/api/content/manifest", async (req, res) => {
  const row = await fetchSingleton("content_manifest");
  const payload =
    row?.payload ||
    {
      schema_version: 1,
      revision: 1,
      updated_at: new Date().toISOString(),
      resources: [
        { key: "app_config", etag: null, updated_at: null, url: "/api/app-config" },
        { key: "major_arcana_export_v2", etag: null, updated_at: null, url: "/api/arcanos/export/v2/arcanos.json" }
      ]
    };
  replyWithEtag(req, res, payload, row?.etag || null, row?.updated_at || null);
});

app.listen(port, () => {
  process.stdout.write(`mitarot-backend-reference listening on :${port}\n`);
});

