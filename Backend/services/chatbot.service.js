const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../db');
const { getHotLeads } = require('./hot-leads.service');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const functionDeclarations = [
  {
    name: "getLeads",
    description: "Fetches a list of leads based on optional filters. Caps at 50 results.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "e.g., New, Contacted, Qualified, Converted, Rejected" },
        source: { type: "string" },
        searchTerm: { type: "string", description: "Search by name, email, or company" },
        dateFrom: { type: "string", description: "ISO date string" },
        dateTo: { type: "string", description: "ISO date string" }
      }
    }
  },
  {
    name: "getLeadStats",
    description: "Returns aggregate counts of leads (total, by status, by source).",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "getHotLeads",
    description: "Returns the top N leads ordered by lead_score descending, excluding Converted/Rejected leads.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of hot leads to return (default 5, max 20)" }
      }
    }
  },
  {
    name: "getLeadById",
    description: "Fetches full details for a single lead using its exact integer ID.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "integer", description: "The lead ID" }
      },
      required: ["id"]
    }
  }
];

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: "You are a helpful assistant for a CRM admin. You can only answer questions about lead data using the provided tools. You cannot take any actions or make changes. If asked to do something you cannot do (like update, create, or delete a lead), clearly state that you are a read-only assistant and suggest the user perform the action manually in the dashboard.",
  tools: [{ functionDeclarations }]
});

// Database execution functions
async function executeGetLeads(args) {
  try {
    let query = 'SELECT id, name, company, email, status, source, lead_score, created_at FROM leads WHERE 1=1';
    const params = [];
    
    if (args.status) {
      params.push(args.status);
      query += ` AND status ILIKE $${params.length}`;
    }
    if (args.source) {
      params.push(args.source);
      query += ` AND source ILIKE $${params.length}`;
    }
    if (args.searchTerm) {
      params.push(`%${args.searchTerm}%`);
      query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`;
    }
    if (args.dateFrom) {
      params.push(args.dateFrom);
      query += ` AND created_at >= $${params.length}`;
    }
    if (args.dateTo) {
      params.push(args.dateTo);
      query += ` AND created_at <= $${params.length}`;
    }

    // First get total count matching filters
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS filtered`;
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    query += ' ORDER BY created_at DESC LIMIT 50';
    const result = await pool.query(query, params);
    
    return {
      total_matching: totalCount,
      returned: result.rows.length,
      leads: result.rows
    };
  } catch (error) {
    console.error('=== ERROR IN getLeads TOOL ===');
    console.error('Args:', args);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

async function executeGetLeadStats() {
  const totalRes = await pool.query('SELECT COUNT(*) FROM leads');
  const statusRes = await pool.query('SELECT status, COUNT(*) FROM leads GROUP BY status');
  const sourceRes = await pool.query('SELECT source, COUNT(*) FROM leads GROUP BY source');
  
  return {
    total: parseInt(totalRes.rows[0].count, 10),
    by_status: statusRes.rows.reduce((acc, row) => ({ ...acc, [row.status]: parseInt(row.count, 10) }), {}),
    by_source: sourceRes.rows.reduce((acc, row) => ({ ...acc, [row.source]: parseInt(row.count, 10) }), {})
  };
}

async function executeGetHotLeads(args) {
  const limit = Math.min(Math.max(parseInt(args.limit) || 5, 1), 20);
  const leads = await getHotLeads(limit);
  return { leads };
}

async function executeGetLeadById(args) {
  const result = await pool.query('SELECT * FROM leads WHERE id = $1', [args.id]);
  if (result.rows.length === 0) return { error: "Lead not found" };
  return { lead: result.rows[0] };
}

async function handleToolCall(functionCall) {
  const { name, args } = functionCall;
  try {
    switch (name) {
      case 'getLeads':
        return await executeGetLeads(args);
      case 'getLeadStats':
        return await executeGetLeadStats();
      case 'getHotLeads':
        return await executeGetHotLeads(args);
      case 'getLeadById':
        return await executeGetLeadById(args);
      default:
        return { error: `Unknown function: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return { error: `Failed to execute tool: ${error.message}` };
  }
}

async function processChat(message, history = []) {
  const maxRetries = 3;
  const delays = [500, 1000, 2000];

  try {
    // Format history for Gemini
    const formattedHistory = history.map(item => ({
      role: item.role === 'model' ? 'model' : 'user',
      parts: [{ text: item.text }]
    }));

    const chat = model.startChat({
      history: formattedHistory
    });

    async function sendMessageWithRetry(payload) {
      let lastError;
      // attempt ranges from 1 up to maxRetries + 1 (the initial try + 3 retries)
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
          return await chat.sendMessage(payload);
        } catch (error) {
          lastError = error;
          // Only retry on 503 Service Unavailable
          if (error.status === 503) {
            if (attempt <= maxRetries) {
              const delay = delays[attempt - 1] || 2000;
              console.log(`Gemini 503, retrying attempt ${attempt}/${maxRetries}...`);
              await new Promise(res => setTimeout(res, delay));
              continue;
            }
          } else {
            // Fail immediately on 400s, auth errors, etc.
            throw error;
          }
        }
      }
      throw lastError;
    }

    let result = await sendMessageWithRetry(message);
    let call = result.response.functionCalls() && result.response.functionCalls()[0];

    // Loop to handle potential multiple function calls
    while (call) {
      const functionResponseData = await handleToolCall(call);
      
      result = await sendMessageWithRetry([{
        functionResponse: {
          name: call.name,
          response: functionResponseData
        }
      }]);
      
      call = result.response.functionCalls() && result.response.functionCalls()[0];
    }

    return { reply: result.response.text() };
  } catch (error) {
    console.error('Chatbot error - Full Trace:', {
      message: error.message,
      name: error.name,
      status: error.status,
      stack: error.stack,
      historySent: history
    });

    // If exhausted retries on a 503
    if (error.status === 503) {
      return { 
        reply: "The AI service is temporarily busy, please try again in a moment."
      };
    }

    return { 
      reply: "I'm sorry, I encountered an internal error while processing your request. Please try again later."
    };
  }
}

module.exports = { processChat };
