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
  `);

  await sequelize.sync();
}

module.exports = { initDb };
Object.defineProperty(module.exports, "sequelize", { get: () => sequelize });
Object.defineProperty(module.exports, "MajorArcana", { get: () => models.MajorArcana });
Object.defineProperty(module.exports, "models", { get: () => models });
