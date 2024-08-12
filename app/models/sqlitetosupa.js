const { Sequelize } = require('sequelize');
const sqlite3 = require('sqlite3').verbose();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Connect to SQLite database
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'emenef.db'),
});

// Connect to Supabase (PostgreSQL)
const supabaseClient = new Client({
    user: 'postgres.nsjbknzxvlqsljcxvjpx',
    host: 'aws-0-us-east-1.pooler.supabase.com',
    database: 'postgres',
    password: 'DM_sYRxELMg3B!nVbspdR-',
    port: 6543,
});

supabaseClient.connect();

// Map SQLite types to PostgreSQL types
const mapSQLiteTypeToPostgres = (col, isPrimaryKey) => {
    switch (col.type.toLowerCase()) {
        case 'integer':
            return isPrimaryKey ? 'SERIAL' : 'INTEGER';
        case 'real':
            return 'FLOAT';
        case 'text':
            return 'TEXT';
        case 'blob':
            return 'BYTEA';
        case 'datetime':
        case 'date':
            return 'TIMESTAMP';
        default:
            return col.type.toUpperCase();
    }
};

// Function to handle null values in the insert query
const formatValue = (value) => {
    if (value === null || value === 'null') {
        return 'NULL';
    } else if (typeof value === 'string') {
        // Escape single quotes in strings
        return `'${value.replace(/'/g, "''")}'`;
    } else {
        return `'${value}'`;
    }
};

// Function to migrate a single table
const migrateTable = async (tableName) => {
    try {
        // Get schema of the table
        const schemaResult = await sequelize.query(`PRAGMA table_info(${tableName});`);
        const columns = schemaResult[0];

        // Build the table creation SQL with primary key
        let createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (`;
        createTableQuery += columns.map(col => {
            let columnDefinition = `${col.name} ${mapSQLiteTypeToPostgres(col, col.pk)}`;
            if (col.pk) {
                columnDefinition += ' PRIMARY KEY';
            }
            return columnDefinition;
        }).join(', ');
        createTableQuery += ');';

        // Execute the create table query in Supabase
        await supabaseClient.query(createTableQuery);

        // Get all data from SQLite table
        const data = await sequelize.query(`SELECT * FROM ${tableName};`);
        const rows = data[0];

        // Insert data into Supabase table
        for (let row of rows) {
            try {
                const keys = Object.keys(row).join(', ');
                const values = Object.values(row).map(val => formatValue(val)).join(', ');
                const insertQuery = `INSERT INTO ${tableName} (${keys}) VALUES (${values});`;
                await supabaseClient.query(insertQuery);
            } catch (rowError) {
                console.error(`Error inserting row into table ${tableName}:`, rowError.message);
                // Continue to the next row
            }
        }

        console.log(`Table ${tableName} migrated successfully!`);
    } catch (error) {
        console.error(`Error migrating table ${tableName}:`, error);
    }
};

const migrateDatabase = async () => {
    try {
        // Get all tables from SQLite database
        const tablesResult = await sequelize.query(
            `SELECT name FROM sqlite_master WHERE type='table';`
        );
        const tables = tablesResult[0].map(row => row.name);

        // Migrate each table
        for (let table of tables) {
            if (table == "entries")
                await migrateTable(table);
        }

        console.log('Database migration completed!');
    } catch (error) {
        console.error('Error during migration:', error);
    } finally {
        sequelize.close();
        supabaseClient.end();
    }
};

migrateDatabase();