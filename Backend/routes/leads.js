const express = require('express');
const router = express.Router();
const pool = require('../db');
const sse = require('../services/sse.service');

// =========================
// SSE AUTO-REFRESH STREAM
// =========================
router.get('/stream', (req, res) => {
  sse.addClient(req, res);
});

// =========================
// GET ALL LEADS
// =========================
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leads ORDER BY id DESC'
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

    const query = `
      INSERT INTO leads (name, department, email, status, source, notes, company, linkedin_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [name, department || 'General', email, status || 'New', source || 'Website', notes || '', company || '', linkedin_id || null];

    const result = await pool.query(query, values);

    // Notify connected clients
    sse.sendEvent('NEW_LEAD', result.rows[0]);

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

    const query = `
      UPDATE leads
      SET name = $1, department = $2, email = $3, status = $4, source = $5, notes = $6, company = $7, linkedin_id = $8
      WHERE id = $9
      RETURNING *
    `;
    const values = [name, department, email, status, source, notes, company, linkedin_id, id];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Notify connected clients (optional)
    sse.sendEvent('LEAD_UPDATED', result.rows[0]);

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

    const query = `DELETE FROM leads WHERE id = $1 RETURNING *`;
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
