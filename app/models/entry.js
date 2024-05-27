module.exports = (sequelize, DataTypes) => {
    const Entry = sequelize.define('Entry', {
        id: {
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        verb: {
            type: DataTypes.STRING,
            allowNull: false
        },
        task: {
            type: DataTypes.TEXT
        },
        memories: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        forecast: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        entry_date: {
            type: DataTypes.DATE
        },
        days_ago: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        next_date: {
            type: DataTypes.DATE
        },
        status: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        },
        created_by: {
            type: DataTypes.INTEGER
        }
    });

    // Add any associations if necessary
    Entry.associate = function(models) {
        // associations can be defined here
    };

    return Entry;
};
