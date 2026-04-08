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
        allowNull: false,
        references: {
          model: 'major_arcana',
          key: "id"
        }
      },
      posicion: {
        type: DataTypes.ENUM("pasado", "presente", "futuro"),
        allowNull: false
      },
      contexto: {
        type: DataTypes.ENUM("general", "amor", "salud", "dinero"),
        allowNull: false
      },
      perfil_tono: {
        type: DataTypes.ENUM("empatico", "directo", "mistico","general"),
        defaultValue: "general",
        allowNull: false
      },
      contenido: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    },
    {
      tableName: "mensajes_arcanos",
      freezeTableName: true,
      timestamps: false,
      indexes: [
        {
          name: "idx_mensajes_arcanos_lookup",
          fields: ["arcano_id", "posicion", "contexto", "perfil_tono"]
        }
      ]
    }
  );
};
