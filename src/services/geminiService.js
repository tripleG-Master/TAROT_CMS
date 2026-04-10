function extractTextFromResponse(json) {
  const candidate = Array.isArray(json?.candidates) ? json.candidates[0] : null;
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => (p && typeof p.text === "string" ? p.text : "")).join("").trim();
}

function extractFinishReason(json) {
  const candidate = Array.isArray(json?.candidates) ? json.candidates[0] : null;
  return candidate?.finishReason ? String(candidate.finishReason) : "";
}

function extractSafetyRatings(json) {
  const candidate = Array.isArray(json?.candidates) ? json.candidates[0] : null;
  const ratings = Array.isArray(candidate?.safetyRatings) ? candidate.safetyRatings : [];
  return ratings.map((r) => ({
    category: String(r?.category || ""),
    probability: String(r?.probability || "")
  }));
}

function normalizeModelName(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  let m = raw;
  if (m.includes(":")) m = m.split(":")[0];
  if (m.includes("/")) m = m.split("/").pop();
  m = m.trim();
  return m;
}

async function listGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY ? String(process.env.GEMINI_API_KEY) : "";
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY no configurada.");
    err.status = 500;
    throw err;
  }

  if (typeof fetch !== "function") {
    const err = new Error("fetch no está disponible en esta versión de Node. Actualiza Node a >= 18.");
    err.status = 500;
    throw err;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = new Error(json?.error?.message || `Gemini error HTTP ${res.status}`);
    err.status = 502;
    err.gemini = json || text;
    throw err;
  }

  const models = Array.isArray(json?.models) ? json.models : [];
  return models.map((m) => ({
    name: String(m?.name || ""),
    displayName: String(m?.displayName || ""),
    description: String(m?.description || ""),
    supportedGenerationMethods: Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : []
  }));
}

async function generateWithGemini({
  prompt,
  system,
  model,
  temperature,
  maxOutputTokens,
  topP,
  topK,
  thinkingBudget
}) {
  const apiKey = process.env.GEMINI_API_KEY ? String(process.env.GEMINI_API_KEY) : "";
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY no configurada.");
    err.status = 500;
    throw err;
  }

  if (typeof fetch !== "function") {
    const err = new Error("fetch no está disponible en esta versión de Node. Actualiza Node a >= 18.");
    err.status = 500;
    throw err;
  }

  const m =
    normalizeModelName(model) ||
    normalizeModelName(process.env.GEMINI_MODEL) ||
    "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const generationConfig = {};
  if (Number.isFinite(Number(temperature))) generationConfig.temperature = Number(temperature);
  if (Number.isFinite(Number(maxOutputTokens))) generationConfig.maxOutputTokens = Number(maxOutputTokens);
  if (Number.isFinite(Number(topP))) generationConfig.topP = Number(topP);
  if (Number.isFinite(Number(topK))) generationConfig.topK = Number(topK);
  if (thinkingBudget === 0 || Number.isFinite(Number(thinkingBudget))) {
    generationConfig.thinkingConfig = { thinkingBudget: Number(thinkingBudget) };
  }

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: String(prompt || "") }]
      }
    ]
  };

  if (system && String(system).trim()) {
    body.systemInstruction = {
      role: "system",
      parts: [{ text: String(system) }]
    };
  }

  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  const controller = new AbortController();
  const timeoutMs = process.env.GEMINI_TIMEOUT_MS ? Number(process.env.GEMINI_TIMEOUT_MS) : 20000;
  const t = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 20000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const baseMessage = json?.error?.message || `Gemini error HTTP ${res.status}`;
      const hint =
        typeof baseMessage === "string" && baseMessage.toLowerCase().includes("model")
          ? " Verifica el nombre del modelo (ej: gemini-1.5-flash) y no incluyas el prefijo 'models/'."
          : "";
      const err = new Error(String(baseMessage) + hint);
      err.status = 502;
      err.gemini = json || text;
      throw err;
    }

    const usageMetadata = json?.usageMetadata || null;
    const usage = {
      promptTokens: Number(usageMetadata?.promptTokenCount) || undefined,
      outputTokens: Number(usageMetadata?.candidatesTokenCount) || undefined,
      totalTokens: Number(usageMetadata?.totalTokenCount) || undefined
    };
    return {
      model: m,
      text: extractTextFromResponse(json),
      raw: json,
      usage,
      usageMetadata,
      finishReason: extractFinishReason(json),
      safetyRatings: extractSafetyRatings(json),
      request: {
        generationConfig: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
      }
    };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { generateWithGemini, normalizeModelName, listGeminiModels };
