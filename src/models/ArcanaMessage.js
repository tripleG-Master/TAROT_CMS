module.exports = function defineArcanaMessage(sequelize, DataTypes) {
  return sequelize.define(
    "ArcanaMessage",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      arcano_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      posicion: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      contexto: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      perfil_tono: {
        type: DataTypes.TEXT,
        defaultValue: "general",
        allowNull: false
      },
      contenido: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      polaridad: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "neutra"
      },
      sentido: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "neutro"
      },
      luz_sombra: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "neutra"
      }
    },
    {
      tableName: "mensajes_arcanos",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          name: "idx_mensajes_arcanos_lookup",
          fields: ["arcano_id", "posicion", "contexto", "perfil_tono"]
        },
        {
          name: "idx_mensajes_arcanos_lookup_v2",
          fields: ["arcano_id", "posicion", "contexto", "perfil_tono", "polaridad", "sentido"]
        },
        {
          name: "idx_mensajes_arcanos_lookup_v3",
          fields: ["arcano_id", "posicion", "contexto", "perfil_tono", "polaridad", "sentido", "luz_sombra"]
        }
      ]
    }
  );
};
