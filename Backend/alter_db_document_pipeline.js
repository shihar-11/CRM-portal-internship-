const pool = require('./db');

async function createDocumentPipelineTables() {
  try {
    // 1. Create document_categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Table 'document_categories' checked/created successfully.");

    // 2. Create document_queue table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_queue (
        id SERIAL PRIMARY KEY,
        file_name VARCHAR,
        file_path TEXT,
        file_type VARCHAR,
        status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        category_id INT REFERENCES document_categories(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Table 'document_queue' checked/created successfully.");

    // 3. Create document_extractions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_extractions (
        id SERIAL PRIMARY KEY,
        queue_id INT REFERENCES document_queue(id),
        category_name VARCHAR,
        extracted_data JSONB,
        confidence_score FLOAT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Table 'document_extractions' checked/created successfully.");

    // 4. Create document_audit_trail table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS document_audit_trail (
        id SERIAL PRIMARY KEY,
        queue_id INT REFERENCES document_queue(id),
        action VARCHAR,
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Table 'document_audit_trail' checked/created successfully.");

    // 5. Seed document_categories
    await pool.query(`
      INSERT INTO document_categories (name, description) VALUES
      ('Salary Slip', 'Salary slips and pay stubs'),
      ('Bank Statement', 'Bank statements and financial records'),
      ('Aadhaar Card', 'Aadhaar card identification document'),
      ('PAN Card', 'PAN card identification document'),
      ('Offer Letter', 'Employment offer letters'),
      ('Invoice', 'Invoices and bills')
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log("Seeded default document categories.");

  } catch (err) {
    console.error("Error creating document pipeline tables:", err);
  }
}

module.exports = createDocumentPipelineTables;
