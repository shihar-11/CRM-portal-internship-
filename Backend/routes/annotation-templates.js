const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const upload = multer({ storage: multer.memoryStorage() });

// GET all templates
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT t.*, 
             COALESCE(json_agg(f.*) FILTER (WHERE f.id IS NOT NULL), '[]') as fields
      FROM annotation_templates t
      LEFT JOIN annotation_fields f ON t.id = f.template_id
      GROUP BY t.id
      ORDER BY t.id DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single template by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT t.*, 
             COALESCE(json_agg(f.*) FILTER (WHERE f.id IS NOT NULL), '[]') as fields
      FROM annotation_templates t
      LEFT JOIN annotation_fields f ON t.id = f.template_id
      WHERE t.id = $1
      GROUP BY t.id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create template
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, document_type, fields } = req.body;
    
    if (!name || !document_type) {
      return res.status(400).json({ error: 'Missing name or document_type' });
    }

    await client.query('BEGIN');
    
    // Insert template
    const insertTemplateQuery = `
      INSERT INTO annotation_templates (name, document_type) 
      VALUES ($1, $2) RETURNING *
    `;
    const templateResult = await client.query(insertTemplateQuery, [name, document_type]);
    const templateId = templateResult.rows[0].id;
    
    // Insert fields
    const insertedFields = [];
    if (fields && fields.length > 0) {
      const insertFieldQuery = `
        INSERT INTO annotation_fields (template_id, field_name, field_label, page_number, x, y, width, height)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
      `;
      
      for (const field of fields) {
        const { field_name, field_label, page_number, x, y, width, height } = field;
        const fieldResult = await client.query(insertFieldQuery, [
          templateId, field_name, field_label, page_number, x, y, width, height
        ]);
        insertedFields.push(fieldResult.rows[0]);
      }
    }
    
    await client.query('COMMIT');
    
    const response = templateResult.rows[0];
    response.fields = insertedFields;
    
    res.status(201).json(response);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// DELETE template
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM annotation_fields WHERE template_id = $1', [id]);
    const result = await pool.query('DELETE FROM annotation_templates WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ message: 'Template deleted successfully', template: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST extract data using Gemini
router.post('/:id/extract', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Fetch fields
    const fieldsQuery = await pool.query('SELECT * FROM annotation_fields WHERE template_id = $1', [id]);
    const fields = fieldsQuery.rows;
    
    if (fields.length === 0) {
      return res.status(404).json({ error: 'No fields found for this template' });
    }

    // Helper to get region
    const getRegionDescription = (x, y) => {
      let vert = y < 33 ? 'top' : y < 66 ? 'middle' : 'bottom';
      let horiz = x < 33 ? 'left' : x < 66 ? 'center' : 'right';
      if (vert === 'middle' && horiz === 'center') return 'center';
      return `${vert}-${horiz} region`;
    };

    let promptText = `You are a data extraction assistant. Please extract the following fields from the attached document. Return the response STRICTLY as a valid JSON object where the keys are the field names and the values are the extracted data as strings. Do not include any other text or markdown formatting.\n\nFields to extract:\n`;
    
    fields.forEach(f => {
      const region = getRegionDescription(f.x, f.y);
      promptText += `- Key: "${f.field_name}" (Look for label: "${f.field_label}"). Approximate location: ${region} of page ${f.page_number}.\n`;
    });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
    
    const filePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype
      }
    };

    const result = await model.generateContent([promptText, filePart]);
    const responseText = result.response.text();
    
    let extractedData;
    try {
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(cleanJson);
    } catch (e) {
      console.error('Failed to parse Gemini response as JSON:', responseText);
      return res.status(500).json({ error: 'Failed to parse extraction results' });
    }

    res.json(extractedData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during extraction' });
  }
});

module.exports = router;
