let clients = [];

function addClient(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // flush headers to establish SSE

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ message: 'Connected to SSE' })}\n\n`);

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
}

function sendEvent(eventType, data) {
  const payload = JSON.stringify({ type: eventType, data });
  clients.forEach(client => {
    client.write(`data: ${payload}\n\n`);
  });
}

module.exports = { addClient, sendEvent };
