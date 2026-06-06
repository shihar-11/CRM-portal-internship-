require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function cleanup() {
  try {
    console.log('Connecting to local database to clean up...');
    await pool.query('DROP TABLE IF EXISTS ocr_template_mappings;');
    await pool.query('DROP TABLE IF EXISTS bill_scan_templates;');
    console.log('Tables ocr_template_mappings and bill_scan_templates dropped successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await pool.end();
  }
}

cleanup();
