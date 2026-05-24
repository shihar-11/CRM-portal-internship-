const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function alterDb() {
  try {
    console.log("Renaming table to leads...");
    await pool.query('ALTER TABLE employees RENAME TO leads;');
  } catch(e) {
    console.log("Table might already be renamed or doesn't exist", e.message);
  }

  try {
    console.log("Adding columns...");
    await pool.query("ALTER TABLE leads ADD COLUMN status VARCHAR(50) DEFAULT 'New';");
    await pool.query("ALTER TABLE leads ADD COLUMN source VARCHAR(50) DEFAULT 'Website';");
    await pool.query("ALTER TABLE leads ADD COLUMN notes TEXT;");
    await pool.query("ALTER TABLE leads ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;");
    console.log("Columns added successfully");
  } catch(e) {
    console.log("Columns might already exist", e.message);
  }
  process.exit();
}

alterDb();
