const db = require("../db");

function showCalculo(req, res) {
  res.render("tarot/calculo", {
    title: "Cálculo de Tarot"
  });
}

async function showLectura(req, res, next) {
  try {
    const arcanos = await db.MajorArcana.findAll({
      attributes: ["numero", "nombre"],
      order: [["numero", "ASC"]],
      raw: true
    });

    res.render("tarot/lectura", {
      title: "Lectura (3 cartas)",
      arcanos,
      hasArcanos: arcanos.length > 0
    });
  } catch (err) {
    next(err);
  }
}

function showGemini(req, res) {
  res.render("tarot/gemini", {
    title: "Gemini (Prueba)"
  });
}

async function showGeminiGenerations(req, res, next) {
  try {
    const generations = await db.models.GeminiGeneration.findAll({
      order: [["createdAt", "DESC"]],
      limit: 100,
      raw: true
    });
    res.render("tarot/gemini_generations", { title: "Gemini · Generaciones", generations });
  } catch (err) {
    next(err);
  }
}

async function showGeminiTemplates(req, res, next) {
  try {
    const templates = await db.models.GeminiTemplate.findAll({
      order: [["createdAt", "DESC"]],
      raw: true
    });
    res.render("tarot/gemini_templates", { title: "Gemini · Plantillas", templates });
  } catch (err) {
    next(err);
  }
}

module.exports = { showCalculo, showLectura, showGemini, showGeminiGenerations, showGeminiTemplates };
