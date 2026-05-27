const pool = require('./db');

(async () => {
  try {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_ocr_mappings_annotations ON ocr_template_mappings USING GIN (annotations);');
    console.log('Successfully added GIN index to ocr_template_mappings.annotations');
    process.exit(0);
  } catch (error) {
    console.error('Error adding GIN index:', error);
    process.exit(1);
  }
})();
