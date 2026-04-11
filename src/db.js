const { Client } = require("pg");
const { Sequelize, DataTypes } = require("sequelize");
const { initModels } = require("./models");

function buildSequelize(databaseName) {
  if (process.env.DATABASE_URL) return new Sequelize(process.env.DATABASE_URL, { logging: false });

  return new Sequelize({
    dialect: "postgres",
    host: process.env.PGHOST || "localhost",
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: databaseName || process.env.PGDATABASE,
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    logging: false
  });
}

let sequelize = buildSequelize();
let models = initModels(sequelize, DataTypes);

async function ensureDatabaseExists(databaseName) {
  const adminDb = process.env.PGADMIN_DB ? String(process.env.PGADMIN_DB) : "postgres";
  const client = new Client({
    host: process.env.PGHOST || "localhost",
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    database: adminDb,
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres"
  });

  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
  if (exists.rowCount === 0) {
    const safeName = databaseName.replace(/"/g, '""');
    await client.query(`CREATE DATABASE "${safeName}"`);
  }
  await client.end();
}

async function initDb() {
  const targetDb = process.env.PGDATABASE || "tarot_cms";

  try {
    await sequelize.authenticate();
  } catch (err) {
    const code = err?.parent?.code || err?.original?.code;
    if (!process.env.DATABASE_URL && code === "3D000") {
      await ensureDatabaseExists(targetDb);
      sequelize = buildSequelize(targetDb);
      models = initModels(sequelize, DataTypes);
      await sequelize.authenticate();
    } else {
      throw err;
    }
  }

  await sequelize.query(`
    ALTER TABLE IF EXISTS "MajorArcana"
    ADD COLUMN IF NOT EXISTS imagen_thumb_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS planeta TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS numero_simbolismo TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS simbologia_mesa_elementos TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS simbologia_lemniscata TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS simbologia_ropa TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS significado_amor_luz TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS significado_amor_sombra TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS significado_trabajo_luz TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS significado_trabajo_sombra TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS significado_salud_luz TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS significado_salud_sombra TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;

    ALTER TABLE IF EXISTS "MajorArcana"
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "MinorArcana" (
      id SERIAL PRIMARY KEY,
      numero INTEGER NOT NULL,
      palo TEXT NOT NULL DEFAULT '',
      valor TEXT NOT NULL DEFAULT '',
      nombre TEXT NOT NULL DEFAULT '',
      significado_luz TEXT NOT NULL DEFAULT '',
      significado_sombra TEXT NOT NULL DEFAULT '',
      descripcion_visual TEXT NOT NULL DEFAULT '',
      palabras_clave TEXT NOT NULL DEFAULT '',
      imagen_url TEXT NOT NULL DEFAULT '',
      imagen_thumb_url TEXT NOT NULL DEFAULT '',
      extra JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );

    ALTER TABLE IF EXISTS "MinorArcana"
    ADD COLUMN IF NOT EXISTS palo TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS valor TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS significado_luz TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS significado_sombra TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS descripcion_visual TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS palabras_clave TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS imagen_thumb_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_minor_arcana_numero
      ON "MinorArcana" (numero);
    CREATE INDEX IF NOT EXISTS idx_minor_arcana_palo_valor
      ON "MinorArcana" (palo, valor);
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS connectores (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL,
      polaridad TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'general',
      texto TEXT NOT NULL,
      peso INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );

    ALTER TABLE IF EXISTS connectores
    ADD COLUMN IF NOT EXISTS perfil TEXT NOT NULL DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS peso INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_connectores_lookup
      ON connectores (tipo, polaridad, perfil);

    CREATE TABLE IF NOT EXISTS mensajes_arcanos (
      id SERIAL PRIMARY KEY,
      arcano_id INTEGER NOT NULL,
      posicion TEXT NOT NULL,
      contexto TEXT NOT NULL,
      perfil_tono TEXT NOT NULL,
      contenido TEXT NOT NULL,
      polaridad TEXT NOT NULL DEFAULT 'neutra',
      sentido TEXT NOT NULL DEFAULT 'neutro',
      luz_sombra TEXT NOT NULL DEFAULT 'neutra',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );

    ALTER TABLE IF EXISTS mensajes_arcanos
    ADD COLUMN IF NOT EXISTS polaridad TEXT NOT NULL DEFAULT 'neutra',
    ADD COLUMN IF NOT EXISTS sentido TEXT NOT NULL DEFAULT 'neutro',
    ADD COLUMN IF NOT EXISTS luz_sombra TEXT NOT NULL DEFAULT 'neutra',
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

    UPDATE mensajes_arcanos
      SET polaridad = 'favorable'
      WHERE polaridad IN ('positivo', 'positiva');
    UPDATE mensajes_arcanos
      SET polaridad = 'desafiante'
      WHERE polaridad IN ('negativo', 'negativa');
    UPDATE mensajes_arcanos
      SET polaridad = 'neutra'
      WHERE polaridad IN ('neutro', 'neutra', 'neutral');
    UPDATE mensajes_arcanos
      SET sentido = 'invertido'
      WHERE sentido IN ('invertida');
    UPDATE mensajes_arcanos
      SET sentido = 'neutro'
      WHERE sentido IN ('neutra');
    UPDATE mensajes_arcanos
      SET luz_sombra = 'neutra'
      WHERE luz_sombra IS NULL OR luz_sombra = '' OR luz_sombra IN ('neutro', 'neutral');

    CREATE INDEX IF NOT EXISTS idx_mensajes_arcanos_lookup
      ON mensajes_arcanos (arcano_id, posicion, contexto, perfil_tono);
    CREATE INDEX IF NOT EXISTS idx_mensajes_arcanos_lookup_v2
      ON mensajes_arcanos (arcano_id, posicion, contexto, perfil_tono, polaridad, sentido);
    CREATE INDEX IF NOT EXISTS idx_mensajes_arcanos_lookup_v3
      ON mensajes_arcanos (arcano_id, posicion, contexto, perfil_tono, polaridad, sentido, luz_sombra);

    CREATE TABLE IF NOT EXISTS gemini_generations (
      id SERIAL PRIMARY KEY,
      model TEXT NOT NULL DEFAULT '',
      tema TEXT NOT NULL DEFAULT '',
      pregunta TEXT NOT NULL DEFAULT '',
      user_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      response_text TEXT NOT NULL DEFAULT '',
      response_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'ok',
      error TEXT NOT NULL DEFAULT '',
      fingerprint TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_gemini_generations_model ON gemini_generations (model);
    CREATE INDEX IF NOT EXISTS idx_gemini_generations_tema ON gemini_generations (tema);
    CREATE INDEX IF NOT EXISTS idx_gemini_generations_fingerprint ON gemini_generations (fingerprint);

    CREATE TABLE IF NOT EXISTS gemini_templates (
      id SERIAL PRIMARY KEY,
      tema TEXT NOT NULL DEFAULT 'general',
      tags TEXT NOT NULL DEFAULT '',
      contenido TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'gemini',
      approved BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_gemini_templates_tema ON gemini_templates (tema);
    CREATE INDEX IF NOT EXISTS idx_gemini_templates_approved ON gemini_templates (approved);

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      external_id TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT 'android',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external_id ON users (external_id);

    CREATE TABLE IF NOT EXISTS user_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      nombre TEXT NOT NULL DEFAULT '',
      genero TEXT NOT NULL DEFAULT 'neutro',
      birthdate DATE,
      zodiac TEXT NOT NULL DEFAULT '',
      life_path INTEGER,
      birth_arcana INTEGER,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles (user_id);
    CREATE INDEX IF NOT EXISTS idx_user_profiles_birthdate ON user_profiles (birthdate);

    CREATE TABLE IF NOT EXISTS entitlements (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      provider TEXT NOT NULL DEFAULT 'google_play',
      product_id TEXT NOT NULL DEFAULT '',
      purchase_token TEXT NOT NULL DEFAULT '',
      expires_at TIMESTAMPTZ,
      last_validated_at TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "deletedAt" TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_entitlements_user_id ON entitlements (user_id);
    CREATE INDEX IF NOT EXISTS idx_entitlements_plan_status ON entitlements (plan, status);

    CREATE TABLE IF NOT EXISTS usage_counters (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      period DATE NOT NULL,
      requests INTEGER NOT NULL DEFAULT 0,
      tokens_prompt INTEGER NOT NULL DEFAULT 0,
      tokens_output INTEGER NOT NULL DEFAULT 0,
      tokens_total INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_counters_user_period ON usage_counters (user_id, period);
  `);

  await sequelize.sync();
}

module.exports = { initDb };
Object.defineProperty(module.exports, "sequelize", { get: () => sequelize });
Object.defineProperty(module.exports, "MajorArcana", { get: () => models.MajorArcana });
Object.defineProperty(module.exports, "MinorArcana", { get: () => models.MinorArcana });
Object.defineProperty(module.exports, "models", { get: () => models });
