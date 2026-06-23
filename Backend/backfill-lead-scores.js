require('dotenv').config();
const pool = require('./db');
const { calculateLeadScore } = require('./services/lead-scoring.service');

async function backfill() {
  console.log("Starting lead score backfill...");
  const startTime = Date.now();
  let updatedCount = 0;
  let failedIds = [];

  try {
    const result = await pool.query('SELECT * FROM leads');
    const totalCount = result.rows.length;
    
    for (const lead of result.rows) {
      try {
        const { total, breakdown } = calculateLeadScore(lead);
        await pool.query(
          'UPDATE leads SET lead_score = $1, score_breakdown = $2 WHERE id = $3',
          [total, breakdown, lead.id]
        );
        updatedCount++;
        
        if (updatedCount % 50 === 0) {
          console.log(`Scored ${updatedCount}/${totalCount}...`);
        }
      } catch (rowError) {
        console.error(`Failed to update lead ID ${lead.id}:`, rowError.message);
        failedIds.push(lead.id);
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Backfill complete: ${updatedCount} leads scored in ${duration} seconds.`);
    
    if (failedIds.length > 0) {
      console.log(`The following ${failedIds.length} leads failed to update:`, failedIds.join(', '));
    }
  } catch(e) {
    console.error("Fatal error during backfill:", e);
  } finally {
    // Close the database connection cleanly
    await pool.end();
    process.exit(0);
  }
}

backfill();
