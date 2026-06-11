const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../db');

let isProcessing = false;

async function processNextDocument() {
  if (isProcessing) return;
  isProcessing = true;

  let currentDocId = null;

  try {
    const result = await pool.query(
      `SELECT * FROM document_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 1`
    );

    if (result.rows.length === 0) {
      isProcessing = false;
      return;
    }

    const doc = result.rows[0];
    currentDocId = doc.id;

    // Mark as processing
    await pool.query(
      `UPDATE document_queue SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [currentDocId]
    );
    await pool.query(
      `INSERT INTO document_audit_trail (queue_id, action, details) VALUES ($1, 'processing_started', 'Started processing document')`,
      [currentDocId]
    );

    console.log(`[DocProcessor] Processing document ${currentDocId}: ${doc.file_name}`);

    // Read file and convert to base64
    const fileBuffer = fs.readFileSync(doc.file_path);
    const base64File = fileBuffer.toString('base64');

    // Determine mime type
    let mimeType = 'application/octet-stream';
    if (doc.file_type === 'pdf') mimeType = 'application/pdf';
    else if (doc.file_type === 'jpg' || doc.file_type === 'jpeg') mimeType = 'image/jpeg';
    else if (doc.file_type === 'png') mimeType = 'image/png';

    // Call Gemini
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = 'Analyze this document and return ONLY a valid JSON object with exactly these keys: category (string, must be one of: Salary Slip, Bank Statement, Aadhaar Card, PAN Card, Offer Letter, Invoice, Unknown), confidence (integer 0-100 representing how confident you are in the category), extracted_fields (object containing all key-value data you can extract from this document). Return nothing else, no markdown, no explanation, only the JSON object.';

    const geminiResult = await model.generateContent([
      {
        inlineData: {
          data: base64File,
          mimeType: mimeType
        }
      },
      prompt
    ]);

    let responseText = geminiResult.response.text();
    // Clean up potential markdown formatting despite instructions
    responseText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const jsonResponse = JSON.parse(responseText);

    const categoryName = jsonResponse.category || 'Unknown';
    const confidenceScore = typeof jsonResponse.confidence === 'number' ? jsonResponse.confidence : null;
    const extractedData = jsonResponse.extracted_fields || {};

    // Insert to document_extractions
    await pool.query(
      `INSERT INTO document_extractions (queue_id, category_name, extracted_data, confidence_score)
       VALUES ($1, $2, $3, $4)`,
      [currentDocId, categoryName, extractedData, confidenceScore]
    );

    // Update queue to completed
    await pool.query(
      `UPDATE document_queue SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [currentDocId]
    );

    // Audit completed
    await pool.query(
      `INSERT INTO document_audit_trail (queue_id, action, details) VALUES ($1, 'completed', 'Document processed successfully')`,
      [currentDocId]
    );

    try {
      const processedFolder = process.env.PROCESSED_FOLDER_PATH || path.join(process.env.WATCH_FOLDER_PATH || './watched_docs', '..', 'processed_docs');
      fs.mkdirSync(processedFolder, { recursive: true });
      const destination = path.join(processedFolder, doc.file_name);
      fs.copyFileSync(doc.file_path, destination);
      fs.unlinkSync(doc.file_path);
    } catch (moveErr) {
      console.error(`[DocProcessor] Error moving file for document ${currentDocId}:`, moveErr);
    }

    console.log(`[DocProcessor] Completed document ${currentDocId}`);

  } catch (err) {
    const is503 = err.status === 503 || (err.message && err.message.includes('503'));
    
    if (is503) {
      console.log(`[DocProcessor] Gemini overloaded, will retry...`);
      if (currentDocId) {
        try {
          await pool.query(
            `UPDATE document_queue SET status = 'pending', updated_at = NOW() WHERE id = $1`,
            [currentDocId]
          );
        } catch (dbErr) {
          console.error(`[DocProcessor] Failed to revert document ${currentDocId} to pending:`, dbErr);
        }
      }
    } else {
      console.error(`[DocProcessor] Error processing document ${currentDocId}:`, err);
      if (currentDocId) {
        try {
          await pool.query(
            `UPDATE document_queue SET status = 'failed', updated_at = NOW() WHERE id = $1`,
            [currentDocId]
          );
          await pool.query(
            `INSERT INTO document_audit_trail (queue_id, action, details) VALUES ($1, 'failed', $2)`,
            [currentDocId, err.message]
          );
        } catch (dbErr) {
          console.error(`[DocProcessor] Failed to log error for document ${currentDocId}:`, dbErr);
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}

async function startProcessor() {
  console.log('[DocProcessor] Starting document processor loop');
  
  try {
    await pool.query(`UPDATE document_queue SET status = 'pending' WHERE status = 'processing'`);
    console.log('[DocProcessor] Reset stuck processing documents');
  } catch (err) {
    console.error('[DocProcessor] Failed to reset stuck processing documents:', err);
  }

  // Check every 15 seconds
  setInterval(processNextDocument, 15000);
}

module.exports = { startProcessor };
