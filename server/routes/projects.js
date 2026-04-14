const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

async function isMember(projectId, userId, role) {
  if (role === 'admin') return true;
  return await db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

// Generate a key prefix from project name (first 2-4 uppercase alpha chars)
function makeKeyPrefix(name) {
  const clean = name.toUpperCase().replace(/[^A-Z]/g, '');
  return (clean.slice(0, 4) || 'TF').padEnd(2, 'X');
}

// GET /api/projects
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  let projects;
  if (req.user.role === 'admin') {
    projects = await db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count
      FROM projects p LEFT JOIN users u ON u.id = p.owner_id ORDER BY p.created_at DESC
    `).all();
  } else {
    projects = await db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count
      FROM projects p LEFT JOIN users u ON u.id = p.owner_id
      INNER JOIN project_members me ON me.project_id = p.id AND me.user_id = ?
      ORDER BY p.created_at DESC
    `).all(req.user.id);
  }
  res.json(projects);
}));

// POST /api/projects
router.post('/', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { name, description, memberIds, estimated_completion_date, project_goal, owner_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  // Use the provided owner_id (assigned lead) or default to the admin creator
  const ownerId = owner_id || req.user.id;
  const keyPrefix = makeKeyPrefix(name);

  const result = await db.prepare(
    'INSERT INTO projects (name, key_prefix, description, owner_id, creator_id, estimated_completion_date, project_goal) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name, keyPrefix, description || '', ownerId, req.user.id, estimated_completion_date || null, project_goal || null);

  const projectId = result.lastInsertRowid;
  
  // Ensure the owner is a member
  await db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(projectId, ownerId);

  if (Array.isArray(memberIds)) {
    for (const uid of memberIds) {
      if (uid !== ownerId) {
        await db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(projectId, uid);
      }
    }
  }
  res.status(201).json({ id: projectId, name, key_prefix: keyPrefix, description, owner_id: ownerId, creator_id: req.user.id });
}));

// GET /api/projects/all-directory
router.get('/all-directory', authMiddleware, asyncHandler(async (req, res) => {
  const projects = await db.prepare(`
    SELECT p.*, u.name as owner_name,
      EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?) as is_member,
      (SELECT status FROM project_requests pr WHERE pr.project_id = p.id AND pr.user_id = ?) as request_status
    FROM projects p
    LEFT JOIN users u ON u.id = p.owner_id
    ORDER BY p.name ASC
  `).all(req.user.id, req.user.id);
  res.json(projects);
}));

// GET /api/projects/requests/pending
router.get('/requests/pending', authMiddleware, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'lead') {
    return res.status(403).json({ error: 'Admin or Lead access required' });
  }

  let requests;
  if (req.user.role === 'admin') {
    requests = await db.prepare(`
      SELECT pr.*, p.name as project_name, u.name as user_name, u.email as user_email
      FROM project_requests pr
      JOIN projects p ON p.id = pr.project_id
      JOIN users u ON u.id = pr.user_id
      WHERE pr.status = 'pending'
      ORDER BY pr.created_at DESC
    `).all();
  } else {
    // Lead only sees requests for projects they own
    requests = await db.prepare(`
      SELECT pr.*, p.name as project_name, u.name as user_name, u.email as user_email
      FROM project_requests pr
      JOIN projects p ON p.id = pr.project_id
      JOIN users u ON u.id = pr.user_id
      WHERE pr.status = 'pending' AND p.owner_id = ?
      ORDER BY pr.created_at DESC
    `).all(req.user.id);
  }
  res.json(requests);
}));

// PUT /api/projects/requests/:id/:action
router.put('/requests/:id/:action', authMiddleware, asyncHandler(async (req, res) => {
  const { id, action } = req.params;
  const reqRow = await db.prepare(`
    SELECT pr.*, p.owner_id 
    FROM project_requests pr 
    JOIN projects p ON p.id = pr.project_id 
    WHERE pr.id = ?
  `).get(id);

  if (!reqRow) return res.status(404).json({ error: 'Request not found' });

  // Allow admin OR the project owner (Lead)
  if (req.user.role !== 'admin' && reqRow.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Admin or Project Lead access required' });
  }

  if (action === 'approve') {
    await db.prepare("UPDATE project_requests SET status = 'approved' WHERE id = ?").run(id);
    await db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(reqRow.project_id, reqRow.user_id);
  } else if (action === 'reject') {
    await db.prepare("UPDATE project_requests SET status = 'rejected' WHERE id = ?").run(id);
  }
  res.json({ success: true });
}));

// POST /api/projects/:id/requests
router.post('/:id/requests', authMiddleware, asyncHandler(async (req, res) => {
  await db.prepare(`
    INSERT INTO project_requests (project_id, user_id, status)
    VALUES (?, ?, 'pending')
    ON CONFLICT(project_id, user_id) DO UPDATE SET status = 'pending'
  `).run(req.params.id, req.user.id);
  res.json({ success: true });
}));

// GET /api/projects/:id
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role !== 'admin' && !(await isMember(req.params.id, req.user.id))) {
    return res.status(403).json({ error: 'Not a member of this project' });
  }
  const members = await db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_color, u.role FROM users u
    INNER JOIN project_members pm ON pm.user_id = u.id WHERE pm.project_id = ?
  `).all(req.params.id);
  res.json({ ...project, members });
}));

// PATCH /api/projects/:id
router.patch('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const projectId = Number(req.params.id);
  const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  
  if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Admin or Owner access required' });
  }

  const { name, description, estimated_completion_date, project_goal, owner_id } = req.body;
  
  const updates = [];
  const params = [];
  
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (estimated_completion_date !== undefined) { updates.push('estimated_completion_date = ?'); params.push(estimated_completion_date); }
  if (project_goal !== undefined) { updates.push('project_goal = ?'); params.push(project_goal); }
  
  if (owner_id !== undefined) { 
    updates.push('owner_id = ?'); 
    params.push(owner_id === null ? null : Number(owner_id)); 
  }
  
  if (updates.length > 0) {
    params.push(projectId);
    const sql = `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`;
    
    await db.prepare(sql).run(...params);
    if (owner_id !== undefined && owner_id !== null) {
      await db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(projectId, Number(owner_id));
    }
  }
  
  const updatedProject = await db.prepare('SELECT p.*, u.name as owner_name FROM projects p LEFT JOIN users u ON u.id = p.owner_id WHERE p.id = ?').get(projectId);
  res.json(updatedProject);
}));

// DELETE /api/projects/:id
router.delete('/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  await db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

// POST /api/projects/:id/members
router.post('/:id/members', authMiddleware, asyncHandler(async (req, res) => {
  const project = await db.prepare('SELECT owner_id FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Admin or Project Lead access required' });
  }

  const { userId, userIds } = req.body;
  const stmt = db.prepare('INSERT INTO project_members (project_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING');

  if (Array.isArray(userIds)) {
    for (const uid of userIds) {
      await stmt.run(req.params.id, uid);
    }
  } else if (userId) {
    await stmt.run(req.params.id, userId);
  }

  res.json({ success: true });
}));

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { id, userId } = req.params;
  const project = await db.prepare('SELECT owner_id, creator_id FROM projects WHERE id = ?').get(id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // 1. Block removal of creator
  if (parseInt(userId) === project.creator_id) {
    return res.status(403).json({ error: 'The project creator cannot be removed' });
  }

  // 2. Permission check
  if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Admin or Project Lead access required' });
  }

  // 3. Prevent Lead from removing an Admin
  const targetUser = await db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (req.user.role !== 'admin' && targetUser?.role === 'admin') {
    return res.status(403).json({ error: 'Project Leads cannot remove Administrators' });
  }

  // 4. Fail-safe: Ensure at least one admin remains
  if (targetUser?.role === 'admin') {
    const otherAdmins = await db.prepare(`
      SELECT COUNT(*) as count FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ? AND u.role = 'admin' AND u.id != ?
    `).get(id, userId);
    
    if (parseInt(otherAdmins.count) === 0) {
      return res.status(403).json({ error: 'Every project must have at least one Administrator' });
    }
  }

  await db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(id, userId);
  res.json({ success: true });
}));

module.exports = router;
