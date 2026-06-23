const pool = require('./db');

async function addLeadScoringColumns() {
  try {
    await pool.query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
    `);
    console.log("Lead scoring columns checked/added successfully.");

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads (lead_score DESC);
    `);
    console.log("Index on lead_score checked/added successfully.");
  } catch (err) {
    console.error("Error adding lead scoring columns/index:", err);
  }
}

module.exports = addLeadScoringColumns;
