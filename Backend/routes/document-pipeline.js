const express = require('express');
const router = express.Router();
const pool = require('../db');
const fs = require('fs');
const path = require('path');

// Function to reconstruct nested object from flat dot-notation object
function unflattenObject(data) {
  if (Object(data) !== data || Array.isArray(data)) return data;
  let result = {};
  for (let p in data) {
    let keys = p.split('.');
    keys.reduce((acc, key, index) => {
      if (index === keys.length - 1) {
        let val = data[p];
        if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
          try { val = JSON.parse(val); } catch (e) {}
        }
        acc[key] = val;
      } else {
        acc[key] = acc[key] || {};
      }
      return acc[key];
    }, result);
  }
  return result;
}

// GET /api/document-pipeline/queue
router.get('/queue', async (req, res) => {
  try {
    const result = await pool.query('SELECT dq.*, de.created_at as completed_at FROM document_queue dq LEFT JOIN document_extractions de ON de.queue_id = dq.id ORDER BY dq.created_at DESC');
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

// PUT /api/document-pipeline/queue/:id/extraction
router.put('/queue/:id/extraction', async (req, res) => {
  try {
    const { id } = req.params;
    const flatData = req.body;
    
    // Reconstruct nested object
    const nestedData = unflattenObject(flatData);

    const updateResult = await pool.query(`
      UPDATE document_extractions 
      SET extracted_data = $1 
      WHERE queue_id = $2
      RETURNING *
    `, [JSON.stringify(nestedData), id]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Extraction not found for this queue item' });
    }

    await pool.query(`
      INSERT INTO document_audit_trail (queue_id, action, details)
      VALUES ($1, 'manual_override', 'Admin edited extraction fields')
    `, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating extraction:', err);
    res.status(500).json({ error: 'Failed to update extraction' });
  }
});

// GET /api/document-pipeline/queue/:id/file
router.get('/queue/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT file_path FROM document_queue WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found in queue' });
    }
    
    const filePath = result.rows[0].file_path;
    let absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      const fileName = path.basename(filePath);
      const processedDir = process.env.PROCESSED_FOLDER_PATH;
      if (processedDir) {
        const processedPath = path.resolve(path.join(processedDir, fileName));
        if (fs.existsSync(processedPath)) {
          absolutePath = processedPath;
        } else {
          return res.status(404).json({ error: 'File not found' });
        }
      } else {
        return res.status(404).json({ error: 'File not found' });
      }
    }
    
    const ext = path.extname(absolutePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.png') {
      contentType = 'image/png';
    }
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(absolutePath);
  } catch (err) {
    console.error('Error fetching document file:', err);
    res.status(500).json({ error: 'Failed to fetch document file' });
  }
});

// GET /api/document-pipeline/compare/:filename
router.get('/compare/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await pool.query(
      `SELECT de.*, dq.created_at as queued_at 
       FROM document_extractions de 
       JOIN document_queue dq ON dq.id = de.queue_id 
       WHERE dq.file_name = $1 AND dq.status = 'completed' 
       ORDER BY de.created_at DESC LIMIT 2`, 
      [filename]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching compare data:', err);
    res.status(500).json({ error: 'Failed to fetch comparison data' });
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
