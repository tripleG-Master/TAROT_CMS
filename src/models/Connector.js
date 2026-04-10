module.exports = function defineConnector(sequelize, DataTypes) {
  return sequelize.define(
    "Connector",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      tipo: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      polaridad: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      perfil: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "general"
      },
      texto: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      peso: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      }
    },
    {
      tableName: "connectores",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          name: "idx_connectores_lookup",
          fields: ["tipo", "polaridad", "perfil"]
        }
      ]
    }
  );
};
