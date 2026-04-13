import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() || '?';
}

function CreateUserModal({ onClose, onCreated, projects }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member', projectId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const myProjects = projects.filter(p => p.owner_id === user.id);

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/users', form);
      onCreated(data);
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Add Team Member</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input id="new-user-name" name="name" className="form-input" placeholder="Jane Smith" value={form.name} onChange={handle} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input id="new-user-email" name="email" type="email" className="form-input" placeholder="jane@company.com" value={form.email} onChange={handle} required />
          </div>
          <div className="form-group">
            <label className="form-label">Temporary Password</label>
            <input id="new-user-password" name="password" type="password" className="form-input" placeholder="Min. 6 characters" value={form.password} onChange={handle} required minLength={6} />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select id="new-user-role" name="role" className="form-select" value={form.role} onChange={handle}>
              <option value="member">Member</option>
              <option value="lead">Project Lead / Scrum Master</option>
              {user.role === 'admin' && <option value="admin">Admin</option>}
            </select>
          </div>
          {myProjects.length > 0 && (
            <div className="form-group">
              <label className="form-label">Add to Project (Optional)</label>
              <select name="projectId" className="form-select" value={form.projectId} onChange={handle}>
                <option value="">None</option>
                {myProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="new-user-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateProjectModal({ onClose, onCreated, allUsers }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', description: '', owner_id: user.id, memberIds: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const toggleMember = id => setForm(p => ({
    ...p,
    memberIds: p.memberIds.includes(id) ? p.memberIds.filter(x => x !== id) : [...p.memberIds, id]
  }));

  const potentialLeads = allUsers.filter(u => u.role === 'admin' || u.role === 'lead');

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/projects', form);
      onCreated(data);
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Create Project</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input id="new-proj-name" name="name" className="form-input" placeholder="e.g. Website Redesign" value={form.name} onChange={handle} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea id="new-proj-desc" name="description" className="form-textarea" placeholder="What is this project about?" value={form.description} onChange={handle} />
          </div>
          <div className="form-group">
            <label className="form-label">Project Lead</label>
            <select name="owner_id" className="form-select" value={form.owner_id} onChange={handle}>
              {potentialLeads.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Add Members</label>
            <div className="member-picker">
              {allUsers.map(u => (
                <div key={u.id}
                  className={`member-chip ${form.memberIds.includes(u.id) ? 'selected' : ''}`}
                  onClick={() => toggleMember(u.id)}
                >
                  <div className="user-avatar" style={{ background: u.avatar_color, width: 22, height: 22, fontSize: 10 }}>
                    {initials(u.name)}
                  </div>
                  {u.name}
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="new-proj-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditProjectModal({ project, onClose, onUpdated, allUsers }) {
  const [form, setForm] = useState({ 
    name: project.name, 
    description: project.description || '', 
    owner_id: project.owner_id 
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const potentialLeads = allUsers.filter(u => u.role === 'admin' || u.role === 'lead');

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.patch(`/projects/${project.id}`, form);
      onUpdated();
    } catch (err) { setError(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Edit Project: {project.name}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input name="name" className="form-input" value={form.name} onChange={handle} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea name="description" className="form-textarea" value={form.description} onChange={handle} />
          </div>
          <div className="form-group">
            <label className="form-label">Project Lead</label>
            <select name="owner_id" className="form-select" value={form.owner_id} onChange={handle}>
              {potentialLeads.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectMembersModal({ project, onClose, onUpdated }) {
  const { user: currentUser, isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingRoles, setPendingRoles] = useState({}); // userId -> newRole
  const [saving, setSaving] = useState(false);

  // Search & Selection State
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${project.id}`),
      api.get('/users')
    ]).then(([projRes, usersRes]) => {
      setMembers(projRes.data.members);
      setAllUsers(usersRes.data);
      setLoading(false);
    });
  }, [project.id]);

  const handleRoleChange = (userId, newRole) => {
    setPendingRoles(prev => ({ ...prev, [userId]: newRole }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(pendingRoles);
    if (entries.length === 0) return onClose();
    
    setSaving(true);
    try {
      for (const [uid, role] of entries) {
        await api.patch(`/users/${uid}/role`, { role });
      }
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update some roles');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (userId) => {
    if (!confirm('Remove member from project?')) return;
    try {
      await api.delete(`/projects/${project.id}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.id !== userId));
      if (onUpdated) onUpdated();
    } catch (err) {
      alert('Failed to remove member');
    }
  };

  const handleAddMember = async (userId) => {
    try {
      await api.post(`/projects/${project.id}/members`, { userId });
      const newUser = allUsers.find(u => u.id === userId);
      if (newUser) setMembers(prev => [...prev, newUser]);
      if (onUpdated) onUpdated();
    } catch (err) {
      alert('Failed to add member');
    }
  };

  const handleAddSelected = async () => {
    if (selectedUserIds.length === 0) return;
    setSaving(true);
    try {
      await api.post(`/projects/${project.id}/members`, { userIds: selectedUserIds });
      const newMembers = allUsers.filter(u => selectedUserIds.includes(u.id));
      setMembers(prev => [...prev, ...newMembers]);
      setSelectedUserIds([]);
      setIsAdding(false);
      setSearchTerm('');
      if (onUpdated) onUpdated();
    } catch (err) {
      alert('Failed to add members');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const currentMemberIds = members.map(m => m.id);
  const availableUsers = allUsers.filter(u => 
    !currentMemberIds.includes(u.id) && 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const hasChanges = Object.keys(pendingRoles).length > 0;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <span className="modal-title">Manage Members: {project.name}</span>
          <button className="modal-close" onClick={onClose} disabled={saving}>✕</button>
        </div>

        <div style={{ padding: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', marginBottom: 20 }}>
          {!isAdding ? (
            <button className="btn btn-primary btn-sm" onClick={() => setIsAdding(true)}>
              + Add Member
            </button>
          ) : (
            <div className="add-member-section">
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input 
                  className="form-input" 
                  placeholder="Search by name or email..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-secondary btn-sm" onClick={() => { setIsAdding(false); setSelectedUserIds([]); setSearchTerm(''); }}>
                  Cancel
                </button>
              </div>

              {searchTerm.length > 0 && (
                <div className="search-results" style={{ 
                  maxHeight: 200, overflowY: 'auto', background: 'rgba(255,255,255,0.03)', 
                  borderRadius: 8, padding: 8, border: '1px solid var(--border-color)' 
                }}>
                  {availableUsers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>No users found</div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px 8px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Results</span>
                        {selectedUserIds.length > 0 && (
                          <button className="btn btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: 11 }} onClick={handleAddSelected} disabled={saving}>
                            Add {selectedUserIds.length} Selected
                          </button>
                        )}
                      </div>
                      {availableUsers.map(u => (
                        <div key={u.id} style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                          padding: '6px 8px', borderRadius: 6, transition: 'background 0.2s'
                        }} className="search-result-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }} onClick={() => toggleSelect(u.id)}>
                            <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => {}} onClick={e => e.stopPropagation()} />
                            <div className="user-avatar" style={{ background: u.avatar_color, width: 24, height: 24, fontSize: 10 }}>
                              {initials(u.name)}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{u.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                            </div>
                          </div>
                          <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: 11, background: 'rgba(139, 92, 246, 0.1)', color: '#a78bfa' }} onClick={() => handleAddMember(u.id)}>
                            Quick Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {loading ? <div className="loading-spinner" style={{ margin: '40px auto' }} /> : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Global Role</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="user-avatar" style={{ background: m.avatar_color, width: 28, height: 28, fontSize: 12 }}>
                          {initials(m.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {m.name} 
                            {m.id === currentUser.id && <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>(You)</span>}
                            {m.id === project.creator_id && <span className="role-badge role-admin" style={{ fontSize: 9, marginLeft: 6, padding: '1px 4px' }}>Creator</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select 
                        className="form-select" 
                        style={{ padding: '2px 8px', fontSize: 12 }} 
                        value={pendingRoles[m.id] || m.role} 
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        disabled={saving || (!isAdmin && m.role === 'admin') || (m.id === currentUser.id) || (m.id === project.creator_id)}
                      >
                        <option value="member">Member</option>
                        <option value="lead">Lead</option>
                        {(isAdmin || m.role === 'admin') && <option value="admin">Admin</option>}
                      </select>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-sm btn-danger" 
                        onClick={() => handleRemove(m.id)} 
                        disabled={saving || m.id === project.creator_id || m.id === currentUser.id || (!isAdmin && m.role === 'admin')}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="modal-footer" style={{ marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving || !hasChanges}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const isLead = user?.role === 'lead';
  const navigate = useNavigate();

  const [tab, setTab] = useState(isAdmin ? 'users' : 'projects');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [managingProject, setManagingProject] = useState(null);

  const [pendingUserRoles, setPendingUserRoles] = useState({}); // userId -> newRole
  const [savingGlobal, setSavingGlobal] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/users'), 
      api.get('/projects'), 
      api.get('/projects/requests/pending')
    ])
      .then(([u, p, r]) => { setUsers(u.data); setProjects(p.data); setRequests(r.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // If a lead, they should only see projects they own in the projects tab
  const displayProjects = isAdmin ? projects : projects.filter(p => p.owner_id === user.id);
  
  // Leads don't get the 'users' tab (global management)
  useEffect(() => {
    if (isLead && tab === 'users') setTab('projects');
  }, [isLead, tab]);

  const handleRequestAction = async (id, action) => {
    try {
      await api.put(`/projects/requests/${id}/${action}`);
      setRequests(prev => prev.filter(req => req.id !== id));
    } catch (err) {}
  };

  const handleGlobalRoleChange = (userId, newRole) => {
    setPendingUserRoles(prev => ({ ...prev, [userId]: newRole }));
  };

  const handleSaveGlobalRoles = async () => {
    const entries = Object.entries(pendingUserRoles);
    if (entries.length === 0) return;
    setSavingGlobal(true);
    try {
      for (const [uid, role] of entries) {
        await api.patch(`/users/${uid}/role`, { role });
      }
      setPendingUserRoles({});
      fetchData();
    } catch (err) {
      alert('Failed to update some global roles');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleDeleteUser = async id => {
    if (!confirm('Remove this user?')) return;
    await api.delete(`/users/${id}`);
    setUsers(p => p.filter(u => u.id !== id));
  };

  const handleDeleteProject = async id => {
    if (!confirm('Delete project and all its tasks?')) return;
    await api.delete(`/projects/${id}`);
    setProjects(p => p.filter(pr => pr.id !== id));
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-section-header" style={{ marginBottom: 8 }}>
          <div>
            <div className="admin-section-title">{isAdmin ? 'Admin Console' : 'Project Management'}</div>
            <div className="admin-section-sub">
              {isAdmin ? 'Global application and team management' : 'Manage your projects and joining requests'}
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="admin-tabs">
          {isAdmin && (
            <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
              👥 Team Members
            </button>
          )}
          <button className={`admin-tab ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}>
            📁 Projects
          </button>
          <button className={`admin-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
            📥 Join Requests ({requests.length})
          </button>
        </div>

        {tab === 'users' && (
          <>
            <div className="admin-section-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{users.length} Members</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {Object.keys(pendingUserRoles).length > 0 && (
                  <button className="btn btn-primary btn-sm" onClick={handleSaveGlobalRoles} disabled={savingGlobal}>
                    {savingGlobal ? 'Saving...' : 'Save Role Changes'}
                  </button>
                )}
                <button id="add-user-btn" className="btn btn-primary btn-sm" onClick={() => setShowAddUser(true)}>
                  + Add Member
                </button>
              </div>
            </div>
            {loading ? <div className="loading-spinner" style={{ margin: '40px auto' }} /> : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="user-avatar" style={{ background: u.avatar_color }}>
                            {initials(u.name)}
                          </div>
                          <div>
                            <div>{u.name} {u.id === user.id && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>(You)</span>}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td>
                        <select 
                          className="form-select" 
                          style={{ padding: '2px 8px', fontSize: 12, width: 100 }} 
                          value={pendingUserRoles[u.id] || u.role} 
                          onChange={(e) => handleGlobalRoleChange(u.id, e.target.value)}
                          disabled={savingGlobal || u.id === user.id}
                        >
                          <option value="member">Member</option>
                          <option value="lead">Lead</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button 
                          id={`delete-user-${u.id}`} 
                          className="btn btn-danger btn-sm" 
                          onClick={() => handleDeleteUser(u.id)} 
                          disabled={savingGlobal || u.id === user.id}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === 'projects' && (
          <>
            <div className="admin-section-header">
              <div style={{ fontSize: 15, fontWeight: 600 }}>{displayProjects.length} Projects</div>
              {isAdmin && (
                <button id="admin-add-project-btn" className="btn btn-primary btn-sm" onClick={() => setShowAddProject(true)}>
                  + Create Project
                </button>
              )}
            </div>
            {loading ? <div className="loading-spinner" style={{ margin: '40px auto' }} /> : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Owner</th>
                    <th>Members</th>
                    <th>Tasks</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {displayProjects.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 500 }}>{p.name}</div>
                          {p.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.description}</div>}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.owner_name || '—'}</td>
                      <td><span className="role-badge role-member">{p.member_count}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.task_count}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button id={`view-project-${p.id}`} className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${p.id}/board`)}>
                            View Board
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => setManagingProject(p)}>
                            Members
                          </button>
                          {isAdmin && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingProject(p)}>
                              Edit
                            </button>
                          )}
                          {isAdmin && (
                            <button id={`delete-project-${p.id}`} className="btn btn-danger btn-sm" onClick={() => handleDeleteProject(p.id)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
        {tab === 'requests' && (
          <>
            <div className="admin-section-header">
              <div style={{ fontSize: 15, fontWeight: 600 }}>{requests.length} Pending Requests</div>
            </div>
            {loading ? <div className="loading-spinner" style={{ margin: '40px auto' }} /> : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Project</th>
                    <th>Requested On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                        No pending requests.
                      </td>
                    </tr>
                  )}
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.user_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.user_email}</td>
                      <td><span className="type-badge type-story">{r.project_name}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => handleRequestAction(r.id, 'approve')}>
                            Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRequestAction(r.id, 'reject')}>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {showAddUser && (
        <CreateUserModal
          projects={projects}
          onClose={() => setShowAddUser(false)}
          onCreated={u => { fetchData(); setShowAddUser(false); }}
        />
      )}

      {showAddProject && (
        <CreateProjectModal
          allUsers={users}
          onClose={() => setShowAddProject(false)}
          onCreated={p => { fetchData(); setShowAddProject(false); }}
        />
      )}

      {managingProject && (
        <ProjectMembersModal
          project={managingProject}
          onClose={() => setManagingProject(null)}
          onUpdated={() => fetchData()}
        />
      )}

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          allUsers={users}
          onClose={() => setEditingProject(null)}
          onUpdated={() => { fetchData(); setEditingProject(null); }}
        />
      )}
    </div>
  );
}
