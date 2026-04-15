module.exports = function defineAppConfig(sequelize, DataTypes) {
    return sequelize.define(
        "AppConfig",
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                defaultValue: 1
            },
            schema_version: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1
            },
            payload: {
                type: DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            },
            etag: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            }
        },
        {
            tableName: "app_config",
            freezeTableName: true,
            timestamps: true,
            paranoid: false
        }
    );
};

