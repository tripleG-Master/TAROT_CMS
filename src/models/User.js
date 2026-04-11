module.exports = function defineUser(sequelize, DataTypes) {
  return sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      external_id: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      provider: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "android"
      }
    },
    {
      tableName: "users",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [{ name: "idx_users_external_id", unique: true, fields: ["external_id"] }]
    }
  );
};

