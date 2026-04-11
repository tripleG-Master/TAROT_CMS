module.exports = function defineUsageCounter(sequelize, DataTypes) {
  return sequelize.define(
    "UsageCounter",
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
      period: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      requests: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      tokens_prompt: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      tokens_output: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      tokens_total: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    },
    {
      tableName: "usage_counters",
      freezeTableName: true,
      timestamps: true,
      paranoid: false,
      indexes: [{ name: "idx_usage_counters_user_period", unique: true, fields: ["user_id", "period"] }]
    }
  );
};

