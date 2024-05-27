module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('user', {
        id: {
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        fullname: {
            type: DataTypes.STRING,
            notEmpty: true
        },
        username: {
            type: DataTypes.TEXT
        },
        email: {
            type: DataTypes.STRING,
            validate: {
                isEmail: true
            }
        },
        fb_profile_id: {
            type: DataTypes.STRING
        },
        fb_token: {
            type: DataTypes.STRING
        },
        google_profile_id: {
            type: DataTypes.STRING
        },
        google_token: {
            type: DataTypes.STRING
        },
        gender: {
            type: DataTypes.STRING
        },
        last_login: {
            type: DataTypes.DATE
        },
        login_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        member_type: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
        }
    });

    // If you have associations, define them here
    User.associate = function(models) {
        // associations can be defined here
    };

    return User;
};
