const db = require("../db");
const { parseBirthdate, getZodiacByBirthdate } = require("./zodiac");
const { lifePathNumber, birthArcanaFromBirthdate } = require("./numerology");
const { loadPrepromptFromFile } = require("./prepromptLoader");

function normalizeTema(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "amor") return "amor";
  if (raw === "salud") return "salud";
  if (raw === "dinero") return "dinero";
  return "general";
}

function normalizeGenero(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (["m", "masculino", "hombre", "male"].includes(raw)) return "hombre";
  if (["f", "femenino", "mujer", "female"].includes(raw)) return "mujer";
  return "neutro";
}

function normalizeOrientacion(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (["upright", "derecho", "positivo", "luz"].includes(raw)) return "derecho";
  if (["reversed", "invertido", "invertida", "negativo", "sombra"].includes(raw)) return "invertido";
  return "neutro";
}

function messagePolarityFromSentido(sentido) {
  const s = String(sentido || "").trim().toLowerCase();
  if (s === "derecho") return "favorable";
  if (s === "invertido") return "desafiante";
  return "neutra";
}

function keywordsArray(text) {
  return String(text || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function limitKeywords(list, max) {
  const arr = Array.isArray(list) ? list : [];
  const out = [];
  for (const k of arr) {
    const v = String(k || "").trim();
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
    if (out.length >= (Number.isInteger(max) ? max : 3)) break;
  }
  return out;
}

function meaningForTema(row, tema, orientacion) {
  const t = normalizeTema(tema);
  const o = normalizeOrientacion(orientacion);
  const luz = o === "invertido" ? false : true;

  if (t === "amor") return luz ? String(row.significado_amor_luz || "") : String(row.significado_amor_sombra || "");
  if (t === "salud") return luz ? String(row.significado_salud_luz || "") : String(row.significado_salud_sombra || "");
  if (t === "dinero") return luz ? String(row.significado_trabajo_luz || "") : String(row.significado_trabajo_sombra || "");
  return luz ? String(row.significado_luz || "") : String(row.significado_sombra || "");
}

function meaningForCardKind(row, tema, orientacion, card_kind) {
  const kind = String(card_kind || "").trim().toLowerCase();
  const o = normalizeOrientacion(orientacion);
  const luz = o === "invertido" ? false : true;
  if (kind === "minor") return luz ? String(row.significado_luz || "") : String(row.significado_sombra || "");
  return meaningForTema(row, tema, orientacion);
}

function normalizeCardSource(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (["mensajes", "messages", "arcana_messages", "arcanamessages", "arcana_message"].includes(raw)) return "messages";
  return "meanings";
}

function normalizeReadingMode(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (["premium", "pro", "full", "extendido"].includes(raw)) return "premium";
  return "free";
}

function normalizePerfilTono(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "empatico") return "empatico";
  if (raw === "directo") return "directo";
  if (raw === "mistico") return "mistico";
  return "general";
}

function validateCards(cards) {
  const arr = Array.isArray(cards) ? cards : [];
  if (arr.length !== 3) return null;
  const normalized = arr.map((c) => ({
    card_kind: String(c?.card_kind ?? c?.cardKind ?? c?.kind ?? "major").trim().toLowerCase(),
    numero: Number(c?.id ?? c?.numero ?? c?.arcano_id ?? c?.card_numero ?? c?.cardNumero),
    posicion: String(c?.posicion || "").trim().toLowerCase(),
    orientacion: String(c?.orientacion ?? c?.orientation ?? "").trim()
  }));
  const okPos = new Set(["pasado", "presente", "futuro"]);
  const kindOk = new Set(["major", "minor"]);
  if (
    normalized.some(
      (c) =>
        !kindOk.has(c.card_kind) ||
        !Number.isInteger(c.numero) ||
        c.numero < 0 ||
        !okPos.has(c.posicion)
    )
  ) {
    return null;
  }
  const byPos = new Map(normalized.map((c) => [c.posicion, c]));
  if (!byPos.get("pasado") || !byPos.get("presente") || !byPos.get("futuro")) return null;
  return { pasado: byPos.get("pasado"), presente: byPos.get("presente"), futuro: byPos.get("futuro") };
}

function computeAgeFromParsed(parsed) {
  if (!parsed) return null;
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();

  let age = y - parsed.year;
  const birthdayNotYet = m < parsed.month || (m === parsed.month && d < parsed.day);
  if (birthdayNotYet) age -= 1;
  return age >= 0 && age <= 150 ? age : null;
}

async function buildUserContext(user_data) {
  const userIdCandidate = Number(user_data?.user_id ?? user_data?.userId);
  if (
    Number.isInteger(userIdCandidate) &&
    userIdCandidate > 0 &&
    (!user_data?.nacimiento && !user_data?.birthdate && !user_data?.birth_date && !user_data?.fecha_nacimiento)
  ) {
    const profile = await db.models.UserProfile.findOne({
      where: { user_id: userIdCandidate },
      raw: true
    });
    if (profile) {
      user_data = {
        ...user_data,
        nombre: user_data?.nombre ?? user_data?.name ?? profile.nombre,
        genero: user_data?.genero ?? user_data?.gender ?? profile.genero,
        nacimiento: user_data?.nacimiento ?? user_data?.birthdate ?? profile.birthdate
      };
    }
  }

  const nombre = String(user_data?.nombre ?? user_data?.name ?? "").trim();
  const genero = normalizeGenero(user_data?.genero ?? user_data?.gender);
  const nacimientoRaw = user_data?.nacimiento ?? user_data?.birthdate ?? "";
  const nacimientoParsed = parseBirthdate(nacimientoRaw);
  const nacimiento = nacimientoParsed
    ? `${String(nacimientoParsed.year).padStart(4, "0")}-${String(nacimientoParsed.month).padStart(2, "0")}-${String(nacimientoParsed.day).padStart(2, "0")}`
    : String(nacimientoRaw || "").trim();

  const edad = nacimientoParsed ? computeAgeFromParsed(nacimientoParsed) : null;

  const zodiacProvided = user_data?.zodiac || user_data?.sign || null;
  const zodiacComputed = nacimientoParsed ? getZodiacByBirthdate(nacimiento) : null;
  const zodiac = zodiacProvided || (zodiacComputed ? zodiacComputed.sign : null);

  const lifePathProvided = user_data?.numerology?.life_path ?? user_data?.life_path ?? null;
  const lifePathComputed = nacimientoParsed ? lifePathNumber(nacimientoParsed) : null;
  const life_path = lifePathProvided || lifePathComputed;

  const birthArcanaProvided = user_data?.birth_arcana ?? null;
  const birthArcanaComputed = nacimientoParsed ? birthArcanaFromBirthdate(nacimientoParsed) : null;
  const birth_arcana_core = birthArcanaProvided || birthArcanaComputed;

  let birth_arcana = null;
  if (birth_arcana_core && Number.isInteger(birth_arcana_core.major_arcana_numero)) {
    const arcano = await db.MajorArcana.findOne({
      where: { numero: birth_arcana_core.major_arcana_numero },
      attributes: ["numero", "nombre", "imagen_url", "imagen_thumb_url"],
      raw: true
    });
    birth_arcana = {
      major_arcana_numero: birth_arcana_core.major_arcana_numero,
      arcana_22: birth_arcana_core.arcana_22,
      is_master: birth_arcana_core.is_master,
      arcano: arcano
        ? {
            numero: arcano.numero,
            nombre: arcano.nombre,
            imagen_url: arcano.imagen_url,
            imagen_thumb_url: arcano.imagen_thumb_url
          }
        : null
    };
  }

  return {
    nombre,
    genero,
    nacimiento,
    edad,
    zodiac,
    numerology: life_path ? { life_path } : null,
    birth_arcana
  };
}

async function pickArcanaMessage({ arcano_id, posicion, contexto, perfil_tono, sentido, polaridad }) {
  const tono = String(perfil_tono || "").trim().toLowerCase() || "general";
  const ctx = normalizeTema(contexto);
  const sen = String(sentido || "").trim().toLowerCase();
  const senVal = sen === "derecho" || sen === "invertido" || sen === "neutro" ? sen : "";
  const pol = String(polaridad || "").trim().toLowerCase();
  const polVal = pol === "favorable" || pol === "desafiante" || pol === "neutra" ? pol : "";
  const attempts = [
    { contexto: ctx, perfil_tono: tono, sentido: senVal, polaridad: polVal },
    { contexto: ctx, perfil_tono: "general", sentido: senVal, polaridad: polVal },
    { contexto: "general", perfil_tono: tono, sentido: senVal, polaridad: polVal },
    { contexto: "general", perfil_tono: "general", sentido: senVal, polaridad: polVal },
    { contexto: ctx, perfil_tono: tono },
    { contexto: ctx, perfil_tono: "general" },
    { contexto: "general", perfil_tono: tono },
    { contexto: "general", perfil_tono: "general" }
  ];

  for (const a of attempts) {
    const where = { arcano_id, posicion, contexto: a.contexto, perfil_tono: a.perfil_tono };
    if (a.sentido) where.sentido = a.sentido;
    if (a.polaridad) where.polaridad = a.polaridad;
    const rows = await db.models.ArcanaMessage.findAll({
      where,
      order: [["id", "ASC"]],
      limit: 50,
      raw: true
    });
    const list = Array.isArray(rows) ? rows.filter((r) => r && String(r.contenido || "").trim()) : [];
    if (list.length > 0) return list[Math.floor(Math.random() * list.length)];
  }

  return null;
}

async function buildTarotReadingPrompt({ user_data, tirada, tema, preprompt, pregunta, card_source, perfil_tono, reading_mode }) {
  const cards = validateCards(tirada?.cards);
  if (!cards) {
    const err = new Error("tirada inválida. Se requieren 3 cartas con posicion pasado/presente/futuro e id numérico.");
    err.status = 400;
    throw err;
  }

  const requested = [cards.pasado, cards.presente, cards.futuro];
  const majorNumeros = requested.filter((c) => c.card_kind === "major").map((c) => c.numero);
  const minorNumeros = requested.filter((c) => c.card_kind === "minor").map((c) => c.numero);

  const majorRows = majorNumeros.length
    ? await db.MajorArcana.findAll({ where: { numero: majorNumeros }, raw: true })
    : [];
  const minorRows = minorNumeros.length
    ? await db.models.MinorArcana.findAll({ where: { numero: minorNumeros }, raw: true })
    : [];

  const byMajorNumero = new Map(majorRows.map((r) => [r.numero, r]));
  const byMinorNumero = new Map(minorRows.map((r) => [r.numero, r]));

  for (const c of requested) {
    if (c.card_kind === "major" && !byMajorNumero.has(c.numero)) {
      const err = new Error("No se encontraron todas las cartas en MajorArcana.");
      err.status = 400;
      throw err;
    }
    if (c.card_kind === "minor" && !byMinorNumero.has(c.numero)) {
      const err = new Error("No se encontraron todas las cartas en MinorArcana.");
      err.status = 400;
      throw err;
    }
  }

  const t = normalizeTema(tema);
  const tono = normalizePerfilTono(perfil_tono);
  const u = await buildUserContext(user_data);
  const q = String(pregunta ?? user_data?.pregunta ?? user_data?.question ?? "").trim();
  const mode = normalizeReadingMode(reading_mode);
  const source = mode === "premium" ? "messages" : normalizeCardSource(card_source);

  const cardPayload = async (c) => {
    const kind = c.card_kind === "minor" ? "minor" : "major";
    const r = kind === "minor" ? byMinorNumero.get(c.numero) : byMajorNumero.get(c.numero);
    const significado_tema = meaningForCardKind(r, t, c.orientacion, kind);
    const sentido = normalizeOrientacion(c.orientacion);
    const polaridad = messagePolarityFromSentido(sentido);
    const mensaje =
      source === "messages"
        ? await pickArcanaMessage({ arcano_id: r.numero, posicion: c.posicion, contexto: t, perfil_tono: tono, sentido, polaridad })
        : null;
    const texto_para_lectura = source === "messages" && mensaje ? String(mensaje.contenido || "") : significado_tema;
    return {
      card_kind: kind,
      numero: r.numero,
      nombre: r.nombre,
      palo: kind === "minor" ? String(r.palo || "") : "",
      valor: kind === "minor" ? String(r.valor || "") : "",
      posicion: c.posicion,
      orientacion: sentido,
      keywords: keywordsArray(r.palabras_clave),
      fuente_texto: source,
      texto_para_lectura,
      mensaje_arcano: mensaje
        ? {
            id: mensaje.id,
            contexto: mensaje.contexto,
            perfil_tono: mensaje.perfil_tono,
            polaridad: mensaje.polaridad,
            sentido: mensaje.sentido
          }
        : null,
      significado_tema,
      significado_general: normalizeOrientacion(c.orientacion) === "invertido" ? String(r.significado_sombra || "") : String(r.significado_luz || ""),
      descripcion_visual: String(r.descripcion_visual || ""),
      planeta: String(r.planeta || ""),
      numero_simbolismo: String(r.numero_simbolismo || "")
    };
  };

  const pasado = await cardPayload(cards.pasado);
  const presente = await cardPayload(cards.presente);
  const futuro = await cardPayload(cards.futuro);

  const context_full = {
    user: u,
    tema: t,
    perfil_tono: tono,
    pregunta: q || null,
    reading_mode: mode,
    cartas: {
      pasado,
      presente,
      futuro
    }
  };

  const compactUser = {
    nombre: String(u?.nombre || ""),
    zodiac: u?.zodiac || null,
    numerology: u?.numerology ? { life_path: u.numerology.life_path } : null,
    birth_arcana: u?.birth_arcana ? { major_arcana_numero: u.birth_arcana.major_arcana_numero } : null
  };
  const compactCard = (c) => ({
    card_kind: c.card_kind,
    numero: c.numero,
    nombre: c.nombre,
    palo: c.card_kind === "minor" ? String(c.palo || "") : "",
    valor: c.card_kind === "minor" ? String(c.valor || "") : "",
    posicion: c.posicion,
    orientacion: c.orientacion,
    texto_para_lectura: String(c.texto_para_lectura || ""),
    keywords: limitKeywords(c.keywords, 3),
    mensaje_arcano: c.mensaje_arcano
      ? {
          id: c.mensaje_arcano.id,
          perfil_tono: c.mensaje_arcano.perfil_tono,
          polaridad: c.mensaje_arcano.polaridad,
          sentido: c.mensaje_arcano.sentido
        }
      : null
  });

  const context = {
    user: compactUser,
    tema: t,
    perfil_tono: tono,
    pregunta: q || null,
    reading_mode: mode,
    cartas: {
      pasado: compactCard(pasado),
      presente: compactCard(presente),
      futuro: compactCard(futuro)
    }
  };

  const prepromptOverride = String(preprompt || "").trim();
  const prepromptFile =
    String(process.env.GEMINI_TAROT_PREPROMPT_FILE || "").trim() || "prompts/gemini_tarot_preprompt.md";
  const prepromptFromFile = prepromptOverride ? "" : await loadPrepromptFromFile(prepromptFile);
  const prepromptFromEnv = prepromptOverride || prepromptFromFile || String(process.env.GEMINI_TAROT_PREPROMPT || "").trim();
  const system =
    prepromptOverride ||
    (mode === "free"
      ? "Eres un lector de tarot. Respondes en español y muy breve. No inventes nada fuera del CONTEXTO (JSON)."
      : prepromptFromEnv ||
        "Eres un lector de tarot profesional. Escribes en español claro, cálido y coherente. No inventes datos fuera del contexto proporcionado.");

  const styleRule =
    mode === "free"
      ? "FREE: devuelve SOLO JSON. Valores: Intro/Cierre <=10 palabras. Pasado/Presente/Futuro <=15 palabras. 1 frase por campo."
      : "PREMIUM: devuelve SOLO JSON. Campos más completos, cálidos y coherentes, sin inventar.";

  const prompt =
    "Usa SOLO el CONTEXTO JSON. No inventes.\n" +
    "Salida: SOLO un JSON válido (sin markdown, sin texto extra) con claves exactas: Intro, Pasado, Presente, Futuro, Cierre.\n" +
    "Usa cartas.*.texto_para_lectura y keywords si ayuda. Si hay pregunta, enfoca la lectura. Respeta perfil_tono.\n" +
    styleRule +
    "\nCONTEXTO:\n```json\n" +
    JSON.stringify(context) +
    "\n```\n";

  return { system, prompt, context, context_full };
}

module.exports = { buildTarotReadingPrompt };
