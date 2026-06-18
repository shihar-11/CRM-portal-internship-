require('dotenv').config();
const https = require('https');
const db = require('./db');
const { fetchLeadResponses, fetchLeadForms } = require('./services/linkedin-sync.service.js').__get__ ? require('./services/linkedin-sync.service.js') : {};

async function fetchAllResponses() {
  const options = {
    hostname: 'api.linkedin.com',
    path: '/rest/leadForms?q=owner&owner=(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A512213121)&count=25&start=0',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + process.env.LINKEDIN_ACCESS_TOKEN,
      'Linkedin-Version': '202506',
      'X-Restli-Protocol-Version': '2.0.0'
    }
  };

  const formsData = await new Promise((resolve, reject) => {
    https.request(options, res => {
      let data = '';
      res.on('data', c => data+=c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject).end();
  });

  const formObjects = formsData.elements || [];
  
  for (const form of formObjects) {
    const formId = form.id;
    const versionId = form.version?.versionTag || '1';
    
    let startOffset = 0;
    let hasMore = true;
    while(hasMore) {
      const path = '/rest/leadFormResponses' +
        '?q=owner' +
        '&owner=(sponsoredAccount:urn%3Ali%3AsponsoredAccount%3A512213121)' +
        '&leadType=(leadType:SPONSORED)' +
        '&limitedToTestLeads=false' +
        '&count=50' +
        `&start=${startOffset}` +
        `&versionedLeadGenFormUrn=urn%3Ali%3AversionedLeadGenForm%3A%28urn%3Ali%3AleadGenForm%3A${formId}%2C${versionId}%29`;
      
      const reqOptions = { ...options, path };
      const responsesData = await new Promise((resolve, reject) => {
        https.request(reqOptions, res => {
          let data = '';
          res.on('data', c => data+=c);
          res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject).end();
      });

      const elements = responsesData.elements || [];
      if (elements.length === 0) break;

      for (const response of elements) {
        const submittedAt = response.submittedAt;
        let email = null;
        for (const ans of (response.formResponse.answers || [])) {
          const txt = ans.answerDetails?.textQuestionAnswer?.answer;
          if (txt && txt.includes('@')) {
            email = txt.trim();
          }
        }

        if (email && submittedAt) {
          await db.query('UPDATE leads SET created_at = TO_TIMESTAMP($1 / 1000.0) WHERE email = $2', [submittedAt, email]);
        }
      }

      startOffset += 50;
    }
  }
}

fetchAllResponses().then(() => {
  console.log('Timestamps updated successfully!');
  process.exit(0);
}).catch(console.error);
