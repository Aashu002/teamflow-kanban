const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

const VALID_STATUSES = ['open','gathering','inprogress','review','qa_testing','qa_completed','stakeholder','done'];
const VALID_PRIORITIES = ['low','medium','high'];
const VALID_TYPES = ['epic','story','task','subtask','bug'];

function isMember(projectId, userId, role) {
  if (role === 'admin') return true;
  return db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

// Full task select query helper
function selectTask(id) {
  return db.prepare(`
    SELECT t.*,
      p.key_prefix,
      creator.name as creator_name, creator.avatar_color as creator_color,
      assignee.name as assignee_name, assignee.avatar_color as assignee_color,
      parent.title as parent_title, parent.task_number as parent_task_number,
      parent_proj.key_prefix as parent_key_prefix
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users creator ON creator.id = t.creator_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    LEFT JOIN tasks parent ON parent.id = t.parent_id
    LEFT JOIN projects parent_proj ON parent_proj.id = parent.project_id
    WHERE t.id = ?
  `).get(id);
}

// GET /api/tasks?projectId=X
router.get('/', authMiddleware, (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  if (!isMember(projectId, req.user.id, req.user.role)) return res.status(403).json({ error: 'Not a member' });

  const tasks = db.prepare(`
    SELECT t.*, p.key_prefix,
      creator.name as creator_name, creator.avatar_color as creator_color,
      assignee.name as assignee_name, assignee.avatar_color as assignee_color
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users creator ON creator.id = t.creator_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    WHERE t.project_id = ?
    ORDER BY t.task_number DESC
  `).all(projectId);
  res.json(tasks);
});

// GET /api/tasks/:id — full task detail
router.get('/:id', authMiddleware, (req, res) => {
  const task = selectTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!isMember(task.project_id, req.user.id, req.user.role)) return res.status(403).json({ error: 'Not a member' });

  // Subtasks
  const subtasks = db.prepare(`
    SELECT t.*, p.key_prefix, assignee.name as assignee_name, assignee.avatar_color as assignee_color
    FROM tasks t LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN users assignee ON assignee.id = t.assignee_id
    WHERE t.parent_id = ?
  `).all(req.params.id);

  // Comments
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_color
    FROM comments c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);

  // Attachments
  const attachments = db.prepare(`
    SELECT a.*, u.name as user_name
    FROM attachments a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.task_id = ? ORDER BY a.created_at ASC
  `).all(req.params.id);

  res.json({ ...task, subtasks, comments, attachments });
});

// POST /api/tasks
router.post('/', authMiddleware, (req, res) => {
  const { title, description, status, priority, task_type, projectId, assigneeId, parentId } = req.body;
  if (!title || !projectId) return res.status(400).json({ error: 'Title and projectId required' });
  if (!isMember(projectId, req.user.id, req.user.role)) return res.status(403).json({ error: 'Not a member' });

  // Atomically get next task number for this project
  db.prepare('UPDATE projects SET task_counter = task_counter + 1 WHERE id = ?').run(projectId);
  const { task_counter } = db.prepare('SELECT task_counter FROM projects WHERE id = ?').get(projectId);

  const s = VALID_STATUSES.includes(status) ? status : 'open';
  const p = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
  const t = VALID_TYPES.includes(task_type) ? task_type : 'task';

  const result = db.prepare(`
    INSERT INTO tasks (task_number, task_type, title, description, status, priority, project_id, creator_id, assignee_id, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(task_counter, t, title, description || '', s, p, projectId, req.user.id, assigneeId || null, parentId || null);

  const task = selectTask(result.lastInsertRowid);
  res.status(201).json(task);
});

// PATCH /api/tasks/:id
router.patch('/:id', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!isMember(task.project_id, req.user.id, req.user.role)) return res.status(403).json({ error: 'Not a member' });

  const { title, description, status, priority, task_type, assigneeId, parentId } = req.body;
  const s = VALID_STATUSES.includes(status) ? status : task.status;
  const p = VALID_PRIORITIES.includes(priority) ? priority : task.priority;
  const t = VALID_TYPES.includes(task_type) ? task_type : task.task_type;

  db.prepare(`
    UPDATE tasks SET title=?, description=?, status=?, priority=?, task_type=?, assignee_id=?, parent_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(
    title ?? task.title,
    description ?? task.description,
    s, p, t,
    assigneeId !== undefined ? (assigneeId || null) : task.assignee_id,
    parentId !== undefined ? (parentId || null) : task.parent_id,
    req.params.id
  );

  res.json(selectTask(req.params.id));
});

// DELETE /api/tasks/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (req.user.role !== 'admin' && task.creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Only creator or admin can delete' });
  }
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Comments ────────────────────────────────────────────────────────────────

// GET /api/tasks/:id/comments
router.get('/:id/comments', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!isMember(task.project_id, req.user.id, req.user.role)) return res.status(403).json({ error: 'Not a member' });

  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_color
    FROM comments c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!isMember(task.project_id, req.user.id, req.user.role)) return res.status(403).json({ error: 'Not a member' });

  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

  const result = db.prepare(
    'INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, content.trim());

  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_color
    FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(comment);
});

// PATCH /api/tasks/:id/comments/:cid
router.patch('/:id/comments/:cid', authMiddleware, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND task_id = ?').get(req.params.cid, req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  db.prepare('UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content.trim(), req.params.cid);
  const updated = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_color
    FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(req.params.cid);
  res.json(updated);
});

// DELETE /api/tasks/:id/comments/:cid
router.delete('/:id/comments/:cid', authMiddleware, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND task_id = ?').get(req.params.cid, req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.cid);
  res.json({ success: true });
});

// ─── Attachments ──────────────────────────────────────────────────────────────

// POST /api/tasks/:id/attachments
router.post('/:id/attachments', authMiddleware, upload.single('file'), (req, res) => {
  const task = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!isMember(task.project_id, req.user.id, req.user.role)) return res.status(403).json({ error: 'Not a member' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const result = db.prepare(
    'INSERT INTO attachments (task_id, user_id, filename, original_name, size, mimetype) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, req.user.id, req.file.filename, req.file.originalname, req.file.size, req.file.mimetype);

  const attachment = db.prepare(`
    SELECT a.*, u.name as user_name FROM attachments a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(attachment);
});

// DELETE /api/tasks/:id/attachments/:aid
router.delete('/:id/attachments/:aid', authMiddleware, (req, res) => {
  const att = db.prepare('SELECT * FROM attachments WHERE id = ? AND task_id = ?').get(req.params.aid, req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });
  if (att.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });

  // Delete file from disk
  const filePath = path.join(__dirname, '../uploads', att.filename);
  try { fs.unlinkSync(filePath); } catch {}

  db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.aid);
  res.json({ success: true });
});

module.exports = router;
