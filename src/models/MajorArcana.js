module.exports = function defineMajorArcana(sequelize, DataTypes) {
  return sequelize.define(
    "MajorArcana",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      nombre: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      numero: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        validate: {
          min: 0,
          max: 21,
          isInt: true
        }
      },
      significado_luz: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      significado_sombra: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      descripcion_visual: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      palabras_clave: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
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
      planeta: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      numero_simbolismo: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      simbologia_mesa_elementos: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      simbologia_lemniscata: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      simbologia_ropa: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      significado_amor_luz: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      significado_amor_sombra: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      significado_trabajo_luz: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      significado_trabajo_sombra: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      significado_salud_luz: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      significado_salud_sombra: {
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
      tableName: "MajorArcana",
      freezeTableName: true,
      timestamps: true,
      paranoid: true
    }
  );
};
