module.exports = function defineGeminiTemplate(sequelize, DataTypes) {
  return sequelize.define(
    "GeminiTemplate",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      tema: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "general"
      },
      tags: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      contenido: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      source: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "gemini"
      },
      approved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      tableName: "gemini_templates",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        { name: "idx_gemini_templates_tema", fields: ["tema"] },
        { name: "idx_gemini_templates_approved", fields: ["approved"] }
      ]
    }
  );
};
