const pool = require('./db');
const { calculateLeadScore } = require('./services/lead-scoring.service');

async function backfill() {
  console.log("[Backfill] Starting lead score backfill...");
  try {
    const result = await pool.query('SELECT * FROM leads');
    let updatedCount = 0;
    
    for (const lead of result.rows) {
      const { total, breakdown } = calculateLeadScore(lead);
      await pool.query(
        'UPDATE leads SET lead_score = $1, score_breakdown = $2 WHERE id = $3',
        [total, breakdown, lead.id]
      );
      updatedCount++;
    }
    
    console.log(`[Backfill] Successfully backfilled ${updatedCount} leads.`);
  } catch(e) {
    console.error("[Backfill] Error during backfill:", e);
  } finally {
    process.exit(0);
  }
}

backfill();
