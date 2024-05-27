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
        email: {
            type: DataTypes.STRING,
            validate: {
                isEmail: true
            }
        },
        last_login: {
            type: DataTypes.DATE
        },
        login_count: {
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
