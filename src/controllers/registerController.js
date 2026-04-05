const db = require("../db");
const { parseBirthdate, getZodiacByBirthdate } = require("../services/zodiac");
const { lifePathNumber, birthArcanaFromBirthdate } = require("../services/numerology");

async function register(req, res) {
  const name = String(req.body?.name ?? req.body?.nombre ?? "").trim();
  const birthdateRaw = req.body?.birthdate ?? req.body?.fecha_nacimiento ?? req.body?.date;

  const parsed = parseBirthdate(birthdateRaw);
  if (!parsed) {
    return res.status(400).json({
      ok: false,
      error: "birthdate inválida. Formatos soportados: YYYY-MM-DD o DD/MM/YYYY o DD-MM-YYYY."
    });
  }

  const zodiac = getZodiacByBirthdate(birthdateRaw);
  const lifePath = lifePathNumber(parsed);
  const birthArcana = birthArcanaFromBirthdate(parsed);

  const arcano = await db.MajorArcana.findOne({
    where: { numero: birthArcana.major_arcana_numero },
    attributes: ["numero", "nombre", "imagen_url", "imagen_thumb_url"],
    raw: true
  });

  return res.json({
    ok: true,
    user: {
      name,
      birthdate: zodiac ? zodiac.birthdate : `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`
    },
    zodiac: zodiac ? zodiac.sign : null,
    numerology: {
      life_path: lifePath
    },
    birth_arcana: {
      major_arcana_numero: birthArcana.major_arcana_numero,
      arcana_22: birthArcana.arcana_22,
      arcano: arcano
        ? {
            numero: arcano.numero,
            nombre: arcano.nombre,
            imagen_url: arcano.imagen_url,
            imagen_thumb_url: arcano.imagen_thumb_url
          }
        : null
    }
  });
}

module.exports = { register };
