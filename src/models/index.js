const defineMajorArcana = require("./MajorArcana");
const defineConnector = require("./Connector");
const defineArcanaMessage = require("./ArcanaMessage");

function initModels(sequelize, DataTypes) {
  const MajorArcana = defineMajorArcana(sequelize, DataTypes);
  const Connector = defineConnector(sequelize, DataTypes);
  const ArcanaMessage = defineArcanaMessage(sequelize, DataTypes);

  return { MajorArcana, Connector, ArcanaMessage };
}

module.exports = { initModels };
