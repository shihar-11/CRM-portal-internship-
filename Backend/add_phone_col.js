require('dotenv').config();
const pool = require('./db');

async function alterTable() {
  try {
    await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone VARCHAR(255);`);
    console.log('Successfully added phone column');
  } catch (err) {
    console.error('Error adding phone column:', err);
  } finally {
    pool.end();
  }
}

alterTable();
