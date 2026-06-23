const pool = require('../db');
const sse = require('./sse.service');

async function getHotLeads(limit = 5) {
  const result = await pool.query(`
    SELECT * 
    FROM leads 
    WHERE status NOT IN ('Converted', 'Rejected')
    ORDER BY lead_score DESC 
    LIMIT $1
  `, [limit]);
  return result.rows;
}

async function broadcastHotLeads() {
  try {
    const leads = await getHotLeads(5); // Default top 5 for broadcasts
    sse.sendEvent('HOT_LEADS_UPDATED', leads);
  } catch (err) {
    console.error('Error broadcasting hot leads:', err);
  }
}

module.exports = { getHotLeads, broadcastHotLeads };
