const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function isMember(projectId, userId, role) {
  if (role === 'admin') return true;
  return db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

// Generate a key prefix from project name (first 2-4 uppercase alpha chars)
function makeKeyPrefix(name) {
  const clean = name.toUpperCase().replace(/[^A-Z]/g, '');
  return (clean.slice(0, 4) || 'TF').padEnd(2, 'X');
}

// GET /api/projects
router.get('/', authMiddleware, (req, res) => {
  let projects;
  if (req.user.role === 'admin') {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count
      FROM projects p LEFT JOIN users u ON u.id = p.owner_id ORDER BY p.created_at DESC
    `).all();
  } else {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count
      FROM projects p LEFT JOIN users u ON u.id = p.owner_id
      INNER JOIN project_members me ON me.project_id = p.id AND me.user_id = ?
      ORDER BY p.created_at DESC
    `).all(req.user.id);
  }
  res.json(projects);
});

// POST /api/projects
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { name, description, memberIds } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const keyPrefix = makeKeyPrefix(name);
  const result = db.prepare(
    'INSERT INTO projects (name, key_prefix, description, owner_id) VALUES (?, ?, ?, ?)'
  ).run(name, keyPrefix, description || '', req.user.id);

  const projectId = result.lastInsertRowid;
  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)').run(projectId, req.user.id);

  if (Array.isArray(memberIds)) {
    for (const uid of memberIds) {
      db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)').run(projectId, uid);
    }
  }
  res.status(201).json({ id: projectId, name, key_prefix: keyPrefix, description, owner_id: req.user.id });
});

// GET /api/projects/:id
router.get('/:id', authMiddleware, (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role !== 'admin' && !isMember(req.params.id, req.user.id)) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_color, u.role FROM users u
    INNER JOIN project_members pm ON pm.user_id = u.id WHERE pm.project_id = ?
  `).all(req.params.id);
  res.json({ ...project, members });
});

// PATCH /api/projects/:id
router.patch('/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, description } = req.body;
  db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?').run(name, description, req.params.id);
  res.json({ success: true });
});

// DELETE /api/projects/:id
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/projects/:id/members
router.post('/:id/members', authMiddleware, adminOnly, (req, res) => {
  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)').run(req.params.id, req.body.userId);
  res.json({ success: true });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', authMiddleware, adminOnly, (req, res) => {
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ success: true });
});

module.exports = router;
