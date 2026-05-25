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
    all_names: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          source_label: { type: "string" },
          location_hint: { type: "string" }
        },
        required: ["value", "source_label"]
      }
    },
    all_phones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          source_label: { type: "string" },
          location_hint: { type: "string" }
        },
        required: ["value", "source_label"]
      }
    },
    all_emails: {
      type: "array",
      items: {
        type: "object",
        properties: {
          value: { type: "string" },
          source_label: { type: "string" },
          location_hint: { type: "string" }
        },
        required: ["value", "source_label"]
      }
    },
    project_name: { type: "string" },
    primary_vendor_name: { type: "string" },
    primary_contact_person: { type: "string" },
    primary_phone: { type: "string" },
    primary_email: { type: "string" },
    work_order_no: { type: "string" },
    date: { type: "string" },
    project_no: { type: "string" },
    address: { type: "string" },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sno: { type: "string" },
          hsn_sac_code: { type: "string" },
          description: { type: "string" },
          no_of_persons: { type: "string" },
          required_period: { type: "string" },
          unit_rate: { type: "string" },
          date_from: { type: "string" },
          date_to: { type: "string" },
          total_amount: { type: "string" },
          cgst_percent: { type: "string" },
          cgst_amount: { type: "string" },
          sgst_percent: { type: "string" },
          sgst_amount: { type: "string" },
          igst_percent: { type: "string" },
          igst_amount: { type: "string" }
        }
      }
    },
    grand_total: { type: "string" }
  },
  required: [
    "all_names", "all_phones", "all_emails", "project_name",
    "primary_vendor_name", "primary_contact_person", "primary_phone", "primary_email",
    "work_order_no", "date", "project_no", "address", "line_items", "grand_total"
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

Use a TWO-PHASE extraction strategy:

PHASE 1 — Extract ALL candidates for each field with their source label context:
- all_names: array of {value, source_label, location_hint}. Extract any name found in the document. Provide the label it is associated with (e.g., source_label: "Issued to → Name", "Contact Person", "Signed by", "Copy To").
- all_phones: array of {value, source_label, location_hint}. Extract any phone numbers found.
- all_emails: array of {value, source_label, location_hint}. Extract any email addresses found.
- project_name: look ONLY for value after label "Project Name:-" or "Project Name:" — never confuse with person names.

PHASE 2 — From the candidates, pick the PRIMARY one per field using these strict rules:
- primary_vendor_name: pick from source_label containing "Issued to" or "Name:" under Issued to block.
- primary_contact_person: pick from source_label "Contact Person".
- primary_phone: pick from source_label "Phone No.:" under Issued to block — NOT footer numbers, NOT paragraph numbers.
- primary_email: pick from source_label "Email ID:" under Issued to block — NOT cc emails, NOT nic.in emails.

ALSO extract:
- work_order_no
- date
- project_no
- address
- line_items: array of {sno, hsn_sac_code, description, no_of_persons, required_period, unit_rate, date_from, date_to, total_amount, cgst_percent, cgst_amount, sgst_percent, sgst_amount, igst_percent, igst_amount}. Map these from the main table in the document if present.
- grand_total
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
