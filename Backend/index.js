require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Import modular routes
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const webhooksRoutes = require('./routes/webhooks');
const ocrRoutes = require('./routes/ocr');

const app = express();

// =========================
// Middleware
// =========================
app.use(cors());
app.use(express.json());

// =========================
// Register Routes
// =========================
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/webhook', webhooksRoutes);
app.use('/api/ocr', ocrRoutes);

// Retain legacy login api path just in case
app.use('/api/login', authRoutes);

// =========================
// SERVER START
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});