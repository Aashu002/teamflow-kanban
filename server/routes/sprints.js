const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function canManageSprints(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'lead') {
    return res.status(403).json({ error: 'Admin or Lead access required' });
  }
  next();
}

// GET /api/sprints?projectId=X — list all sprints for a project
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { projectId } = req.query;
  if (!projectId) return res.status(400).json({ error: 'projectId is required' });

  const sprints = await db.prepare(`
    SELECT s.*,
      COUNT(t.id) as task_count,
      COALESCE(SUM(t.hours_estimated), 0) as total_hours,
      COALESCE(SUM(CASE WHEN t.status = 'done' THEN t.hours_estimated ELSE 0 END), 0) as completed_hours
    FROM sprints s
    LEFT JOIN tasks t ON t.sprint_id = s.id
    WHERE s.project_id = ?
    GROUP BY s.id
    ORDER BY s.created_at ASC
  `).all(projectId);

  res.json(sprints);
}));

// POST /api/sprints — create a new sprint
router.post('/', authMiddleware, canManageSprints, asyncHandler(async (req, res) => {
  const { projectId, name, goal, start_date, end_date } = req.body;
  if (!projectId || !name) return res.status(400).json({ error: 'projectId and name are required' });

  const result = await db.prepare(
    `INSERT INTO sprints (project_id, name, goal, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?, 'planning') RETURNING *`
  ).run(projectId, name, goal || '', start_date || null, end_date || null);

  // Fetch the full sprint row
  const sprint = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(sprint);
}));

// PATCH /api/sprints/:id — edit sprint details
router.patch('/:id', authMiddleware, canManageSprints, asyncHandler(async (req, res) => {
  const { name, goal, start_date, end_date } = req.body;
  const sprint = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

  await db.prepare(
    `UPDATE sprints SET name = ?, goal = ?, start_date = ?, end_date = ? WHERE id = ?`
  ).run(
    name ?? sprint.name,
    goal ?? sprint.goal,
    start_date !== undefined ? start_date : sprint.start_date,
    end_date !== undefined ? end_date : sprint.end_date,
    req.params.id
  );

  const updated = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  res.json(updated);
}));

// POST /api/sprints/:id/start — activate a sprint
router.post('/:id/start', authMiddleware, canManageSprints, asyncHandler(async (req, res) => {
  const sprint = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
  if (sprint.status === 'active') return res.status(400).json({ error: 'Sprint is already active' });
  if (sprint.status === 'completed') return res.status(400).json({ error: 'Completed sprints cannot be restarted' });

  // Only one sprint can be active per project at a time
  const alreadyActive = await db.prepare(
    `SELECT id FROM sprints WHERE project_id = ? AND status = 'active'`
  ).get(sprint.project_id);
  if (alreadyActive) {
    return res.status(400).json({ error: 'Another sprint is already active for this project. Complete it first.' });
  }

  await db.prepare(`UPDATE sprints SET status = 'active' WHERE id = ?`).run(req.params.id);
  const updated = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  res.json(updated);
}));

// POST /api/sprints/:id/complete — close a sprint
router.post('/:id/complete', authMiddleware, canManageSprints, asyncHandler(async (req, res) => {
  const sprint = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
  if (sprint.status !== 'active') return res.status(400).json({ error: 'Only active sprints can be completed' });

  // All unfinished tasks automatically return to the project backlog
  const incompleteTasks = await db.prepare(
    `SELECT id FROM tasks WHERE sprint_id = ? AND status != 'done'`
  ).all(req.params.id);

  for (const t of incompleteTasks) {
    await db.prepare('UPDATE tasks SET sprint_id = NULL WHERE id = ?').run(t.id);
  }

  await db.prepare(`UPDATE sprints SET status = 'completed' WHERE id = ?`).run(req.params.id);
  const updated = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  res.json({ sprint: updated, movedToBacklog: incompleteTasks.length });
}));

// DELETE /api/sprints/:id — delete sprint, tasks fall back to backlog
router.delete('/:id', authMiddleware, canManageSprints, asyncHandler(async (req, res) => {
  const sprint = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

  // Move all tasks in this sprint back to backlog
  await db.prepare('UPDATE tasks SET sprint_id = NULL WHERE sprint_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM sprints WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

// POST /api/sprints/:id/tasks — assign tasks to this sprint
router.post('/:id/tasks', authMiddleware, asyncHandler(async (req, res) => {
  const { taskId, taskIds } = req.body;
  const sprint = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(req.params.id);
  if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

  const ids = taskIds || (taskId ? [taskId] : []);
  if (ids.length === 0) return res.status(400).json({ error: 'No tasks specified' });

  for (const id of ids) {
    await db.prepare('UPDATE tasks SET sprint_id = ? WHERE id = ?').run(req.params.id, id);
  }
  res.json({ success: true, count: ids.length });
}));

// DELETE /api/sprints/:id/tasks/:taskId — remove task from sprint → backlog
router.delete('/:id/tasks/:taskId', authMiddleware, asyncHandler(async (req, res) => {
  await db.prepare('UPDATE tasks SET sprint_id = NULL WHERE id = ? AND sprint_id = ?')
    .run(req.params.taskId, req.params.id);
  res.json({ success: true });
}));

module.exports = router;
