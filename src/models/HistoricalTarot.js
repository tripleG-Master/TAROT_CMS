module.exports = function defineHistoricalTarot(sequelize, DataTypes) {
  return sequelize.define(
    "HistoricalTarot",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      kind: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      tema: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      pregunta: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      tirada: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      resultado: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      resultado_text: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      }
    },
    {
      tableName: "historical_tarot",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        { name: "idx_historical_tarot_user_id", fields: ["user_id"] },
        { name: "idx_historical_tarot_kind", fields: ["kind"] },
        { name: "idx_historical_tarot_user_id_createdAt", fields: ["user_id", "createdAt"] }
      ]
    }
  );
};
