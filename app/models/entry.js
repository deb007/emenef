module.exports = function(sequelize, Sequelize) {

    var Entry = sequelize.define('entry', {

        id: {
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },

        verb: {
            type: Sequelize.STRING,
            notEmpty: true
        },

        task: {
            type: Sequelize.TEXT
        },

        memories: {
            type: Sequelize.INTEGER,
            defaultValue:0
        },

        forecast: {
            type: Sequelize.INTEGER,
            defaultValue:0
        },

        entry_date: {
            type: Sequelize.DATE
        },

        days_ago: {
            type: Sequelize.INTEGER,
            defaultValue:0
        },

        next_date: {
            type: Sequelize.DATE
        },

        status: {
            type: Sequelize.INTEGER,
            defaultValue:1
        },

        created_by: {
            type: Sequelize.INTEGER
        }


    });

    return Entry;

}
