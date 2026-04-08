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
                type: DataTypes.ENUM(
                    "pasado_presente",
                    "presente_futuro",
                    "introduccion",
                    "cierre"
                ),
                allowNull: false
            },
            polaridad: {
                type: DataTypes.ENUM(
                    "positivo_positivo",
                    "positivo_negativo",
                    "negativo_positivo",
                    "negativo_negativo",
                    "neutro"
                ),
                allowNull: false
            },
            texto: {
                type: DataTypes.TEXT,
                allowNull: false
            }
        },
        {
            tableName: "connectores",
            freezeTableName: true,
            timestamps: false
        }
    );
};
