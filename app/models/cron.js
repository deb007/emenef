module.exports = (sequelize, DataTypes) => {
    const Cron = sequelize.define('Cron', {
        id: {
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        title: {
            type: DataTypes.STRING,
            notEmpty: true
        },
        status: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            notEmpty: true
        }
    }, {
        tableName: 'crons'
    });

    // If there are associations to define, add them here
    // Cron.associate = function(models) {
    //     // associations can be defined here
    // };

    return Cron;
};
