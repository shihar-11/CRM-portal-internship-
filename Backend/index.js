require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Import modular routes
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const webhooksRoutes = require('./routes/webhooks');
const ocrRoutes = require('./routes/ocr');
const billScannerRoutes = require('./routes/bill-scanner');
const notificationsRoutes = require('./routes/notifications');
const profileRoutes = require('./routes/profile');
const annotationTemplatesRoutes = require('./routes/annotation-templates');
const documentPipelineRoutes = require('./routes/document-pipeline');

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
app.use('/api/bill-scan', billScannerRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/annotation-templates', annotationTemplatesRoutes);
app.use('/api/document-pipeline', documentPipelineRoutes);

// Retain legacy login api path just in case
app.use('/api/login', authRoutes);

// =========================
// SERVER START
// =========================
const createOcrTemplatesTable = require('./alter_db_ocr_templates');
const createNotificationsAndProfileTables = require('./alter_db_notifications');
const createDocumentPipelineTables = require('./alter_db_document_pipeline');

const initializeDatabase = async () => {
  await createOcrTemplatesTable();
  await createNotificationsAndProfileTables();
  await createDocumentPipelineTables();
};

initializeDatabase();

const linkedinSyncService = require('./services/linkedin-sync.service');
linkedinSyncService.start();

const { startWatcher } = require('./services/document-watcher.service');
startWatcher();

const { startProcessor } = require('./services/document-processor.service');
startProcessor();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
