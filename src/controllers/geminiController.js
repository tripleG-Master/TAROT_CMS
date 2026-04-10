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

    const built = await buildTarotReadingPrompt({
      user_data,
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
