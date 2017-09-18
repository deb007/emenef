module.exports = function(sequelize, Sequelize) {

    var User = sequelize.define('user', {

        id: {
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },

        fullname: {
            type: Sequelize.STRING,
            notEmpty: true
        },

        username: {
            type: Sequelize.TEXT
        },

        email: {
            type: Sequelize.STRING,
            validate: {
                isEmail: true
            }
        },

        fb_profile_id: {
            type: Sequelize.STRING
        },

        fb_token: {
            type: Sequelize.STRING
        },

        google_profile_id: {
            type: Sequelize.STRING
        },

        google_token: {
            type: Sequelize.STRING
        },

        gender: {
            type: Sequelize.STRING
        },

        last_login: {
            type: Sequelize.DATE
        },

        login_count: {
            type: Sequelize.INTEGER,
            defaultValue:0
        },

        member_type: {
            type: Sequelize.INTEGER,
            defaultValue:0
        },

        status: {
            type: Sequelize.ENUM('active', 'inactive'),
            defaultValue: 'active'
        }


    });

    return User;

}
