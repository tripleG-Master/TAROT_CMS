const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const crypto = require("node:crypto");
const db = require("../db");

const imgDir = path.join(__dirname, "..", "..", "public", "img");
const thumbDir = path.join(imgDir, "thumbs");
const imageAliases = {
  "el-hierofante": "el-papa"
};

function normalizeKeywords(input) {
  if (Array.isArray(input)) return input.map(String).join(", ");
  return String(input || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function keywordsToArray(input) {
  return String(input || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function slugifyDash(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveImageUrl(numero, nombre, imagenUrl) {
  const current = cleanText(imagenUrl);
  if (current) return current;

  if (Number.isInteger(numero)) {
    const n = String(numero);
    const candidates = [`${n}.jpg`, `${n}.jpeg`, `${n}.png`, `${n}.webp`];
    const existing = candidates.find((f) => fs.existsSync(path.join(imgDir, f)));
    const fileName = existing || candidates[0];
    return `/public/img/${fileName}`;
  }

  let base = slugifyDash(nombre);
  base = imageAliases[base] || base;

  const candidates = [
    `${base}.jpg`,
    `${base}.jpeg`,
    `${base}.png`,
    `${base}.webp`
  ];

  const existing = candidates.find((f) => fs.existsSync(path.join(imgDir, f)));
  const fileName = existing || candidates[0];
  return `/public/img/${fileName}`;
}

function resolveThumbUrl(numero, nombre, imagenThumbUrl, imagenUrl) {
  const current = cleanText(imagenThumbUrl);
  if (current) return current;

  if (Number.isInteger(numero)) {
    const n = String(numero);
    const candidates = [
      `${n}.thumb.webp`,
      `${n}.thumb.jpg`,
      `${n}.thumb.jpeg`,
      `${n}.thumb.png`
    ];
    const existing = candidates.find((f) => fs.existsSync(path.join(thumbDir, f)));
    if (existing) return `/public/img/thumbs/${existing}`;
    return "";
  }

  const image = cleanText(imagenUrl);
  if (image) {
    const match = image.match(/^\/public\/img\/(.+)$/);
    if (match) {
      const baseName = match[1].replace(/\.[^.]+$/, "");
      const candidates = [
        `${baseName}.thumb.webp`,
        `${baseName}.thumb.jpg`,
        `${baseName}.thumb.jpeg`,
        `${baseName}.thumb.png`
      ];
      const existing = candidates.find((f) => fs.existsSync(path.join(thumbDir, f)));
      if (existing) return `/public/img/thumbs/${existing}`;
    }
  }

  let base = slugifyDash(nombre);
  base = imageAliases[base] || base;
  const candidates = [
    `${base}.thumb.webp`,
    `${base}.thumb.jpg`,
    `${base}.thumb.jpeg`,
    `${base}.thumb.png`
  ];
  const existing = candidates.find((f) => fs.existsSync(path.join(thumbDir, f)));
  if (existing) return `/public/img/thumbs/${existing}`;
  return "";
}

function localPublicImgPath(url) {
  const m = String(url || "").match(/^\/public\/img\/(.+)$/);
  if (!m) return null;
  return path.join(imgDir, m[1]);
}

function ensureDirs() {
  fs.mkdirSync(imgDir, { recursive: true });
  fs.mkdirSync(thumbDir, { recursive: true });
}

async function writeImageWebp(buffer, filePath, maxWidth, quality) {
  const pipeline = sharp(buffer).rotate().resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality });
  await pipeline.toFile(filePath);
}

async function writeThumbFromFilePath(inputPath, thumbPath) {
  await sharp(inputPath)
    .rotate()
    .resize({ width: 256, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(thumbPath);
}

function buildImageBase(numero, nombre) {
  let base = Number.isInteger(numero) ? String(numero) : slugifyDash(nombre);
  base = imageAliases[base] || base;
  return base;
}

async function saveImageAndThumb({ numero, nombre, buffer, variant = "" }) {
  ensureDirs();
  const base = buildImageBase(numero, nombre);
  const suffix = String(variant || "").trim();
  const finalBase = suffix ? `${base}__${suffix}` : base;

  const imageFile = `${finalBase}.webp`;
  const thumbFile = `${finalBase}.thumb.webp`;

  const imagePath = path.join(imgDir, imageFile);
  const thumbPath = path.join(thumbDir, thumbFile);

  await writeImageWebp(buffer, imagePath, 1600, 82);
  await writeImageWebp(buffer, thumbPath, 256, 80);

  return {
    imagen_url: `/public/img/${imageFile}`,
    imagen_thumb_url: `/public/img/thumbs/${thumbFile}`
  };
}

function normalizeGallery(extra) {
  const raw = extra && typeof extra === "object" ? extra.image_gallery : null;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => ({
      imagen_url: String(it?.imagen_url || "").trim(),
      imagen_thumb_url: String(it?.imagen_thumb_url || "").trim()
    }))
    .filter((it) => it.imagen_url);
}

function mergeGallery(list) {
  const out = [];
  const seen = new Set();
  for (const it of list || []) {
    const url = String(it?.imagen_url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      imagen_url: url,
      imagen_thumb_url: String(it?.imagen_thumb_url || "").trim()
    });
  }
  return out;
}

function pickUploadedFiles(req, fieldName) {
  if (req?.files && Array.isArray(req.files[fieldName])) return req.files[fieldName].filter((f) => f?.buffer);
  if (fieldName === "imagen_file" && req?.file?.buffer) return [req.file];
  return [];
}

async function saveGalleryImages({ numero, nombre, files }) {
  const list = Array.isArray(files) ? files : [];
  const stamp = Date.now();
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const f = list[i];
    if (!f?.buffer) continue;
    const variant = `g${stamp}_${i + 1}`;
    const saved = await saveImageAndThumb({ numero, nombre, buffer: f.buffer, variant });
    out.push(saved);
  }
  return out;
}

async function ensureThumbForLocalImage(numero, nombre, imagenUrl) {
  const localPath = localPublicImgPath(imagenUrl);
  if (!localPath || !fs.existsSync(localPath)) return "";
  ensureDirs();

  let base = Number.isInteger(numero) ? String(numero) : slugifyDash(nombre);
  base = imageAliases[base] || base;
  const thumbFile = `${base}.thumb.webp`;
  const thumbPath = path.join(thumbDir, thumbFile);
  if (!fs.existsSync(thumbPath)) {
    await writeThumbFromFilePath(localPath, thumbPath);
  }
  return `/public/img/thumbs/${thumbFile}`;
}

function validateArcano(body) {
  const errors = {};

  const nombre = String(body.nombre || "").trim();
  const numeroRaw = String(body.numero || "").trim();
  const numero = Number(numeroRaw);

  if (!nombre) errors.nombre = "El nombre es obligatorio.";

  if (!numeroRaw) {
    errors.numero = "El número es obligatorio (0 a 21).";
  } else if (!Number.isInteger(numero) || numero < 0 || numero > 21) {
    errors.numero = "El número debe ser un entero entre 0 y 21.";
  }

  const payload = {
    nombre,
    numero,
    significado_luz: String(body.significado_luz || "").trim(),
    significado_sombra: String(body.significado_sombra || "").trim(),
    descripcion_visual: String(body.descripcion_visual || "").trim(),
    palabras_clave: normalizeKeywords(body.palabras_clave),
    imagen_url: String(body.imagen_url || "").trim(),
    imagen_thumb_url: String(body.imagen_thumb_url || "").trim(),
    planeta: String(body.planeta || "").trim(),
    numero_simbolismo: String(body.numero_simbolismo || "").trim(),
    simbologia_mesa_elementos: String(body.simbologia_mesa_elementos || "").trim(),
    simbologia_lemniscata: String(body.simbologia_lemniscata || "").trim(),
    simbologia_ropa: String(body.simbologia_ropa || "").trim(),
    significado_amor_luz: String(body.significado_amor_luz || "").trim(),
    significado_amor_sombra: String(body.significado_amor_sombra || "").trim(),
    significado_trabajo_luz: String(body.significado_trabajo_luz || "").trim(),
    significado_trabajo_sombra: String(body.significado_trabajo_sombra || "").trim(),
    significado_salud_luz: String(body.significado_salud_luz || "").trim(),
    significado_salud_sombra: String(body.significado_salud_sombra || "").trim()
  };

  return { errors, payload };
}

function showImportForm(req, res) {
  res.render("majorArcana/import", {
    title: "Importar Arcanos",
    json: "",
    csv: "",
    connectorsJson: "",
    connectorsCsv: "",
    messagesJson: "",
    messagesCsv: "",
    messagesCsvWide: "",
    connectorsStatus: "",
    messagesStatus: "",
    error: "",
    result: null
  });
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  let s = String(value).trim();
  if (!s) return "";
  s = s.replace(/^\uFEFF/, "");
  s = s.replace(/^"+|"+$/g, "");
  s = s.replace(/^\\+|\\+$/g, "");
  s = s.replace(/\\+"/g, '"');
  return s.trim();
}

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNormalizedMap(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

function mapImportRow(raw) {
  const normalized = toNormalizedMap(raw);
  const numeroText = cleanText(normalized.numero ?? normalized.number ?? raw?.numero ?? raw?.number);
  if (!numeroText) return null;
  const numero = Number.parseInt(numeroText, 10);
  if (!Number.isInteger(numero) || numero < 0 || numero > 21) return null;

  const nombre = cleanText(normalized.nombre ?? normalized.name ?? raw?.nombre ?? raw?.name);
  if (!nombre) return null;

  const descripcion_visual = cleanText(
    normalized.descripcion_visual ??
      normalized.visual_description ??
      raw?.descripcion_visual ??
      raw?.visual_description
  );
  const significado_luz = cleanText(raw?.meanings?.upright?.general ?? normalized.significado_luz ?? raw?.significado_luz);
  const significado_sombra = cleanText(raw?.meanings?.reversed?.general ?? normalized.significado_sombra ?? raw?.significado_sombra);
  const palabrasClaveRaw = raw?.keywords ?? normalized.palabras_clave ?? raw?.palabras_clave;

  const palabras_clave = Array.isArray(palabrasClaveRaw)
    ? palabrasClaveRaw.map((x) => cleanText(x)).filter(Boolean).join(", ")
    : normalizeKeywords(cleanText(palabrasClaveRaw));

  const imagen_url = resolveImageUrl(
    numero,
    nombre,
    normalized.imagen_url ?? normalized.image_url ?? raw?.imagen_url ?? raw?.image_url
  );
  const imagen_thumb_url = resolveThumbUrl(
    numero,
    nombre,
    normalized.imagen_thumb_url ?? normalized.image_thumb_url ?? raw?.imagen_thumb_url ?? raw?.image_thumb_url,
    imagen_url
  );

  let extra = {};
  const providedExtra = normalized.extra ?? raw?.extra;
  if (providedExtra && typeof providedExtra === "object") {
    extra = providedExtra;
  } else if (typeof providedExtra === "string") {
    const trimmed = providedExtra.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") extra = parsed;
      } catch (_) {
        extra = {};
      }
    }
  }
  const uprightAdvice = cleanText(raw?.meanings?.upright?.advice);
  const uprightCareer = cleanText(raw?.meanings?.upright?.career);
  const reversedAdvice = cleanText(raw?.meanings?.reversed?.advice);
  const reversedCareer = cleanText(raw?.meanings?.reversed?.career);
  const element = cleanText(raw?.attributes?.element);
  const astrology = cleanText(raw?.attributes?.astrology);
  const colorHex = cleanText(raw?.attributes?.color_hex ?? raw?.attributes?.colorHex);

  if (uprightAdvice || uprightCareer || reversedAdvice || reversedCareer) {
    const prev = extra.meanings && typeof extra.meanings === "object" ? extra.meanings : {};
    extra.meanings = {
      ...prev,
      upright: { ...(prev.upright || {}), advice: uprightAdvice, career: uprightCareer },
      reversed: { ...(prev.reversed || {}), advice: reversedAdvice, career: reversedCareer }
    };
  }

  if (element || astrology || colorHex) {
    const prev = extra.attributes && typeof extra.attributes === "object" ? extra.attributes : {};
    extra.attributes = { ...prev, element, astrology, color_hex: colorHex };
  }

  const planeta = cleanText(
    raw?.base_attributes?.planet ??
      raw?.baseAttributes?.planet ??
      normalized.planeta ??
      raw?.planeta
  );
  const numero_simbolismo = cleanText(
    raw?.base_attributes?.number_symbolism ??
      raw?.baseAttributes?.numberSymbolism ??
      raw?.base_attributes?.numero_simbolismo ??
      normalized.numero_simbolismo ??
      raw?.numero_simbolismo
  );

  const simbologia_mesa_elementos = cleanText(
    raw?.symbolism?.table_of_elements ??
      raw?.symbolism?.mesa_de_elementos ??
      normalized.simbologia_mesa_elementos ??
      raw?.simbologia_mesa_elementos
  );
  const simbologia_lemniscata = cleanText(
    raw?.symbolism?.lemniscate ??
      raw?.symbolism?.lemniscata ??
      normalized.simbologia_lemniscata ??
      raw?.simbologia_lemniscata
  );
  const simbologia_ropa = cleanText(
    raw?.symbolism?.clothing ??
      raw?.symbolism?.ropa ??
      normalized.simbologia_ropa ??
      raw?.simbologia_ropa
  );

  const significado_amor_luz = cleanText(
    raw?.meanings_by_area?.love?.upright ??
      raw?.meaningsByArea?.love?.upright ??
      normalized.significado_amor_luz ??
      raw?.significado_amor_luz
  );
  const significado_amor_sombra = cleanText(
    raw?.meanings_by_area?.love?.reversed ??
      raw?.meaningsByArea?.love?.reversed ??
      normalized.significado_amor_sombra ??
      raw?.significado_amor_sombra
  );
  const significado_trabajo_luz = cleanText(
    raw?.meanings_by_area?.work?.upright ??
      raw?.meaningsByArea?.work?.upright ??
      normalized.significado_trabajo_luz ??
      raw?.significado_trabajo_luz
  );
  const significado_trabajo_sombra = cleanText(
    raw?.meanings_by_area?.work?.reversed ??
      raw?.meaningsByArea?.work?.reversed ??
      normalized.significado_trabajo_sombra ??
      raw?.significado_trabajo_sombra
  );
  const significado_salud_luz = cleanText(
    raw?.meanings_by_area?.health?.upright ??
      raw?.meaningsByArea?.health?.upright ??
      normalized.significado_salud_luz ??
      raw?.significado_salud_luz
  );
  const significado_salud_sombra = cleanText(
    raw?.meanings_by_area?.health?.reversed ??
      raw?.meaningsByArea?.health?.reversed ??
      normalized.significado_salud_sombra ??
      raw?.significado_salud_sombra
  );

  return {
    nombre,
    numero,
    significado_luz,
    significado_sombra,
    descripcion_visual,
    palabras_clave,
    imagen_url,
    imagen_thumb_url,
    planeta,
    numero_simbolismo,
    simbologia_mesa_elementos,
    simbologia_lemniscata,
    simbologia_ropa,
    significado_amor_luz,
    significado_amor_sombra,
    significado_trabajo_luz,
    significado_trabajo_sombra,
    significado_salud_luz,
    significado_salud_sombra,
    extra
  };
}

function extractRows(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.arcanos_mayores)) return parsed.arcanos_mayores;
    if (Array.isArray(parsed.arcanosMayores)) return parsed.arcanosMayores;
    if (Array.isArray(parsed.data)) return parsed.data;
  }
  return [];
}

async function performImport(rows) {
  const mapped = new Map();
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const m = mapImportRow(r);
    if (!m) continue;
    mapped.set(m.numero, m);
  }

  const items = Array.from(mapped.values()).sort((a, b) => a.numero - b.numero);
  if (items.length === 0) {
    return { items: [], created: 0, updated: 0, skipped: rows.length };
  }

  for (const item of items) {
    item.deletedAt = null;
    if (!String(item.imagen_thumb_url || "").trim() && String(item.imagen_url || "").startsWith("/public/img/")) {
      item.imagen_thumb_url = await ensureThumbForLocalImage(item.numero, item.nombre, item.imagen_url);
    }
  }

  const existing = await db.MajorArcana.findAll({
    where: { numero: items.map((i) => i.numero) },
    attributes: ["numero"],
    raw: true
  });
  const existingNums = new Set(existing.map((e) => e.numero));

  await db.sequelize.transaction(async (t) => {
    for (const item of items) {
      await db.MajorArcana.upsert(item, { transaction: t });
    }
  });

  const created = items.filter((i) => !existingNums.has(i.numero)).length;
  const updated = items.length - created;
  const skipped = rows.length - items.length;
  return { items, created, updated, skipped };
}

async function importJson(req, res, next) {
  try {
    const input = req.body?.json !== undefined ? req.body.json : req.body;

    let parsed = input;
    if (typeof parsed === "string") {
      const trimmed = parsed.trim();
      parsed = trimmed ? JSON.parse(trimmed) : null;
    }

    const rows = extractRows(parsed);
    const { items, created, updated, skipped } = await performImport(rows);
    if (items.length === 0) {
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: typeof input === "string" ? input : JSON.stringify(req.body, null, 2),
        csv: "",
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: "",
        messagesCsv: "",
        connectorsStatus: "",
        messagesStatus: "",
        error: "No se encontraron entradas válidas para importar (número 0–21 y nombre obligatorio).",
        result: null
      });
    }

    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: "",
      result: { created, updated, skipped }
    });
  } catch (err) {
    const message =
      err instanceof SyntaxError
        ? "JSON inválido. Revisa comas, comillas y estructura."
        : err?.message || "Error inesperado importando.";
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: req.body?.json || "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: message,
      result: null
    });
  }
}

function detectDelimiter(headerLine) {
  const comma = (headerLine.match(/,/g) || []).length;
  const semi = (headerLine.match(/;/g) || []).length;
  const tab = (headerLine.match(/\t/g) || []).length;
  if (tab >= comma && tab >= semi && tab > 0) return "\t";
  if (semi >= comma && semi > 0) return ";";
  return ",";
}

function parseSeparatedValues(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const input = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = input[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  row.push(field);
  rows.push(row);

  return rows
    .map((r) => r.map((v) => String(v ?? "").trim()))
    .filter((r) => r.some((v) => v.length > 0));
}

function csvToObjects(csvText) {
  const normalized = String(csvText || "").trim();
  if (!normalized) return [];
  const firstLine = normalized.split(/\r?\n/, 1)[0] || "";
  const delimiter = detectDelimiter(firstLine);
  const table = parseSeparatedValues(normalized, delimiter);
  if (table.length < 2) return [];

  const headers = table[0].map((h) => h.trim()).filter(Boolean);
  const objects = [];

  for (const r of table.slice(1)) {
    if (r.every((v) => !String(v || "").trim())) continue;
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) {
      obj[headers[i]] = r[i] ?? "";
    }
    objects.push(obj);
  }

  return objects;
}

function decodeUploadedTextBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return "";
  const utf8 = buffer.toString("utf8");
  if (utf8.includes("�")) {
    return buffer.toString("latin1");
  }
  return utf8;
}

async function importCsv(req, res, next) {
  try {
    const csv = String(req.body?.csv || "");
    const rows = csvToObjects(csv);
    const { items, created, updated, skipped } = await performImport(rows);
    if (items.length === 0) {
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv,
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: "",
        messagesCsv: "",
        connectorsStatus: "",
        messagesStatus: "",
        error: "No se encontraron entradas válidas en el CSV (número 0–21 y nombre obligatorio).",
        result: null
      });
    }

    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: "",
      result: { created, updated, skipped }
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: req.body?.csv || "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando CSV.",
      result: null
    });
  }
}

async function importCsvFile(req, res, next) {
  try {
    const originalName = req.file?.originalname ? String(req.file.originalname) : "";
    const csv = decodeUploadedTextBuffer(req.file?.buffer);
    const rows = csvToObjects(csv);
    const { items, created, updated, skipped } = await performImport(rows);

    if (items.length === 0) {
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv,
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: "",
        messagesCsv: "",
        connectorsStatus: "",
        messagesStatus: "",
        error: `No se encontraron entradas válidas en el archivo (${originalName || "CSV"}).`,
        result: null
      });
    }

    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: "",
      result: { created, updated, skipped }
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando archivo CSV.",
      result: null
    });
  }
}

async function importLocal(req, res) {
  const fs = require("node:fs/promises");
  const path = require("node:path");

  try {
    const filePath = path.join(__dirname, "..", "..", "data", "arcanosMajores.json");
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const rows = extractRows(parsed);
    const { items, created, updated, skipped } = await performImport(rows);

    if (items.length === 0) {
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv: "",
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: "",
        messagesCsv: "",
        connectorsStatus: "",
        messagesStatus: "",
        error: "No se encontraron entradas válidas en data/arcanosMajores.json.",
        result: null
      });
    }

    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: "",
      result: { created, updated, skipped }
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error leyendo data/arcanosMajores.json.",
      result: null
    });
  }
}

async function importConnectorsJson(req, res, next) {
  try {
    const input = req.body?.connectorsJson ?? req.body?.json ?? req.body;
    let rows = input;
    if (typeof rows === "string") {
      const trimmed = rows.trim();
      rows = trimmed ? JSON.parse(trimmed) : null;
    }
    const list = Array.isArray(rows) ? rows : rows?.items ?? [];
    const normalized = list
      .map((r) => ({
        tipo: String(r.tipo || "").trim(),
        polaridad: String(r.polaridad || "").trim(),
        perfil: String(r.perfil ?? r.perfil_tono ?? r.perfilTono ?? "general").trim() || "general",
        peso: Number.isFinite(Number(r.peso)) ? Number(r.peso) : 1,
        texto: String(r.texto || "").trim()
      }))
      .filter((r) => r.tipo && r.polaridad && r.perfil && r.texto);
    if (normalized.length === 0) {
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv: "",
        connectorsJson: typeof input === "string" ? input : JSON.stringify(req.body, null, 2),
        connectorsCsv: "",
        messagesJson: "",
        messagesCsv: "",
        connectorsStatus: "",
        messagesStatus: "",
        error: "No se encontraron conectores válidos."
      });
    }
    await db.models.Connector.bulkCreate(normalized);
    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: `Conectores importados: ${normalized.length}`,
      messagesStatus: "",
      error: "",
      result: null
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: req.body?.connectorsJson || req.body?.json || "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando conectores.",
      result: null
    });
  }
}

async function importArcanaMessagesJson(req, res, next) {
  try {
    function normalizeArcanaMessagePolarity(input) {
      const raw = String(input || "").trim().toLowerCase();
      if (!raw) return null;
      if (["favorable"].includes(raw)) return "favorable";
      if (["desafiante"].includes(raw)) return "desafiante";
      if (["neutra"].includes(raw)) return "neutra";
      return null;
    }

    function normalizeArcanaMessageSentido(input) {
      const raw = String(input || "").trim().toLowerCase();
      if (!raw) return null;
      if (["derecho"].includes(raw)) return "derecho";
      if (["invertido"].includes(raw)) return "invertido";
      if (["neutro"].includes(raw)) return "neutro";
      return null;
    }

    const input = req.body?.messagesJson ?? req.body?.json ?? req.body;
    let rows = input;
    if (typeof rows === "string") {
      const trimmed = rows.trim();
      rows = trimmed ? JSON.parse(trimmed) : null;
    }
    const list = Array.isArray(rows) ? rows : rows?.items ?? [];
    const invalidPolaridad = new Set();
    const invalidSentido = new Set();
    for (const r of list) {
      const pRaw = String(r?.polaridad ?? "").trim().toLowerCase();
      const sRaw = String(r?.sentido ?? "").trim().toLowerCase();
      if (!pRaw || !normalizeArcanaMessagePolarity(pRaw)) invalidPolaridad.add(pRaw || "(vacío)");
      if (!sRaw || !normalizeArcanaMessageSentido(sRaw)) invalidSentido.add(sRaw || "(vacío)");
    }
    if (invalidPolaridad.size > 0 || invalidSentido.size > 0) {
      const pol = Array.from(invalidPolaridad).slice(0, 10).join(", ");
      const sen = Array.from(invalidSentido).slice(0, 10).join(", ");
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv: "",
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: typeof input === "string" ? input : JSON.stringify(req.body, null, 2),
        messagesCsv: "",
        messagesCsvWide: "",
        connectorsStatus: "",
        messagesStatus: "",
        error:
          "Contrato inválido. Valores permitidos: polaridad=favorable|desafiante|neutra; sentido=derecho|invertido|neutro. " +
          `Recibidos: polaridad=[${pol}] sentido=[${sen}]`,
        result: null
      });
    }
    const normalized = list
      .map((r) => ({
        arcano_id: Number(r.arcano_id ?? r.arcanoId ?? r.numero),
        posicion: String(r.posicion || "").trim(),
        contexto: String(r.contexto || "").trim(),
        perfil_tono: String(r.perfil_tono ?? r.perfil ?? "general").trim() || "general",
        polaridad: normalizeArcanaMessagePolarity(r.polaridad),
        sentido: normalizeArcanaMessageSentido(r.sentido),
        contenido: String(r.contenido || "").trim()
      }))
      .filter(
        (r) =>
          Number.isInteger(r.arcano_id) &&
          r.posicion &&
          r.contexto &&
          r.contenido &&
          r.polaridad &&
          r.sentido
      );
    if (normalized.length === 0) {
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv: "",
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: typeof input === "string" ? input : JSON.stringify(req.body, null, 2),
        messagesCsv: "",
        messagesCsvWide: "",
        connectorsStatus: "",
        messagesStatus: "",
        error: "No se encontraron mensajes válidos."
      });
    }
    await db.models.ArcanaMessage.bulkCreate(normalized);
    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: `Mensajes importados: ${normalized.length}`,
      error: "",
      result: null
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: req.body?.messagesJson || req.body?.json || "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando mensajes.",
      result: null
    });
  }
}

async function importConnectorsCsv(req, res, next) {
  try {
    const csv = String(req.body?.connectorsCsv || req.body?.csv || "");
    const rows = csvToObjects(csv);
    const normalized = rows
      .map((r) => ({
        tipo: String(r.tipo || "").trim(),
        polaridad: String(r.polaridad || "").trim(),
        perfil: String(r.perfil ?? r.perfil_tono ?? "general").trim() || "general",
        peso: Number.isFinite(Number(r.peso)) ? Number(r.peso) : 1,
        texto: String(r.texto || "").trim()
      }))
      .filter((r) => r.tipo && r.polaridad && r.perfil && r.texto);
    if (normalized.length === 0) {
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv: "",
        connectorsJson: "",
        connectorsCsv: csv,
        messagesJson: "",
        messagesCsv: "",
        connectorsStatus: "",
        messagesStatus: "",
        error: "No se encontraron conectores válidos en CSV."
      });
    }
    await db.models.Connector.bulkCreate(normalized);
    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: `Conectores importados: ${normalized.length}`,
      messagesStatus: "",
      error: "",
      result: null
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: req.body?.connectorsCsv || req.body?.csv || "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando conectores CSV.",
      result: null
    });
  }
}

async function importArcanaMessagesCsv(req, res, next) {
  try {
    function normalizeArcanaMessagePolarity(input) {
      const raw = String(input || "").trim().toLowerCase();
      if (!raw) return null;
      if (raw === "favorable") return "favorable";
      if (raw === "desafiante") return "desafiante";
      if (raw === "neutra") return "neutra";
      return null;
    }

    function normalizeArcanaMessageSentido(input) {
      const raw = String(input || "").trim().toLowerCase();
      if (!raw) return null;
      if (raw === "derecho") return "derecho";
      if (raw === "invertido") return "invertido";
      if (raw === "neutro") return "neutro";
      return null;
    }

    const csv = String(req.body?.messagesCsv || req.body?.csv || "");
    const rows = csvToObjects(csv);
    const invalidPolaridad = new Set();
    const invalidSentido = new Set();
    for (const r of rows) {
      const pRaw = String(r?.polaridad ?? "").trim().toLowerCase();
      const sRaw = String(r?.sentido ?? "").trim().toLowerCase();
      if (!pRaw || !normalizeArcanaMessagePolarity(pRaw)) invalidPolaridad.add(pRaw || "(vacío)");
      if (!sRaw || !normalizeArcanaMessageSentido(sRaw)) invalidSentido.add(sRaw || "(vacío)");
    }
    if (invalidPolaridad.size > 0 || invalidSentido.size > 0) {
      const pol = Array.from(invalidPolaridad).slice(0, 10).join(", ");
      const sen = Array.from(invalidSentido).slice(0, 10).join(", ");
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv: "",
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: "",
        messagesCsv: csv,
        messagesCsvWide: "",
        connectorsStatus: "",
        messagesStatus: "",
        error:
          "Contrato inválido. Valores permitidos: polaridad=favorable|desafiante|neutra; sentido=derecho|invertido|neutro. " +
          `Recibidos: polaridad=[${pol}] sentido=[${sen}]`,
        result: null
      });
    }
    const normalized = rows
      .map((r) => ({
        arcano_id: Number(r.arcano_id ?? r.arcanoId ?? r.numero),
        posicion: String(r.posicion || "").trim(),
        contexto: String(r.contexto || "").trim(),
        perfil_tono: String(r.perfil_tono ?? r.perfil ?? "general").trim() || "general",
        polaridad: normalizeArcanaMessagePolarity(r.polaridad),
        sentido: normalizeArcanaMessageSentido(r.sentido),
        contenido: String(r.contenido || "").trim()
      }))
      .filter(
        (r) =>
          Number.isInteger(r.arcano_id) &&
          r.posicion &&
          r.contexto &&
          r.contenido &&
          r.polaridad &&
          r.sentido
      );
    if (normalized.length === 0) {
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv: "",
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: "",
        messagesCsv: csv,
        messagesCsvWide: "",
        connectorsStatus: "",
        messagesStatus: "",
        error: "No se encontraron mensajes válidos en CSV."
      });
    }
    await db.models.ArcanaMessage.bulkCreate(normalized);
    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: `Mensajes importados: ${normalized.length}`,
      error: "",
      result: null
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: req.body?.messagesCsv || req.body?.csv || "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando mensajes CSV.",
      result: null
    });
  }
}

async function importConnectorsCsvFile(req, res, next) {
  try {
    const originalName = req.file?.originalname ? String(req.file.originalname) : "";
    const csv = decodeUploadedTextBuffer(req.file?.buffer);
    req.body.connectorsCsv = csv;
    return importConnectorsCsv(req, res, next);
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando archivo CSV (conectores).",
      result: null
    });
  }
}

async function importArcanaMessagesCsvFile(req, res, next) {
  try {
    const originalName = req.file?.originalname ? String(req.file.originalname) : "";
    const csv = decodeUploadedTextBuffer(req.file?.buffer);
    req.body.messagesCsv = csv;
    return importArcanaMessagesCsv(req, res, next);
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando archivo CSV (mensajes).",
      result: null
    });
  }
}

function normalizeHeaderKey(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeObjectKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    const nk = normalizeHeaderKey(k);
    if (!nk) continue;
    out[nk] = v;
  }
  return out;
}

async function importArcanaMessagesCsvWide(req, res, next) {
  try {
    function normalizeArcanaMessagePolarity(input) {
      const raw = String(input || "").trim().toLowerCase();
      if (!raw) return null;
      if (raw === "favorable") return "favorable";
      if (raw === "desafiante") return "desafiante";
      if (raw === "neutra") return "neutra";
      return null;
    }

    function normalizeArcanaMessageSentido(input) {
      const raw = String(input || "").trim().toLowerCase();
      if (!raw) return null;
      if (raw === "derecho") return "derecho";
      if (raw === "invertido") return "invertido";
      if (raw === "neutro") return "neutro";
      return null;
    }

    const csv = String(req.body?.messagesCsvWide || "");
    const rows = csvToObjects(csv).map(normalizeObjectKeys);

    const arcanos = await db.MajorArcana.findAll({ attributes: ["numero", "nombre"], raw: true, paranoid: false });
    const bySlug = new Map(arcanos.map((a) => [slugifyDash(a.nombre), a.numero]));

    const invalidPolaridad = new Set();
    const invalidSentido = new Set();
    for (const r of rows) {
      const pRaw = String(r?.polaridad ?? "").trim().toLowerCase();
      const sRaw = String(r?.sentido ?? "").trim().toLowerCase();
      if (!pRaw || !normalizeArcanaMessagePolarity(pRaw)) invalidPolaridad.add(pRaw || "(vacío)");
      if (!sRaw || !normalizeArcanaMessageSentido(sRaw)) invalidSentido.add(sRaw || "(vacío)");
    }
    if (invalidPolaridad.size > 0 || invalidSentido.size > 0) {
      const pol = Array.from(invalidPolaridad).slice(0, 10).join(", ");
      const sen = Array.from(invalidSentido).slice(0, 10).join(", ");
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv: "",
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: "",
        messagesCsv: "",
        messagesCsvWide: csv,
        connectorsStatus: "",
        messagesStatus: "",
        error:
          "Contrato inválido. Valores permitidos: polaridad=favorable|desafiante|neutra; sentido=derecho|invertido|neutro. " +
          `Recibidos: polaridad=[${pol}] sentido=[${sen}]`,
        result: null
      });
    }

    const records = [];
    for (const r of rows) {
      const idRaw = String(r.id ?? "").trim();
      let arcano_id = Number(idRaw);
      if (!Number.isInteger(arcano_id)) {
        const arcanoRaw = String(r.arcano ?? r.arcano_id ?? r.carta ?? "").trim();
        arcano_id = Number(arcanoRaw);
        if (!Number.isInteger(arcano_id)) {
          const slug = slugifyDash(arcanoRaw);
          arcano_id = bySlug.has(slug) ? bySlug.get(slug) : NaN;
        }
      }
      if (!Number.isInteger(arcano_id)) continue;

      const contexto = String(r.contexto || r.tema || "general").trim().toLowerCase() || "general";
      const posicion = String(r.posicion || "").trim().toLowerCase();
      const sentido = normalizeArcanaMessageSentido(r.sentido);
      const polaridad = normalizeArcanaMessagePolarity(r.polaridad);

      const variants = [
        { perfil_tono: "general", contenido: String(r.general || "").trim() },
        { perfil_tono: "empatico", contenido: String(r.empatico || "").trim() },
        { perfil_tono: "directo", contenido: String(r.directo || "").trim() },
        { perfil_tono: "mistico", contenido: String(r.mistico || "").trim() }
      ];

      for (const v of variants) {
        if (!v.contenido) continue;
        records.push({
          arcano_id,
          contexto,
          posicion,
          sentido,
          polaridad,
          perfil_tono: v.perfil_tono,
          contenido: v.contenido
        });
      }
    }

    if (records.length === 0) {
      return res.status(400).render("majorArcana/import", {
        title: "Importar Arcanos",
        json: "",
        csv: "",
        connectorsJson: "",
        connectorsCsv: "",
        messagesJson: "",
        messagesCsv: "",
        messagesCsvWide: csv,
        connectorsStatus: "",
        messagesStatus: "",
        error: "No se encontraron mensajes válidos en CSV (formato por columnas).",
        result: null
      });
    }

    const chunkSize = 1000;
    for (let i = 0; i < records.length; i += chunkSize) {
      await db.models.ArcanaMessage.bulkCreate(records.slice(i, i + chunkSize));
    }

    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      messagesCsvWide: "",
      connectorsStatus: "",
      messagesStatus: `Mensajes importados: ${records.length}`,
      error: "",
      result: null
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      messagesCsvWide: req.body?.messagesCsvWide || "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando mensajes CSV (formato por columnas).",
      result: null
    });
  }
}

async function importArcanaMessagesCsvWideFile(req, res, next) {
  try {
    const csv = decodeUploadedTextBuffer(req.file?.buffer);
    req.body.messagesCsvWide = csv;
    return importArcanaMessagesCsvWide(req, res, next);
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      messagesCsvWide: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error importando archivo CSV (mensajes por columnas).",
      result: null
    });
  }
}

async function deleteAllArcanaMessages(req, res) {
  try {
    const count = await db.models.ArcanaMessage.destroy({ where: {}, truncate: false });
    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      messagesCsvWide: "",
      connectorsStatus: "",
      messagesStatus: `Mensajes eliminados: ${count}`,
      error: "",
      result: null
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      csv: "",
      connectorsJson: "",
      connectorsCsv: "",
      messagesJson: "",
      messagesCsv: "",
      messagesCsvWide: "",
      connectorsStatus: "",
      messagesStatus: "",
      error: err?.message || "Error eliminando mensajes.",
      result: null
    });
  }
}

async function list(req, res, next) {
  try {
    const decks = await db.models.Deck.findAll({
      where: { is_active: true },
      attributes: ["id", "slug", "nombre"],
      order: [["id", "ASC"]],
      raw: true
    });

    if (!decks || decks.length === 0) {
      const arcanosRaw = await db.MajorArcana.findAll({ order: [["numero", "ASC"]], raw: true });
      const arcanos = [];
      for (const a of arcanosRaw) {
        const imagen_url_resolved = resolveImageUrl(a.numero, a.nombre, a.imagen_url);
        let imagen_thumb_url_resolved = resolveThumbUrl(a.numero, a.nombre, a.imagen_thumb_url, imagen_url_resolved);
        if (!imagen_thumb_url_resolved && String(imagen_url_resolved).startsWith("/public/img/")) {
          imagen_thumb_url_resolved = await ensureThumbForLocalImage(a.numero, a.nombre, imagen_url_resolved);
        }
        arcanos.push({ ...a, imagen_url_resolved, imagen_thumb_url_resolved });
      }
      return res.render("majorArcana/index", {
        title: "Cartas",
        arcanos,
        hasArcanos: arcanos.length > 0,
        decks: [],
        selectedDeckId: null
      });
    }

    const deckIdRaw = req.query?.deck_id ?? req.query?.deckId;
    const deckId = Number(deckIdRaw);
    const defaultDeck = decks.find((d) => d.slug === "default") || decks[0] || null;
    const selectedDeck =
      Number.isInteger(deckId) && deckId > 0 ? decks.find((d) => d.id === deckId) || defaultDeck : defaultDeck;

    const deckCards = selectedDeck
      ? await db.models.DeckCard.findAll({
          where: { deck_id: selectedDeck.id, card_kind: "major", enabled: true },
          attributes: ["card_numero", "imagen_url", "imagen_thumb_url", "extra"],
          order: [["card_numero", "ASC"]],
          raw: true
        })
      : [];

    const numeros = deckCards.map((r) => Number(r.card_numero)).filter((n) => Number.isInteger(n));
    const byNumeroDeck = new Map(deckCards.map((r) => [Number(r.card_numero), r]));

    const arcanosRaw = numeros.length
      ? await db.MajorArcana.findAll({ where: { numero: numeros }, order: [["numero", "ASC"]], raw: true })
      : [];

    const arcanos = [];
    for (const a of arcanosRaw) {
      const override = byNumeroDeck.get(a.numero) || null;
      const overrideUrl = override ? String(override.imagen_url || "").trim() : "";
      const overrideThumb = override ? String(override.imagen_thumb_url || "").trim() : "";

      const baseImagenUrl = overrideUrl || resolveImageUrl(a.numero, a.nombre, a.imagen_url);
      let baseThumbUrl = overrideThumb || resolveThumbUrl(a.numero, a.nombre, a.imagen_thumb_url, baseImagenUrl);
      if (!baseThumbUrl && String(baseImagenUrl).startsWith("/public/img/")) {
        baseThumbUrl = await ensureThumbForLocalImage(a.numero, a.nombre, baseImagenUrl);
      }

      arcanos.push({
        ...a,
        imagen_url_resolved: baseImagenUrl,
        imagen_thumb_url_resolved: baseThumbUrl
      });
    }

    res.render("majorArcana/index", {
      title: "Cartas",
      arcanos,
      hasArcanos: arcanos.length > 0,
      decks,
      selectedDeckId: selectedDeck ? selectedDeck.id : null
    });
  } catch (err) {
    next(err);
  }
}

function showCreateForm(req, res) {
  res.render("majorArcana/form", {
    title: "Nuevo Arcano",
    isEdit: false,
    heading: "Nuevo Arcano",
    formAction: "/arcanos",
    cancelHref: "/arcanos",
    arcano: {
      nombre: "",
      numero: "",
      significado_luz: "",
      significado_sombra: "",
      descripcion_visual: "",
      palabras_clave: "",
      imagen_url: "",
      imagen_thumb_url: "",
      planeta: "",
      numero_simbolismo: "",
      simbologia_mesa_elementos: "",
      simbologia_lemniscata: "",
      simbologia_ropa: "",
      significado_amor_luz: "",
      significado_amor_sombra: "",
      significado_trabajo_luz: "",
      significado_trabajo_sombra: "",
      significado_salud_luz: "",
      significado_salud_sombra: ""
    },
    errors: {}
  });
}

async function create(req, res, next) {
  try {
    const { errors, payload } = validateArcano(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).render("majorArcana/form", {
        title: "Nuevo Arcano",
        isEdit: false,
        heading: "Nuevo Arcano",
        formAction: "/arcanos",
        cancelHref: "/arcanos",
        arcano: { ...req.body },
        errors
      });
    }

    const primaryFiles = pickUploadedFiles(req, "imagen_file");
    const galleryFiles = pickUploadedFiles(req, "galeria_files");

    if (primaryFiles[0]?.buffer) {
      const saved = await saveImageAndThumb({ numero: payload.numero, nombre: payload.nombre, buffer: primaryFiles[0].buffer });
      payload.imagen_url = saved.imagen_url;
      payload.imagen_thumb_url = saved.imagen_thumb_url;
    } else if (payload.imagen_url && !payload.imagen_thumb_url) {
      payload.imagen_thumb_url = await ensureThumbForLocalImage(payload.numero, payload.nombre, payload.imagen_url);
    }

    const uploadedGallery = await saveGalleryImages({ numero: payload.numero, nombre: payload.nombre, files: galleryFiles });
    const primaryEntry = payload.imagen_url
      ? [{ imagen_url: payload.imagen_url, imagen_thumb_url: payload.imagen_thumb_url || "" }]
      : [];
    const image_gallery = mergeGallery([...primaryEntry, ...uploadedGallery]);
    if (image_gallery.length > 0) payload.extra = { image_gallery };

    await db.MajorArcana.create(payload);

    res.redirect("/arcanos");
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(400).render("majorArcana/form", {
        title: "Nuevo Arcano",
        isEdit: false,
        heading: "Nuevo Arcano",
        formAction: "/arcanos",
        cancelHref: "/arcanos",
        arcano: { ...req.body },
        errors: { numero: "Ya existe un arcano con ese número (0-21)." }
      });
    }
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render("notFound", { title: "No encontrado" });
    const arcanoRaw = await db.MajorArcana.findByPk(id, { raw: true });
    let arcano = null;
    if (arcanoRaw) {
      const imagen_url_resolved = resolveImageUrl(arcanoRaw.numero, arcanoRaw.nombre, arcanoRaw.imagen_url);
      let imagen_thumb_url_resolved = resolveThumbUrl(
        arcanoRaw.numero,
        arcanoRaw.nombre,
        arcanoRaw.imagen_thumb_url,
        imagen_url_resolved
      );
      if (!imagen_thumb_url_resolved && String(imagen_url_resolved).startsWith("/public/img/")) {
        imagen_thumb_url_resolved = await ensureThumbForLocalImage(arcanoRaw.numero, arcanoRaw.nombre, imagen_url_resolved);
      }
      const rawGallery = normalizeGallery(arcanoRaw.extra);
      const image_gallery_resolved = mergeGallery(
        [
          { imagen_url: imagen_url_resolved, imagen_thumb_url: imagen_thumb_url_resolved || "" },
          ...rawGallery
        ].map((g) => ({
          imagen_url: g.imagen_url,
          imagen_thumb_url: g.imagen_thumb_url || resolveThumbUrl(arcanoRaw.numero, arcanoRaw.nombre, "", g.imagen_url)
        }))
      );
      arcano = { ...arcanoRaw, imagen_url_resolved, imagen_thumb_url_resolved, image_gallery_resolved };
    }
    if (!arcano) return res.status(404).render("notFound", { title: "No encontrado" });
    res.render("majorArcana/show", { title: arcano.nombre, arcano });
  } catch (err) {
    next(err);
  }
}

async function showEditForm(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render("notFound", { title: "No encontrado" });
    const arcanoRaw = await db.MajorArcana.findByPk(id, { raw: true });
    const arcano = arcanoRaw
      ? { ...arcanoRaw, image_gallery: normalizeGallery(arcanoRaw.extra) }
      : null;
    if (!arcano) return res.status(404).render("notFound", { title: "No encontrado" });

    res.render("majorArcana/form", {
      title: `Editar: ${arcano.nombre}`,
      isEdit: true,
      heading: "Editar Arcano",
      formAction: `/arcanos/${id}?_method=PUT`,
      cancelHref: `/arcanos/${id}`,
      arcano,
      errors: {}
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render("notFound", { title: "No encontrado" });
    const existingInstance = await db.MajorArcana.findByPk(id);
    const existing = existingInstance ? existingInstance.get({ plain: true }) : null;
    if (!existing) return res.status(404).render("notFound", { title: "No encontrado" });

    const { errors, payload } = validateArcano(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).render("majorArcana/form", {
        title: `Editar: ${existing.nombre}`,
        isEdit: true,
        heading: "Editar Arcano",
        formAction: `/arcanos/${id}?_method=PUT`,
        cancelHref: `/arcanos/${id}`,
        arcano: { id, ...req.body },
        errors
      });
    }

    const primaryFiles = pickUploadedFiles(req, "imagen_file");
    const galleryFiles = pickUploadedFiles(req, "galeria_files");
    const keepExistingGallery = String(req.body?.clear_gallery || "").trim() !== "1";
    const existingGallery = keepExistingGallery ? normalizeGallery(existing.extra) : [];

    if (primaryFiles[0]?.buffer) {
      const saved = await saveImageAndThumb({ numero: payload.numero, nombre: payload.nombre, buffer: primaryFiles[0].buffer });
      payload.imagen_url = saved.imagen_url;
      payload.imagen_thumb_url = saved.imagen_thumb_url;
    } else {
      const imageChanged = String(payload.imagen_url || "") !== String(existing.imagen_url || "");
      const thumbMissing = !String(existing.imagen_thumb_url || "").trim();
      if ((imageChanged || thumbMissing) && payload.imagen_url) {
        payload.imagen_thumb_url = await ensureThumbForLocalImage(payload.numero, payload.nombre, payload.imagen_url);
      } else {
        delete payload.imagen_thumb_url;
      }
    }

    const uploadedGallery = await saveGalleryImages({ numero: payload.numero, nombre: payload.nombre, files: galleryFiles });
    const finalPrimaryUrl = String(payload.imagen_url || existing.imagen_url || "").trim();
    const finalPrimaryThumb = String(payload.imagen_thumb_url || existing.imagen_thumb_url || "").trim();
    const primaryEntry = finalPrimaryUrl ? [{ imagen_url: finalPrimaryUrl, imagen_thumb_url: finalPrimaryThumb }] : [];
    const image_gallery = mergeGallery([...primaryEntry, ...existingGallery, ...uploadedGallery]);
    payload.extra = { ...(existing.extra && typeof existing.extra === "object" ? existing.extra : {}), image_gallery };

    await existingInstance.update(payload);

    res.redirect(`/arcanos/${id}`);
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      const id = Number(req.params.id);
      const arcano = await db.MajorArcana.findByPk(id, { raw: true });
      return res.status(400).render("majorArcana/form", {
        title: `Editar: ${arcano?.nombre || "Arcano"}`,
        isEdit: true,
        heading: "Editar Arcano",
        formAction: `/arcanos/${id}?_method=PUT`,
        cancelHref: `/arcanos/${id}`,
        arcano: { id, ...req.body },
        errors: { numero: "Ya existe un arcano con ese número (0-21)." }
      });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render("notFound", { title: "No encontrado" });
    await db.MajorArcana.destroy({ where: { id } });
    res.redirect("/arcanos");
  } catch (err) {
    next(err);
  }
}

async function exportJson(req, res, next) {
  try {
    const rows = await db.MajorArcana.findAll({ order: [["numero", "ASC"]], raw: true });

    const author = process.env.EXPORT_AUTHOR ? String(process.env.EXPORT_AUTHOR) : "Oracle Family Devs";
    const version = process.env.EXPORT_VERSION ? String(process.env.EXPORT_VERSION) : "1.0.0";
    const lastUpdated = new Date().toISOString();

    const payload = {
      metadata: {
        version,
        last_updated: lastUpdated,
        author
      },
      arcanos_mayores: rows.map((r) => ({
        id: r.numero,
        number: String(r.numero),
        slug: slugify(r.nombre),
        name: r.nombre,
        arcana_type: "major",
        keywords: keywordsToArray(r.palabras_clave),
        meanings: {
          upright: {
            general: r.significado_luz,
            advice: "",
            career: ""
          },
          reversed: {
            general: r.significado_sombra,
            advice: "",
            career: ""
          }
        },
        visual_description: r.descripcion_visual,
        image_url: resolveImageUrl(r.numero, r.nombre, r.imagen_url),
        attributes: {
          element: "",
          astrology: "",
          color_hex: ""
        }
      }))
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="arcanos.json"');
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
}

async function exportJsonV2(req, res, next) {
  try {
    const rows = await db.MajorArcana.findAll({ order: [["numero", "ASC"]], raw: true });
    const etag = `"${crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex")}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=60");
    const maxUpdatedAt = rows.reduce((acc, r) => {
      const v = r?.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      return v > acc ? v : acc;
    }, 0);
    if (maxUpdatedAt) res.setHeader("Last-Modified", new Date(maxUpdatedAt).toUTCString());
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    const author = process.env.EXPORT_AUTHOR ? String(process.env.EXPORT_AUTHOR) : "Oracle Family Devs";
    const version = process.env.EXPORT_VERSION_V2 ? String(process.env.EXPORT_VERSION_V2) : "2.0.0";
    const lastUpdated = new Date().toISOString();

    const payload = {
      metadata: {
        version,
        last_updated: lastUpdated,
        author
      },
      arcanos_mayores: rows.map((r) => {
        const extra = r.extra && typeof r.extra === "object" ? r.extra : {};
        const meaningsExtra = extra.meanings && typeof extra.meanings === "object" ? extra.meanings : {};
        const uprightExtra = meaningsExtra.upright && typeof meaningsExtra.upright === "object" ? meaningsExtra.upright : {};
        const reversedExtra = meaningsExtra.reversed && typeof meaningsExtra.reversed === "object" ? meaningsExtra.reversed : {};
        const attributesExtra = extra.attributes && typeof extra.attributes === "object" ? extra.attributes : {};

        return {
          id: r.numero,
          number: String(r.numero),
          slug: slugify(r.nombre),
          name: r.nombre,
          arcana_type: "major",
          keywords: keywordsToArray(r.palabras_clave),
          base_attributes: {
            planet: String(r.planeta || ""),
            number_symbolism: String(r.numero_simbolismo || "")
          },
          symbolism: {
            table_of_elements: String(r.simbologia_mesa_elementos || ""),
            lemniscate: String(r.simbologia_lemniscata || ""),
            clothing: String(r.simbologia_ropa || "")
          },
          meanings: {
            upright: {
              general: r.significado_luz,
              advice: String(uprightExtra.advice || ""),
              career: String(uprightExtra.career || "")
            },
            reversed: {
              general: r.significado_sombra,
              advice: String(reversedExtra.advice || ""),
              career: String(reversedExtra.career || "")
            }
          },
          meanings_by_area: {
            love: {
              upright: String(r.significado_amor_luz || ""),
              reversed: String(r.significado_amor_sombra || "")
            },
            work: {
              upright: String(r.significado_trabajo_luz || ""),
              reversed: String(r.significado_trabajo_sombra || "")
            },
            health: {
              upright: String(r.significado_salud_luz || ""),
              reversed: String(r.significado_salud_sombra || "")
            }
          },
          visual_description: r.descripcion_visual,
          image_url: resolveImageUrl(r.numero, r.nombre, r.imagen_url),
          image_thumb_url: resolveThumbUrl(r.numero, r.nombre, r.imagen_thumb_url, r.imagen_url),
          attributes: {
            element: String(attributesExtra.element || ""),
            astrology: String(attributesExtra.astrology || ""),
            color_hex: String(attributesExtra.color_hex || "")
          },
          extra
        };
      })
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="arcanos.v2.json"');
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
}

function parseFields(input) {
  const out = new Set();
  const values = Array.isArray(input) ? input : input ? [input] : [];
  for (const v of values) {
    const s = String(v || "").trim();
    if (s) out.add(s);
  }
  return out;
}

function fieldsFromQueryParam(param) {
  const out = new Set();
  const raw = String(param || "").trim();
  if (!raw) return out;
  for (const token of raw.split(",")) {
    const s = token.trim();
    if (s) out.add(s);
  }
  return out;
}

function makeSelectedObject(fields) {
  const keys = [
    "base",
    "keywords",
    "base_attributes",
    "symbolism",
    "meanings_general",
    "meanings_details",
    "meanings_by_area",
    "visual_description",
    "image_url",
    "image_thumb_url",
    "attributes",
    "extra"
  ];
  const selected = {};
  for (const k of keys) selected[k] = fields.has(k);
  return selected;
}

function buildDownloadUrl(version, fields) {
  const fieldStr = Array.from(fields).join(",");
  return `/arcanos/export/custom/arcanos.json?v=${encodeURIComponent(version)}&fields=${encodeURIComponent(fieldStr)}`;
}

function buildEndpointHint(version) {
  return version === "1"
    ? "V1 estable: /arcanos/export/arcanos.json"
    : "V2 estable: /arcanos/export/v2/arcanos.json";
}

function buildExportPayload(rows, version, fields) {
  const author = process.env.EXPORT_AUTHOR ? String(process.env.EXPORT_AUTHOR) : "Oracle Family Devs";
  const metaVersion =
    version === "1"
      ? process.env.EXPORT_VERSION
        ? String(process.env.EXPORT_VERSION)
        : "1.0.0"
      : process.env.EXPORT_VERSION_V2
        ? String(process.env.EXPORT_VERSION_V2)
        : "2.0.0";
  const lastUpdated = new Date().toISOString();

  const includeBase = !fields || fields.size === 0 || fields.has("base");
  const includeKeywords = fields?.has("keywords");
  const includeBaseAttributes = fields?.has("base_attributes");
  const includeSymbolism = fields?.has("symbolism");
  const includeMeaningsGeneral = fields?.has("meanings_general");
  const includeMeaningsDetails = fields?.has("meanings_details");
  const includeMeaningsByArea = fields?.has("meanings_by_area");
  const includeVisual = fields?.has("visual_description");
  const includeImage = fields?.has("image_url");
  const includeImageThumb = fields?.has("image_thumb_url");
  const includeAttributes = fields?.has("attributes");
  const includeExtra = fields?.has("extra");

  return {
    metadata: {
      version: metaVersion,
      last_updated: lastUpdated,
      author
    },
    arcanos_mayores: rows.map((r) => {
      const extra = r.extra && typeof r.extra === "object" ? r.extra : {};
      const meaningsExtra = extra.meanings && typeof extra.meanings === "object" ? extra.meanings : {};
      const uprightExtra = meaningsExtra.upright && typeof meaningsExtra.upright === "object" ? meaningsExtra.upright : {};
      const reversedExtra = meaningsExtra.reversed && typeof meaningsExtra.reversed === "object" ? meaningsExtra.reversed : {};
      const attributesExtra = extra.attributes && typeof extra.attributes === "object" ? extra.attributes : {};

      const out = {};

      if (includeBase) {
        out.id = r.numero;
        out.number = String(r.numero);
        out.slug = slugify(r.nombre);
        out.name = r.nombre;
        out.arcana_type = "major";
      }

      if (includeKeywords) out.keywords = keywordsToArray(r.palabras_clave);

      if (includeBaseAttributes) {
        out.base_attributes = {
          planet: String(r.planeta || ""),
          number_symbolism: String(r.numero_simbolismo || "")
        };
      }

      if (includeSymbolism) {
        out.symbolism = {
          table_of_elements: String(r.simbologia_mesa_elementos || ""),
          lemniscate: String(r.simbologia_lemniscata || ""),
          clothing: String(r.simbologia_ropa || "")
        };
      }

      if (includeMeaningsGeneral || includeMeaningsDetails) {
        const meanings = { upright: {}, reversed: {} };
        if (includeMeaningsGeneral) {
          meanings.upright.general = r.significado_luz;
          meanings.reversed.general = r.significado_sombra;
        }
        if (version !== "1" && includeMeaningsDetails) {
          meanings.upright.advice = String(uprightExtra.advice || "");
          meanings.upright.career = String(uprightExtra.career || "");
          meanings.reversed.advice = String(reversedExtra.advice || "");
          meanings.reversed.career = String(reversedExtra.career || "");
        }
        out.meanings = meanings;
      }

      if (includeMeaningsByArea) {
        out.meanings_by_area = {
          love: {
            upright: String(r.significado_amor_luz || ""),
            reversed: String(r.significado_amor_sombra || "")
          },
          work: {
            upright: String(r.significado_trabajo_luz || ""),
            reversed: String(r.significado_trabajo_sombra || "")
          },
          health: {
            upright: String(r.significado_salud_luz || ""),
            reversed: String(r.significado_salud_sombra || "")
          }
        };
      }

      if (includeVisual) out.visual_description = r.descripcion_visual;
      if (includeImage) out.image_url = resolveImageUrl(r.numero, r.nombre, r.imagen_url);
      if (includeImageThumb) out.image_thumb_url = resolveThumbUrl(r.numero, r.nombre, r.imagen_thumb_url, r.imagen_url);

      if (includeAttributes) {
        out.attributes =
          version === "1"
            ? { element: "", astrology: "", color_hex: "" }
            : {
                element: String(attributesExtra.element || ""),
                astrology: String(attributesExtra.astrology || ""),
                color_hex: String(attributesExtra.color_hex || "")
              };
      }

      if (version !== "1" && includeExtra) out.extra = extra;

      return out;
    })
  };
}

async function showExportBuilder(req, res, next) {
  try {
    const version = "2";
    const fields = new Set([
      "base",
      "keywords",
      "base_attributes",
      "symbolism",
      "meanings_general",
      "meanings_details",
      "meanings_by_area",
      "visual_description",
      "image_url",
      "image_thumb_url",
      "attributes",
      "extra"
    ]);
    const rows = await db.MajorArcana.findAll({ order: [["numero", "ASC"]], raw: true });
    const previewCount = Math.min(3, rows.length);
    const payload = buildExportPayload(rows.slice(0, previewCount), version, fields);
    const preview = JSON.stringify(payload, null, 2);

    res.render("majorArcana/exportBuilder", {
      title: "Export Builder",
      version,
      selected: makeSelectedObject(fields),
      preview,
      previewCount,
      endpointHint: buildEndpointHint(version),
      downloadUrl: buildDownloadUrl(version, fields),
      error: ""
    });
  } catch (err) {
    next(err);
  }
}

async function previewExportBuilder(req, res, next) {
  try {
    const version = req.body?.version === "1" ? "1" : "2";
    const fields = parseFields(req.body?.fields);
    if (!fields.has("base")) fields.add("base");
    const rows = await db.MajorArcana.findAll({ order: [["numero", "ASC"]], raw: true });
    const previewCount = Math.min(3, rows.length);
    const payload = buildExportPayload(rows.slice(0, previewCount), version, fields);
    const preview = JSON.stringify(payload, null, 2);

    res.render("majorArcana/exportBuilder", {
      title: "Export Builder",
      version,
      selected: makeSelectedObject(fields),
      preview,
      previewCount,
      endpointHint: buildEndpointHint(version),
      downloadUrl: buildDownloadUrl(version, fields),
      error: ""
    });
  } catch (err) {
    const message =
      err instanceof SyntaxError ? "Error de parseo." : err?.message || "Error generando preview.";
    res.status(400).render("majorArcana/exportBuilder", {
      title: "Export Builder",
      version: req.body?.version === "1" ? "1" : "2",
      selected: makeSelectedObject(new Set(["base"])),
      preview: "",
      previewCount: 0,
      endpointHint: "",
      downloadUrl: "/arcanos/export/custom/arcanos.json?v=2&fields=base",
      error: message
    });
  }
}

async function exportJsonCustom(req, res, next) {
  try {
    const version = req.query?.v === "1" ? "1" : "2";
    const fields = fieldsFromQueryParam(req.query?.fields);
    if (!fields.has("base")) fields.add("base");

    const rows = await db.MajorArcana.findAll({ order: [["numero", "ASC"]], raw: true });
    const payload = buildExportPayload(rows, version, fields);

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="arcanos.custom.v${version}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showImportForm,
  importJson,
  importCsv,
  importCsvFile,
  importConnectorsJson,
  importArcanaMessagesJson,
  importConnectorsCsv,
  importArcanaMessagesCsv,
  importConnectorsCsvFile,
  importArcanaMessagesCsvFile,
  importArcanaMessagesCsvWide,
  importArcanaMessagesCsvWideFile,
  deleteAllArcanaMessages,
  importLocal,
  list,
  showCreateForm,
  create,
  show,
  showEditForm,
  update,
  remove,
  exportJson,
  exportJsonV2,
  showExportBuilder,
  previewExportBuilder,
  exportJsonCustom
};
