const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#dc2626',
  '#d97706', '#0891b2', '#db2777', '#65a30d'
];

// POST /api/auth/setup  — only works if zero users exist (creates first admin)
router.post('/setup', async (req, res) => {
  try {
    const row = await db.prepare('SELECT COUNT(*) as c FROM users').get();
    const count = parseInt(row.c || row.count || 0);
    if (count > 0) {
      return res.status(403).json({ error: 'Setup already complete. Contact your admin.' });
    }
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const color = AVATAR_COLORS[0];
    const result = await db.prepare(
      'INSERT INTO users (name, email, password, avatar_color, role, timezone) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(name, email, hashed, color, 'admin', 'UTC');

    const user = { id: result.lastInsertRowid, name, email, avatar_color: color, avatar_url: null, timezone: 'UTC', role: 'admin' };
    const token = jwt.sign({ id: user.id, name, email, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/needs-setup  — frontend checks this on load
router.get('/needs-setup', async (req, res) => {
  try {
    const row = await db.prepare('SELECT COUNT(*) as c FROM users').get();
    const count = parseInt(row.c || row.count || 0);
    res.json({ needsSetup: count === 0 });
  } catch (err) {
    console.error('❌ Needs-setup Check Failed:', err.message);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        avatar_color: user.avatar_color, 
        avatar_url: user.avatar_url,
        timezone: user.timezone || 'UTC',
        role: user.role 
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
