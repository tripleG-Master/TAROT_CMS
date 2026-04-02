const { Client } = require("pg");
const { Sequelize, DataTypes } = require("sequelize");

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

function defineMajorArcana(sequelizeInstance) {
  return sequelizeInstance.define(
    "MajorArcana",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      nombre: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      numero: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        validate: {
          min: 0,
          max: 21,
          isInt: true
        }
      },
      significado_luz: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      significado_sombra: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      descripcion_visual: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      palabras_clave: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      imagen_url: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      }
    },
    {
      tableName: "MajorArcana",
      freezeTableName: true,
      timestamps: false
    }
  );
}

let sequelize = buildSequelize();
let MajorArcana = defineMajorArcana(sequelize);

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
      MajorArcana = defineMajorArcana(sequelize);
      await sequelize.authenticate();
    } else {
      throw err;
    }
  }

  await sequelize.sync();
}

module.exports = { initDb };
Object.defineProperty(module.exports, "sequelize", { get: () => sequelize });
Object.defineProperty(module.exports, "MajorArcana", { get: () => MajorArcana });
