const Sequelize = require("sequelize");
const path = require("path");
const fs = require("fs");

// Supabase PostgreSQL configuration
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.SUPABASE_HOST,
  port: process.env.SUPABASE_PORT,
  database: process.env.SUPABASE_DB,
  username: process.env.SUPABASE_USER,
  password: process.env.SUPABASE_PWD,
  ssl: true,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  pool: {
    max: 10,
    min: 0,
    idle: 10000
  }
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
