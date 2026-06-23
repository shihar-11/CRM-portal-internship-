const cron = require('node-cron');
const pool = require('../db');
const { calculateLeadScore } = require('./lead-scoring.service');
const { broadcastHotLeads } = require('./hot-leads.service');

function startCron() {
  // Run once daily at 2 AM server time
  cron.schedule('0 2 * * *', async () => {
    console.log('[Lead Scoring Cron] Starting nightly recalculation...');
    const startTime = Date.now();
    let updatedCount = 0;
    let failedCount = 0;

    try {
      // Query all rows from the leads table
      const result = await pool.query('SELECT * FROM leads');
      const leads = result.rows;

      for (const lead of leads) {
        try {
          // Call the existing calculateLeadScore function
          const { total, breakdown } = calculateLeadScore(lead);

          // Update lead_score and score_breakdown for each row
          await pool.query(
            'UPDATE leads SET lead_score = $1, score_breakdown = $2 WHERE id = $3',
            [total, breakdown, lead.id]
          );
          updatedCount++;
        } catch (rowErr) {
          // Handle errors per-row so one bad row doesn't kill the whole batch
          console.error(`[Lead Scoring Cron] Failed to update lead ID ${lead.id}:`, rowErr.message);
          failedCount++;
        }
      }

      // Log a summary when done
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Lead Scoring Cron] Nightly lead scoring: updated ${updatedCount} leads in ${durationSec}s. (Failed: ${failedCount})`);
      
      // Broadcast one single update to SSE clients after the batch is fully done
      if (updatedCount > 0) {
        broadcastHotLeads();
      }
      
    } catch (err) {
      console.error('[Lead Scoring Cron] Fatal error during recalculation:', err);
    }
  });

  console.log('[Lead Scoring Cron] Scheduled to run daily at 2 AM.');
}

module.exports = { start: startCron };
