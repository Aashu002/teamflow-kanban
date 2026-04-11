const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ tasks: [], projects: [] });
  }

  const query = `%${q.trim()}%`;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    // 1. Search Tasks
    let tasks;
    if (isAdmin) {
      tasks = db.prepare(`
        SELECT t.id, t.title, t.task_number, t.task_type, t.status, t.project_id, p.key_prefix, p.name as project_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.title LIKE ? OR t.description LIKE ? OR (p.key_prefix || '-' || t.task_number) LIKE ?
        ORDER BY t.created_at DESC
        LIMIT 10
      `).all(query, query, query);
    } else {
      tasks = db.prepare(`
        SELECT t.id, t.title, t.task_number, t.task_type, t.status, t.project_id, p.key_prefix, p.name as project_name
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE (t.title LIKE ? OR t.description LIKE ? OR (p.key_prefix || '-' || t.task_number) LIKE ?)
        AND p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        ORDER BY t.created_at DESC
        LIMIT 10
      `).all(query, query, query, userId);
    }

    // 2. Search Projects
    let projects;
    if (isAdmin) {
      projects = db.prepare(`
        SELECT id, name, key_prefix, description
        FROM projects
        WHERE name LIKE ? OR key_prefix LIKE ?
        LIMIT 5
      `).all(query, query);
    } else {
      projects = db.prepare(`
        SELECT p.id, p.name, p.key_prefix, p.description
        FROM projects p
        WHERE (p.name LIKE ? OR p.key_prefix LIKE ?)
        AND p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        LIMIT 5
      `).all(query, query, userId);
    }

    res.json({ tasks, projects });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

module.exports = router;
