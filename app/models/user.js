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
        google_profile_id: {
          type: DataTypes.STRING
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
        },
        created_at: {
            type: DataTypes.DATE,
            field: 'created_at' // Specify the column name in your database
        },
        updated_at: {
            type: DataTypes.DATE,
            field: 'updated_at' // Specify the column name in your database
        }
    }, {
        timestamps: true, // Enable automatic timestamps
        createdAt: 'created_at', // Specify the field name for createdAt
        updatedAt: 'updated_at' // Specify the field name for updatedAt
    });

    // If you have associations, define them here
    User.associate = function(models) {
        // associations can be defined here
    };

    return User;
};
