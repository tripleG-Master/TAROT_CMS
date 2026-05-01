const db = require("../db");

function extractToken(req) {
  const header = req.headers?.authorization ? String(req.headers.authorization) : "";
  const bearer = header.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();

  const apiKey = req.headers?.["x-api-key"] ? String(req.headers["x-api-key"]) : "";
  if (apiKey) return apiKey.trim();

  return "";
}

function requireApiToken(req, res, next) {
  const required = process.env.API_TOKEN ? String(process.env.API_TOKEN) : "";
  if (!required) return next();

  const token = extractToken(req);
  if (token && token === required) return next();

  res.status(401).json({ ok: false, error: "Unauthorized" });
}

function parseBasicAuth(header) {
  const raw = String(header || "");
  const m = raw.match(/^Basic\s+(.+)$/i);
  if (!m) return null;
  let decoded = "";
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  if (idx === -1) return null;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return { user, pass };
}

function requireCmsBasicAuth(req, res, next) {
  const cmsUser = process.env.CMS_USER ? String(process.env.CMS_USER) : "";
  const cmsPassword = process.env.CMS_PASSWORD ? String(process.env.CMS_PASSWORD) : "";
  if (!cmsUser || !cmsPassword) return next();

  const url = String(req.originalUrl || req.url || "");
  if (
    url.startsWith("/api/") ||
    url === "/api" ||
    url.startsWith("/health") ||
    url.startsWith("/public/") ||
    url === "/public" ||
    url.startsWith("/arcanos/export/") ||
    url.startsWith("/menores/export/")
  ) {
    return next();
  }

  const header = req.headers?.authorization ? String(req.headers.authorization) : "";
  const basic = parseBasicAuth(header);
  const isValid = Boolean(basic && basic.user === cmsUser && basic.pass === cmsPassword);
  const maxFailed = Math.max(1, Number(process.env.CMS_BRUTE_FORCE_MAX_ATTEMPTS || 10));
  const blockMinutes = Math.max(1, Number(process.env.CMS_BRUTE_FORCE_BLOCK_MINUTES || 30));
  const ip =
    String(req.headers?.["x-forwarded-for"] || "")
      .split(",")[0]
      .trim() ||
    String(req.ip || req.socket?.remoteAddress || "").trim() ||
    "unknown";
  const userAgent = String(req.headers?.["user-agent"] || "").slice(0, 500);
  const now = new Date();

  const denyUnauthorized = () => {
    res.setHeader("WWW-Authenticate", 'Basic realm="Tarot CMS"');
    return res.status(401).send("Unauthorized");
  };
  const denyBlocked = (until) => {
    const retrySec = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retrySec));
    return res.status(429).send("Too many attempts. Try later.");
  };

  const SecurityIpRegistry = db?.models?.SecurityIpRegistry;
  if (!SecurityIpRegistry) {
    if (isValid) return next();
    return denyUnauthorized();
  }

  return SecurityIpRegistry.findOne({ where: { ip } })
    .then(async (row) => {
      if (!row) {
        row = await SecurityIpRegistry.create({
          ip,
          last_path: url,
          last_user_agent: userAgent,
          last_seen_at: now,
          total_attempts: 0,
          failed_attempts: 0,
          consecutive_failed: 0,
          blocked_until: null
        });
      }

      const blockedUntil = row.blocked_until ? new Date(row.blocked_until) : null;
      if (blockedUntil && blockedUntil.getTime() > Date.now()) {
        row.last_seen_at = now;
        row.last_path = url;
        row.last_user_agent = userAgent;
        row.total_attempts = Number(row.total_attempts || 0) + 1;
        await row.save();
        return denyBlocked(blockedUntil);
      }

      row.last_seen_at = now;
      row.last_path = url;
      row.last_user_agent = userAgent;
      row.total_attempts = Number(row.total_attempts || 0) + 1;

      if (isValid) {
        row.consecutive_failed = 0;
        row.blocked_until = null;
        await row.save();
        return next();
      }

      row.failed_attempts = Number(row.failed_attempts || 0) + 1;
      row.consecutive_failed = Number(row.consecutive_failed || 0) + 1;

      if (row.consecutive_failed >= maxFailed) {
        const until = new Date(Date.now() + blockMinutes * 60 * 1000);
        row.blocked_until = until;
        row.consecutive_failed = 0;
        await row.save();
        return denyBlocked(until);
      }

      await row.save();
      return denyUnauthorized();
    })
    .catch(() => {
      if (isValid) return next();
      return denyUnauthorized();
    });
}

module.exports = { requireApiToken, requireCmsBasicAuth };
