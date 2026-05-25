const pool = require('./db'); 
async function run() { 
  try { 
    const res = await pool.query(`DELETE FROM ocr_template_mappings WHERE document_type = 'work_order'`); 
    console.log('Deleted rows:', res.rowCount); 
    const res2 = await pool.query(`SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'ocr_template_mappings'`); 
    console.log('Constraints:', res2.rows); 
  } catch (e) { 
    console.error(e); 
  } finally { 
    pool.end(); 
  } 
} 
run();
