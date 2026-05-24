const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configure multer to store file in memory
const upload = multer({ storage: multer.memoryStorage() });

router.post('/extract', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: 'Gemini API key is not configured' });
    }

    // Initialize Gemini API inside route to ensure env is loaded
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Convert buffer to base64
    const base64File = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Extract the following information from this document and return ONLY a valid JSON object with no extra text, no markdown, no backticks:
{
  "full_name": "",
  "email": "",
  "phone": "",
  "university": "",
  "degree": "",
  "skills": ""
}
Rules:
- email must contain @
- phone must contain only digits, spaces, or + symbol
- skills should be a comma-separated list
- If a field is not clearly found in the document, return null for that field
- Do NOT guess or fill from footer/header text`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64File,
          mimeType: mimeType
        }
      },
      prompt
    ]);

    let responseText = result.response.text();
    // Clean up potential markdown formatting despite instructions
    responseText = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON from Gemini:', responseText);
      return res.status(500).json({ success: false, message: 'Failed to parse extracted data' });
    }

    res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('OCR extraction error:', error);
    res.status(500).json({ success: false, message: 'Server error during extraction' });
  }
});

module.exports = router;
