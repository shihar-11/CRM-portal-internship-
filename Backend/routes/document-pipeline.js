const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/document-pipeline/queue
router.get('/queue', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM document_queue ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching queue:', err);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// GET /api/document-pipeline/queue/:id/extraction
router.get('/queue/:id/extraction', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT *, confidence_score, category_name FROM document_extractions WHERE queue_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Extraction not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching extraction:', err);
    res.status(500).json({ error: 'Failed to fetch extraction' });
  }
});

// GET /api/document-pipeline/stats
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM document_queue 
      GROUP BY status
    `);
    
    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    result.rows.forEach(row => {
      if (stats[row.status] !== undefined) {
        stats[row.status] = parseInt(row.count, 10);
      }
    });

    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/document-pipeline/retry/:id
router.post('/retry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateResult = await pool.query(`
      UPDATE document_queue 
      SET status = 'pending', updated_at = NOW() 
      WHERE id = $1 AND status = 'failed'
      RETURNING id
    `, [id]);
    
    if (updateResult.rows.length === 0) {
       return res.status(400).json({ error: 'Cannot retry this document or it does not exist.' });
    }

    await pool.query(`
      INSERT INTO document_audit_trail (queue_id, action, details)
      VALUES ($1, 'retry', 'Document queued for retry')
    `, [id]);
    
    res.json({ message: 'Document queued for retry' });
  } catch (err) {
    console.error('Error retrying document:', err);
    res.status(500).json({ error: 'Failed to retry document' });
  }
});

// DELETE /api/document-pipeline/queue/:id
router.delete('/queue/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM document_audit_trail WHERE queue_id = $1', [id]);
    await pool.query('DELETE FROM document_extractions WHERE queue_id = $1', [id]);
    await pool.query('DELETE FROM document_queue WHERE id = $1', [id]);
    await pool.query('SELECT setval(\'document_queue_id_seq\', COALESCE((SELECT MAX(id) FROM document_queue), 0))');
    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
