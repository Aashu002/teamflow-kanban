const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#dc2626',
  '#d97706', '#0891b2', '#db2777', '#65a30d'
];

// Middleware: admin or lead
function adminOrLead(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'lead') {
    return res.status(403).json({ error: 'Admin or Project Lead access required' });
  }
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// GET /api/users — all users (for assignee dropdown)
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const users = await db.prepare(
    'SELECT id, name, email, avatar_color, role, created_at FROM users ORDER BY name'
  ).all();
  res.json(users);
}));

// POST /api/users — admin or lead creates a new member
router.post('/', authMiddleware, adminOrLead, asyncHandler(async (req, res) => {
  const { name, email, password, role, projectId } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Role safety: Only admins can create other admins
  let userRole = ['admin', 'lead', 'member'].includes(role) ? role : 'member';
  if (req.user.role !== 'admin' && userRole === 'admin') userRole = 'member';

  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const result = await db.prepare(
    'INSERT INTO users (name, email, password, avatar_color, role) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, hashed, color, userRole);

  const userId = result.lastInsertRowid;

  // Auto-boarding logic
  if (projectId) {
    const proj = await db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId);
    if (proj && (req.user.role === 'admin' || proj.owner_id === req.user.id)) {
      await db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?) ON CONFLICT (project_id, user_id) DO NOTHING').run(projectId, userId);
    }
  }

  res.status(201).json({
    id: userId, name, email, avatar_color: color, role: userRole
  });
}));

// DELETE /api/users/:id — admin removes a user
router.delete('/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  await db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
}));

// PATCH /api/users/:id/role — change global role
router.patch('/:id/role', authMiddleware, adminOrLead, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }
  if (!['admin', 'lead', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // If lead, verify permissions and scope
  if (req.user.role !== 'admin') {
    // 1. Prevent non-admins from promoting to admin
    if (role === 'admin') return res.status(403).json({ error: 'Only admins can grant admin role' });

    // 2. Prevent non-admins from demoting or modifying existing admins
    const targetUser = await db.prepare('SELECT role FROM users WHERE id = ?').get(id);
    if (targetUser?.role === 'admin') {
      return res.status(403).json({ error: 'Only admins can modify another admin\'s role' });
    }

    // 3. Verify the target user is a member of one of their projects
    const shared = await db.prepare(`
      SELECT 1 FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
      WHERE pm.user_id = ? AND p.owner_id = ?
    `).get(id, req.user.id);

    if (!shared) return res.status(403).json({ error: 'You can only manage roles for members of your own projects' });
  }

  await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  res.json({ success: true, role });
}));

// GET /api/users/me — profile and project info
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const user = await db.prepare('SELECT id, name, email, avatar_color, avatar_url, timezone, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const projects = await db.prepare(`
    SELECT p.id, p.name, p.key_prefix, p.owner_id
    FROM projects p
    INNER JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = ?
    ORDER BY p.name ASC
  `).all(req.user.id);

  const fullProfile = {
    ...user,
    timezone: user.timezone || 'UTC',
    projects
  };
  
  res.json(fullProfile);
}));

// PUT /api/users/me/profile — update profile data
router.put('/me/profile', authMiddleware, asyncHandler(async (req, res) => {
  const { name, timezone, avatar_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  await db.prepare('UPDATE users SET name = ?, timezone = ?, avatar_url = ? WHERE id = ?')
    .run(name, timezone || 'UTC', avatar_url || null, req.user.id);

  res.json({ success: true, name, timezone, avatar_url });
}));

// PUT /api/users/me/password — update password
router.put('/me/password', authMiddleware, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const user = await db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return res.status(401).json({ error: 'Incorrect current password' });

  const hashed = await bcrypt.hash(newPassword, 10);
  await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);

  res.json({ success: true });
}));

module.exports = router;
