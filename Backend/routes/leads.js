const express = require('express');
const router = express.Router();
const pool = require('../db');
const sse = require('../services/sse.service');
const { calculateLeadScore } = require('../services/lead-scoring.service');
const { getHotLeads, broadcastHotLeads } = require('../services/hot-leads.service');

// =========================
// SSE AUTO-REFRESH STREAM
// =========================
router.get('/stream', (req, res) => {
  sse.addClient(req, res);
});

// =========================
// GET HOT LEADS
// =========================
router.get('/hot', async (req, res) => {
  try {
    let limit = parseInt(req.query.limit, 10) || 5;
    if (limit > 20) limit = 20;
    if (limit < 1) limit = 1;

    const leads = await getHotLeads(limit);
    res.status(200).json(leads);
  } catch (error) {
    console.error('Fetch Hot Leads Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =========================
// GET ALL LEADS
// =========================
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM leads WHERE status != 'Deleted' ORDER BY created_at DESC"
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Fetch Leads Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =========================
// ADD LEAD MANUALLY
// =========================
router.post('/', async (req, res) => {
  try {
    const { name, department, email, status, source, notes, company, linkedin_id } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existingLead = await pool.query(
      'SELECT * FROM leads WHERE email = $1',
      [email]
    );

    if (existingLead.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Lead already exists' });
    }

    const finalStatus = status || 'New';
    const finalSource = source || 'Website';
    const { total, breakdown } = calculateLeadScore({ status: finalStatus, email, source: finalSource });

    const query = `
      INSERT INTO leads (name, department, email, status, source, notes, company, linkedin_id, lead_score, score_breakdown)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [name, department || 'General', email, finalStatus, finalSource, notes || '', company || '', linkedin_id || null, total, breakdown];

    const result = await pool.query(query, values);

    // Notify connected clients
    sse.sendEvent('NEW_LEAD', result.rows[0]);
    broadcastHotLeads();

    // Insert notification
    await pool.query(
      `INSERT INTO notifications (message, type, lead_name) VALUES ($1, $2, $3)`,
      [`New lead added: ${name}`, 'lead_added', name]
    );

    res.status(201).json({ success: true, message: 'Lead added successfully', lead: result.rows[0] });
  } catch (error) {
    console.error('Add Lead Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =========================
// UPDATE LEAD
// =========================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, email, status, source, notes, company, linkedin_id } = req.body;

    const existingLeadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (existingLeadRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    const existingLead = existingLeadRes.rows[0];

    const { total, breakdown } = calculateLeadScore({
      ...existingLead,
      status: status || existingLead.status,
      email: email || existingLead.email,
      source: source || existingLead.source
    });

    const query = `
      UPDATE leads
      SET name = $1, department = $2, email = $3, status = $4, source = $5, notes = $6, company = $7, linkedin_id = $8, lead_score = $9, score_breakdown = $10
      WHERE id = $11
      RETURNING *
    `;
    const values = [name, department, email, status, source, notes, company, linkedin_id, total, breakdown, id];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Notify connected clients (optional)
    sse.sendEvent('LEAD_UPDATED', result.rows[0]);
    broadcastHotLeads();

    res.status(200).json({ success: true, message: 'Lead updated successfully', lead: result.rows[0] });
  } catch (error) {
    console.error('Update Lead Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =========================
// DELETE LEAD
// =========================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `UPDATE leads SET status = 'Deleted' WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Notify connected clients (optional)
    sse.sendEvent('LEAD_DELETED', { id });

    // Insert notification
    await pool.query(
      `INSERT INTO notifications (message, type, lead_name) VALUES ($1, $2, $3)`,
      [`Lead deleted: ${result.rows[0].name}`, 'lead_deleted', result.rows[0].name]
    );

    res.status(200).json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Delete Lead Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
