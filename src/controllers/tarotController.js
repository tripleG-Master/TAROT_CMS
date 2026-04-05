function showCalculo(req, res) {
  res.render("tarot/calculo", {
    title: "Cálculo de Tarot"
  });
}

module.exports = { showCalculo };
