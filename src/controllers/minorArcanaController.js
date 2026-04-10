const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const db = require("../db");

const minorImgDir = path.join(__dirname, "..", "..", "public", "img", "minor");
const minorThumbDir = path.join(minorImgDir, "thumbs");

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeKeywords(input) {
  if (Array.isArray(input)) return input.map(String).join(", ");
  return String(input || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function ensureDirs() {
  if (!fs.existsSync(minorImgDir)) fs.mkdirSync(minorImgDir, { recursive: true });
  if (!fs.existsSync(minorThumbDir)) fs.mkdirSync(minorThumbDir, { recursive: true });
}

function resolveMinorImageUrl(numero, imagenUrl) {
  const current = cleanText(imagenUrl);
  if (current) return current;
  if (!Number.isInteger(numero)) return "";
  const n = String(numero);
  const candidates = [`${n}.jpg`, `${n}.jpeg`, `${n}.png`, `${n}.webp`];
  const existing = candidates.find((f) => fs.existsSync(path.join(minorImgDir, f)));
  const fileName = existing || candidates[0];
  return `/public/img/minor/${fileName}`;
}

function resolveMinorThumbUrl(numero, imagenThumbUrl, imagenUrl) {
  const current = cleanText(imagenThumbUrl);
  if (current) return current;
  if (!Number.isInteger(numero)) return "";

  const n = String(numero);
  const candidates = [
    `${n}.thumb.webp`,
    `${n}.thumb.jpg`,
    `${n}.thumb.jpeg`,
    `${n}.thumb.png`
  ];
  const existing = candidates.find((f) => fs.existsSync(path.join(minorThumbDir, f)));
  if (existing) return `/public/img/minor/thumbs/${existing}`;

  const image = cleanText(imagenUrl);
  if (image) {
    const match = image.match(/^\/public\/img\/minor\/(.+)$/);
    if (match) {
      const baseName = match[1].replace(/\.[^.]+$/, "");
      const derived = [
        `${baseName}.thumb.webp`,
        `${baseName}.thumb.jpg`,
        `${baseName}.thumb.jpeg`,
        `${baseName}.thumb.png`
      ];
      const existing2 = derived.find((f) => fs.existsSync(path.join(minorThumbDir, f)));
      if (existing2) return `/public/img/minor/thumbs/${existing2}`;
    }
  }

  return "";
}

async function writeThumbFromFilePath(inputPath, outThumbPath) {
  ensureDirs();
  await sharp(inputPath)
    .resize({ width: 256, height: 256, fit: "cover" })
    .webp({ quality: 72 })
    .toFile(outThumbPath);
}

async function saveMinorImageAndThumb({ numero, buffer }) {
  ensureDirs();
  const base = Number.isInteger(numero) ? String(numero) : String(Date.now());
  const imageFile = `${base}.webp`;
  const thumbFile = `${base}.thumb.webp`;

  const imagePath = path.join(minorImgDir, imageFile);
  const thumbPath = path.join(minorThumbDir, thumbFile);

  await sharp(buffer).resize({ width: 1024, withoutEnlargement: true }).webp({ quality: 82 }).toFile(imagePath);
  await sharp(buffer).resize({ width: 256, height: 256, fit: "cover" }).webp({ quality: 72 }).toFile(thumbPath);

  return {
    imagen_url: `/public/img/minor/${imageFile}`,
    imagen_thumb_url: `/public/img/minor/thumbs/${thumbFile}`
  };
}

function localMinorPublicImgPath(imagenUrl) {
  const match = String(imagenUrl || "").match(/^\/public\/img\/minor\/(.+)$/);
  if (!match) return null;
  const rel = match[1];
  return path.join(minorImgDir, rel);
}

async function ensureThumbForLocalMinorImage(numero, imagenUrl) {
  const localPath = localMinorPublicImgPath(imagenUrl);
  if (!localPath || !fs.existsSync(localPath)) return "";
  ensureDirs();

  const base = Number.isInteger(numero) ? String(numero) : path.basename(localPath).replace(/\.[^.]+$/, "");
  const thumbFile = `${base}.thumb.webp`;
  const thumbPath = path.join(minorThumbDir, thumbFile);
  if (!fs.existsSync(thumbPath)) {
    await writeThumbFromFilePath(localPath, thumbPath);
  }
  return `/public/img/minor/thumbs/${thumbFile}`;
}

function mapImportRow(raw) {
  if (!raw || typeof raw !== "object") return null;
  const nombre = cleanText(raw.nombre ?? raw.Nombre ?? raw.name);
  const numero = Number(raw.numero ?? raw.Numero ?? raw.number);
  const palo = cleanText(raw.palo ?? raw.Palo ?? raw.suit);
  const valor = cleanText(raw.valor ?? raw.Valor ?? raw.rank ?? raw.value);

  if (!Number.isInteger(numero)) return null;
  if (!nombre) return null;

  const significado_luz = cleanText(raw.significado_luz ?? raw.significadoLuz ?? raw.upright ?? raw.meaning_upright);
  const significado_sombra = cleanText(raw.significado_sombra ?? raw.significadoSombra ?? raw.reversed ?? raw.meaning_reversed);
  const descripcion_visual = cleanText(raw.descripcion_visual ?? raw.descripcionVisual ?? raw.visual_description);
  const palabras_clave = normalizeKeywords(raw.palabras_clave ?? raw.palabrasClave ?? raw.keywords);
  const imagen_url = cleanText(raw.imagen_url ?? raw.image_url ?? "");
  const imagen_thumb_url = cleanText(raw.imagen_thumb_url ?? raw.image_thumb_url ?? "");

  return {
    numero,
    palo,
    valor,
    nombre,
    significado_luz,
    significado_sombra,
    descripcion_visual,
    palabras_clave,
    imagen_url,
    imagen_thumb_url
  };
}

function detectDelimiter(line) {
  const sample = String(line || "");
  const counts = { "\t": 0, ";": 0, ",": 0 };
  for (const ch of sample) {
    if (ch === "\t") counts["\t"] += 1;
    else if (ch === ";") counts[";"] += 1;
    else if (ch === ",") counts[","] += 1;
  }
  let best = "\t";
  let bestCount = counts["\t"];
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    }
  }
  return bestCount === 0 ? ";" : best;
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

async function performImport(rows) {
  const mapped = new Map();
  for (const r of rows) {
    const m = mapImportRow(r);
    if (!m) continue;
    mapped.set(m.numero, m);
  }

  const items = Array.from(mapped.values()).sort((a, b) => a.numero - b.numero);
  if (items.length === 0) return { created: 0, updated: 0, skipped: rows.length };

  for (const item of items) {
    item.deletedAt = null;
    const resolved = resolveMinorImageUrl(item.numero, item.imagen_url);
    item.imagen_url = resolved;
    if (!String(item.imagen_thumb_url || "").trim() && String(item.imagen_url || "").startsWith("/public/img/minor/")) {
      item.imagen_thumb_url = await ensureThumbForLocalMinorImage(item.numero, item.imagen_url);
    }
  }

  const existing = await db.MinorArcana.findAll({
    where: { numero: items.map((i) => i.numero) },
    attributes: ["numero"],
    raw: true,
    paranoid: false
  });
  const existingSet = new Set(existing.map((e) => e.numero));

  let created = 0;
  let updated = 0;
  for (const item of items) {
    await db.MinorArcana.upsert(item);
    if (existingSet.has(item.numero)) updated += 1;
    else created += 1;
  }
  const skipped = Math.max(0, rows.length - items.length);
  return { created, updated, skipped };
}

async function list(req, res, next) {
  try {
    const rows = await db.MinorArcana.findAll({ order: [["numero", "ASC"]], raw: true });
    const items = rows.map((r) => {
      const imagen_url_resolved = resolveMinorImageUrl(r.numero, r.imagen_url);
      const imagen_thumb_url_resolved = resolveMinorThumbUrl(r.numero, r.imagen_thumb_url, imagen_url_resolved);
      return { ...r, imagen_url_resolved, imagen_thumb_url_resolved };
    });
    res.render("minorArcana/index", { title: "Arcanos Menores", items, hasItems: items.length > 0 });
  } catch (err) {
    next(err);
  }
}

function showCreateForm(req, res) {
  res.render("minorArcana/form", {
    title: "Nuevo Arcano Menor",
    isEdit: false,
    heading: "Nuevo Arcano Menor",
    formAction: "/menores",
    cancelHref: "/menores",
    item: {
      numero: "",
      palo: "",
      valor: "",
      nombre: "",
      palabras_clave: "",
      significado_luz: "",
      significado_sombra: "",
      descripcion_visual: "",
      imagen_url: "",
      imagen_thumb_url: ""
    },
    errors: {}
  });
}

async function create(req, res, next) {
  try {
    const payload = {
      numero: Number(req.body?.numero),
      palo: cleanText(req.body?.palo),
      valor: cleanText(req.body?.valor),
      nombre: cleanText(req.body?.nombre),
      palabras_clave: normalizeKeywords(req.body?.palabras_clave),
      significado_luz: cleanText(req.body?.significado_luz),
      significado_sombra: cleanText(req.body?.significado_sombra),
      descripcion_visual: cleanText(req.body?.descripcion_visual),
      imagen_url: cleanText(req.body?.imagen_url),
      imagen_thumb_url: cleanText(req.body?.imagen_thumb_url)
    };

    if (!Number.isInteger(payload.numero) || payload.numero < 0) {
      return res.status(400).render("minorArcana/form", {
        title: "Nuevo Arcano Menor",
        isEdit: false,
        heading: "Nuevo Arcano Menor",
        formAction: "/menores",
        cancelHref: "/menores",
        item: payload,
        errors: { numero: "Número inválido." }
      });
    }
    if (!payload.nombre) {
      return res.status(400).render("minorArcana/form", {
        title: "Nuevo Arcano Menor",
        isEdit: false,
        heading: "Nuevo Arcano Menor",
        formAction: "/menores",
        cancelHref: "/menores",
        item: payload,
        errors: { nombre: "Nombre es obligatorio." }
      });
    }

    if (req.file?.buffer) {
      const saved = await saveMinorImageAndThumb({ numero: payload.numero, buffer: req.file.buffer });
      payload.imagen_url = saved.imagen_url;
      payload.imagen_thumb_url = saved.imagen_thumb_url;
    } else if (payload.imagen_url && !payload.imagen_thumb_url && String(payload.imagen_url).startsWith("/public/img/minor/")) {
      payload.imagen_thumb_url = await ensureThumbForLocalMinorImage(payload.numero, payload.imagen_url);
    }

    const created = await db.MinorArcana.create(payload);
    res.redirect(`/menores/${created.id}`);
  } catch (err) {
    next(err);
  }
}

async function show(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render("notFound", { title: "No encontrado" });
    const raw = await db.MinorArcana.findByPk(id, { raw: true });
    if (!raw) return res.status(404).render("notFound", { title: "No encontrado" });
    const imagen_url_resolved = resolveMinorImageUrl(raw.numero, raw.imagen_url);
    const imagen_thumb_url_resolved = resolveMinorThumbUrl(raw.numero, raw.imagen_thumb_url, imagen_url_resolved);
    res.render("minorArcana/show", {
      title: raw.nombre,
      item: { ...raw, imagen_url_resolved, imagen_thumb_url_resolved }
    });
  } catch (err) {
    next(err);
  }
}

async function showEditForm(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render("notFound", { title: "No encontrado" });
    const item = await db.MinorArcana.findByPk(id, { raw: true });
    if (!item) return res.status(404).render("notFound", { title: "No encontrado" });
    res.render("minorArcana/form", {
      title: `Editar: ${item.nombre}`,
      isEdit: true,
      heading: `Editar: ${item.nombre}`,
      formAction: `/menores/${id}?_method=PUT`,
      cancelHref: `/menores/${id}`,
      item,
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
    const existing = await db.MinorArcana.findByPk(id, { raw: true, paranoid: false });
    if (!existing) return res.status(404).render("notFound", { title: "No encontrado" });

    const payload = {
      numero: Number(req.body?.numero),
      palo: cleanText(req.body?.palo),
      valor: cleanText(req.body?.valor),
      nombre: cleanText(req.body?.nombre),
      palabras_clave: normalizeKeywords(req.body?.palabras_clave),
      significado_luz: cleanText(req.body?.significado_luz),
      significado_sombra: cleanText(req.body?.significado_sombra),
      descripcion_visual: cleanText(req.body?.descripcion_visual),
      imagen_url: cleanText(req.body?.imagen_url),
      imagen_thumb_url: cleanText(req.body?.imagen_thumb_url)
    };

    if (!Number.isInteger(payload.numero) || payload.numero < 0) {
      return res.status(400).render("minorArcana/form", {
        title: `Editar: ${existing.nombre}`,
        isEdit: true,
        heading: `Editar: ${existing.nombre}`,
        formAction: `/menores/${id}?_method=PUT`,
        cancelHref: `/menores/${id}`,
        item: { ...existing, ...payload },
        errors: { numero: "Número inválido." }
      });
    }
    if (!payload.nombre) {
      return res.status(400).render("minorArcana/form", {
        title: `Editar: ${existing.nombre}`,
        isEdit: true,
        heading: `Editar: ${existing.nombre}`,
        formAction: `/menores/${id}?_method=PUT`,
        cancelHref: `/menores/${id}`,
        item: { ...existing, ...payload },
        errors: { nombre: "Nombre es obligatorio." }
      });
    }

    if (req.file?.buffer) {
      const saved = await saveMinorImageAndThumb({ numero: payload.numero, buffer: req.file.buffer });
      payload.imagen_url = saved.imagen_url;
      payload.imagen_thumb_url = saved.imagen_thumb_url;
    } else {
      const imageChanged = String(payload.imagen_url || "") !== String(existing.imagen_url || "");
      const thumbMissing = !String(existing.imagen_thumb_url || "").trim();
      if ((imageChanged || thumbMissing) && payload.imagen_url && String(payload.imagen_url).startsWith("/public/img/minor/")) {
        payload.imagen_thumb_url = await ensureThumbForLocalMinorImage(payload.numero, payload.imagen_url);
      } else {
        delete payload.imagen_thumb_url;
      }
    }

    await db.MinorArcana.update(payload, { where: { id } });
    res.redirect(`/menores/${id}`);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(404).render("notFound", { title: "No encontrado" });
    await db.MinorArcana.destroy({ where: { id } });
    res.redirect("/menores");
  } catch (err) {
    next(err);
  }
}

function showImportForm(req, res) {
  res.render("minorArcana/import", {
    title: "Importar Arcanos Menores",
    json: "",
    csv: "",
    error: "",
    result: null
  });
}

async function importJson(req, res) {
  try {
    const input = req.body?.json ?? req.body;
    let rows = input;
    if (typeof rows === "string") {
      const trimmed = rows.trim();
      rows = trimmed ? JSON.parse(trimmed) : null;
    }
    const list = Array.isArray(rows) ? rows : rows?.items ?? [];
    const { created, updated, skipped } = await performImport(list);
    if (created + updated === 0) {
      return res.status(400).render("minorArcana/import", {
        title: "Importar Arcanos Menores",
        json: typeof input === "string" ? input : JSON.stringify(req.body, null, 2),
        csv: "",
        error: "No se encontraron entradas válidas.",
        result: null
      });
    }
    res.render("minorArcana/import", {
      title: "Importar Arcanos Menores",
      json: "",
      csv: "",
      error: "",
      result: { created, updated, skipped }
    });
  } catch (err) {
    res.status(400).render("minorArcana/import", {
      title: "Importar Arcanos Menores",
      json: req.body?.json || "",
      csv: "",
      error: err?.message || "Error importando JSON.",
      result: null
    });
  }
}

async function importCsv(req, res) {
  try {
    const csv = String(req.body?.csv || "");
    const rows = csvToObjects(csv);
    const { created, updated, skipped } = await performImport(rows);
    if (created + updated === 0) {
      return res.status(400).render("minorArcana/import", {
        title: "Importar Arcanos Menores",
        json: "",
        csv,
        error: "No se encontraron entradas válidas en el CSV.",
        result: null
      });
    }
    res.render("minorArcana/import", {
      title: "Importar Arcanos Menores",
      json: "",
      csv: "",
      error: "",
      result: { created, updated, skipped }
    });
  } catch (err) {
    res.status(400).render("minorArcana/import", {
      title: "Importar Arcanos Menores",
      json: "",
      csv: req.body?.csv || "",
      error: err?.message || "Error importando CSV.",
      result: null
    });
  }
}

async function importCsvFile(req, res) {
  try {
    const csv = req.file?.buffer ? req.file.buffer.toString("utf8") : "";
    const rows = csvToObjects(csv);
    const { created, updated, skipped } = await performImport(rows);
    if (created + updated === 0) {
      return res.status(400).render("minorArcana/import", {
        title: "Importar Arcanos Menores",
        json: "",
        csv,
        error: "No se encontraron entradas válidas en el archivo.",
        result: null
      });
    }
    res.render("minorArcana/import", {
      title: "Importar Arcanos Menores",
      json: "",
      csv: "",
      error: "",
      result: { created, updated, skipped }
    });
  } catch (err) {
    res.status(400).render("minorArcana/import", {
      title: "Importar Arcanos Menores",
      json: "",
      csv: "",
      error: err?.message || "Error importando archivo CSV.",
      result: null
    });
  }
}

async function exportJsonV2(req, res, next) {
  try {
    const rows = await db.MinorArcana.findAll({ order: [["numero", "ASC"]], raw: true });

    const author = process.env.EXPORT_AUTHOR ? String(process.env.EXPORT_AUTHOR) : "Oracle Family Devs";
    const version = process.env.EXPORT_VERSION_V2 ? String(process.env.EXPORT_VERSION_V2) : "2.0.0";
    const lastUpdated = new Date().toISOString();

    const payload = {
      metadata: { version, last_updated: lastUpdated, author },
      arcanos_menores: rows.map((r) => ({
        id: r.numero,
        number: String(r.numero),
        name: r.nombre,
        arcana_type: "minor",
        suit: String(r.palo || ""),
        rank: String(r.valor || ""),
        keywords: String(r.palabras_clave || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        meanings: {
          upright: { general: r.significado_luz },
          reversed: { general: r.significado_sombra }
        },
        visual_description: r.descripcion_visual,
        image_url: resolveMinorImageUrl(r.numero, r.imagen_url),
        image_thumb_url: resolveMinorThumbUrl(r.numero, r.imagen_thumb_url, r.imagen_url),
        extra: r.extra && typeof r.extra === "object" ? r.extra : {}
      }))
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="arcanos-menores.v2.json"');
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  showCreateForm,
  create,
  show,
  showEditForm,
  update,
  remove,
  showImportForm,
  importJson,
  importCsv,
  importCsvFile,
  exportJsonV2
};
