const defineMajorArcana = require("./MajorArcana");
const defineMinorArcana = require("./MinorArcana");
const defineConnector = require("./Connector");
const defineArcanaMessage = require("./ArcanaMessage");
const defineGeminiGeneration = require("./GeminiGeneration");
const defineGeminiTemplate = require("./GeminiTemplate");
const defineUser = require("./User");
const defineUserProfile = require("./UserProfile");
const defineEntitlement = require("./Entitlement");
const defineUsageCounter = require("./UsageCounter");
const defineDeck = require("./Deck");
const defineDeckCard = require("./DeckCard");
const defineAppConfig = require("./AppConfig");

function initModels(sequelize, DataTypes) {
  const MajorArcana = defineMajorArcana(sequelize, DataTypes);
  const MinorArcana = defineMinorArcana(sequelize, DataTypes);
  const Connector = defineConnector(sequelize, DataTypes);
  const ArcanaMessage = defineArcanaMessage(sequelize, DataTypes);
  const GeminiGeneration = defineGeminiGeneration(sequelize, DataTypes);
  const GeminiTemplate = defineGeminiTemplate(sequelize, DataTypes);
  const User = defineUser(sequelize, DataTypes);
  const UserProfile = defineUserProfile(sequelize, DataTypes);
  const Entitlement = defineEntitlement(sequelize, DataTypes);
  const UsageCounter = defineUsageCounter(sequelize, DataTypes);
  const Deck = defineDeck(sequelize, DataTypes);
  const DeckCard = defineDeckCard(sequelize, DataTypes);
  const AppConfig = defineAppConfig(sequelize, DataTypes);

  User.hasOne(UserProfile, { foreignKey: "user_id" });
  UserProfile.belongsTo(User, { foreignKey: "user_id" });

  User.hasMany(Entitlement, { foreignKey: "user_id" });
  Entitlement.belongsTo(User, { foreignKey: "user_id" });

  User.hasMany(UsageCounter, { foreignKey: "user_id" });
  UsageCounter.belongsTo(User, { foreignKey: "user_id" });

  Deck.hasMany(DeckCard, { foreignKey: "deck_id" });
  DeckCard.belongsTo(Deck, { foreignKey: "deck_id" });

  return {
    MajorArcana,
    MinorArcana,
    Connector,
    ArcanaMessage,
    GeminiGeneration,
    GeminiTemplate,
    User,
    UserProfile,
    Entitlement,
    UsageCounter,
    Deck,
    DeckCard,
    AppConfig
  };
}

module.exports = { initModels };
