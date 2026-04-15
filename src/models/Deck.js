module.exports = function defineDeck(sequelize, DataTypes) {
  return sequelize.define(
    "Deck",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      slug: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      nombre: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      descripcion: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      extra: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      }
    },
    {
      tableName: "decks",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [{ name: "idx_decks_slug", unique: true, fields: ["slug"] }]
    }
  );
};

