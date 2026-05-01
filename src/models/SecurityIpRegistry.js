module.exports = function defineSecurityIpRegistry(sequelize, DataTypes) {
  return sequelize.define(
    "SecurityIpRegistry",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      ip: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
      },
      last_path: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      last_user_agent: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      last_seen_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      total_attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      failed_attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      consecutive_failed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      blocked_until: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: "security_ip_registry",
      freezeTableName: true,
      timestamps: true,
      paranoid: false,
      indexes: [{ name: "idx_security_ip_registry_ip", unique: true, fields: ["ip"] }]
    }
  );
};
