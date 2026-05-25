const pool = require('./db');

async function renameAndCreateOcrTemplatesTable() {
  try {
    // Rename existing table if it exists
    await pool.query(`
      ALTER TABLE IF EXISTS bill_scan_templates RENAME TO ocr_template_mappings;
    `);
    console.log("Renamed 'bill_scan_templates' to 'ocr_template_mappings' (if existed).");

    // Ensure the table exists with the correct schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ocr_template_mappings (
        id SERIAL PRIMARY KEY,
        document_name VARCHAR(255) NOT NULL,
        document_type VARCHAR(100) NOT NULL,
        annotations JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'ocr_template_mappings' checked/created successfully.");

    await pool.query(`
      ALTER TABLE ocr_template_mappings 
      DROP CONSTRAINT IF EXISTS ocr_template_mappings_document_type_unique;
      
      ALTER TABLE ocr_template_mappings 
      ADD CONSTRAINT ocr_template_mappings_document_type_unique 
      UNIQUE (document_type);
    `);
    console.log("Unique constraint added/checked successfully.");
  } catch (err) {
    console.error("Error creating/renaming ocr_template_mappings table:", err);
  }
}

module.exports = renameAndCreateOcrTemplatesTable;
