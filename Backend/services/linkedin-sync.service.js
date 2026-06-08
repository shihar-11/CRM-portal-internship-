// ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_id VARCHAR(255) UNIQUE;

const https = require('https');
const db = require('../db');
const sseService = require('./sse.service');

const LINKEDIN_AD_ACCOUNT_ID = '512213121';

function fetchLeadForms() {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const path = '/rest/leadForms' +
      '?q=owner' +
      '&owner=(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A512213121)' +
      '&count=25' +
      '&start=0';

    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
        'Linkedin-Version': '202506',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch(e) {
            reject(new Error('Failed to parse response: ' + data));
          }
        } else {
          reject(new Error(`HTTP error! status: ${res.statusCode}, data: ${data}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}

function fetchLeadResponses(formId, versionId) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    
    // Build path directly as a string — do NOT use new URL() or URLSearchParams
    // They re-encode parentheses which breaks LinkedIn Restli 2.0
    const path = '/rest/leadFormResponses' +
      '?q=owner' +
      '&owner=(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A512213121)' +
      '&leadType=(leadType:SPONSORED)' +
      '&limitedToTestLeads=false' +
      '&count=25' +
      '&start=0' +
      `&versionedLeadGenFormUrn=urn%3Ali%3AversionedLeadGenForm%3A%28urn%3Ali%3AleadGenForm%3A${formId}%2C${versionId}%29`;

    const options = {
      hostname: 'api.linkedin.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
        'Linkedin-Version': '202506',
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(data);
            console.log('[LinkedIn Sync] Form', formId, '- response paging:', 
              JSON.stringify(parsedData.paging), '- elements count:', 
              parsedData.elements ? parsedData.elements.length : 0);

            resolve(parsedData);
          } catch(e) {
            reject(new Error('Failed to parse response: ' + data));
          }
        } else {
          reject(new Error(`HTTP error! status: ${res.statusCode}, data: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      console.error('[LinkedIn Sync] Request error:', e.message);
      reject(e);
    });
    req.end();
  });
}

function parseLead(element, questionMap) {
  const answers = element.formResponse?.answers || [];
  const fields = {};
  
  for (const answer of answers) {
    const predefined = questionMap[answer.questionId];
    const textAnswer = answer.answerDetails?.textQuestionAnswer?.answer;
    if (predefined && textAnswer) {
      fields[predefined] = textAnswer.trim();
    }
  }

  const firstName = fields['FIRST_NAME'] || '';
  const lastName = fields['LAST_NAME'] || '';
  const name = (firstName + ' ' + lastName).trim() || 'Unknown';
  const email = fields['EMAIL'] || fields['WORK_EMAIL'] || null;
  const phone = fields['WORK_PHONE_NUMBER'] || fields['PHONE_NUMBER'] || null;
  const company = fields['COMPANY_NAME'] || null;

  return {
    name,
    email,
    phone,
    company,
    linkedin_id: element.id,
    source: 'LinkedIn Sync',
    status: 'New'
  };
}

async function syncLeads() {
  console.log('[LinkedIn Sync] Starting sync...');
  if (!process.env.LINKEDIN_ACCESS_TOKEN) {
    console.error('[LinkedIn Sync] Error: LINKEDIN_ACCESS_TOKEN is missing in .env');
    return;
  }

  try {
    // Step A — Fetch Lead Forms
    const formsData = await fetchLeadForms();
    
    const formObjects = formsData.elements || [];
    console.log(`[LinkedIn Sync] Found ${formObjects.length} forms`);

    const formQuestionMap = {};
    for (const form of formObjects) {
      formQuestionMap[form.id] = {};
      const questions = form.content?.questions || [];
      for (const q of questions) {
        if (q.predefinedField) {
          formQuestionMap[form.id][q.questionId] = q.predefinedField;
        }
      }
    }

    let totalNewLeads = 0;

    // Step B — For each form URN, fetch lead responses
    for (const form of formObjects) {
      const formId = form.id;           // numeric ID from leadForms response
      const versionId = form.versionId || 1;
      
      const leadsData = await fetchLeadResponses(formId, versionId);
      const leadResponses = leadsData.elements || [];

      for (const response of leadResponses) {
        // Step C — For each lead response, parse fields
        const lead = parseLead(response, formQuestionMap[formId] || {});

        // Step D — Save to PostgreSQL with duplicate prevention
        const result = await db.query(
          `INSERT INTO leads (name, email, phone, company, source, status, linkedin_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (linkedin_id) DO NOTHING
           RETURNING *`,
          [lead.name, lead.email, lead.phone, lead.company, lead.source, lead.status, lead.linkedin_id]
        );

        if (result.rows.length > 0) {
          console.log('[LinkedIn Sync] New lead saved:', lead.name, lead.email);
          sseService.sendEvent('NEW_LEAD', result.rows[0]);
          totalNewLeads++;
        } else {
          console.log('[LinkedIn Sync] Duplicate skipped:', lead.linkedin_id);
        }
      }
    }
    console.log(`[LinkedIn Sync] Sync complete. ${totalNewLeads} new leads.`);
  } catch (err) {
    console.error('[LinkedIn Sync] Error:', err.message);
  }
}

function start() {
  syncLeads();
  setInterval(syncLeads, 5 * 60 * 1000);
}

module.exports = { start };
