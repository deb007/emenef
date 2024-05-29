module.exports = (sequelize, DataTypes) => {
    const Subscriber = sequelize.define('Subscriber', {
        id: {
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        subscription: {
            type: DataTypes.TEXT
        }
    }, {
        indexes: [{ fields: ['user_id'] }]
    });

    // Define any associations here if necessary
    Subscriber.associate = function(models) {
        // Example association
        // Subscriber.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    };

    return Subscriber;
};
