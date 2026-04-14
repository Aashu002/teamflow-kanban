const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const router = express.Router();

// GET /api/dashboard
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const { projectId, startDate, endDate } = req.query;

  const projectFilter = projectId && projectId !== 'all' ? Number(projectId) : null;

  // ── 1. User's projects ──────────────────────────────────────────────────
  const projects = isAdmin
    ? await db.prepare(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_count,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
        FROM projects p LEFT JOIN users u ON u.id = p.owner_id
        ORDER BY p.created_at DESC
      `).all()
    : await db.prepare(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') as done_count,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
        FROM projects p LEFT JOIN users u ON u.id = p.owner_id
        INNER JOIN project_members me ON me.project_id = p.id AND me.user_id = ?
        ORDER BY p.created_at DESC
      `).all(userId);

  // ── 2. Tasks assigned to this user (open only) ──────────────────────────
  const myTasks = await db.prepare(`
    SELECT t.*, p.key_prefix, p.name as project_name,
      creator.name as creator_name, creator.avatar_color as creator_color
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    LEFT JOIN users creator ON creator.id = t.creator_id
    WHERE t.assignee_id = ? ${projectFilter ? 'AND t.project_id = ?' : ''}
    ORDER BY
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.created_at DESC
  `).all(...(projectFilter ? [userId, projectFilter] : [userId]));

  const myOpenTasks = myTasks.filter(t => t.status !== 'done');

  // ── 3. Recent activity (tasks + comments across user's projects) ─────────
  const recentTasks = isAdmin
    ? await db.prepare(`
        SELECT t.id, t.title, t.task_number, t.task_type, t.status, t.created_at,
          p.key_prefix, p.name as project_name, p.id as project_id,
          u.name as actor_name, u.avatar_color as actor_color
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.creator_id
        WHERE 1=1 ${projectFilter ? 'AND t.project_id = ?' : ''}
        ORDER BY t.created_at DESC LIMIT 12
      `).all(...(projectFilter ? [projectFilter] : []))
    : await db.prepare(`
        SELECT t.id, t.title, t.task_number, t.task_type, t.status, t.created_at,
          p.key_prefix, p.name as project_name, p.id as project_id,
          u.name as actor_name, u.avatar_color as actor_color
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.creator_id
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        WHERE 1=1 ${projectFilter ? 'AND t.project_id = ?' : ''}
        ORDER BY t.created_at DESC LIMIT 12
      `).all(...(projectFilter ? [userId, projectFilter] : [userId]));

  const recentComments = isAdmin
    ? await db.prepare(`
        SELECT c.id, c.content, c.created_at, c.task_id,
          t.title as task_title, t.task_number, t.id as task_db_id,
          p.key_prefix, p.name as project_name, p.id as project_id,
          u.name as actor_name, u.avatar_color as actor_color
        FROM comments c
        LEFT JOIN tasks t ON t.id = c.task_id
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = c.user_id
        WHERE 1=1 ${projectFilter ? 'AND t.project_id = ?' : ''}
        ORDER BY c.created_at DESC LIMIT 12
      `).all(...(projectFilter ? [projectFilter] : []))
    : await db.prepare(`
        SELECT c.id, c.content, c.created_at, c.task_id,
          t.title as task_title, t.task_number, t.id as task_db_id,
          p.key_prefix, p.name as project_name, p.id as project_id,
          u.name as actor_name, u.avatar_color as actor_color
        FROM comments c
        LEFT JOIN tasks t ON t.id = c.task_id
        LEFT JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = c.user_id
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        WHERE 1=1 ${projectFilter ? 'AND t.project_id = ?' : ''}
        ORDER BY c.created_at DESC LIMIT 12
      `).all(...(projectFilter ? [userId, projectFilter] : [userId]));

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

  // ── 4. Velocity: created vs completed ─
  const chartStart = startDate ? new Date(startDate) : new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const chartEnd   = endDate   ? new Date(endDate)   : new Date();
  const startIso   = chartStart.toISOString().split('T')[0];
  const endIso     = chartEnd.toISOString().split('T')[0];

  const createdByDay = isAdmin
    ? await db.prepare(`SELECT t.created_at::date as day, COUNT(*) as count FROM tasks t WHERE t.created_at::date BETWEEN ? AND ? ${projectFilter ? 'AND t.project_id = ?' : ''} GROUP BY t.created_at::date`).all(...(projectFilter ? [startIso, endIso, projectFilter] : [startIso, endIso]))
    : await db.prepare(`SELECT t.created_at::date as day, COUNT(*) as count FROM tasks t INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ? WHERE t.created_at::date BETWEEN ? AND ? ${projectFilter ? 'AND t.project_id = ?' : ''} GROUP BY t.created_at::date`).all(...(projectFilter ? [userId, startIso, endIso, projectFilter] : [userId, startIso, endIso]));

  const completedByDay = isAdmin
    ? await db.prepare(`SELECT t.updated_at::date as day, COUNT(*) as count FROM tasks t WHERE t.status = 'done' AND t.updated_at::date BETWEEN ? AND ? ${projectFilter ? 'AND t.project_id = ?' : ''} GROUP BY t.updated_at::date`).all(...(projectFilter ? [startIso, endIso, projectFilter] : [startIso, endIso]))
    : await db.prepare(`SELECT t.updated_at::date as day, COUNT(*) as count FROM tasks t INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ? WHERE t.status = 'done' AND t.updated_at::date BETWEEN ? AND ? ${projectFilter ? 'AND t.project_id = ?' : ''} GROUP BY t.updated_at::date`).all(...(projectFilter ? [userId, startIso, endIso, projectFilter] : [userId, startIso, endIso]));

  // Build days array for chart
  const days = [];
  let currStep = new Date(chartStart);
  currStep.setHours(12, 0, 0, 0); // avoid DST issues
  while (currStep <= chartEnd) {
    days.push(currStep.toISOString().split('T')[0]);
    currStep.setDate(currStep.getDate() + 1);
    if (days.length > 90) break; // Safety
  }

  const createdMap = Object.fromEntries(createdByDay.map(r => [r.day instanceof Date ? r.day.toISOString().split('T')[0] : r.day, r.count]));
  const completedMap = Object.fromEntries(completedByDay.map(r => [r.day instanceof Date ? r.day.toISOString().split('T')[0] : r.day, r.count]));

  const burndown = days.map(day => ({
    day,
    label: new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    created: parseInt(createdMap[day] || 0),
    completed: parseInt(completedMap[day] || 0),
  }));

  // ── 5. Stats by Project ─────────────────────────────
  const rawStatusCounts = isAdmin
    ? await db.prepare(`SELECT status, COUNT(*) as count FROM tasks WHERE 1=1 ${projectFilter ? 'AND project_id = ?' : ''} GROUP BY status`).all(...(projectFilter ? [projectFilter] : []))
    : await db.prepare(`
        SELECT t.status, COUNT(*) as count FROM tasks t
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        WHERE 1=1 ${projectFilter ? 'AND t.project_id = ?' : ''}
        GROUP BY t.status
      `).all(...(projectFilter ? [userId, projectFilter] : [userId]));

  const statusCounts = rawStatusCounts.map(r => ({ status: r.status, count: parseInt(r.count) }));
  const totalTickets = statusCounts.reduce((s, r) => s + r.count, 0);

  const priorityCounts = isAdmin
    ? await db.prepare(`SELECT priority, COUNT(*) as count FROM tasks WHERE 1=1 ${projectFilter ? 'AND project_id = ?' : ''} GROUP BY priority`).all(...(projectFilter ? [projectFilter] : []))
    : await db.prepare(`
        SELECT t.priority, COUNT(*) as count FROM tasks t
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        WHERE 1=1 ${projectFilter ? 'AND t.project_id = ?' : ''}
        GROUP BY t.priority
      `).all(...(projectFilter ? [userId, projectFilter] : [userId]));

  const typeCounts = isAdmin
    ? await db.prepare(`SELECT task_type, COUNT(*) as count FROM tasks WHERE 1=1 ${projectFilter ? 'AND project_id = ?' : ''} GROUP BY task_type`).all(...(projectFilter ? [projectFilter] : []))
    : await db.prepare(`
        SELECT t.task_type, COUNT(*) as count FROM tasks t
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        WHERE 1=1 ${projectFilter ? 'AND t.project_id = ?' : ''}
        GROUP BY t.task_type
      `).all(...(projectFilter ? [userId, projectFilter] : [userId]));

  const hourStats = isAdmin
    ? await db.prepare(`
        SELECT u.name, SUM(h.hours) as total_hours FROM hour_logs h
        INNER JOIN users u ON u.id = h.user_id
        GROUP BY u.id, u.name
        ORDER BY total_hours DESC
      `).all()
    : await db.prepare(`
        SELECT u.name, SUM(h.hours) as total_hours FROM hour_logs h
        INNER JOIN users u ON u.id = h.user_id
        INNER JOIN tasks t ON t.id = h.task_id
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        GROUP BY u.id, u.name
        ORDER BY total_hours DESC
      `).all(userId);

  // ── 7. Workload Balance: Active tasks per member ────────────────────────
  const workloadStats = isAdmin
    ? await db.prepare(`
        SELECT u.name, COUNT(t.id) as active_count FROM users u
        LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done' ${projectFilter ? 'AND t.project_id = ?' : ''}
        GROUP BY u.id, u.name ORDER BY active_count DESC
      `).all(...(projectFilter ? [projectFilter] : []))
    : await db.prepare(`
        SELECT u.name, COUNT(t.id) as active_count FROM users u
        INNER JOIN project_members pm ON pm.user_id = u.id
        LEFT JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done' AND t.project_id = pm.project_id
        WHERE pm.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        ${projectFilter ? 'AND pm.project_id = ?' : ''}
        GROUP BY u.id, u.name ORDER BY active_count DESC
      `).all(...(projectFilter ? [userId, projectFilter] : [userId]));

  // ── 8. Estimation Accuracy: Logged vs Estimated ────────────────────────
  const accuracyStats = isAdmin
    ? await db.prepare(`
        SELECT t.title, t.hours_estimated as estimated, COALESCE(SUM(h.hours), 0) as actual
        FROM tasks t
        LEFT JOIN hour_logs h ON h.task_id = t.id
        WHERE t.status = 'done' AND t.hours_estimated > 0 ${projectFilter ? 'AND t.project_id = ?' : ''}
        GROUP BY t.id, t.title, t.hours_estimated LIMIT 8
      `).all(...(projectFilter ? [projectFilter] : []))
    : await db.prepare(`
        SELECT t.title, t.hours_estimated as estimated, COALESCE(SUM(h.hours), 0) as actual
        FROM tasks t
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        LEFT JOIN hour_logs h ON h.task_id = t.id
        WHERE t.status = 'done' AND t.hours_estimated > 0 ${projectFilter ? 'AND t.project_id = ?' : ''}
        GROUP BY t.id, t.title, t.hours_estimated LIMIT 8
      `).all(...(projectFilter ? [userId, projectFilter] : [userId]));

  // ── 9. Aging Tasks: Stale tasks not touched in 7 days ───────────────────
  const agingTasks = isAdmin
    ? await db.prepare(`
        SELECT t.title, t.status, t.updated_at, p.key_prefix, t.task_number
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        WHERE t.status != 'done' AND t.updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days' ${projectFilter ? 'AND t.project_id = ?' : ''}
        ORDER BY t.updated_at ASC LIMIT 10
      `).all(...(projectFilter ? [projectFilter] : []))
    : await db.prepare(`
        SELECT t.title, t.status, t.updated_at, p.key_prefix, t.task_number
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?
        WHERE t.status != 'done' AND t.updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days' ${projectFilter ? 'AND t.project_id = ?' : ''}
        ORDER BY t.updated_at ASC LIMIT 10
      `).all(...(projectFilter ? [userId, projectFilter] : [userId]));

  // ── 11. Featured Project Burndown Chart ────────────────────────────────
  const featured = projectFilter 
    ? projects.find(p => p.id === projectFilter)
    : projects
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
    const pTasks = await db.prepare(`SELECT status, updated_at, created_at, hours_estimated FROM tasks WHERE project_id = ?`).all(featured.id);
    const totalWork = pTasks.reduce((s, t) => s + (t.hours_estimated || 1), 0);
    
    // Build days array
    const chartDays = [];
    let currDay = new Date(start);
    currDay.setHours(12, 0, 0, 0);
    const lastDay = new Date(end);
    lastDay.setHours(23, 59, 59, 999);

    const maxDaysCount = 90;
    while (currDay <= lastDay && chartDays.length < maxDaysCount) {
      chartDays.push(new Date(currDay));
      currDay.setDate(currDay.getDate() + 1);
    }

    burndownData = chartDays.map((d, idx) => {
      const dayStr = d.toISOString().split('T')[0];
      const dEnd = new Date(d);
      dEnd.setHours(23,59,59,999);

      const workDoneByDay = pTasks
        .filter(t => t.status === 'done' && t.updated_at && new Date(t.updated_at) <= dEnd)
        .reduce((s, t) => s + (t.hours_estimated || 1), 0);

      const remaining = Math.max(0, totalWork - workDoneByDay);
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

  // ── 12. Project Pulse (High Level Summary) ─────────────────────────────
  let projectHealth = {
    percentagePending: 0,
    daysRemaining: 0,
    summary: 'Analyze project progress data...',
    status: 'neutral',
    metrics: {
      blockers: 0,
      staleCount: 0,
      onTrack: true,
      velocity: 'steady'
    }
  };

  if (featured) {
    const totalRes = await db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id = ?`).get(featured.id);
    const total = parseInt(totalRes.count);
    const pendingRes = await db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status != 'done'`).get(featured.id);
    const pending = parseInt(pendingRes.count);
    const perc = total > 0 ? Math.round((pending / total) * 100) : 0;
    
    // Additional metrics
    const blockersRes = await db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status != 'done' AND priority = 'high'`).get(featured.id);
    const blockers = parseInt(blockersRes.count);
    const staleRes = await db.prepare(`SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status != 'done' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '3 days'`).get(featured.id);
    const staleCount = parseInt(staleRes.count);

    let daysDiff = 0;
    let deadlineStr = 'unspecified';
    if (featured.estimated_completion_date) {
      const deadline = new Date(featured.estimated_completion_date);
      const now = new Date();
      daysDiff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      deadlineStr = deadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }

    let healthStatus = 'neutral';
    let summaryText = '';
    let isTrack = true;
    let nextStep = 'Continue tracking progress.';

    if (perc === 0 && total > 0) {
      healthStatus = 'good';
      summaryText = `Project "${featured.name}" is fully completed! Excellent team execution. Total of ${total} tasks delivered.`;
      nextStep = "Celebrate the win and begin post-project analysis.";
    } else if (daysDiff < 0) {
      healthStatus = 'bad';
      isTrack = false;
      summaryText = `The go-live date (${deadlineStr}) for "${featured.name}" has passed with ${perc}% (${pending} tasks) still pending. Immediate action required.`;
      nextStep = "Urgent: Review remaining scope and adjust delivery expectations.";
    } else if (daysDiff <= 7 && perc > 30) {
      healthStatus = 'bad';
      isTrack = false;
      summaryText = `Critical deadline approaching for "${featured.name}". Only ${daysDiff} days left to resolve ${perc}% of the remaining workload. ${blockers > 0 ? `There are ${blockers} high-priority blockers.` : ''}`;
      nextStep = "Recommendation: Reassign high-priority tasks and focus 100% on blockers.";
    } else if (daysDiff <= 14 && perc > 50) {
      healthStatus = 'warning';
      isTrack = false;
      summaryText = `Project "${featured.name}" is falling behind. With ${perc}% of tasks still open and only two weeks left, the team needs to prioritize completion.`;
      nextStep = "Strategy: Escalate blockers and consider adding resources to key tasks.";
    } else {
      healthStatus = 'good';
      summaryText = `"${featured.name}" is healthy. Currently ${100 - perc}% complete with ${daysDiff || 'ample'} days remaining. Work distribution is balanced across the team.`;
      nextStep = "Next Milestone: Maintain momentum and begin closing pending low-priority tasks.";
    }

    projectHealth = {
      percentagePending: perc,
      daysRemaining: daysDiff,
      summary: summaryText,
      nextSteps: nextStep,
      status: healthStatus,
      metrics: {
        blockers,
        staleCount,
        onTrack: isTrack,
        velocity: burndown.length > 5 ? 'active' : 'stable'
      }
    };
  }

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
    workloadStats, accuracyStats, agingTasks, projectBurndown, projectHealth
  });
}));

module.exports = router;
