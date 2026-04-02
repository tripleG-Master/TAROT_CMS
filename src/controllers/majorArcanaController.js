const fs = require("node:fs");
const path = require("node:path");
const db = require("../db");

const imgDir = path.join(__dirname, "..", "..", "public", "img");
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

function resolveImageUrl(nombre, imagenUrl) {
  const current = cleanText(imagenUrl);
  if (current) return current;

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
    imagen_url: String(body.imagen_url || "").trim()
  };

  return { errors, payload };
}

function showImportForm(req, res) {
  res.render("majorArcana/import", {
    title: "Importar Arcanos",
    json: "",
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
    nombre,
    normalized.imagen_url ?? normalized.image_url ?? raw?.imagen_url ?? raw?.image_url
  );

  return {
    nombre,
    numero,
    significado_luz,
    significado_sombra,
    descripcion_visual,
    palabras_clave,
    imagen_url
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
        error: "No se encontraron entradas válidas para importar (número 0–21 y nombre obligatorio).",
        result: null
      });
    }

    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
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
      error: message,
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
        error: "No se encontraron entradas válidas en data/arcanosMajores.json.",
        result: null
      });
    }

    res.render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      error: "",
      result: { created, updated, skipped }
    });
  } catch (err) {
    res.status(400).render("majorArcana/import", {
      title: "Importar Arcanos",
      json: "",
      error: err?.message || "Error leyendo data/arcanosMajores.json.",
      result: null
    });
  }
}

async function list(req, res, next) {
  try {
    const arcanos = await db.MajorArcana.findAll({ order: [["numero", "ASC"]], raw: true });
    res.render("majorArcana/index", {
      title: "Arcanos Mayores",
      arcanos,
      hasArcanos: arcanos.length > 0
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
      imagen_url: ""
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
    const arcano = await db.MajorArcana.findByPk(id, { raw: true });
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
    const arcano = await db.MajorArcana.findByPk(id, { raw: true });
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
        image_url: resolveImageUrl(r.nombre, r.imagen_url),
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

module.exports = {
  showImportForm,
  importJson,
  importLocal,
  list,
  showCreateForm,
  create,
  show,
  showEditForm,
  update,
  remove,
  exportJson
};
