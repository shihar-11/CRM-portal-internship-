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
    console.log("Adding linkedin fields...");
    await pool.query("ALTER TABLE leads ADD COLUMN company VARCHAR(100);");
    await pool.query("ALTER TABLE leads ADD COLUMN linkedin_id VARCHAR(100) UNIQUE;");
    console.log("Columns added successfully");
  } catch(e) {
    console.log("Columns might already exist", e.message);
  }
  process.exit();
}

alterDb();
