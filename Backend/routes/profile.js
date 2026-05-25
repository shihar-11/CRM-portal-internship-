const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'));
    }
  }
});

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, profile_image, updated_at FROM admin_users WHERE id = 1'
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Fetch Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/profile/name
router.patch('/name', async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    await pool.query('UPDATE admin_users SET full_name = $1, updated_at = NOW() WHERE id = 1', [full_name]);
    res.status(200).json({ success: true, message: 'Name updated' });
  } catch (error) {
    console.error('Update Name Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/profile/password
router.patch('/password', async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    
    const userResult = await pool.query('SELECT password FROM admin_users WHERE id = 1');
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Auth logic hardcodes plain text check in auth.js, so we match that pattern here
    const storedPassword = userResult.rows[0].password;
    if (current_password !== storedPassword) {
      return res.status(400).json({ success: false, error: 'Current password incorrect' });
    }
    
    await pool.query('UPDATE admin_users SET password = $1, updated_at = NOW() WHERE id = 1', [new_password]);
    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update Password Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/profile/image
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }
    
    const base64string = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await pool.query('UPDATE admin_users SET profile_image = $1, updated_at = NOW() WHERE id = 1', [base64string]);
    
    res.status(200).json({ success: true, profile_image: base64string });
  } catch (error) {
    console.error('Upload Image Error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

module.exports = router;
