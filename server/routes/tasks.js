const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

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

const VALID_STATUSES = ['backlog','open','gathering','inprogress','qa_testing','qa_completed','stakeholder','done'];
const VALID_PRIORITIES = ['low','medium','high'];
const VALID_TYPES = ['epic','story','task','subtask','bug'];

async function isMember(projectId, userId, role) {
  if (role === 'admin') return true;
  const project_id = parseInt(projectId);
  return await db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(project_id, userId);
}

// Full task select query helper
async function selectTask(id) {
  return await db.prepare(`
    SELECT t.*,
      (SELECT SUM(hours) FROM hour_logs WHERE task_id = t.id) as totalHoursLogged,
      p.key_prefix, p.owner_id as project_owner_id,
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

// GET /api/tasks/by-key/:projectId/:taskNumber  — lookup by human key e.g. TF-3
router.get('/by-key/:projectId/:taskNumber', authMiddleware, asyncHandler(async (req, res) => {
  const { projectId, taskNumber } = req.params;
  if (!(await isMember(projectId, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not a member' });

  const row = await db.prepare(
    'SELECT id FROM tasks WHERE project_id = ? AND task_number = ?'
  ).get(projectId, parseInt(taskNumber, 10));

  if (!row) return res.status(404).json({ error: 'Task not found' });

  const task = await selectTask(row.id);
  const subtasks = await db.prepare(`
    SELECT t.*, p.key_prefix, assignee.name as assignee_name, assignee.avatar_color as assignee_color
    FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    WHERE t.parent_id = ?
  `).all(row.id);
  const comments = await db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_color
    FROM comments c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ? ORDER BY c.created_at ASC
  `).all(row.id);
  const attachments = await db.prepare(`
    SELECT a.*, u.name as user_name
    FROM attachments a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.task_id = ? ORDER BY a.created_at ASC
  `).all(row.id);
  const hourLogs = await db.prepare(`
    SELECT h.*, u.name as user_name, u.avatar_color as user_color
    FROM hour_logs h LEFT JOIN users u ON u.id = h.user_id
    WHERE h.task_id = ? ORDER BY h.logged_at DESC
  `).all(row.id);
  const totalHoursLogged = hourLogs.reduce((s, l) => s + l.hours, 0);

  const rawLinks = await db.prepare(`
    SELECT tl.*,
      t1.title as task_title, t1.task_number as task_number, p1.key_prefix as task_key_prefix, t1.status as task_status, t1.task_type as task_type,
      t2.title as linked_task_title, t2.task_number as linked_task_number, p2.key_prefix as linked_key_prefix, t2.status as linked_status, t2.task_type as linked_type
    FROM task_links tl
    JOIN tasks t1 ON tl.task_id = t1.id
    JOIN projects p1 ON t1.project_id = p1.id
    JOIN tasks t2 ON tl.linked_task_id = t2.id
    JOIN projects p2 ON t2.project_id = p2.id
    WHERE tl.task_id = ? OR tl.linked_task_id = ?
  `).all(row.id, row.id);

  // Re-map links so they're always relative to THIS task
  const links = rawLinks.map(l => {
    const isSource = l.task_id === row.id;
    return {
      id: l.id,
      link_type: l.link_type,
      isSource, // if false, the link type is technically reversed (e.g. "blocks" -> "is blocked by")
      other_task_id: isSource ? l.linked_task_id : l.task_id,
      other_task_title: isSource ? l.linked_task_title : l.task_title,
      other_task_key: isSource ? `${l.linked_key_prefix}-${l.linked_task_number}` : `${l.task_key_prefix}-${l.task_number}`,
      other_task_status: isSource ? l.linked_status : l.task_status,
      other_task_type: isSource ? l.linked_type : l.task_type
    };
  });

  res.json({ ...task, subtasks, comments, attachments, hourLogs, totalHoursLogged, links });
}));

// GET /api/tasks/search
router.get('/search', authMiddleware, asyncHandler(async (req, res) => {
  const { creator, search } = req.query;
  const conditions = [];
  const params = [];

  if (req.user.role !== 'admin') {
    conditions.push('p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)');
    params.push(req.user.id);
  }

  if (creator === 'me') {
    conditions.push('t.creator_id = ?');
    params.push(req.user.id);
  }

  if (search) {
    conditions.push('(t.title ILIKE ? OR t.description ILIKE ? OR CAST(t.task_number AS TEXT) LIKE ?)');
    const likeParam = `%${search}%`;
    params.push(likeParam, likeParam, likeParam);
  }

  const { type, priority, assignee, status, projectId } = req.query;
  if (type && type !== 'all') {
    conditions.push('t.task_type = ?');
    params.push(type);
  }
  if (priority && priority !== 'all') {
    conditions.push('t.priority = ?');
    params.push(priority);
  }
  if (status && status !== 'all') {
    conditions.push('t.status = ?');
    params.push(status);
  }
  if (assignee && assignee !== 'all') {
    conditions.push('t.assignee_id = ?');
    params.push(assignee);
  }
  if (projectId && projectId !== 'all') {
    conditions.push('t.project_id = ?');
    params.push(projectId);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const tasks = await db.prepare(`
    SELECT t.*, p.key_prefix, p.name as project_name,
      creator.name as creator_name, creator.avatar_color as creator_color,
      assignee.name as assignee_name, assignee.avatar_color as assignee_color
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users creator ON creator.id = t.creator_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT 200
  `).all(...params);

  res.json(tasks);
}));

// GET /api/tasks?projectId=X
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  if (!(await isMember(projectId, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not a member' });

  const tasks = await db.prepare(`
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
}));

// GET /api/tasks/:id — full task detail
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const task = await selectTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!(await isMember(task.project_id, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not a member' });

  // Subtasks
  const subtasks = await db.prepare(`
    SELECT t.*, p.key_prefix, assignee.name as assignee_name, assignee.avatar_color as assignee_color
    FROM tasks t LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN users assignee ON assignee.id = t.assignee_id
    WHERE t.parent_id = ?
  `).all(req.params.id);

  // Comments
  const comments = await db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_color
    FROM comments c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);

  // Attachments
  const attachments = await db.prepare(`
    SELECT a.*, u.name as user_name
    FROM attachments a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.task_id = ? ORDER BY a.created_at ASC
  `).all(req.params.id);

  const hourLogs = await db.prepare(`
    SELECT h.*, u.name as user_name, u.avatar_color as user_color
    FROM hour_logs h LEFT JOIN users u ON u.id = h.user_id
    WHERE h.task_id = ? ORDER BY h.logged_at DESC
  `).all(req.params.id);
  const totalHoursLogged = hourLogs.reduce((s, l) => s + l.hours, 0);

  res.json({ ...task, subtasks, comments, attachments, hourLogs, totalHoursLogged });
}));

// POST /api/tasks
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { title, description, status, priority, task_type, projectId, assigneeId, parentId } = req.body;
  if (!title || !projectId) return res.status(400).json({ error: 'Title and projectId required' });
  if (!(await isMember(projectId, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not a member' });

  // Atomically get next task number for this project
  await db.prepare('UPDATE projects SET task_counter = task_counter + 1 WHERE id = ?').run(projectId);
  const row = await db.prepare('SELECT task_counter FROM projects WHERE id = ?').get(projectId);
  const task_counter = row.task_counter;

  const s = VALID_STATUSES.includes(status) ? status : 'backlog';
  const p = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
  const t = VALID_TYPES.includes(task_type) ? task_type : 'task';

  const result = await db.prepare(`
    INSERT INTO tasks (task_number, task_type, title, description, status, priority, project_id, creator_id, assignee_id, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(task_counter, t, title, description || '', s, p, projectId, req.user.id, assigneeId || null, parentId || null);

  const task = await selectTask(result.lastInsertRowid);
  
  if (req.app.get('io')) {
    req.app.get('io').to(`project_${projectId}`).emit('task_created', task);
  }

  res.status(201).json(task);
}));

// PATCH /api/tasks/:id
router.patch('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!(await isMember(task.project_id, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not a member' });

  const { title, description, status, priority, task_type, assigneeId, parentId, estimated_completion, hours_estimated } = req.body;
  const s = VALID_STATUSES.includes(status) ? status : task.status;
  const p = VALID_PRIORITIES.includes(priority) ? priority : task.priority;
  const t = VALID_TYPES.includes(task_type) ? task_type : task.task_type;

  await db.prepare(`
    UPDATE tasks SET title=?, description=?, status=?, priority=?, task_type=?,
      assignee_id=?, parent_id=?, estimated_completion=?, hours_estimated=?,
      updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(
    title ?? task.title,
    description ?? task.description,
    s, p, t,
    assigneeId !== undefined ? (assigneeId || null) : task.assignee_id,
    parentId   !== undefined ? (parentId   || null) : task.parent_id,
    estimated_completion !== undefined ? estimated_completion : (task.estimated_completion || null),
    hours_estimated      !== undefined ? hours_estimated      : (task.hours_estimated || 0),
    req.params.id
  );

  const updatedTask = await selectTask(req.params.id);
  
  if (req.app.get('io')) {
    req.app.get('io').to(`project_${updatedTask.project_id}`).emit('task_updated', updatedTask);
  }

  res.json(updatedTask);
}));

// POST /api/tasks/:id/move — Transfer task to a different project or change key details
router.post('/:id/move', authMiddleware, asyncHandler(async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  
  // Member of current project?
  if (!(await isMember(task.project_id, req.user.id, req.user.role))) {
    return res.status(403).json({ error: 'Not a member of current project' });
  }

  const { targetProjectId, task_type, priority } = req.body;
  if (!targetProjectId) return res.status(400).json({ error: 'targetProjectId required' });

  // Member of target project?
  if (!(await isMember(targetProjectId, req.user.id, req.user.role))) {
    return res.status(403).json({ error: 'Not a member of target project' });
  }

  const p = VALID_PRIORITIES.includes(priority) ? priority : task.priority;
  const t = VALID_TYPES.includes(task_type) ? task_type : task.task_type;

  let newProject = task.project_id;
  let newTaskNumber = task.task_number;

  // If project is changing, we need a new task number
  if (parseInt(targetProjectId) !== task.project_id) {
    await db.prepare('UPDATE projects SET task_counter = task_counter + 1 WHERE id = ?').run(targetProjectId);
    const projData = await db.prepare('SELECT task_counter FROM projects WHERE id = ?').get(targetProjectId);
    newProject = parseInt(targetProjectId);
    newTaskNumber = projData.task_counter;
  }

  await db.prepare(`
    UPDATE tasks SET project_id=?, task_number=?, priority=?, task_type=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(newProject, newTaskNumber, p, t, req.params.id);

  const updatedTask = await selectTask(req.params.id);

  // Notify old project members (deletion) and new project members (creation/update)
  if (req.app.get('io')) {
    if (newProject !== task.project_id) {
      req.app.get('io').to(`project_${task.project_id}`).emit('task_deleted', { id: task.id, project_id: task.project_id });
      req.app.get('io').to(`project_${newProject}`).emit('task_created', updatedTask);
    } else {
      req.app.get('io').to(`project_${newProject}`).emit('task_updated', updatedTask);
    }
  }

  res.json(updatedTask);
}));

// DELETE /api/tasks/:id
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const task = await selectTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  
  const canDelete = req.user.role === 'admin' 
    || task.creator_id === req.user.id 
    || task.project_owner_id === req.user.id;

  if (!canDelete) {
    return res.status(403).json({ error: 'Only creator, project lead or admin can delete' });
  }
  await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  
  if (req.app.get('io')) {
    req.app.get('io').to(`project_${task.project_id}`).emit('task_deleted', { id: task.id, project_id: task.project_id });
  }

  res.json({ success: true });
}));

// ─── Hour Logging ────────────────────────────────────────────────────────────

// POST /api/tasks/:id/log-hours
router.post('/:id/log-hours', authMiddleware, asyncHandler(async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!(await isMember(task.project_id, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not a member' });

  const { hours, note } = req.body;
  const h = parseFloat(hours);
  if (!h || h <= 0) return res.status(400).json({ error: 'Hours must be a positive number' });

  const result = await db.prepare(
    'INSERT INTO hour_logs (task_id, user_id, hours, note) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, req.user.id, h, note?.trim() || '');

  const log = await db.prepare(`
    SELECT h.*, u.name as user_name, u.avatar_color as user_color
    FROM hour_logs h LEFT JOIN users u ON u.id = h.user_id WHERE h.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(log);
}));

// DELETE /api/tasks/:id/log-hours/:logId
router.delete('/:id/log-hours/:logId', authMiddleware, asyncHandler(async (req, res) => {
  const log = await db.prepare('SELECT * FROM hour_logs WHERE id = ? AND task_id = ?').get(req.params.logId, req.params.id);
  if (!log) return res.status(404).json({ error: 'Log not found' });
  if (log.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await db.prepare('DELETE FROM hour_logs WHERE id = ?').run(req.params.logId);
  res.json({ success: true });
}));

// ─── Comments ────────────────────────────────────────────────────────────────

// GET /api/tasks/:id/comments
router.get('/:id/comments', authMiddleware, asyncHandler(async (req, res) => {
  const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!(await isMember(task.project_id, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not a member' });

  const comments = await db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_color
    FROM comments c LEFT JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);
  res.json(comments);
}));

// POST /api/tasks/:id/comments
router.post('/:id/comments', authMiddleware, asyncHandler(async (req, res) => {
  const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!(await isMember(task.project_id, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not a member' });

  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

  const result = await db.prepare(
    'INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, content.trim());

  const comment = await db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_color
    FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(result.lastInsertRowid);
  
  if (req.app.get('io')) {
    req.app.get('io').to(`project_${task.project_id}`).emit('comment_added', comment);
  }

  res.status(201).json(comment);
}));

// PATCH /api/tasks/:id/comments/:cid
router.patch('/:id/comments/:cid', authMiddleware, asyncHandler(async (req, res) => {
  const comment = await db.prepare('SELECT * FROM comments WHERE id = ? AND task_id = ?').get(req.params.cid, req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  await db.prepare('UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(content.trim(), req.params.cid);
  const updated = await db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_color
    FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(req.params.cid);
  
  if (req.app.get('io')) {
    // Need project_id, so lookup task
    const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
    if (task) {
      req.app.get('io').to(`project_${task.project_id}`).emit('comment_updated', updated);
    }
  }

  res.json(updated);
}));

// DELETE /api/tasks/:id/comments/:cid
router.delete('/:id/comments/:cid', authMiddleware, asyncHandler(async (req, res) => {
  const comment = await db.prepare('SELECT * FROM comments WHERE id = ? AND task_id = ?').get(req.params.cid, req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.cid);
  
  if (req.app.get('io')) {
    const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
    if (task) {
      req.app.get('io').to(`project_${task.project_id}`).emit('comment_deleted', { id: parseInt(req.params.cid), task_id: parseInt(req.params.id) });
    }
  }

  res.json({ success: true });
}));

// ─── Attachments ──────────────────────────────────────────────────────────────

// POST /api/tasks/:id/attachments
router.post('/:id/attachments', authMiddleware, upload.single('file'), asyncHandler(async (req, res) => {
  const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!(await isMember(task.project_id, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not a member' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const result = await db.prepare(
    'INSERT INTO attachments (task_id, user_id, filename, original_name, size, mimetype) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, req.user.id, req.file.filename, req.file.originalname, req.file.size, req.file.mimetype);

  const attachment = await db.prepare(`
    SELECT a.*, u.name as user_name FROM attachments a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(attachment);
}));

// DELETE /api/tasks/:id/attachments/:aid
router.delete('/:id/attachments/:aid', authMiddleware, asyncHandler(async (req, res) => {
  const att = await db.prepare('SELECT * FROM attachments WHERE id = ? AND task_id = ?').get(req.params.aid, req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });
  if (att.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });

  // Delete file from disk
  const filePath = path.join(__dirname, '../uploads', att.filename);
  try { fs.unlinkSync(filePath); } catch {}

  await db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.aid);
  res.json({ success: true });
}));

// ─── Links ────────────────────────────────────────────────────────────────────

// POST /api/tasks/:id/links
router.post('/:id/links', authMiddleware, asyncHandler(async (req, res) => {
  const { linkedTaskId, linkType } = req.body;
  if (!linkedTaskId || !linkType) return res.status(400).json({ error: 'Missing properties' });
  
  const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Source task not found' });
  if (!(await isMember(task.project_id, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not authorized' });

  try {
    const result = await db.prepare(
      'INSERT INTO task_links (task_id, linked_task_id, link_type) VALUES (?, ?, ?)'
    ).run(req.params.id, linkedTaskId, linkType);
    
    // Fetch newly created link data formatted to match GET response
    const l = await db.prepare(`
      SELECT tl.*,
        t1.title as task_title, t1.task_number as task_number, p1.key_prefix as task_key_prefix, t1.status as task_status, t1.task_type as task_type,
        t2.title as linked_task_title, t2.task_number as linked_task_number, p2.key_prefix as linked_key_prefix, t2.status as linked_status, t2.task_type as linked_type
      FROM task_links tl
      JOIN tasks t1 ON tl.task_id = t1.id
      JOIN projects p1 ON t1.project_id = p1.id
      JOIN tasks t2 ON tl.linked_task_id = t2.id
      JOIN projects p2 ON t2.project_id = p2.id
      WHERE tl.id = ?
    `).get(result.lastInsertRowid);
    
    const isSource = l.task_id === parseInt(req.params.id);
    const linkData = {
      id: l.id,
      link_type: l.link_type,
      isSource,
      other_task_id: isSource ? l.linked_task_id : l.task_id,
      other_task_title: isSource ? l.linked_task_title : l.task_title,
      other_task_key: isSource ? `${l.linked_key_prefix}-${l.linked_task_number}` : `${l.task_key_prefix}-${l.task_number}`,
      other_task_status: isSource ? l.linked_status : l.task_status,
      other_task_type: isSource ? l.linked_type : l.task_type
    };

    res.status(201).json(linkData);
  } catch (err) {
    if (err.message.includes('UNIQUE') || err.code === '23505') {
      return res.status(409).json({ error: 'Link already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create link' });
  }
}));

// DELETE /api/tasks/:id/links/:linkId
router.delete('/:id/links/:linkId', authMiddleware, asyncHandler(async (req, res) => {
  const link = await db.prepare('SELECT * FROM task_links WHERE id = ? AND (task_id = ? OR linked_task_id = ?)').get(req.params.linkId, req.params.id, req.params.id);
  if (!link) return res.status(404).json({ error: 'Link not found' });
  
  const task = await db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(req.params.id);
  if (!(await isMember(task.project_id, req.user.id, req.user.role))) return res.status(403).json({ error: 'Not authorized' });

  await db.prepare('DELETE FROM task_links WHERE id = ?').run(req.params.linkId);
  res.json({ success: true });
}));

module.exports = router;
