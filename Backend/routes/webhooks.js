const express = require('express');
const router = express.Router();
const linkedinService = require('../services/linkedin.service');
const pool = require('../db');
const sse = require('../services/sse.service');
const { calculateLeadScore } = require('../services/lead-scoring.service');
const { broadcastHotLeads } = require('../services/hot-leads.service');

// =========================
// LINKEDIN VERIFICATION CHALLENGE
// LinkedIn calls this GET first to verify your server is real
// =========================
router.get('/linkedin', (req, res) => {
  const challengeCode = req.query.challengeCode;

  if (challengeCode) {
    console.log('LinkedIn verification challenge received:', challengeCode);
    // Must respond with exactly this JSON structure
    return res.status(200).json({ challengeCode: challengeCode });
  }

  res.status(200).json({ status: 'LinkedIn webhook endpoint active' });
});

// =========================
// LINKEDIN REAL WEBHOOK (Lead arrives here)
// =========================
router.post('/linkedin', async (req, res) => {
  try {
    const providedSecret = req.headers['x-linkedin-webhook-secret'];
    if (providedSecret !== process.env.LINKEDIN_WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body;
    console.log('LinkedIn Webhook Payload Received:', JSON.stringify(payload, null, 2));

    // LinkedIn sends an array of leads inside payload.leads
    const leads = payload.leads || payload.elements || [];

    if (leads.length === 0) {
      console.log('No leads found in payload');
      return res.status(200).json({ success: true, message: 'No leads to process' });
    }

    const results = [];

    for (const lead of leads) {
      const result = await linkedinService.processLinkedInLead(lead);
      results.push(result);
    }

    res.status(201).json({ success: true, processed: results.length });

  } catch (error) {
    console.error('LinkedIn Webhook Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =========================
// GENERIC WEBHOOK (Zapier / manual testing)
// =========================
router.post('/generic', async (req, res) => {
  try {
    const { name, department, email, status, source, notes, company, linkedin_id } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existingLead = await pool.query('SELECT * FROM leads WHERE email = $1', [email]);
    if (existingLead.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Lead already exists' });
    }

    const finalStatus = status || 'New';
    const finalSource = source || 'Webhook';
    const { total, breakdown } = calculateLeadScore({ status: finalStatus, email, source: finalSource });

    const query = `
      INSERT INTO leads (name, department, email, status, source, notes, company, linkedin_id, lead_score, score_breakdown)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      name,
      department || 'General',
      email,
      finalStatus,
      finalSource,
      notes || '',
      company || '',
      linkedin_id || null,
      total,
      breakdown
    ];

    const result = await pool.query(query, values);
    sse.sendEvent('NEW_LEAD', result.rows[0]);
    broadcastHotLeads();

    res.status(201).json({ success: true, lead: result.rows[0] });
  } catch (error) {
    console.error('Generic Webhook Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;