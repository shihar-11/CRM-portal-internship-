const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20'
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Fetch Notifications Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Mark Read Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Mark All Read Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/notifications/clear
router.delete('/clear', async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Clear Notifications Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
