module.exports = function(sequelize, Sequelize) {

    var Subscriber = sequelize.define('subscriber', {

        id: {
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },

        user_id: {
            type: Sequelize.INTEGER,
            notEmpty: true
        },

        subscription: {
            type: Sequelize.TEXT
        }

    },
    {
        indexes: [{ fields: ['user_id']}]
    }
);

    return Subscriber;

}
