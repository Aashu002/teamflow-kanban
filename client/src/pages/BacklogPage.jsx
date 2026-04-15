import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNavbar } from '../contexts/NavbarContext.jsx';
import { TYPE_META } from '../components/TaskCard.jsx';
import api from '../api.js';

const STATUS_COLORS = { planning: '#8b5cf6', active: '#10b981', completed: '#6b7280' };
const STATUS_LABELS = { planning: '🟡 Planning', active: '🟢 Active', completed: '✅ Done' };
const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

function SprintBadge({ status }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
      background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status],
      textTransform: 'uppercase', letterSpacing: 0.5
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function CreateSprintModal({ projectId, onClose, onCreated }) {
  const today = new Date().toISOString().split('T')[0];
  const twoWeeksOut = new Date(Date.now() + 13 * 864e5).toISOString().split('T')[0];
  const [form, setForm] = useState({ name: '', goal: '', start_date: today, end_date: twoWeeksOut });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/sprints', { projectId, ...form });
      onCreated(data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to create sprint'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">✨ Create Sprint</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Sprint Name *</label>
            <input name="name" className="form-input" placeholder="e.g. Sprint 1 — Auth & Onboarding" value={form.name} onChange={handle} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Sprint Goal</label>
            <textarea name="goal" className="form-textarea" placeholder="What should the team achieve by end of this sprint?" value={form.goal} onChange={handle} rows={2} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" name="start_date" className="form-input" value={form.start_date} onChange={handle} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" name="end_date" className="form-input" value={form.end_date} onChange={handle} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Sprint'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CompleteSprintModal({ sprint, incompleteCount, onClose, onConfirm, loading }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div className="modal" style={{ maxWidth: 420, textAlign: 'center', padding: '36px 28px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏁</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Complete "{sprint.name}"?</h2>
        {incompleteCount > 0 ? (
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
            <strong style={{ color: '#f59e0b' }}>{incompleteCount} unfinished task{incompleteCount > 1 ? 's' : ''}</strong> will automatically be moved back to the <strong>Project Backlog</strong>.
          </p>
        ) : (
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
            All tasks are completed! Great sprint 🎉
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? 'Completing…' : 'Complete Sprint'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BacklogTaskRow({ task, navigate, onDragStart, side }) {
  const tm = TYPE_META[task.task_type] || TYPE_META.task;
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task)}
      onClick={() => navigate(`/projects/${task.project_id}/tasks/${task.key_prefix}-${task.task_number}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
        borderRadius: 8, cursor: 'grab', marginBottom: 3,
        border: '1px solid var(--border-color)', background: 'var(--bg-surface)',
        transition: 'background 0.15s, border-color 0.15s', userSelect: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.borderColor = 'var(--accent-purple-dim, #6d4aaa)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
    >
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_COLOR[task.priority] || '#6b7280', flexShrink: 0 }} />
      <span className={`type-badge type-${task.task_type}`} style={{ fontSize: 10, padding: '1px 5px', flexShrink: 0 }}>{tm.icon}</span>
      <span style={{ fontSize: 11, color: 'var(--accent-purple)', fontWeight: 700, flexShrink: 0, minWidth: 58 }}>
        {task.key_prefix}-{task.task_number}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      {task.assignee_name && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{task.assignee_name.split(' ')[0]}</span>
      )}
      {task.hours_estimated > 0 && (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 5, flexShrink: 0,
          background: 'rgba(139,92,246,0.10)', color: 'var(--accent-purple)',
        }}>
          {task.hours_estimated}h
        </span>
      )}
      <span style={{
        fontSize: 10, padding: '2px 6px', borderRadius: 5, flexShrink: 0,
        background: task.status === 'done' ? 'rgba(16,185,129,0.12)' : 'var(--bg-secondary)',
        color: task.status === 'done' ? '#10b981' : 'var(--text-muted)',
      }}>
        {task.status}
      </span>
    </div>
  );
}

export default function BacklogPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { setHeaderData, clearHeaderData } = useNavbar();

  const [project, setProject] = useState(null);
  const [backlog, setBacklog] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [sprintTasks, setSprintTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [incompleteCount, setIncompleteCount] = useState(0);
  const [dragOverSide, setDragOverSide] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [editingSprint, setEditingSprint] = useState({}); // local edits before save

  const canManage = isAdmin || project?.owner_id === user?.id;

  const load = useCallback(async (keepSelection = false) => {
    try {
      const [projRes, backlogRes, sprintsRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/tasks/backlog?projectId=${projectId}`),
        api.get(`/sprints?projectId=${projectId}`),
      ]);
      setProject(projRes.data);
      setBacklog(backlogRes.data);
      setSprints(sprintsRes.data);

      if (!keepSelection) {
        const active = sprintsRes.data.find(s => s.status === 'active');
        const firstPlanning = sprintsRes.data.find(s => s.status === 'planning');
        const auto = active || firstPlanning || sprintsRes.data[0];
        setSelectedSprintId(auto?.id ?? null);
      }
    } catch { navigate('/home'); }
    finally { setLoading(false); }
  }, [projectId, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (project) setHeaderData({ projectName: project.name, onBack: () => navigate(`/projects/${projectId}/board`) });
    return () => clearHeaderData();
  }, [project, projectId, navigate, setHeaderData, clearHeaderData]);

  // Load tasks for selected sprint
  useEffect(() => {
    if (!selectedSprintId) { setSprintTasks([]); return; }
    api.get(`/tasks?projectId=${projectId}&sprintId=${selectedSprintId}`)
      .then(r => setSprintTasks(r.data))
      .catch(() => setSprintTasks([]));
  }, [selectedSprintId, projectId]);

  const selectedSprint = sprints.find(s => s.id === selectedSprintId);

  // Drag helpers
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('taskId', String(task.id));
    e.dataTransfer.setData('fromSide', backlog.find(b => b.id === task.id) ? 'backlog' : 'sprint');
  };

  const handleDropOnSprint = async e => {
    e.preventDefault(); setDragOverSide(null);
    const taskId = Number(e.dataTransfer.getData('taskId'));
    const from = e.dataTransfer.getData('fromSide');
    if (from === 'sprint' || !selectedSprintId) return;
    try {
      await api.post(`/sprints/${selectedSprintId}/tasks`, { taskId });
      const task = backlog.find(t => t.id === taskId);
      setBacklog(p => p.filter(t => t.id !== taskId));
      if (task) setSprintTasks(p => [{ ...task, sprint_id: selectedSprintId }, ...p]);
    } catch { alert('Failed to assign task to sprint'); }
  };

  const handleDropOnBacklog = async e => {
    e.preventDefault(); setDragOverSide(null);
    const taskId = Number(e.dataTransfer.getData('taskId'));
    const from = e.dataTransfer.getData('fromSide');
    if (from === 'backlog') return;
    try {
      await api.delete(`/sprints/${selectedSprintId}/tasks/${taskId}`);
      const task = sprintTasks.find(t => t.id === taskId);
      setSprintTasks(p => p.filter(t => t.id !== taskId));
      if (task) setBacklog(p => [{ ...task, sprint_id: null }, ...p]);
    } catch { alert('Failed to move task to backlog'); }
  };

  const handleStartSprint = async sprint => {
    try {
      const { data } = await api.post(`/sprints/${sprint.id}/start`);
      setSprints(p => p.map(s => s.id === data.id ? data : s));
    } catch (err) { alert(err.response?.data?.error || 'Failed to start sprint'); }
  };

  const openCompleteModal = async sprint => {
    const tasks = sprintTasks.length > 0 ? sprintTasks : (await api.get(`/tasks?projectId=${projectId}&sprintId=${sprint.id}`)).data;
    setIncompleteCount(tasks.filter(t => t.status !== 'done').length);
    setCompleteTarget(sprint);
  };

  const handleCompleteSprint = async () => {
    setCompleteLoading(true);
    try {
      await api.post(`/sprints/${completeTarget.id}/complete`);
      setCompleteTarget(null);
      await load();
    } catch (err) { alert(err.response?.data?.error || 'Failed to complete sprint'); }
    finally { setCompleteLoading(false); }
  };

  const handleDeleteSprint = async sprint => {
    if (!confirm(`Delete "${sprint.name}"? Its tasks will return to the Project Backlog.`)) return;
    try {
      await api.delete(`/sprints/${sprint.id}`);
      setSprints(p => p.filter(s => s.id !== sprint.id));
      if (selectedSprintId === sprint.id) setSelectedSprintId(null);
      setEditingSprint({});
      await load(true);
    } catch (err) { alert(err.response?.data?.error || 'Failed to delete sprint'); }
  };

  // Patch a single field on the selected sprint (auto-save on blur/change)
  const patchSprint = async (field, value) => {
    if (!selectedSprintId) return;
    try {
      const { data } = await api.patch(`/sprints/${selectedSprintId}`, { [field]: value });
      setSprints(p => p.map(s => s.id === data.id ? { ...s, ...data } : s));
    } catch (err) { alert('Failed to save sprint: ' + (err.response?.data?.error || err.message)); }
  };

  const filteredBacklog = backlog.filter(t => {
    if (filterType !== 'all' && t.task_type !== filterType) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const totalHours = sprintTasks.reduce((s, t) => s + (t.hours_estimated || 0), 0);
  const doneHours = sprintTasks.filter(t => t.status === 'done').reduce((s, t) => s + (t.hours_estimated || 0), 0);
  const progressPct = totalHours > 0 ? Math.round((doneHours / totalHours) * 100) : 0;

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;

  return (
    <div className="board-page">
      {/* Toolbar */}
      <div className="board-toolbar">
        <span className="board-toolbar-title">📋 Project Backlog</span>
        <span className="board-task-count">{backlog.length} unassigned · {sprints.length} sprint{sprints.length !== 1 ? 's' : ''}</span>
        <div style={{ flex: 1 }} />
        <div className="board-filter-group">
          <span className="board-filter-label">Type:</span>
          <select className="board-filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All</option>
            <option value="epic">⚡ Epic</option>
            <option value="story">📖 Story</option>
            <option value="task">✅ Task</option>
            <option value="subtask">🔧 Sub-Task</option>
            <option value="bug">🐛 Bug</option>
          </select>
        </div>
        <div className="board-filter-group">
          <span className="board-filter-label">Priority:</span>
          <select className="board-filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">All</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
        {canManage && (
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowCreateSprint(true)}>
            + New Sprint
          </button>
        )}
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 'calc(100vh - 112px)', overflow: 'hidden' }}>

        {/* ── LEFT: Project Backlog ── */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)',
            background: dragOverSide === 'backlog' ? 'rgba(139,92,246,0.04)' : 'transparent',
            transition: 'background 0.2s',
          }}
          onDragOver={e => { e.preventDefault(); setDragOverSide('backlog'); }}
          onDragLeave={() => setDragOverSide(null)}
          onDrop={handleDropOnBacklog}
        >
          <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Project Backlog</h3>
              <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--bg-secondary)', borderRadius: 12, color: 'var(--text-muted)' }}>
                {filteredBacklog.length}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              Drag tasks into a sprint → or drop sprint tasks here to unassign.
            </p>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
            {filteredBacklog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                <div style={{ fontWeight: 600 }}>Backlog is empty!</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>All tasks are assigned to sprints.</div>
              </div>
            ) : filteredBacklog.map(t => (
              <BacklogTaskRow key={t.id} task={t} navigate={navigate} onDragStart={handleDragStart} side="backlog" />
            ))}
          </div>
        </div>

        {/* ── RIGHT: Sprint Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Sprint tabs */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {sprints.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                No sprints yet.{canManage && ' Click "+ New Sprint" to create one.'}
              </span>
            ) : sprints.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSprintId(s.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginRight: 6, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                  border: `2px solid ${selectedSprintId === s.id ? STATUS_COLORS[s.status] : 'var(--border-color)'}`,
                  background: selectedSprintId === s.id ? `${STATUS_COLORS[s.status]}15` : 'transparent',
                  color: selectedSprintId === s.id ? STATUS_COLORS[s.status] : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {s.name}
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: `${STATUS_COLORS[s.status]}25`, color: STATUS_COLORS[s.status], fontWeight: 700 }}>
                  {s.status === 'active' ? '●' : s.status === 'planning' ? '○' : '✔'}
                </span>
              </button>
            ))}
          </div>

          {/* Sprint header — with inline editing */}
          {selectedSprint ? (
            <div style={{ padding: '10px 18px 12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>

                  {/* Sprint name — inline editable */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {canManage && selectedSprint.status !== 'completed' ? (
                      <input
                        style={{
                          fontWeight: 700, fontSize: 15, background: 'transparent',
                          border: '1px dashed transparent', borderRadius: 4, color: 'var(--text-primary)',
                          padding: '2px 6px', margin: '-2px -6px', width: '100%', maxWidth: 300,
                        }}
                        defaultValue={selectedSprint.name}
                        key={selectedSprint.id + '-name'}
                        onBlur={e => { if (e.target.value.trim() && e.target.value !== selectedSprint.name) patchSprint('name', e.target.value.trim()); }}
                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                        onFocus={e => { e.target.style.borderColor = 'var(--accent-purple)'; e.target.style.background = 'var(--bg-secondary)'; }}
                        onBlurCapture={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
                        placeholder="Sprint name"
                        title="Click to edit sprint name"
                      />
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedSprint.name}</span>
                    )}
                    <SprintBadge status={selectedSprint.status} />
                  </div>

                  {/* Sprint goal — inline editable */}
                  {canManage && selectedSprint.status !== 'completed' ? (
                    <input
                      style={{
                        fontSize: 12, background: 'transparent',
                        border: '1px dashed transparent', borderRadius: 4,
                        color: 'var(--text-secondary)', padding: '2px 6px', margin: '-2px -6px',
                        width: '100%', marginBottom: 6,
                      }}
                      defaultValue={selectedSprint.goal || ''}
                      key={selectedSprint.id + '-goal'}
                      placeholder="🎯 Click to add a sprint goal..."
                      onBlur={e => { if (e.target.value !== (selectedSprint.goal || '')) patchSprint('goal', e.target.value); }}
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                      onFocus={e => { e.target.style.borderColor = 'var(--accent-purple)'; e.target.style.background = 'var(--bg-secondary)'; }}
                      onBlurCapture={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
                      title="Click to edit sprint goal"
                    />
                  ) : selectedSprint.goal ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>🎯 {selectedSprint.goal}</div>
                  ) : null}

                  {/* Start & End dates — always visible, editable */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📅 Start:</span>
                    {canManage && selectedSprint.status !== 'completed' ? (
                      <input
                        type="date"
                        style={{
                          fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                          borderRadius: 5, color: selectedSprint.start_date ? 'var(--accent-purple)' : 'var(--text-muted)',
                          padding: '2px 6px', cursor: 'pointer',
                        }}
                        defaultValue={selectedSprint.start_date || ''}
                        key={selectedSprint.id + '-start'}
                        onChange={e => patchSprint('start_date', e.target.value)}
                        title="Sprint start date"
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--accent-purple)' }}>{selectedSprint.start_date ? new Date(selectedSprint.start_date).toLocaleDateString() : 'Not set'}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>End:</span>
                    {canManage && selectedSprint.status !== 'completed' ? (
                      <input
                        type="date"
                        style={{
                          fontSize: 11, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                          borderRadius: 5, color: selectedSprint.end_date ? 'var(--accent-purple)' : 'var(--text-muted)',
                          padding: '2px 6px', cursor: 'pointer',
                        }}
                        defaultValue={selectedSprint.end_date || ''}
                        key={selectedSprint.id + '-end'}
                        onChange={e => patchSprint('end_date', e.target.value)}
                        title="Sprint end date"
                      />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--accent-purple)' }}>{selectedSprint.end_date ? new Date(selectedSprint.end_date).toLocaleDateString() : 'Not set'}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {canManage && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {selectedSprint.status === 'planning' && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleStartSprint(selectedSprint)}>▶ Start Sprint</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSprint(selectedSprint)}>Delete</button>
                      </>
                    )}
                    {selectedSprint.status === 'active' && (
                      <button className="btn btn-sm" style={{ background: '#10b981', color: '#fff', border: 'none' }} onClick={() => openCompleteModal(selectedSprint)}>
                        🏁 Complete Sprint
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${projectId}/board`)}>Board →</button>
                  </div>
                )}
              </div>

              {/* Hours progress bar */}
              {totalHours > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                    <span>{doneHours}h / {totalHours}h completed</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${progressPct}%`, background: '#10b981', borderRadius: 99, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                {sprintTasks.length} tasks · {totalHours}h estimated
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select a sprint above to view and plan its tasks.</span>
            </div>
          )}

          {/* Sprint task drop zone */}
          <div
            style={{
              flex: 1, overflowY: 'auto', padding: '10px 14px',
              background: dragOverSide === 'sprint' ? 'rgba(16,185,129,0.04)' : 'transparent',
              transition: 'background 0.2s',
            }}
            onDragOver={e => { e.preventDefault(); setDragOverSide('sprint'); }}
            onDragLeave={() => setDragOverSide(null)}
            onDrop={handleDropOnSprint}
          >
            {!selectedSprint ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📌</div>
                <div>Select or create a sprint to start planning</div>
              </div>
            ) : sprintTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: 10, margin: '8px 4px' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📥</div>
                <div style={{ fontWeight: 500 }}>Drag tasks here from the Project Backlog</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Or create tasks directly on the Board page</div>
              </div>
            ) : sprintTasks.map(t => (
              <BacklogTaskRow key={t.id} task={t} navigate={navigate} onDragStart={handleDragStart} side="sprint" />
            ))}
          </div>
        </div>
      </div>

      {showCreateSprint && (
        <CreateSprintModal
          projectId={projectId}
          onClose={() => setShowCreateSprint(false)}
          onCreated={sprint => {
            setSprints(p => [...p, { ...sprint, task_count: 0, total_hours: 0 }]);
            setSelectedSprintId(sprint.id);
            setShowCreateSprint(false);
          }}
        />
      )}

      {completeTarget && (
        <CompleteSprintModal
          sprint={completeTarget}
          incompleteCount={incompleteCount}
          onClose={() => setCompleteTarget(null)}
          onConfirm={handleCompleteSprint}
          loading={completeLoading}
        />
      )}
    </div>
  );
}
