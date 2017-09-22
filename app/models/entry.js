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
