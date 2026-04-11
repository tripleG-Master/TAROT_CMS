module.exports = function defineEntitlement(sequelize, DataTypes) {
  return sequelize.define(
    "Entitlement",
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
      plan: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "free"
      },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "active"
      },
      provider: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "google_play"
      },
      product_id: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      purchase_token: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: ""
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true
      },
      last_validated_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: "entitlements",
      freezeTableName: true,
      timestamps: true,
      paranoid: true,
      indexes: [
        { name: "idx_entitlements_user_id", fields: ["user_id"] },
        { name: "idx_entitlements_plan_status", fields: ["plan", "status"] }
      ]
    }
  );
};

