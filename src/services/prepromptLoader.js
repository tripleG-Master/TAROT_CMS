const fs = require("node:fs/promises");
const path = require("node:path");

async function loadPrepromptFromFile(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) return "";

  const resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);

  try {
    const content = await fs.readFile(resolved, "utf8");
    return String(content || "").trim();
  } catch {
    return "";
  }
}

module.exports = { loadPrepromptFromFile };
