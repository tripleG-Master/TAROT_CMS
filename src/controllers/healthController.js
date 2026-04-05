const db = require("../db");

async function checkDatabase() {
  try {
    await db.sequelize.authenticate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "db_error" };
  }
}

async function health(req, res) {
  const startedAt = process.uptime ? Math.round(process.uptime()) : null;
  const dbStatus = await checkDatabase();

  const payload = {
    ok: dbStatus.ok,
    service: "tarot-cms",
    time: new Date().toISOString(),
    uptime_sec: startedAt,
    db: dbStatus.ok ? { ok: true } : { ok: false }
  };

  if (!dbStatus.ok) {
    return res.status(503).json(payload);
  }

  return res.json(payload);
}

module.exports = { health };
