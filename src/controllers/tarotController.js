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

module.exports = { showCalculo, showLectura };
