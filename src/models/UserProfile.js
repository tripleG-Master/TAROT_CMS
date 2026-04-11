module.exports = function defineUserProfile(sequelize, DataTypes) {
  return sequelize.define(
    "UserProfile",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      nombre: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      genero: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "neutro"
      },
      birthdate: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      zodiac: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      life_path: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      birth_arcana: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      tableName: "user_profiles",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        { name: "idx_user_profiles_user_id", unique: true, fields: ["user_id"] },
        { name: "idx_user_profiles_birthdate", fields: ["birthdate"] }
      ]
    }
  );
};

