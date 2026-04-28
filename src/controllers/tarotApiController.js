const { buildReading } = require("../services/narrativeEngine");
const db = require("../db");
const crypto = require("node:crypto");
const { getDeckAllowedCardNumeros, resolveDeck } = require("../services/decks");

function todayInTimezoneDateOnly(timeZone) {
    const tz = String(timeZone || "").trim() || "UTC";
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    return fmt.format(new Date());
}

function pickDistinctFromHash(pool, count, hashHex) {
    const list = Array.isArray(pool) ? pool.slice() : [];
    const out = [];
    const seen = new Set();
    let cursor = 0;
    while (out.length < count && out.length < list.length) {
        const chunk = hashHex.slice(cursor, cursor + 8) || "0";
        cursor += 8;
        const n = parseInt(chunk, 16);
        const idx = Number.isFinite(n) ? n % list.length : 0;
        const val = list[idx];
        if (!seen.has(val)) {
            seen.add(val);
            out.push(val);
        } else {
            cursor += 8;
        }
    }
    if (out.length < count) {
        for (const v of list) {
            if (out.length >= count) break;
            if (!seen.has(v)) {
                seen.add(v);
                out.push(v);
            }
        }
    }
    return out;
}

async function dailyTarot(req, res) {
    try {
        const external_id = String(req.body?.external_id ?? req.body?.externalId ?? req.query?.external_id ?? req.query?.externalId ?? "").trim();
        let user_id = Number(req.body?.user_id ?? req.body?.userId ?? req.query?.user_id ?? req.query?.userId);
        const timezone = String(req.body?.timezone ?? req.query?.timezone ?? "UTC").trim() || "UTC";
        const locale = String(req.body?.locale ?? req.query?.locale ?? "es-CL").trim() || "es-CL";

        if ((!Number.isInteger(user_id) || user_id <= 0) && !external_id) {
            return res.status(400).json({ ok: false, error: "Se requiere external_id o user_id." });
        }

        if (!Number.isInteger(user_id) || user_id <= 0) {
            const existing = await db.models.User.findOne({ where: { external_id }, raw: true });
            if (existing) user_id = existing.id;
            else {
                const created = await db.models.User.create({ external_id, provider: "android" });
                user_id = created.id;
            }
        }

        const profile = await db.models.UserProfile.findOne({ where: { user_id }, raw: true });
        const user = {
            nombre: profile ? profile.nombre : "",
            genero: profile ? profile.genero : "neutro"
        };

        const deck_id = req.body?.deck_id ?? req.body?.deckId ?? req.query?.deck_id ?? req.query?.deckId;
        const deck = await resolveDeck(deck_id);

        const dayKey = todayInTimezoneDateOnly(timezone);
        const seed = `${external_id || user_id}|${dayKey}|${locale}`;
        const hashHex = crypto.createHash("sha256").update(seed).digest("hex");

        const fromDeck = deck ? await getDeckAllowedCardNumeros(deck.id, "major") : [];
        const arcanaRows = await db.MajorArcana.findAll({ attributes: ["numero"], order: [["numero", "ASC"]], raw: true });
        const canonicalPool = arcanaRows.length
            ? arcanaRows.map((r) => Number(r.numero)).filter((n) => Number.isInteger(n))
            : Array.from({ length: 22 }, (_, i) => i);
        const pool = fromDeck.length ? fromDeck : canonicalPool;
        const picked = pickDistinctFromHash(pool, 3, hashHex);
        if (picked.length !== 3) return res.status(400).json({ ok: false, error: "No hay suficientes arcanos para generar la tirada." });

        const oriBits = parseInt(hashHex.slice(0, 2), 16);
        const o1 = oriBits & 1 ? "reversed" : "upright";
        const o2 = oriBits & 2 ? "reversed" : "upright";
        const o3 = oriBits & 4 ? "reversed" : "upright";

        const ctxRows = await db.models.ArcanaMessage.findAll({ attributes: ["contexto"], group: ["contexto"], raw: true });
        const temas = ctxRows
            .map((r) => String(r?.contexto || "").trim().toLowerCase())
            .filter(Boolean);
        const tema = temas.includes("general") ? "general" : temas[0] || "general";

        const toneRowsMessages = await db.models.ArcanaMessage.findAll({ attributes: ["perfil_tono"], group: ["perfil_tono"], raw: true });
        const toneRowsConnectors = await db.models.Connector.findAll({ attributes: ["perfil"], group: ["perfil"], raw: true });
        const tones = Array.from(
            new Set(
                [...toneRowsMessages.map((r) => r?.perfil_tono), ...toneRowsConnectors.map((r) => r?.perfil)]
                    .map((v) => String(v || "").trim().toLowerCase())
                    .filter(Boolean)
            )
        );
        const pickTone = ["empatico", "directo", "mistico", "general"].find((t) => tones.includes(t));
        const perfil_tono = pickTone || "";

        const tirada = {
            cards: [
                { id: picked[0], posicion: "pasado", orientacion: o1 },
                { id: picked[1], posicion: "presente", orientacion: o2 },
                { id: picked[2], posicion: "futuro", orientacion: o3 }
            ]
        };

        const result = await buildReading({ user, tirada, tema, perfil_tono });
        if (!result.ok) return res.status(400).json(result);

        try {
            await db.models.HistoricalTarot.create({
                user_id: Number.isInteger(user_id) && user_id > 0 ? user_id : null,
                kind: "daily",
                tema: String(result.tema || tema || "general"),
                pregunta: "",
                tirada: {
                    cards: [
                        { card_kind: "major", id: picked[0], posicion: "pasado", orientacion: o1 },
                        { card_kind: "major", id: picked[1], posicion: "presente", orientacion: o2 },
                        { card_kind: "major", id: picked[2], posicion: "futuro", orientacion: o3 }
                    ]
                },
                resultado: {
                    reading: result.reading || {},
                    message: result?.reading?.intro || result?.lectura || "",
                    perfil_tono: result.perfil_tono || "",
                    timezone,
                    locale,
                    date: dayKey,
                    deck: deck ? { id: deck.id, slug: deck.slug, nombre: deck.nombre } : null
                },
                resultado_text: String(result?.reading?.intro || result?.lectura || "")
            });
        } catch {}

        return res.json({
            ok: true,
            date: dayKey,
            timezone,
            locale,
            user_id,
            deck: deck ? { id: deck.id, slug: deck.slug, nombre: deck.nombre } : undefined,
            message: result?.reading?.intro || result?.lectura || "",
            cards: picked,
            reading: result.reading || undefined,
            tema: result.tema,
            perfil_tono: result.perfil_tono
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err?.message || "Error generando tarot diario." });
    }
}

function yesNoFromHash(hashHex) {
    const n = parseInt(hashHex.slice(0, 8) || "0", 16);
    return Number.isFinite(n) && n % 2 === 0 ? "si" : "no";
}

function pickDistinctRandom(pool, count) {
    const list = Array.isArray(pool) ? pool.slice() : [];
    const out = [];
    const seen = new Set();
    if (list.length === 0) return out;
    while (out.length < count && seen.size < list.length) {
        const idx = crypto.randomInt(0, list.length);
        const val = list[idx];
        if (!seen.has(val)) {
            seen.add(val);
            out.push(val);
        }
    }
    return out;
}

async function yesNoTarot(req, res) {
    try {
        const external_id = String(req.body?.external_id ?? req.body?.externalId ?? req.query?.external_id ?? req.query?.externalId ?? "").trim();
        let user_id = Number(req.body?.user_id ?? req.body?.userId ?? req.query?.user_id ?? req.query?.userId);
        const timezone = String(req.body?.timezone ?? req.query?.timezone ?? "UTC").trim() || "UTC";
        const locale = String(req.body?.locale ?? req.query?.locale ?? "es-CL").trim() || "es-CL";
        const pregunta = String(req.body?.pregunta ?? req.body?.question ?? "").trim();
        const deck_id = req.body?.deck_id ?? req.body?.deckId ?? req.query?.deck_id ?? req.query?.deckId;

        if ((!Number.isInteger(user_id) || user_id <= 0) && !external_id) {
            return res.status(400).json({ ok: false, error: "Se requiere external_id o user_id." });
        }

        if (!Number.isInteger(user_id) || user_id <= 0) {
            const existing = await db.models.User.findOne({ where: { external_id }, raw: true });
            if (existing) user_id = existing.id;
            else {
                const created = await db.models.User.create({ external_id, provider: "android" });
                user_id = created.id;
            }
        }

        const dayKey = todayInTimezoneDateOnly(timezone);
        const answer = crypto.randomInt(0, 2) === 0 ? "si" : "no";
        const message = answer === "si" ? "Sí." : "No.";

        const deck = await resolveDeck(deck_id);
        const fromDeckMajor = deck ? await getDeckAllowedCardNumeros(deck.id, "major") : [];
        const fromDeckMinor = deck ? await getDeckAllowedCardNumeros(deck.id, "minor") : [];
        const arcanaRows = await db.MajorArcana.findAll({ attributes: ["numero"], order: [["numero", "ASC"]], raw: true });
        const canonicalPool = arcanaRows.length
            ? arcanaRows.map((r) => Number(r.numero)).filter((n) => Number.isInteger(n))
            : Array.from({ length: 22 }, (_, i) => i);
        const majorPool = fromDeckMajor.length ? fromDeckMajor : canonicalPool;

        const minorRows = await db.MinorArcana.findAll({ attributes: ["numero"], order: [["numero", "ASC"]], raw: true });
        const canonicalMinorPool = minorRows.length ? minorRows.map((r) => Number(r.numero)).filter((n) => Number.isInteger(n)) : [];
        const minorPool = fromDeckMinor.length ? fromDeckMinor : canonicalMinorPool;

        const majorPicked = pickDistinctRandom(majorPool, 1)[0];
        const minorPicked = minorPool.length >= 2 ? pickDistinctRandom(minorPool, 2) : [];

        const useMinor = Number.isInteger(majorPicked) && minorPicked.length === 2;

        const picked = useMinor
            ? [
                { card_kind: "major", id: majorPicked },
                { card_kind: "minor", id: minorPicked[0] },
                { card_kind: "minor", id: minorPicked[1] }
            ]
            : pickDistinctRandom(majorPool, 3).map((n) => ({ card_kind: "major", id: n }));

        if (picked.length !== 3) return res.status(400).json({ ok: false, error: "No hay suficientes arcanos para generar la tirada." });

        const o1 = crypto.randomInt(0, 2) === 0 ? "upright" : "reversed";
        const o2 = crypto.randomInt(0, 2) === 0 ? "upright" : "reversed";
        const o3 = crypto.randomInt(0, 2) === 0 ? "upright" : "reversed";

        try {
            await db.models.HistoricalTarot.create({
                user_id: Number.isInteger(user_id) && user_id > 0 ? user_id : null,
                kind: "yes_no",
                tema: "general",
                pregunta: String(pregunta || ""),
                tirada: {
                    cards: [
                        { card_kind: picked[0].card_kind, id: picked[0].id, posicion: "carta_1", orientacion: o1 },
                        { card_kind: picked[1].card_kind, id: picked[1].id, posicion: "carta_2", orientacion: o2 },
                        { card_kind: picked[2].card_kind, id: picked[2].id, posicion: "carta_3", orientacion: o3 }
                    ]
                },
                resultado: {
                    answer,
                    message,
                    timezone,
                    locale,
                    date: dayKey,
                    deck: deck ? { id: deck.id, slug: deck.slug, nombre: deck.nombre } : null,
                    cards: picked.map((c) => c.id),
                    cards_kind: picked.map((c) => c.card_kind)
                },
                resultado_text: String(message || "")
            });
        } catch {}

        return res.json({
            ok: true,
            date: dayKey,
            timezone,
            locale,
            user_id,
            deck: deck ? { id: deck.id, slug: deck.slug, nombre: deck.nombre } : undefined,
            pregunta: pregunta || null,
            answer,
            message,
            cards: picked.map((c) => c.id),
            cards_kind: picked.map((c) => c.card_kind),
            cards_v2: picked,
            cards_major: picked.filter((c) => c.card_kind === "major").map((c) => c.id),
            cards_minor: picked.filter((c) => c.card_kind === "minor").map((c) => c.id),
            tirada: {
                cards: [
                    { card_kind: picked[0].card_kind, id: picked[0].id, posicion: "carta_1", orientacion: o1 },
                    { card_kind: picked[1].card_kind, id: picked[1].id, posicion: "carta_2", orientacion: o2 },
                    { card_kind: picked[2].card_kind, id: picked[2].id, posicion: "carta_3", orientacion: o3 }
                ]
            }
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err?.message || "Error generando sí/no." });
    }
}

module.exports = { dailyTarot, yesNoTarot };

