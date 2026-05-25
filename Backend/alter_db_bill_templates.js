const pool = require('./db');

async function createTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS bill_scan_templates (
      id SERIAL PRIMARY KEY,
      document_name VARCHAR(255),
      document_type VARCHAR(255) UNIQUE,
      annotations JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log("Table 'bill_scan_templates' checked/created successfully.");
  } catch (err) {
    console.error("Error creating table:", err);
  }
}

if (require.main === module) {
  createTable().then(() => pool.end());
} else {
  module.exports = createTable;
}
