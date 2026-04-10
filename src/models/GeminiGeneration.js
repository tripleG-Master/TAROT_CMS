module.exports = function defineGeminiGeneration(sequelize, DataTypes) {
  return sequelize.define(
    "GeminiGeneration",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      model: {
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
      user_profile: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      request_payload: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      response_text: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      response_raw: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "ok"
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      fingerprint: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      }
    },
    {
      tableName: "gemini_generations",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        { name: "idx_gemini_generations_model", fields: ["model"] },
        { name: "idx_gemini_generations_tema", fields: ["tema"] },
        { name: "idx_gemini_generations_fingerprint", unique: false, fields: ["fingerprint"] }
      ]
    }
  );
};
