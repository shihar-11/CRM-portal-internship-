const chokidar = require('chokidar');
const path = require('path');
const pool = require('../db');

function startWatcher() {
  const watchFolder = process.env.WATCH_FOLDER_PATH || './watched_docs';
  
  // Create watcher
  const watcher = chokidar.watch(watchFolder, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true
  });

  watcher.on('add', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
      const fileName = path.basename(filePath);
      const fileType = ext.substring(1); // remove the leading dot

      let tableReady = false;
      for (let i = 0; i < 5; i++) {
        try {
          await pool.query('SELECT 1 FROM document_queue LIMIT 1');
          tableReady = true;
          break; // Table exists, proceed to insert
        } catch (err) {
          if (err.code === '42P01') { // 42P01: undefined_table
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            break; // Break on other types of errors
          }
        }
      }

      if (!tableReady) {
        console.log(`[DocWatcher] DB not ready, skipping: ${fileName}`);
        return;
      }

      try {
        const existing = await pool.query(
          `SELECT id FROM document_queue WHERE file_name = $1 AND status IN ('pending', 'processing', 'completed') LIMIT 1`,
          [fileName]
        );
        if (existing.rows.length > 0) {
          console.log(`[DocWatcher] Already queued, skipping: ${fileName}`);
          return;
        }

        await pool.query(
          `INSERT INTO document_queue (file_name, file_path, file_type, status)
           VALUES ($1, $2, $3, 'pending')`,
          [fileName, filePath, fileType]
        );
        console.log(`[DocWatcher] Queued: ${fileName}`);
      } catch (err) {
        console.error(`[DocWatcher] Error queueing ${fileName}:`, err);
      }
    }
  });

  console.log(`[DocWatcher] Watching for documents in ${watchFolder}`);
}

module.exports = { startWatcher };
