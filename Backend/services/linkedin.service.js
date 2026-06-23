const pool = require('../db');
const sse = require('./sse.service');
const { calculateLeadScore } = require('./lead-scoring.service');
const { broadcastHotLeads } = require('./hot-leads.service');

// =========================
// EXTRACT FIELDS FROM REAL LINKEDIN PAYLOAD
// LinkedIn buries answers inside formResponse.answers array
// =========================
function extractFieldFromAnswers(answers, questionType) {
  if (!answers || !Array.isArray(answers)) return null;
  const found = answers.find(a => a.questionType === questionType);
  return found ? found.answer : null;
}

async function processLinkedInLead(lead) {
  try {
    // LinkedIn's real lead object structure
    const leadId = lead.leadId || lead.id || `li_${Date.now()}`;
    
    // Extract from formResponse.answers array
    const answers = lead.formResponse?.answers || [];

    const name =
      extractFieldFromAnswers(answers, 'FULL_NAME') ||
      extractFieldFromAnswers(answers, 'FIRST_NAME') ||
      lead.firstName ||
      'LinkedIn User';

    const email =
      extractFieldFromAnswers(answers, 'EMAIL') ||
      lead.email ||
      'unknown@linkedin.com';

    const company =
      extractFieldFromAnswers(answers, 'COMPANY') ||
      extractFieldFromAnswers(answers, 'COMPANY_NAME') ||
      lead.company ||
      '';

    const phone =
      extractFieldFromAnswers(answers, 'PHONE') ||
      lead.phone ||
      '';

    const source = 'LinkedIn Lead Gen';
    const status = 'New';
    const notes = phone
      ? `Phone: ${phone} | Imported via LinkedIn Lead Gen`
      : 'Imported via LinkedIn Lead Gen';

    // Duplicate check
    const existing = await pool.query(
      'SELECT * FROM leads WHERE linkedin_id = $1 OR email = $2',
      [leadId, email]
    );

    if (existing.rows.length > 0) {
      console.log('Duplicate LinkedIn lead skipped:', leadId);
      return { success: false, message: 'Duplicate lead' };
    }

    // Calculate score
    const { total, breakdown } = calculateLeadScore({ status, email, source });

    // Insert into DB
    const query = `
      INSERT INTO leads (name, email, company, status, source, notes, linkedin_id, lead_score, score_breakdown)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [name, email, company, status, source, notes, leadId, total, breakdown];

    const result = await pool.query(query, values);
    const newLead = result.rows[0];

    console.log('New LinkedIn lead saved:', newLead.id, '|', newLead.name);

    // Push to dashboard in real-time
    sse.sendEvent('NEW_LEAD', newLead);
    broadcastHotLeads();

    return { success: true, lead: newLead };

  } catch (error) {
    console.error('LinkedIn Service Error:', error);
    throw error;
  }
}

module.exports = { processLinkedInLead };