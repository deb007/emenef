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
        updatedAt: 'updated_at', // Specify the field name for updatedAt
        tableName: 'entries'
    });

    return Entry;
};
