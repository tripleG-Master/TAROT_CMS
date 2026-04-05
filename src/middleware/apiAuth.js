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

module.exports = { requireApiToken };
