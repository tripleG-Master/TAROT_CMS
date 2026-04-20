const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = String(a).match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) continue;
    const key = m[1];
    const value = typeof m[2] === "string" ? m[2] : "true";
    out[key] = value;
  }
  return out;
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  const v = String(value).trim().toLowerCase();
  if (["1", "true", "t", "yes", "y", "si", "sí"].includes(v)) return true;
  if (["0", "false", "f", "no", "n"].includes(v)) return false;
  return fallback;
}

function listFiles(dirAbs) {
  if (!fs.existsSync(dirAbs)) return [];
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.join(dirAbs, e.name));
}

function ensureDir(dirAbs) {
  fs.mkdirSync(dirAbs, { recursive: true });
}

function isImageFile(fileAbs) {
  const ext = path.extname(fileAbs).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
}

async function convertToWebp({ inputPath, outputPath, quality, force }) {
  if (!force && fs.existsSync(outputPath)) return { changed: false };
  ensureDir(path.dirname(outputPath));
  await sharp(inputPath).rotate().webp({ quality }).toFile(outputPath);
  return { changed: true };
}

async function makeThumb({ inputPath, outputPath, quality, force }) {
  if (!force && fs.existsSync(outputPath)) return { changed: false };
  ensureDir(path.dirname(outputPath));
  await sharp(inputPath)
    .rotate()
    .resize({ width: 256, height: 256, fit: "cover" })
    .webp({ quality })
    .toFile(outputPath);
  return { changed: true };
}

function baseNameWithoutExt(fileAbs) {
  return path.basename(fileAbs, path.extname(fileAbs));
}

async function processSet({ imagesDirAbs, thumbsDirAbs, quality, thumbQuality, force, includeWebp }) {
  ensureDir(imagesDirAbs);
  ensureDir(thumbsDirAbs);

  const files = listFiles(imagesDirAbs).filter(isImageFile);
  let converted = 0;
  let thumbsCreated = 0;
  let skipped = 0;

  const byBase = new Map();
  for (const f of files) {
    const base = baseNameWithoutExt(f);
    const ext = path.extname(f).toLowerCase();
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push({ path: f, ext });
  }

  for (const [base, variants] of byBase.entries()) {
    const webpExisting = variants.find((v) => v.ext === ".webp")?.path || "";
    const preferredSource =
      webpExisting ||
      variants.find((v) => v.ext === ".png")?.path ||
      variants.find((v) => v.ext === ".jpg")?.path ||
      variants.find((v) => v.ext === ".jpeg")?.path ||
      variants[0]?.path;
    if (!preferredSource) continue;

    const targetWebp = path.join(imagesDirAbs, `${base}.webp`);
    if (includeWebp || path.extname(preferredSource).toLowerCase() !== ".webp") {
      const r = await convertToWebp({ inputPath: preferredSource, outputPath: targetWebp, quality, force });
      if (r.changed) converted += 1;
      else skipped += 1;
    }

    const thumbTarget = path.join(thumbsDirAbs, `${base}.thumb.webp`);
    const thumbSource = fs.existsSync(targetWebp) ? targetWebp : preferredSource;
    const rt = await makeThumb({ inputPath: thumbSource, outputPath: thumbTarget, quality: thumbQuality, force });
    if (rt.changed) thumbsCreated += 1;
    else skipped += 1;
  }

  const thumbFiles = listFiles(thumbsDirAbs).filter(isImageFile);
  for (const f of thumbFiles) {
    const name = path.basename(f);
    const m = name.match(/^(.*)\.thumb\.(jpg|jpeg|png|webp)$/i);
    if (!m) continue;
    const base = m[1];
    const target = path.join(thumbsDirAbs, `${base}.thumb.webp`);
    if (!force && fs.existsSync(target)) continue;
    const r = await convertToWebp({ inputPath: f, outputPath: target, quality: thumbQuality, force: true });
    if (r.changed) thumbsCreated += 1;
  }

  return { converted, thumbsCreated, skipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const quality = Math.min(100, Math.max(1, toInt(args.quality, 50)));
  const thumbQuality = Math.min(100, Math.max(1, toInt(args["thumb-quality"], quality)));
  const force = toBool(args.force, false);
  const includeWebp = toBool(args["include-webp"], false);

  const root = path.join(__dirname, "..");
  const publicDir = path.join(root, "public");

  const majorImages = path.join(publicDir, "img");
  const majorThumbs = path.join(majorImages, "thumbs");

  const minorImages = path.join(majorImages, "minor");
  const minorThumbs = path.join(minorImages, "thumbs");

  const r1 = await processSet({
    imagesDirAbs: majorImages,
    thumbsDirAbs: majorThumbs,
    quality,
    thumbQuality,
    force,
    includeWebp
  });

  const r2 = await processSet({
    imagesDirAbs: minorImages,
    thumbsDirAbs: minorThumbs,
    quality,
    thumbQuality,
    force,
    includeWebp
  });

  const out = {
    major: r1,
    minor: r2,
    quality,
    thumbQuality,
    force,
    includeWebp
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err?.message || err) + "\n");
  process.exit(1);
});

