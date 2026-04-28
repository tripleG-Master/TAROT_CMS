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
  if (url.startsWith("/api/") || url === "/api" || url.startsWith("/health") || url.startsWith("/public/") || url === "/public") {
    return next();
  }

  const header = req.headers?.authorization ? String(req.headers.authorization) : "";
  const basic = parseBasicAuth(header);
  if (basic && basic.user === cmsUser && basic.pass === cmsPassword) return next();

  res.setHeader("WWW-Authenticate", 'Basic realm="Tarot CMS"');
  return res.status(401).send("Unauthorized");
}

module.exports = { requireApiToken, requireCmsBasicAuth };
