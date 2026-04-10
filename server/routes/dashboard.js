const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// GET /api/dashboard
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // ── 1. User's projects ──────────────────────────────────────────────────
  const projects = isAdmin
    ? db.prepare(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_count,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
        FROM projects p LEFT JOIN users u ON u.id = p.owner_id
        ORDER BY p.created_at DESC
      `).all()
    : db.prepare(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_count,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
        FROM projects p LEFT JOIN users u ON u.id = p.owner_id
        INNER JOIN project_members me ON me.project_id = p.id AND me.user_id = ?
        ORDER BY p.created_at DESC
      `).all(userId);

  // ── 2. Tasks assigned to this user (open only) ──────────────────────────
  const myTasks = db.prepare(`
    SELECT t.*, p.key_prefix, p.name as project_name,
      creator.name as creator_name, creator.avatar_color as creator_color
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users creator ON creator.id = t.creator_id
    WHERE t.assignee_id = ?
    ORDER BY
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.created_at DESC
  `).all(userId);

  const myOpenTasks = myTasks.filter(t => t.status !== 'done');

  // ── 3. Recent activity (tasks + comments across user's projects) ─────────
  const recentTasks = isAdmin
    ? db.prepare(`
        SELECT t.id, t.title, t.task_number, t.task_type, t.status, t.created_at,
          p.key_prefix, p.name as project_name, p.id as project_id,
          u.name as actor_name, u.avatar_color as actor_color
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.creator_id
        ORDER BY t.created_at DESC LIMIT 12
      `).all()
    : db.prepare(`
        SELECT t.id, t.title, t.task_number, t.task_type, t.status, t.created_at,
          p.key_prefix, p.name as project_name, p.id as project_id,
          u.name as actor_name, u.avatar_color as actor_color
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.creator_id
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        ORDER BY t.created_at DESC LIMIT 12
      `).all(userId);

  const recentComments = isAdmin
    ? db.prepare(`
        SELECT c.id, c.content, c.created_at, c.task_id,
          t.title as task_title, t.task_number, t.id as task_db_id,
          p.key_prefix, p.name as project_name, p.id as project_id,
          u.name as actor_name, u.avatar_color as actor_color
        FROM comments c
        LEFT JOIN tasks t ON t.id = c.task_id
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = c.user_id
        ORDER BY c.created_at DESC LIMIT 12
      `).all()
    : db.prepare(`
        SELECT c.id, c.content, c.created_at, c.task_id,
          t.title as task_title, t.task_number, t.id as task_db_id,
          p.key_prefix, p.name as project_name, p.id as project_id,
          u.name as actor_name, u.avatar_color as actor_color
        FROM comments c
        LEFT JOIN tasks t ON t.id = c.task_id
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = c.user_id
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        ORDER BY c.created_at DESC LIMIT 12
      `).all(userId);

  const activity = [
    ...recentTasks.map(t => ({
      id: `task-${t.id}`,
      type: 'task_created',
      time: t.created_at,
      actor_name: t.actor_name,
      actor_color: t.actor_color,
      label: `created ${t.key_prefix}-${t.task_number}`,
      detail: t.title,
      project_name: t.project_name,
      project_id: t.project_id,
      task_id: t.id,
      task_type: t.task_type,
    })),
    ...recentComments.map(c => ({
      id: `comment-${c.id}`,
      type: 'comment',
      time: c.created_at,
      actor_name: c.actor_name,
      actor_color: c.actor_color,
      label: `commented on ${c.key_prefix}-${c.task_number}`,
      detail: c.content.slice(0, 60) + (c.content.length > 60 ? '…' : ''),
      project_name: c.project_name,
      project_id: c.project_id,
      task_id: c.task_db_id,
    })),
  ]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 15);

  // ── 4. Burndown: last 7 days — created vs completed (in user's projects) ─
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const cutoff = sevenDaysAgo.toISOString().split('T')[0];

  const createdByDay = isAdmin
    ? db.prepare(`SELECT DATE(created_at) as day, COUNT(*) as count FROM tasks WHERE DATE(created_at) >= ? GROUP BY DATE(created_at)`).all(cutoff)
    : db.prepare(`SELECT DATE(t.created_at) as day, COUNT(*) as count FROM tasks t INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ? WHERE DATE(t.created_at) >= ? GROUP BY DATE(t.created_at)`).all(userId, cutoff);

  const completedByDay = isAdmin
    ? db.prepare(`SELECT DATE(updated_at) as day, COUNT(*) as count FROM tasks WHERE status = 'done' AND DATE(updated_at) >= ? GROUP BY DATE(updated_at)`).all(cutoff)
    : db.prepare(`SELECT DATE(t.updated_at) as day, COUNT(*) as count FROM tasks t INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ? WHERE t.status = 'done' AND DATE(t.updated_at) >= ? GROUP BY DATE(t.updated_at)`).all(userId, cutoff);

  // Build last-7-days array
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const createdMap = Object.fromEntries(createdByDay.map(r => [r.day, r.count]));
  const completedMap = Object.fromEntries(completedByDay.map(r => [r.day, r.count]));

  const burndown = days.map(day => ({
    day,
    label: new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    created: createdMap[day] || 0,
    completed: completedMap[day] || 0,
  }));

  // ── 5. Project-wide ticket counts by status ─────────────────────────────
  const rawStatusCounts = isAdmin
    ? db.prepare(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`).all()
    : db.prepare(`
        SELECT t.status, COUNT(*) as count FROM tasks t
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        GROUP BY t.status
      `).all(userId);

  const statusCounts = rawStatusCounts;
  const totalTickets = rawStatusCounts.reduce((s, r) => s + r.count, 0);

  const priorityCounts = isAdmin
    ? db.prepare(`SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority`).all()
    : db.prepare(`
        SELECT t.priority, COUNT(*) as count FROM tasks t
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        GROUP BY t.priority
      `).all(userId);

  const typeCounts = isAdmin
    ? db.prepare(`SELECT task_type, COUNT(*) as count FROM tasks GROUP BY task_type`).all()
    : db.prepare(`
        SELECT t.task_type, COUNT(*) as count FROM tasks t
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        GROUP BY t.task_type
      `).all(userId);

  const hourStats = isAdmin
    ? db.prepare(`
        SELECT u.name, SUM(h.hours) as total_hours FROM hour_logs h
        INNER JOIN users u ON u.id = h.user_id
        GROUP BY u.id
        ORDER BY total_hours DESC
      `).all()
    : db.prepare(`
        SELECT u.name, SUM(h.hours) as total_hours FROM hour_logs h
        INNER JOIN users u ON u.id = h.user_id
        INNER JOIN tasks t ON t.id = h.task_id
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        GROUP BY u.id
        ORDER BY total_hours DESC
      `).all(userId);

  // ── 7. Workload Balance: Active tasks per member ────────────────────────
  const workloadStats = isAdmin
    ? db.prepare(`
        SELECT u.name, COUNT(t.id) as active_count FROM users u
        LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done'
        GROUP BY u.id ORDER BY active_count DESC
      `).all()
    : db.prepare(`
        SELECT u.name, COUNT(t.id) as active_count FROM users u
        INNER JOIN project_members pm ON pm.user_id = u.id
        LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done' AND t.project_id = pm.project_id
        WHERE pm.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        GROUP BY u.id ORDER BY active_count DESC
      `).all(userId);

  // ── 8. Estimation Accuracy: Logged vs Estimated ────────────────────────
  const accuracyStats = isAdmin
    ? db.prepare(`
        SELECT t.title, t.hours_estimated as estimated, IFNULL(SUM(h.hours), 0) as actual
        FROM tasks t
        LEFT JOIN hour_logs h ON h.task_id = t.id
        WHERE t.status = 'done' AND t.hours_estimated > 0
        GROUP BY t.id LIMIT 8
      `).all()
    : db.prepare(`
        SELECT t.title, t.hours_estimated as estimated, IFNULL(SUM(h.hours), 0) as actual
        FROM tasks t
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        LEFT JOIN hour_logs h ON h.task_id = t.id
        WHERE t.status = 'done' AND t.hours_estimated > 0
        GROUP BY t.id LIMIT 8
      `).all(userId);

  // ── 9. Aging Tasks: Stale tasks not touched in 7 days ───────────────────
  const agingTasks = isAdmin
    ? db.prepare(`
        SELECT t.title, t.status, t.updated_at, p.key_prefix, t.task_number
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        WHERE t.status != 'done' AND t.updated_at < DATETIME('now', '-7 days')
        ORDER BY t.updated_at ASC LIMIT 10
      `).all()
    : db.prepare(`
        SELECT t.title, t.status, t.updated_at, p.key_prefix, t.task_number
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        WHERE t.status != 'done' AND t.updated_at < DATETIME('now', '-7 days')
        ORDER BY t.updated_at ASC LIMIT 10
      `).all(userId);

  // Section 10 removed in favor of Section 11 Burndown

  // ── 11. Featured Project Burndown Chart ────────────────────────────────
  // Pick project with closest deadline that isn't done
  const featured = projects
    .filter(p => p.estimated_completion_date && p.completionRate < 100)
    .sort((a, b) => new Date(a.estimated_completion_date) - new Date(b.estimated_completion_date))[0] 
    || projects[0];

  let burndownData = [];
  if (featured) {
    const start = new Date(featured.created_at);
    const end = featured.estimated_completion_date 
      ? new Date(featured.estimated_completion_date)
      : new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000); // Default 14 days
    
    // Get all tasks for this project
    const pTasks = db.prepare(`SELECT status, updated_at, created_at, hours_estimated FROM tasks WHERE project_id = ?`).all(featured.id);
    const totalWork = pTasks.reduce((s, t) => s + (t.hours_estimated || 1), 0); // Use 1 as unit if no estimation
    
    // Build days array
    const chartDays = [];
    let curr = new Date(start);
    curr.setHours(0,0,0,0);
    const last = new Date(end);
    last.setHours(23,59,59,999);

    // Limit to reasonable range (e.g. 90 days max for chart)
    const maxDays = 90;
    let iterations = 0;
    while (curr <= last && iterations < maxDays) {
      chartDays.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
      iterations++;
    }

    burndownData = chartDays.map((d, idx) => {
      const dayStr = d.toISOString().split('T')[0];
      const dayEnd = new Date(d);
      dayEnd.setHours(23,59,59,999);

      // Remaining work = total - (work done by end of this day)
      const workDone = pTasks
        .filter(t => t.status === 'done' && t.updated_at && new Date(t.updated_at) <= dayEnd)
        .reduce((s, t) => s + (t.hours_estimated || 1), 0);

      const remaining = Math.max(0, totalWork - workDone);
      
      // Ideal = total * (1 - idx / (totalDays - 1))
      const ideal = Math.max(0, totalWork * (1 - idx / (chartDays.length - 1)));

      return {
        day: dayStr,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        remaining: Math.round(remaining * 10) / 10,
        ideal: Math.round(ideal * 10) / 10,
      };
    });
  }

  const projectBurndown = {
    projectName: featured?.name || 'No Active Project',
    targetDate: featured?.estimated_completion_date,
    data: burndownData
  };

  // ── 6. Ticket stats ──────────────────────────────────────────────────────
  const stats = {
    total: myOpenTasks.length,
    high: myOpenTasks.filter(t => t.priority === 'high').length,
    medium: myOpenTasks.filter(t => t.priority === 'medium').length,
    low: myOpenTasks.filter(t => t.priority === 'low').length,
    totalAssigned: myTasks.length,
    completed: myTasks.filter(t => t.status === 'done').length,
  };

  res.json({ 
    projects, myTasks, myOpenTasks, activity, burndown, stats, statusCounts, totalTickets, priorityCounts, typeCounts, hourStats,
    workloadStats, accuracyStats, agingTasks, projectBurndown
  });
});

module.exports = router;
