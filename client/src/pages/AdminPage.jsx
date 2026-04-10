import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import api from '../api.js';

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() || '?';
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

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
              <option value="admin">Admin</option>
            </select>
          </div>
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
  const [form, setForm] = useState({ name: '', description: '', memberIds: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const toggleMember = id => setForm(p => ({
    ...p,
    memberIds: p.memberIds.includes(id) ? p.memberIds.filter(x => x !== id) : [...p.memberIds, id]
  }));

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

export default function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/projects'), api.get('/projects/requests/pending')])
      .then(([u, p, r]) => { setUsers(u.data); setProjects(p.data); setRequests(r.data); })
      .finally(() => setLoading(false));
  }, []);

  const handleRequestAction = async (id, action) => {
    try {
      await api.put(`/projects/requests/${id}/${action}`);
      setRequests(prev => prev.filter(req => req.id !== id));
    } catch (err) {}
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
      <Navbar />
      <div className="admin-container">
        <div className="admin-section-header" style={{ marginBottom: 8 }}>
          <div>
            <div className="admin-section-title">Admin Panel</div>
            <div className="admin-section-sub">Manage team members and projects</div>
          </div>
        </div>

        <div className="divider" />

        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            👥 Team Members
          </button>
          <button className={`admin-tab ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}>
            📁 Projects
          </button>
          <button className={`admin-tab ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
            📥 Join Requests
          </button>
        </div>

        {tab === 'users' && (
          <>
            <div className="admin-section-header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{users.length} Members</div>
              </div>
              <button id="add-user-btn" className="btn btn-primary btn-sm" onClick={() => setShowAddUser(true)}>
                + Add Member
              </button>
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
                          {u.name}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button id={`delete-user-${u.id}`} className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>
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
              <div style={{ fontSize: 15, fontWeight: 600 }}>{projects.length} Projects</div>
              <button id="admin-add-project-btn" className="btn btn-primary btn-sm" onClick={() => setShowAddProject(true)}>
                + Create Project
              </button>
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
                  {projects.map(p => (
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
                          <button id={`delete-project-${p.id}`} className="btn btn-danger btn-sm" onClick={() => handleDeleteProject(p.id)}>
                            Delete
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
          onClose={() => setShowAddUser(false)}
          onCreated={u => { setUsers(p => [...p, u]); setShowAddUser(false); }}
        />
      )}

      {showAddProject && (
        <CreateProjectModal
          allUsers={users}
          onClose={() => setShowAddProject(false)}
          onCreated={p => { setProjects(prev => [p, ...prev]); setShowAddProject(false); }}
        />
      )}
    </div>
  );
}
