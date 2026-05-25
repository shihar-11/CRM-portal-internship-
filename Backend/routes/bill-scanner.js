const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../db');

// Use memory storage for multer
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const schema = {
  type: "object",
  properties: {
    order_no: { type: "string" },
    order_date: { type: "string", description: "Format DD-MM-YYYY" },
    project_number: { type: "string" },
    project_name: { type: "string" },
    order_start: { type: "string", description: "Format DD-MM-YYYY" },
    order_end: { type: "string", description: "Format DD-MM-YYYY" },
    billing_cycle: { type: "string", enum: ["Monthly", "Quarterly", "Yearly"] },
    no_of_billing_cycles: { type: "number" },
    customer: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        mobile: { type: "string" },
        gst_number: { type: "string" },
        pan_number: { type: "string" },
        official_address: { type: "string" },
        contract_state: { type: "string" },
        website: { type: "string" }
      }
    },
    contact_persons: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          designation: { type: "string" },
          email: { type: "string" },
          mobile: { type: "string" }
        }
      }
    },
    resource_demand: {
      type: "array",
      items: {
        type: "object",
        properties: {
          job_role: { type: "string" },
          experience: { type: "string" },
          qty: { type: "number" },
          start_date: { type: "string", description: "Format DD-MM-YYYY" },
          end_date: { type: "string", description: "Format DD-MM-YYYY" },
          unit_rate: { type: "number" },
          billing_amount: { type: "number" }
        }
      }
    },
    billing_subscriptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subscription_id: { type: "string" },
          description: { type: "string" },
          date: { type: "string", description: "Format DD-MM-YYYY" },
          amount: { type: "number" },
          status: { type: "string" }
        }
      }
    },
    total_billing: { type: "number" },
    total_subscription: { type: "number" }
  },
  required: [
    "order_no", "order_date", "project_number", "project_name", "order_start", "order_end",
    "billing_cycle", "no_of_billing_cycles", "customer", "contact_persons", "resource_demand",
    "billing_subscriptions", "total_billing", "total_subscription"
  ]
};

router.post('/', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided.' });
    }

    console.log("File uploaded successfully. Size:", req.file.size);
    // Convert file to base64 inline data block
    const documentPart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype
      }
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });

    const prompt = `You are an expert document parser. Your task is to extract structured fields deterministically from the attached government procurement document (e.g. NICSI Work Order).

Extraction Rules:
- All dates MUST be in DD-MM-YYYY format.
- vendor_name from the document should be mapped to customer.name.
- Phone numbers should only be extracted if they are near the contact person name. DO NOT extract footer phone numbers.
- billing_subscriptions should be auto-generated from the no_of_billing_cycles count, with incremented monthly dates if billing_cycle is Monthly. For example, if no_of_billing_cycles is 3, generate 3 items with subscription_id "M 1", "M 2", "M 3" and incremented dates.
- If a field is not found in the document, return null or an empty string.
- Do NOT guess or hallucinate. Only extract what is explicitly present in the document.
`;

    let annotationsHint = '';
    if (req.body.annotations) {
      try {
        const annotations = JSON.parse(req.body.annotations);
        if (annotations && (annotations.fields || annotations.custom_fields)) {
          annotationsHint = "\n\nUse these spatial hints from previous training:\n";
          
          const processFields = (fieldsObj) => {
            if (!fieldsObj) return;
            for (const [key, field] of Object.entries(fieldsObj)) {
               annotationsHint += `Field '${field.label}' is located on page ${field.page} at position x=${field.normalized.x}% from left, y=${field.normalized.y}% from top, width=${field.normalized.w}%, height=${field.normalized.h}% of the page. Extract the value from this region specifically.\n`;
            }
          };

          processFields(annotations.fields);
          processFields(annotations.custom_fields);
        }
      } catch(e) {
        console.error('Failed to parse annotations hint', e);
      }
    }

    const finalPrompt = prompt + annotationsHint;

    console.log("Sending payload to Gemini API");
    try {
      const result = await model.generateContent([finalPrompt, documentPart]);
      const response = await result.response;
      const text = response.text();
      console.log("Raw Gemini response length:", text.length, "Preview:", text.substring(0, 100));

      let parsedJSON;
      try {
        parsedJSON = JSON.parse(text);
      } catch (parseError) {
        console.warn("Failed to parse structured JSON. Retrying with simple JSON prompt...");
        const fallbackModel = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { temperature: 0.1 }
        });
        const fallbackPrompt = finalPrompt + "\n\nReturn ONLY a raw JSON object and nothing else. No markdown.";
        const fallbackResult = await fallbackModel.generateContent([fallbackPrompt, documentPart]);
        const fallbackText = fallbackResult.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        console.log("Fallback Gemini response preview:", fallbackText.substring(0, 100));
        parsedJSON = JSON.parse(fallbackText);
      }
      res.json(parsedJSON);
    } catch (apiError) {
      console.error("Gemini API Error:", apiError);
      return res.status(500).json({ error: 'Gemini API call failed: ' + apiError.message });
    }
  } catch (error) {
    console.error('Error during bill scan:', error);
    res.status(500).json({ error: 'Failed to process document: ' + error.message });
  }
});

router.post('/save-annotation', async (req, res) => {
  try {
    console.log('=== SAVE ANNOTATION CALLED ===');
    console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    console.log('Annotations received:', req.body?.annotations);
    console.log('Fields count:', Object.keys(req.body?.annotations?.fields || {}).length);
    console.log('Field keys:', Object.keys(req.body?.annotations?.fields || {}));

    const { document_name, document_type = 'work_order', annotations } = req.body;
    if (!annotations || !document_name) {
      console.log("Missing required fields");
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log("Connecting to DB and executing upsert");
    const query = `
      INSERT INTO ocr_template_mappings 
        (document_name, document_type, annotations, created_at, updated_at)
      VALUES 
        ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (document_type) 
      DO UPDATE SET 
        annotations = (ocr_template_mappings.annotations || $3::jsonb) || jsonb_build_object(
          'fields', COALESCE(ocr_template_mappings.annotations->'fields', '{}'::jsonb) || COALESCE($3::jsonb->'fields', '{}'::jsonb),
          'custom_fields', COALESCE(ocr_template_mappings.annotations->'custom_fields', '{}'::jsonb) || COALESCE($3::jsonb->'custom_fields', '{}'::jsonb)
        ),
        document_name = EXCLUDED.document_name,
        updated_at = NOW()
      RETURNING id;
    `;
    const result = await pool.query(query, [document_name, document_type, JSON.stringify(annotations)]);
    
    console.log("Upsert complete. Template ID:", result.rows[0].id);
    res.json({ success: true, template_id: result.rows[0].id });
    console.log("Returning response");
  } catch (error) {
    console.error('Error saving annotation:', error);
    res.status(500).json({ error: 'Failed to save annotation: ' + error.message });
  }
});

module.exports = router;
