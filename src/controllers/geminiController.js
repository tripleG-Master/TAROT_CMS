const { generateWithGemini, normalizeModelName, listGeminiModels } = require("../services/geminiService");
const { buildTarotReadingPrompt } = require("../services/tarotGeminiPrompt");
const db = require("../db");
const crypto = require("node:crypto");

function sha256(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function limitWords(text, maxWords) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const words = cleaned.split(" ");
  const max = Number.isInteger(maxWords) ? maxWords : 15;
  if (words.length <= max) return cleaned;
  return words.slice(0, max).join(" ");
}

function enforceFreeTarotOutput(text) {
  const labels = ["Intro", "Pasado", "Presente", "Futuro", "Cierre"];
  const keyFor = (s) => String(s || "").trim().toLowerCase();
  const limits = { intro: 10, pasado: 15, presente: 15, futuro: 15, cierre: 10 };

  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const found = new Map();
  let current = "";

  for (const line of lines) {
    const m = line.match(/^(Intro|Pasado|Presente|Futuro|Cierre)\s*:\s*(.*)$/i);
    if (m) {
      current = keyFor(m[1]);
      if (!found.has(current)) found.set(current, "");
      const prev = found.get(current) || "";
      const next = (prev ? prev + " " : "") + String(m[2] || "").trim();
      found.set(current, next.trim());
      continue;
    }
    if (current) {
      const prev = found.get(current) || "";
      found.set(current, (prev ? prev + " " : "") + line);
    }
  }

  return labels
    .map((label) => {
      const k = keyFor(label);
      const content = limitWords(found.get(k) || "", limits[k] || 15);
      return `${label}: ${content}`.trimEnd();
    })
    .join("\n");
}

function todayUtcDateOnly() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function incrementUsage({ user_id, usage }) {
  if (!Number.isInteger(user_id) || user_id <= 0) return null;
  const period = todayUtcDateOnly();
  const prompt = Number(usage?.promptTokens) || 0;
  const output = Number(usage?.outputTokens) || 0;
  const total = Number(usage?.totalTokens) || 0;

  const existing = await db.models.UsageCounter.findOne({ where: { user_id, period } });
  if (existing) {
    existing.requests = Number(existing.requests || 0) + 1;
    existing.tokens_prompt = Number(existing.tokens_prompt || 0) + prompt;
    existing.tokens_output = Number(existing.tokens_output || 0) + output;
    existing.tokens_total = Number(existing.tokens_total || 0) + total;
    await existing.save();
    return existing.get({ plain: true });
  }

  const created = await db.models.UsageCounter.create({
    user_id,
    period,
    requests: 1,
    tokens_prompt: prompt,
    tokens_output: output,
    tokens_total: total
  });
  return created.get({ plain: true });
}

async function getActiveEntitlement(user_id) {
  if (!Number.isInteger(user_id) || user_id <= 0) return null;
  const ent = await db.models.Entitlement.findOne({
    where: { user_id },
    order: [["createdAt", "DESC"]],
    raw: true
  });
  if (!ent) return null;
  if (String(ent.plan || "") === "premium" && String(ent.status || "") === "active") {
    if (ent.expires_at) {
      const exp = new Date(ent.expires_at);
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return { ...ent, status: "expired" };
    }
    return ent;
  }
  if (String(ent.plan || "") === "free") return ent;
  return ent;
}

async function ensureFreeEntitlement(user_id) {
  if (!Number.isInteger(user_id) || user_id <= 0) return null;
  const row = await db.models.Entitlement.findOne({ where: { user_id }, order: [["createdAt", "DESC"]], raw: true });
  if (row) return row;
  const created = await db.models.Entitlement.create({
    user_id,
    plan: "free",
    status: "active",
    provider: "google_play",
    product_id: "",
    purchase_token: "",
    expires_at: null,
    last_validated_at: null
  });
  return created.get({ plain: true });
}

async function ensureUserIdFromExternalId(external_id) {
  const ext = String(external_id || "").trim();
  if (!ext) return null;
  const existing = await db.models.User.findOne({ where: { external_id: ext } });
  const user = existing ? existing : await db.models.User.create({ external_id: ext, provider: "android" });
  await ensureFreeEntitlement(user.id);
  return user.id;
}

async function generate(req, res) {
  try {
    const prompt = req.body?.prompt ?? req.body?.text ?? "";
    const system = req.body?.system ?? req.body?.system_prompt ?? "";
    const model = req.body?.model ?? "";
    const temperature = req.body?.temperature;
    const maxOutputTokens = req.body?.maxOutputTokens ?? req.body?.max_output_tokens;
    const topP = req.body?.topP ?? req.body?.top_p;
    const topK = req.body?.topK ?? req.body?.top_k;
    const thinkingBudget = req.body?.thinkingBudget ?? req.body?.thinking_budget;
    const includeRaw = req.body?.includeRaw === true;
    const store = req.body?.store === true;

    if (!String(prompt || "").trim()) {
      return res.status(400).json({ ok: false, error: "prompt es obligatorio." });
    }

    const result = await generateWithGemini({
      prompt,
      system,
      model,
      temperature,
      maxOutputTokens,
      topP,
      topK,
      thinkingBudget
    });

    let user_id = Number(req.body?.user_id ?? req.body?.userId);
    if (!Number.isInteger(user_id) || user_id <= 0) {
      const external_id = req.body?.external_id ?? req.body?.externalId ?? req.body?.device_id ?? req.body?.installation_id;
      const resolved = await ensureUserIdFromExternalId(external_id);
      if (resolved) user_id = resolved;
    }
    const usageRow = await incrementUsage({ user_id, usage: result?.usage });

    if (store) {
      const m = result.model || normalizeModelName(model) || normalizeModelName(process.env.GEMINI_MODEL) || "gemini-2.5-flash";  
      const fingerprint = sha256(JSON.stringify({ kind: "generic", model: m, prompt, system }).slice(0, 1000));
      try {
        await db.models.GeminiGeneration.create({
          model: m,
          tema: "",
          pregunta: "",
          user_profile: req.body?.user_profile || {},
          request_payload: req.body || {},
          response_text: result.text || "",
          response_raw: includeRaw ? result.raw || {} : {},
          status: "ok",
          error: "",
          fingerprint
        });
      } catch {}
    }

    return res.json({
      ok: true,
      model: result.model || normalizeModelName(model) || normalizeModelName(process.env.GEMINI_MODEL) || "gemini-1.5-flash",
      text: result.text,
      user_id: Number.isInteger(user_id) && user_id > 0 ? user_id : undefined,
      usage_counter: usageRow
        ? { period: usageRow.period, requests: usageRow.requests, tokens_prompt: usageRow.tokens_prompt, tokens_output: usageRow.tokens_output, tokens_total: usageRow.tokens_total }
        : undefined,
      usage: {
        tokens: {
          prompt: result?.usage?.promptTokens,
          output: result?.usage?.outputTokens,
          total: result?.usage?.totalTokens
        },
        usageMetadata: result?.usageMetadata || undefined,
        finishReason: result?.finishReason || undefined,
        safetyRatings: Array.isArray(result?.safetyRatings) ? result.safetyRatings : undefined,
        generationConfig: result?.request?.generationConfig || undefined,
        lengths: {
          promptChars: String(prompt || "").length,
          promptWords: String(prompt || "").trim() ? String(prompt || "").trim().split(/\s+/).length : 0,
          systemChars: String(system || "").length,
          systemWords: String(system || "").trim() ? String(system || "").trim().split(/\s+/).length : 0,
          outputChars: String(result.text || "").length,
          outputWords: String(result.text || "").trim() ? String(result.text || "").trim().split(/\s+/).length : 0
        }
      },
      raw: includeRaw ? result.raw : undefined
    });
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    return res.status(status).json({
      ok: false,
      error: err?.message || "Error llamando a Gemini."
    });
  }
}

async function tarotReading(req, res) {
  try {
    const user_data = req.body?.user_data ?? req.body?.user ?? {};
    let user_id = Number(req.body?.user_id ?? req.body?.userId ?? user_data?.user_id ?? user_data?.userId);
    if (!Number.isInteger(user_id) || user_id <= 0) {
      const external_id =
        req.body?.external_id ??
        req.body?.externalId ??
        user_data?.external_id ??
        user_data?.externalId ??
        req.body?.device_id ??
        req.body?.installation_id;
      const resolved = await ensureUserIdFromExternalId(external_id);
      if (resolved) user_id = resolved;
    }
    const tirada = req.body?.tirada ?? {};
    const tema = req.body?.tema ?? "general";
    const pregunta = req.body?.pregunta ?? req.body?.question ?? req.body?.consulta ?? "";
    const preprompt = req.body?.preprompt ?? "";
    const reading_mode = req.body?.reading_mode ?? req.body?.mode ?? "";
    const card_source = req.body?.card_source ?? req.body?.fuente_cartas ?? "";
    const perfil_tono = req.body?.perfil_tono ?? req.body?.tono ?? "";
    const model = req.body?.model ?? "";
    const temperature = req.body?.temperature;
    const maxOutputTokensRaw = req.body?.maxOutputTokens ?? req.body?.max_output_tokens;
    const mode = String(reading_mode || "").trim().toLowerCase() === "premium" ? "premium" : "free";
    const maxOutputTokens = Number.isFinite(Number(maxOutputTokensRaw))
      ? Number(maxOutputTokensRaw)
      : mode === "free"
        ? 160
        : 256;
    const thinkingBudgetRaw = req.body?.thinkingBudget ?? req.body?.thinking_budget;
    const thinkingBudget =
      thinkingBudgetRaw === 0 || thinkingBudgetRaw === "0" || Number.isFinite(Number(thinkingBudgetRaw))
        ? Number(thinkingBudgetRaw)
        : mode === "free"
          ? 0
          : 64;
    const topP = req.body?.topP ?? req.body?.top_p;
    const topK = req.body?.topK ?? req.body?.top_k;
    const includeRaw = req.body?.includeRaw === true;
    const includeContext = req.body?.includeContext === true;
    const includePrompt = req.body?.includePrompt === true;
    const store = req.body?.store !== false;

    if (mode === "premium") {
      const ent = await getActiveEntitlement(user_id);
      if (!ent || ent.plan !== "premium" || ent.status !== "active") {
        return res.status(402).json({ ok: false, error: "premium_required" });
      }
    }

    const built = await buildTarotReadingPrompt({
      user_data: { ...user_data, user_id: Number.isInteger(user_id) ? user_id : undefined },
      tirada,
      tema,
      preprompt,
      pregunta,
      card_source,
      perfil_tono,
      reading_mode
    });
    const result = await generateWithGemini({
      prompt: built.prompt,
      system: built.system,
      model,
      temperature,
      maxOutputTokens,
      topP,
      topK,
      thinkingBudget
    });

    const finalText = mode === "free" ? enforceFreeTarotOutput(result.text || "") : (result.text || "");
    const usageRow = await incrementUsage({ user_id, usage: result?.usage });
    const entitlement = await getActiveEntitlement(user_id);

    if (store) {
      const m = result.model || normalizeModelName(model) || normalizeModelName(process.env.GEMINI_MODEL) || "gemini-1.5-flash";
      const fingerprint = sha256(JSON.stringify({ kind: "tarot", model: m, tema: String(tema || ""), pregunta: String(pregunta || ""), cartas: built?.context?.cartas || [] }).slice(0, 2000));
      try {
        await db.models.GeminiGeneration.create({
          model: m,
          tema: String(tema || ""),
          pregunta: String(pregunta || ""),
          user_profile: user_data || {},
          request_payload: built?.context || {},
          response_text: finalText,
          response_raw: includeRaw ? result.raw || {} : {},
          status: "ok",
          error: "",
          fingerprint
        });
      } catch {}
    }

    return res.json({
      ok: true,
      model: result.model || normalizeModelName(model) || normalizeModelName(process.env.GEMINI_MODEL) || "gemini-1.5-flash",
      tema: String(tema || "general"),
      reading_mode: String(reading_mode || "").trim() || undefined,
      pregunta: String(pregunta || "").trim() || undefined,
      text: finalText,
      user_id: Number.isInteger(user_id) && user_id > 0 ? user_id : undefined,
      entitlement: entitlement ? { plan: entitlement.plan, status: entitlement.status, expires_at: entitlement.expires_at || null } : undefined,
      usage_counter: usageRow
        ? { period: usageRow.period, requests: usageRow.requests, tokens_prompt: usageRow.tokens_prompt, tokens_output: usageRow.tokens_output, tokens_total: usageRow.tokens_total }
        : undefined,
      context: includeContext ? { compact: built.context, full: built.context_full } : undefined,
      system: includePrompt ? built.system : undefined,
      prompt: includePrompt ? built.prompt : undefined,
      usage: {
        tokens: {
          prompt: result?.usage?.promptTokens,
          output: result?.usage?.outputTokens,
          total: result?.usage?.totalTokens
        },
        usageMetadata: result?.usageMetadata || undefined,
        finishReason: result?.finishReason || undefined,
        safetyRatings: Array.isArray(result?.safetyRatings) ? result.safetyRatings : undefined,
        generationConfig: result?.request?.generationConfig || undefined,
        lengths: {
          promptChars: includePrompt ? String(built.prompt || "").length : undefined,
          promptWords: includePrompt && String(built.prompt || "").trim() ? String(built.prompt || "").trim().split(/\s+/).length : undefined,
          systemChars: includePrompt ? String(built.system || "").length : undefined,
          systemWords: includePrompt && String(built.system || "").trim() ? String(built.system || "").trim().split(/\s+/).length : undefined,
          contextChars: includeContext ? JSON.stringify(built.context).length : undefined,
          contextWords: undefined,
          outputChars: String(finalText || "").length,
          outputWords: String(finalText || "").trim() ? String(finalText || "").trim().split(/\s+/).length : 0
        }
      },
      raw: includeRaw ? result.raw : undefined
    });
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    return res.status(status).json({ ok: false, error: err?.message || "Error generando lectura con Gemini." });
  }
}

async function listModels(req, res) {
  try {
    const models = await listGeminiModels();
    return res.json({ ok: true, models });
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    return res.status(status).json({ ok: false, error: err?.message || "Error listando modelos." });
  }
}

async function promoteGeneration(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "id inválido" });
    const gen = await db.models.GeminiGeneration.findByPk(id);
    if (!gen) return res.status(404).json({ ok: false, error: "no encontrado" });
    const contenido = String(gen.response_text || "").trim();
    if (!contenido) return res.status(400).json({ ok: false, error: "la generación no tiene contenido" });
    const tmpl = await db.models.GeminiTemplate.create({
      tema: String(gen.tema || "general"),
      tags: "",
      contenido,
      source: "gemini",
      approved: false
    });
    return res.json({ ok: true, template: { id: tmpl.id } });
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    return res.status(status).json({ ok: false, error: err?.message || "Error promoviendo generación." });
  }
}

async function approveTemplate(req, res) {
  try {
    const id = Number(req.params?.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "id inválido" });
    const tmpl = await db.models.GeminiTemplate.findByPk(id);
    if (!tmpl) return res.status(404).json({ ok: false, error: "no encontrado" });
    let approved = req.body?.approved;
    if (typeof approved !== "boolean") approved = !Boolean(tmpl.approved);
    tmpl.approved = approved;
    await tmpl.save();
    return res.json({ ok: true, template: { id: tmpl.id, approved: tmpl.approved } });
  } catch (err) {
    const status = Number.isInteger(err?.status) ? err.status : 500;
    return res.status(status).json({ ok: false, error: err?.message || "Error actualizando plantilla." });
  }
}

module.exports = { generate, tarotReading, listModels, promoteGeneration, approveTemplate };
