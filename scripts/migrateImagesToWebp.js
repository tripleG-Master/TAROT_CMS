const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const dotenv = require("dotenv");
const { initDb } = require("../src/db");
const db = require("../src/db");

dotenv.config();

function isImageExt(ext) {
  const e = String(ext || "").toLowerCase();
  return e === ".jpg" || e === ".jpeg" || e === ".png" || e === ".webp";
}

function toWebpFileName(fileName) {
  const ext = path.extname(fileName);
  if (!ext) return `${fileName}.webp`;
  return fileName.slice(0, -ext.length) + ".webp";
}

function isThumbDir(dirPath) {
  const norm = dirPath.replace(/\\/g, "/").toLowerCase();
  return norm.endsWith("/thumbs");
}

function isMinorDir(dirPath) {
  const norm = dirPath.replace(/\\/g, "/").toLowerCase();
  return norm.includes("/public/img/minor");
}

async function convertOneFile({ dirPath, fileName, qualityMain, qualityThumb }) {
  const ext = path.extname(fileName).toLowerCase();
  if (!isImageExt(ext)) return { skipped: true, reason: "not_image" };
  if (ext === ".webp") return { skipped: true, reason: "already_webp" };

  const inPath = path.join(dirPath, fileName);
  const outFile = toWebpFileName(fileName);
  const outPath = path.join(dirPath, outFile);
  if (fs.existsSync(outPath)) return { skipped: true, reason: "target_exists", outFile };

  const thumb = isThumbDir(dirPath);
  const minor = isMinorDir(dirPath);
  const quality = thumb ? qualityThumb : qualityMain;

  let pipeline = sharp(inPath).rotate();
  if (thumb && minor) {
    pipeline = pipeline.resize({ width: 256, height: 256, fit: "cover" });
  } else if (thumb) {
    pipeline = pipeline.resize({ width: 256, withoutEnlargement: true });
  } else if (minor) {
    pipeline = pipeline.resize({ width: 1024, withoutEnlargement: true });
  } else {
    pipeline = pipeline.resize({ width: 1600, withoutEnlargement: true });
  }

  await pipeline.webp({ quality }).toFile(outPath);
  return { skipped: false, outFile };
}

async function convertDir(dirPath, options) {
  if (!fs.existsSync(dirPath)) return { converted: 0, skipped: 0 };
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  let converted = 0;
  let skipped = 0;

  for (const fileName of files) {
    const ext = path.extname(fileName);
    if (!isImageExt(ext)) continue;
    const r = await convertOneFile({ dirPath, fileName, ...options });
    if (r.skipped) skipped += 1;
    else converted += 1;
  }

  return { converted, skipped };
}

function toWebpUrl(url) {
  const s = String(url || "").trim();
  if (!s.startsWith("/public/img/")) return s;
  const m = s.match(/^(\/public\/img\/.+)\.(jpg|jpeg|png)$/i);
  if (!m) return s;
  return `${m[1]}.webp`;
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

async function updateDbUrls() {
  const majors = await db.MajorArcana.findAll({ raw: false, paranoid: false });
  let updatedMajors = 0;

  for (const m of majors) {
    const currentImage = String(m.imagen_url || "").trim();
    const currentThumb = String(m.imagen_thumb_url || "").trim();
    const nextImage = toWebpUrl(currentImage);
    const nextThumb = toWebpUrl(currentThumb);

    const extra = m.extra && typeof m.extra === "object" ? m.extra : {};
    const gallery = normalizeGallery(extra);
    const mappedGallery = gallery.map((g) => ({
      imagen_url: toWebpUrl(g.imagen_url),
      imagen_thumb_url: toWebpUrl(g.imagen_thumb_url)
    }));
    const mergedGallery = mergeGallery(mappedGallery);

    const changed =
      nextImage !== currentImage ||
      nextThumb !== currentThumb ||
      JSON.stringify(mergedGallery) !== JSON.stringify(gallery);

    if (!changed) continue;

    m.imagen_url = nextImage;
    m.imagen_thumb_url = nextThumb;
    m.extra = { ...(extra && typeof extra === "object" ? extra : {}), image_gallery: mergedGallery };
    await m.save();
    updatedMajors += 1;
  }

  const minors = await db.MinorArcana.findAll({ raw: false, paranoid: false });
  let updatedMinors = 0;

  for (const mi of minors) {
    const currentImage = String(mi.imagen_url || "").trim();
    const currentThumb = String(mi.imagen_thumb_url || "").trim();
    const nextImage = toWebpUrl(currentImage);
    const nextThumb = toWebpUrl(currentThumb);
    if (nextImage === currentImage && nextThumb === currentThumb) continue;
    mi.imagen_url = nextImage;
    mi.imagen_thumb_url = nextThumb;
    await mi.save();
    updatedMinors += 1;
  }

  return { updatedMajors, updatedMinors };
}

async function run() {
  const root = path.join(__dirname, "..");
  const majorDir = path.join(root, "public", "img");
  const majorThumbDir = path.join(majorDir, "thumbs");
  const minorDir = path.join(majorDir, "minor");
  const minorThumbDir = path.join(minorDir, "thumbs");

  const qualityMain = 82;
  const qualityThumb = 80;

  const r1 = await convertDir(majorDir, { qualityMain, qualityThumb });
  const r2 = await convertDir(majorThumbDir, { qualityMain, qualityThumb });
  const r3 = await convertDir(minorDir, { qualityMain, qualityThumb });
  const r4 = await convertDir(minorThumbDir, { qualityMain, qualityThumb });

  await initDb();
  const dbResult = await updateDbUrls();

  const totals = {
    major: r1,
    majorThumbs: r2,
    minor: r3,
    minorThumbs: r4,
    db: dbResult
  };
  process.stdout.write(JSON.stringify(totals, null, 2) + "\n");
}

run().catch((err) => {
  process.stderr.write(String(err?.stack || err?.message || err) + "\n");
  process.exitCode = 1;
});

