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

const mockDataFallback = {
  work_order: {
    order_no: "WO-2026-001",
    order_date: "15-05-2026",
    project_number: "PRJ-999-WO",
    project_name: "NICSI Govt Portal Upgrade",
    order_start: "01-06-2026",
    order_end: "31-08-2026",
    billing_cycle: "Monthly",
    no_of_billing_cycles: 3,
    customer: {
      name: "National Informatics Centre",
      email: "contact@nic.in",
      mobile: "9876543210",
      gst_number: "27AAAAA0000A1Z5",
      pan_number: "AAAAA0000A",
      official_address: "CGO Complex, Lodhi Road, New Delhi",
      contract_state: "Delhi",
      website: "https://nic.in"
    },
    contact_persons: [
      { name: "Rahul Sharma", designation: "Project Director", email: "rahul.s@nic.in", mobile: "9988776655" }
    ],
    resource_demand: [
      { job_role: "Senior Developer", experience: "5+ Years", qty: 2, start_date: "01-06-2026", end_date: "31-08-2026", unit_rate: 50000, billing_amount: 300000 }
    ],
    billing_subscriptions: [
      { subscription_id: "M 1", description: "Month 1 Billing", date: "01-07-2026", amount: 100000, status: "Pending" },
      { subscription_id: "M 2", description: "Month 2 Billing", date: "01-08-2026", amount: 100000, status: "Pending" },
      { subscription_id: "M 3", description: "Month 3 Billing", date: "01-09-2026", amount: 100000, status: "Pending" }
    ],
    total_billing: 300000,
    total_subscription: 300000
  },
  purchase_order: {
    order_no: "PO-2026-042",
    order_date: "10-05-2026",
    project_number: "PRJ-888-PO",
    project_name: "Hardware Procurement",
    order_start: "15-05-2026",
    order_end: "15-08-2026",
    billing_cycle: "Monthly",
    no_of_billing_cycles: 3,
    customer: {
      name: "Tech Solutions Ltd",
      email: "sales@techsolutions.com",
      mobile: "9876543211",
      gst_number: "27BBBBB0000B1Z5",
      pan_number: "BBBBB0000B",
      official_address: "Andheri East, Mumbai",
      contract_state: "Maharashtra",
      website: "https://techsolutions.com"
    },
    contact_persons: [
      { name: "Sneha Patel", designation: "Sales Manager", email: "sneha@techsolutions.com", mobile: "9988776656" }
    ],
    resource_demand: [
      { job_role: "Server Rack", experience: "N/A", qty: 5, start_date: "15-05-2026", end_date: "15-08-2026", unit_rate: 100000, billing_amount: 500000 }
    ],
    billing_subscriptions: [
      { subscription_id: "M 1", description: "Milestone 1", date: "15-06-2026", amount: 200000, status: "Pending" },
      { subscription_id: "M 2", description: "Milestone 2", date: "15-07-2026", amount: 200000, status: "Pending" },
      { subscription_id: "M 3", description: "Milestone 3", date: "15-08-2026", amount: 100000, status: "Pending" }
    ],
    total_billing: 500000,
    total_subscription: 500000
  },
  invoice: {
    order_no: "INV-2026-999",
    order_date: "20-05-2026",
    project_number: "PRJ-777-INV",
    project_name: "Cloud Hosting Services",
    order_start: "01-06-2026",
    order_end: "31-08-2026",
    billing_cycle: "Monthly",
    no_of_billing_cycles: 3,
    customer: {
      name: "CloudTech India",
      email: "billing@cloudtech.in",
      mobile: "9876543212",
      gst_number: "29CCCCC0000C1Z5",
      pan_number: "CCCCC0000C",
      official_address: "Electronic City, Bangalore",
      contract_state: "Karnataka",
      website: "https://cloudtech.in"
    },
    contact_persons: [
      { name: "Amit Kumar", designation: "Billing Analyst", email: "amit@cloudtech.in", mobile: "9988776657" }
    ],
    resource_demand: [
      { job_role: "Cloud Architect", experience: "8+ Years", qty: 1, start_date: "01-06-2026", end_date: "31-08-2026", unit_rate: 150000, billing_amount: 450000 }
    ],
    billing_subscriptions: [
      { subscription_id: "M 1", description: "June Hosting", date: "01-07-2026", amount: 150000, status: "Pending" },
      { subscription_id: "M 2", description: "July Hosting", date: "01-08-2026", amount: 150000, status: "Pending" },
      { subscription_id: "M 3", description: "August Hosting", date: "01-09-2026", amount: 150000, status: "Pending" }
    ],
    total_billing: 450000,
    total_subscription: 450000
  },
  custom: {
    order_no: "CUST-2026-123",
    order_date: "25-05-2026",
    project_number: "PRJ-666-CUST",
    project_name: "Ad-hoc Maintenance",
    order_start: "01-06-2026",
    order_end: "31-08-2026",
    billing_cycle: "Monthly",
    no_of_billing_cycles: 3,
    customer: {
      name: "ABC Corp",
      email: "admin@abccorp.com",
      mobile: "9876543213",
      gst_number: "33DDDDD0000D1Z5",
      pan_number: "DDDDD0000D",
      official_address: "Guindy, Chennai",
      contract_state: "Tamil Nadu",
      website: "https://abccorp.com"
    },
    contact_persons: [
      { name: "Priya Singh", designation: "Admin", email: "priya@abccorp.com", mobile: "9988776658" }
    ],
    resource_demand: [
      { job_role: "Maintenance Engineer", experience: "2+ Years", qty: 3, start_date: "01-06-2026", end_date: "31-08-2026", unit_rate: 20000, billing_amount: 180000 }
    ],
    billing_subscriptions: [
      { subscription_id: "M 1", description: "Month 1 Maint", date: "01-07-2026", amount: 60000, status: "Pending" },
      { subscription_id: "M 2", description: "Month 2 Maint", date: "01-08-2026", amount: 60000, status: "Pending" },
      { subscription_id: "M 3", description: "Month 3 Maint", date: "01-09-2026", amount: 60000, status: "Pending" }
    ],
    total_billing: 180000,
    total_subscription: 180000
  }
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

    const rawDocType = req.body.document_type || 'Work Order';
    const docType = rawDocType.toLowerCase().replace(' ', '_');

    // 1. Fetch saved annotations for this document type
    const templateQuery = await pool.query('SELECT annotations FROM ocr_template_mappings WHERE document_type = $1', [docType]);

    if (templateQuery.rows.length === 0 || !templateQuery.rows[0].annotations) {
      return res.status(404).json({ error: `No annotation template found for document type '${rawDocType}'. Please annotate the document first using the Annotation Tool.` });
    }

    const dbAnnotations = templateQuery.rows[0].annotations;
    const allFields = { ...(dbAnnotations.fields || {}), ...(dbAnnotations.custom_fields || {}) };

    if (Object.keys(allFields).length === 0) {
      return res.status(400).json({ error: `No fields mapped in the annotation template for '${rawDocType}'. Please add fields in the Annotation Tool.` });
    }

    // 2. Build strict prompt and dynamic schema
    let promptAnnotations = "";
    const dynamicProperties = {};
    const fieldKeys = [];

    for (const [key, field] of Object.entries(allFields)) {
      dynamicProperties[key] = { type: "string" };
      fieldKeys.push(key);
      promptAnnotations += `- '${key}' (Label: '${field.label}'): located on page ${field.page} at x=${field.normalized.x}%, y=${field.normalized.y}%, width=${field.normalized.w}%, height=${field.normalized.h}%.\n`;
    }

    const dynamicSchema = {
      type: "object",
      properties: dynamicProperties,
      required: fieldKeys
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: dynamicSchema
      }
    });

    const finalPrompt = `You are an expert document parser. Your task is to extract structured fields deterministically from the attached document.

Extraction Rules:
- Extract values ONLY for these specific fields:
${promptAnnotations}
- Each field has a bounding box region on the document at these normalized coordinates. Extract text from exactly those regions.
- Do not infer, guess, or extract any other fields.
- If a field's region contains no readable text, return null for that field.
- All dates MUST be in DD-MM-YYYY format.
`;

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
        const fallbackPrompt = finalPrompt + "\n\nReturn ONLY a raw JSON object matching the requested fields and nothing else. No markdown.";
        const fallbackResult = await fallbackModel.generateContent([fallbackPrompt, documentPart]);
        const fallbackText = fallbackResult.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        console.log("Fallback Gemini response preview:", fallbackText.substring(0, 100));
        parsedJSON = JSON.parse(fallbackText);
      }

      // 3. Format response structure
      const extracted = {};
      const mapped_fields = Object.keys(allFields);

      for (const key of Object.keys(parsedJSON)) {
        if (mapped_fields.includes(key)) {
          extracted[key] = parsedJSON[key];
        }
      }

      const allPossibleKeys = [
        'work_order_no', 'order_no', 'date', 'order_date', 'project_no', 'project_name',
        'project_number', 'order_start', 'order_end', 'billing_cycle', 'no_of_billing_cycles',
        'vendor_name', 'email', 'phone_number', 'contact_persons', 'address', 'grand_total'
      ];
      const unmapped_fields = allPossibleKeys.filter(k => !mapped_fields.includes(k));

      res.json({
        extracted,
        mapped_fields,
        unmapped_fields
      });
    } catch (apiError) {
      console.error("Gemini API Error:", apiError);

      const errorMessage = (apiError.message || '').toLowerCase();
      const isQuotaError = apiError.status === 429 ||
        errorMessage.includes('429') ||
        errorMessage.includes('quota exceeded') ||
        errorMessage.includes('resourceexhausted');

      if (isQuotaError) {
        const rawType = req.body.document_type || 'Work Order';
        const docType = rawType.toLowerCase().replace(' ', '_');

        console.warn(`[Gemini API] Quota exceeded / 429 hit. Activating structured mock data fallback for type: ${docType}.`);

        const mockExtracted = {};
        const mapped_fields = Object.keys(allFields);
        for (const key of mapped_fields) {
          mockExtracted[key] = "[Mock DB] " + (allFields[key].label || key);
        }

        const allPossibleKeys = [
          'work_order_no', 'order_no', 'date', 'order_date', 'project_no', 'project_name',
          'project_number', 'order_start', 'order_end', 'billing_cycle', 'no_of_billing_cycles',
          'vendor_name', 'email', 'phone_number', 'contact_persons', 'address', 'grand_total'
        ];
        const unmapped_fields = allPossibleKeys.filter(k => !mapped_fields.includes(k));

        return res.status(200).json({
          extracted: mockExtracted,
          mapped_fields,
          unmapped_fields
        });
      }

      return res.status(500).json({ error: 'Gemini API call failed: ' + apiError.message });
    }
  } catch (error) {
    console.error('Error during bill scan:', error);
    res.status(500).json({ error: 'Failed to process document: ' + error.message });
  }
});

router.post('/save-annotation', async (req, res) => {
  try {
    // const body = decrypt(req.body.data);
    // console.log("REQUEST BODY:", body, 'test');

    // console.log('=== SAVE ANNOTATION CALLED ===');
    // console.log('Raw request body:', JSON.stringify(req.body, null, 2));
    // console.log('Annotations received:', req.body?.annotations);
    // console.log('Fields count:', Object.keys(req.body?.annotations?.fields || {}).length);
    // console.log('Field keys:', Object.keys(req.body?.annotations?.fields || {}));

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
