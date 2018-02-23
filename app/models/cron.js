module.exports = function(sequelize, Sequelize) {

    var Cron = sequelize.define('cron', {

        id: {
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },

        title: {
            type: Sequelize.STRING,
            notEmpty: true
        },

        status: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            notEmpty: true
        }
    });

    return Cron;

}
