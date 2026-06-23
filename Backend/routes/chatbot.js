const express = require('express');
const router = express.Router();
const { processChat } = require('../services/chatbot.service');

router.post('/query', async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    const chatHistory = Array.isArray(history) ? history : [];
    
    const response = await processChat(message, chatHistory);
    
    res.json(response);
  } catch (error) {
    console.error('Error in chatbot route:', error);
    res.status(500).json({ 
      reply: "I'm sorry, an unexpected server error occurred. Please try again later."
    });
  }
});

module.exports = router;
