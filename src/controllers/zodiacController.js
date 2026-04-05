function parseBirthdate(input) {
    const raw = String(input || "").trim();
    if (!raw) return null;

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
        const year = Number(iso[1]);
        const month = Number(iso[2]);
        const day = Number(iso[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return { year, month, day };
    }

    const dmy = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        const year = Number(dmy[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
        return { year, month, day };
    }

    return null;
}

const ZODIAC = [
    { key: "capricorn", es: "Capricornio", en: "Capricorn", start: [12, 22], end: [1, 19] },
    { key: "aquarius", es: "Acuario", en: "Aquarius", start: [1, 20], end: [2, 18] },
    { key: "pisces", es: "Piscis", en: "Pisces", start: [2, 19], end: [3, 20] },
    { key: "aries", es: "Aries", en: "Aries", start: [3, 21], end: [4, 19] },
    { key: "taurus", es: "Tauro", en: "Taurus", start: [4, 20], end: [5, 20] },
    { key: "gemini", es: "Géminis", en: "Gemini", start: [5, 21], end: [6, 20] },
    { key: "cancer", es: "Cáncer", en: "Cancer", start: [6, 21], end: [7, 22] },
    { key: "leo", es: "Leo", en: "Leo", start: [7, 23], end: [8, 22] },
    { key: "virgo", es: "Virgo", en: "Virgo", start: [8, 23], end: [9, 22] },
    { key: "libra", es: "Libra", en: "Libra", start: [9, 23], end: [10, 22] },
    { key: "scorpio", es: "Escorpio", en: "Scorpio", start: [10, 23], end: [11, 21] },
    { key: "sagittarius", es: "Sagitario", en: "Sagittarius", start: [11, 22], end: [12, 21] }
];

function toKey(month, day) {
    return month * 100 + day;
}

function getZodiacByMonthDay(month, day) {
    const md = toKey(month, day);

    for (const s of ZODIAC) {
        const start = toKey(s.start[0], s.start[1]);
        const end = toKey(s.end[0], s.end[1]);
        const wraps = start > end;
        const inRange = wraps ? md >= start || md <= end : md >= start && md <= end;
        if (inRange) return s;
    }

    return null;
}

function respondZodiac(req, res) {
    const birthdate = req.query?.birthdate ?? req.body?.birthdate ?? req.body?.date;
    const parsed = parseBirthdate(birthdate);

    if (!parsed) {
        return res.status(400).json({
            ok: false,
            error: "birthdate inválida. Formatos soportados: YYYY-MM-DD o DD/MM/YYYY o DD-MM-YYYY."
        });
    }

    const sign = getZodiacByMonthDay(parsed.month, parsed.day);
    if (!sign) {
        return res.status(400).json({
            ok: false,
            error: "No se pudo inferir el signo zodiacal."
        });
    }

    return res.json({
        ok: true,
        birthdate: `${String(parsed.year).padStart(4, "0")}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`,
        sign: {
            key: sign.key,
            name_es: sign.es,
            name_en: sign.en
        }
    });
}

module.exports = { respondZodiac };
