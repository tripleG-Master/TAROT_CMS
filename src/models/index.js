const defineMajorArcana = require("./MajorArcana");

function initModels(sequelize, DataTypes) {
  const MajorArcana = defineMajorArcana(sequelize, DataTypes);

  return { MajorArcana };
}

module.exports = { initModels };
