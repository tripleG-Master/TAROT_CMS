module.exports = function defineMinorArcana(sequelize, DataTypes) {
    return sequelize.define(
        "MinorArcana",
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            numero: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            palo: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            },
            valor: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            },
            nombre: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            },
            significado_luz: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            },
            significado_sombra: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            },
            descripcion_visual: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            },
            palabras_clave: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            },
            imagen_url: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            },
            imagen_thumb_url: {
                type: DataTypes.TEXT,
                allowNull: false,
                defaultValue: ""
            },
            extra: {
                type: DataTypes.JSONB,
                allowNull: false,
                defaultValue: {}
            }
        },
        {
            tableName: "MinorArcana",
            freezeTableName: true,
            timestamps: true,
            paranoid: true,
            indexes: [
                {
                    name: "idx_minor_arcana_numero",
                    unique: true,
                    fields: ["numero"]
                },
                {
                    name: "idx_minor_arcana_palo_valor",
                    fields: ["palo", "valor"]
                }
            ]
        }
    );
};
