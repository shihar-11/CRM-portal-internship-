function calculateLeadScore(lead) {
  let total = 0;
  let breakdown = { recency: 0, status: 0, emailDomain: 0, source: 0 };

  // 1. Recency
  const createdAt = lead.created_at ? new Date(lead.created_at) : new Date();
  const diffDays = Math.floor(Math.abs(new Date() - createdAt) / (1000 * 60 * 60 * 24));
  breakdown.recency = Math.max(0, 30 - (diffDays * 5));

  // 2. Status progression
  const status = lead.status || 'New';
  switch (status) {
    case 'New': breakdown.status = 10; break;
    case 'Contacted': breakdown.status = 25; break;
    case 'Qualified': breakdown.status = 40; break;
    case 'Converted': case 'Rejected': breakdown.status = 0; break;
    default: breakdown.status = 0;
  }

  // 3. Email domain quality
  const email = lead.email || '';
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  if (domain && !genericDomains.includes(domain)) {
    breakdown.emailDomain = 15;
  }

  // 4. Source
  const source = lead.source || '';
  const automatedSources = ['LinkedIn Sync', 'LinkedIn Lead Gen', 'Webhook', 'LinkedIn'];
  if (automatedSources.includes(source)) {
    breakdown.source = 15;
  } else {
    breakdown.source = 5; // e.g. 'Website' or manual entries
  }

  total = Math.min(100, breakdown.recency + breakdown.status + breakdown.emailDomain + breakdown.source);
  return { total, breakdown };
}

module.exports = { calculateLeadScore };
