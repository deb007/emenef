const Sequelize = require("sequelize");
const path = require("path");
const fs = require("fs");

// SQLite configuration
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'emenef.db') // path to your SQLite file
});

const db = {};


fs
    .readdirSync(__dirname)
    .filter(file => (file.indexOf(".") !== 0) && (file !== "index.js") && (file.slice(-3) === '.js'))
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});


db.sequelize = sequelize;
db.Sequelize = Sequelize;

console.log(Object.keys(db));

module.exports = db;
