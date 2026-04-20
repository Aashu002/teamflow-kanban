import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { TYPE_META } from '../components/TaskCard.jsx';
import { COLUMNS } from './BoardPage.jsx';
import { useNavbar } from '../contexts/NavbarContext.jsx';

export default function IssuesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = searchParams.get('tab') || 'search';
  
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const { setHeaderData, clearHeaderData } = useNavbar();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [projects, setProjects] = useState([]);
  const [filterProject, setFilterProject] = useState('all');

  const loadIssues = () => {
    setLoading(true);
    const params = {};
    if (tab === 'created') params.creator = 'me';
    if (searchQuery.trim() && tab === 'search') params.search = searchQuery.trim();
    if (tab === 'search' && filterType !== 'all') params.type = filterType;
    if (tab === 'search' && filterPriority !== 'all') params.priority = filterPriority;
    if (tab === 'search' && filterAssignee !== 'all') params.assignee = filterAssignee;
    if (tab === 'search' && filterProject !== 'all') params.projectId = filterProject;

    api.get('/tasks/search', { params }).then(res => {
      setTasks(res.data);
    }).finally(() => setLoading(false));
    
    // Also fetch users and projects if not loaded
    if (users.length === 0) {
      api.get('/users').then(res => setUsers(res.data)).catch(() => {});
    }
    if (projects.length === 0) {
      api.get('/projects').then(res => setProjects(res.data)).catch(() => {});
    }
  };

  useEffect(() => {
    loadIssues();
    setHeaderData({ projectName: tab === 'created' ? 'Issues (Created)' : 'Issue Search' });
    return () => clearHeaderData();
  }, [tab, setHeaderData, clearHeaderData]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (tab !== 'search') setSearchParams({ tab: 'search' });
    loadIssues();
  };

  return (
    <div className="admin-page">
      <div className="admin-container" style={{ maxWidth: 1000 }}>
        <div className="admin-section-header" style={{ marginBottom: 12 }}>
          <div>
            <div className="admin-section-title">
              {tab === 'created' ? 'Issues Created By Me' : 'Search Issues'}
            </div>
            <div className="admin-section-sub">
              {tab === 'created' ? 'View and manage tickets you have created.' : 'Search across all projects you have access to.'}
            </div>
          </div>
        </div>

        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'created' ? 'active' : ''}`} onClick={() => setSearchParams({ tab: 'created' })}>
            🙋‍♂️ Created By Me
          </button>
          <button className={`admin-tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setSearchParams({ tab: 'search' })}>
            🔍 Search
          </button>
        </div>

        {tab === 'search' && (
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '20px 0' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input 
                type="text" 
                className="form-input" 
                style={{ flex: 1 }}
                placeholder="Search by title, description, or issue key..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">Search</button>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Type:</span>
                <select className="form-select" style={{ width: 140, padding: '4px 8px', fontSize: 13 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="all">All</option>
                  <option value="epic">⚡ Epic</option>
                  <option value="story">📖 Story</option>
                  <option value="task">✅ Task</option>
                  <option value="subtask">🔧 Sub-Task</option>
                  <option value="bug">🐛 Bug</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Priority:</span>
                <select className="form-select" style={{ width: 120, padding: '4px 8px', fontSize: 13 }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                  <option value="all">All</option>
                  <option value="high">🔴 HIGH</option>
                  <option value="medium">🟡 MEDIUM</option>
                  <option value="low">🟢 LOW</option>
                </select>
              </div>
              {users.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Assignee:</span>
                  <select className="form-select" style={{ width: 140, padding: '4px 8px', fontSize: 13 }} value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
                    <option value="all">All</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}
              {projects.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="text-muted" style={{ fontSize: 13, fontWeight: 500 }}>Project:</span>
                  <select className="form-select" style={{ width: 160, padding: '4px 8px', fontSize: 13 }} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                    <option value="all">All Projects</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </form>
        )}

        {loading ? <div className="loading-spinner" style={{ margin: '40px auto' }} /> : (
          <table className="data-table" style={{ tableLayout: 'fixed', marginTop: 20 }}>
            <colgroup>
              <col style={{ width: 90 }}/>
              <col style={{ width: 140 }}/>
              <col style={{ width: 110 }}/>
              <col/>
              <col style={{ width: 100 }}/>
              <col style={{ width: 140 }}/>
              <col style={{ width: 130 }}/>
            </colgroup>
            <thead>
              <tr>
                <th>Key</th>
                <th>Project</th>
                <th style={{ textAlign: 'center' }}>Type</th>
                <th>Title</th>
                <th style={{ textAlign: 'center' }}>Priority</th>
                <th>Assignee</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                    No issues found matching your criteria.
                  </td>
                </tr>
              )}
              {tasks.map(t => {
                const tm = TYPE_META[t.task_type] || TYPE_META.task;
                const col = COLUMNS.find(c => c.id === t.status);
                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${t.project_id}/tasks/${t.key_prefix}-${t.task_number}`)}>
                    <td>
                      <span className="task-id" style={{ color: 'var(--accent-purple)' }}>{t.key_prefix}-{t.task_number}</span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {t.project_name}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`type-badge type-${t.task_type}`}>
                        {tm.icon} {tm.label}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`priority-badge priority-${t.priority}`} style={{ textTransform: 'uppercase', fontSize: 10 }}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.assignee_name || 'Unassigned'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ 
                        display: 'inline-block',
                        minWidth: 100,
                        fontSize: 10,
                        lineHeight: 1.2,
                        fontWeight: 700, 
                        textAlign: 'center',
                        color: col?.color || 'var(--text-muted)', 
                        background: (col?.color || '#475569') + '20', 
                        padding: '4px 8px', 
                        borderRadius: 4,
                        textTransform: 'uppercase'
                      }}>
                        {col?.label || t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
