module.exports = function defineDeckCard(sequelize, DataTypes) {
  return sequelize.define(
    "DeckCard",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      deck_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      card_kind: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "major"
      },
      card_numero: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      imagen_url: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      imagen_thumb_url: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      extra: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      }
    },
    {
      tableName: "deck_cards",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        { name: "idx_deck_cards_lookup", fields: ["deck_id", "card_kind", "card_numero"] },
        { name: "idx_deck_cards_unique", unique: true, fields: ["deck_id", "card_kind", "card_numero"] }
      ]
    }
  );
};

