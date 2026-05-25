const pool = require('./db');

async function createNotificationsAndProfileTables() {
  try {
    // 1. Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        lead_name VARCHAR(255),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Table 'notifications' checked/created successfully.");

    // 2. Ensure admin_users table exists with default seed
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    
    // Seed admin if none exists
    const checkAdmin = await pool.query(`SELECT * FROM admin_users WHERE id = 1`);
    if (checkAdmin.rows.length === 0) {
      await pool.query(`
        INSERT INTO admin_users (id, username, password)
        VALUES (1, 'admin', 'admin123')
      `);
      console.log("Seeded default admin user.");
    }

    // 3. Alter admin_users to add profile fields if they don't exist
    await pool.query(`
      ALTER TABLE admin_users 
        ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT 'Admin',
        ADD COLUMN IF NOT EXISTS profile_image TEXT DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);
    console.log("Altered 'admin_users' for profile fields successfully.");
  } catch (err) {
    console.error("Error creating notifications/profile tables:", err);
  }
}

module.exports = createNotificationsAndProfileTables;
