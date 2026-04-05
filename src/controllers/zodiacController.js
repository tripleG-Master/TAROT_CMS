const { getZodiacByBirthdate } = require("../services/zodiac");

function respondZodiac(req, res) {
  const birthdate = req.query?.birthdate ?? req.body?.birthdate ?? req.body?.date;
  const zodiac = getZodiacByBirthdate(birthdate);

  if (!zodiac) {
    return res.status(400).json({
      ok: false,
      error: "birthdate inválida. Formatos soportados: YYYY-MM-DD o DD/MM/YYYY o DD-MM-YYYY."
    });
  }

  return res.json({
    ok: true,
    birthdate: zodiac.birthdate,
    sign: zodiac.sign
  });
}

module.exports = { respondZodiac };
