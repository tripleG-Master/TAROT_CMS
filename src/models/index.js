const defineMajorArcana = require("./MajorArcana");
const defineMinorArcana = require("./MinorArcana");
const defineConnector = require("./Connector");
const defineArcanaMessage = require("./ArcanaMessage");
const defineGeminiGeneration = require("./GeminiGeneration");
const defineGeminiTemplate = require("./GeminiTemplate");

function initModels(sequelize, DataTypes) {
  const MajorArcana = defineMajorArcana(sequelize, DataTypes);
  const MinorArcana = defineMinorArcana(sequelize, DataTypes);
  const Connector = defineConnector(sequelize, DataTypes);
  const ArcanaMessage = defineArcanaMessage(sequelize, DataTypes);
  const GeminiGeneration = defineGeminiGeneration(sequelize, DataTypes);
  const GeminiTemplate = defineGeminiTemplate(sequelize, DataTypes);

  return { MajorArcana, MinorArcana, Connector, ArcanaMessage, GeminiGeneration, GeminiTemplate };
}

module.exports = { initModels };
