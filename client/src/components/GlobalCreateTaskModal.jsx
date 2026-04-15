import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TYPE_META } from './TaskCard.jsx';
import api from '../api.js';

const PARENT_RULES = {
  epic:    [],
  story:   ['epic'],
  task:    ['epic', 'story'],
  subtask: ['task', 'story'],
  bug:     ['epic', 'story', 'task'],
};

export default function GlobalCreateTaskModal({ onClose }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('task');
  const [priority, setPriority] = useState('medium');
  const [parentId, setParentId] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  // Load projects on mount
  useEffect(() => {
    api.get('/projects')
      .then(res => {
        setProjects(res.data);
        if (res.data.length > 0) setProjectId(String(res.data[0].id));
      })
      .catch(() => setError('Failed to fetch projects'))
      .finally(() => setLoadingProjects(false));
  }, []);

  // Load tasks for selected project (for parent dropdown)
  useEffect(() => {
    if (!projectId) { setProjectTasks([]); return; }
    setLoadingTasks(true);
    api.get(`/tasks?projectId=${projectId}`)
      .then(r => setProjectTasks(r.data))
      .catch(() => setProjectTasks([]))
      .finally(() => setLoadingTasks(false));
  }, [projectId]);

  // Reset parent when type changes to incompatible
  const handleTypeChange = (newType) => {
    const allowed = PARENT_RULES[newType] || [];
    const currentParent = projectTasks.find(t => String(t.id) === String(parentId));
    if (!currentParent || !allowed.includes(currentParent.task_type)) setParentId('');
    setTaskType(newType);
  };

  const handleProjectChange = (pid) => {
    setProjectId(pid);
    setParentId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId) return setError('Please select a project');
    if (taskType === 'subtask' && !parentId) return setError('Subtasks must have a parent Task or Story selected.');
    setSubmitLoading(true);
    setError('');
    try {
      const { data } = await api.post('/tasks', {
        projectId,
        title,
        description,
        task_type: taskType,
        priority,
        parentId: parentId || null,
        status: 'backlog'
      });
      navigate(`/projects/${projectId}/tasks/${data.key_prefix}-${data.task_number}`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create issue');
      setSubmitLoading(false);
    }
  };

  const allowedParentTypes = PARENT_RULES[taskType] || [];
  const hasParent = allowedParentTypes.length > 0;
  const parentCandidates = projectTasks.filter(t => allowedParentTypes.includes(t.task_type));

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">Create Issue</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loadingProjects ? (
          <div className="loading-spinner" style={{ margin: '30px auto' }} />
        ) : projects.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            You must be a member of a project to create an issue.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}

            {/* Issue type buttons */}
            <div className="form-group">
              <label className="form-label">Issue Type</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(TYPE_META).map(([key, { icon, label }]) => (
                  <button
                    key={key} type="button"
                    className={`btn btn-sm ${taskType === key ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleTypeChange(key)}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Project */}
            <div className="form-group">
              <label className="form-label">Project</label>
              <select className="form-select" value={projectId} onChange={e => handleProjectChange(e.target.value)} required>
                <option value="" disabled>Select project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.key_prefix})</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                className="form-input"
                placeholder="Summarize the issue..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Add more details..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Priority + Parent in a grid */}
            <div style={{ display: 'grid', gridTemplateColumns: hasParent ? '1fr 1fr' : '1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>

              {/* Parent selector */}
              {hasParent && (
                <div className="form-group">
                  <label className="form-label">
                    Parent {allowedParentTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' / ')}
                    {taskType === 'subtask' && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                  </label>
                  {loadingTasks ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading issues…</div>
                  ) : parentCandidates.length === 0 ? (
                    <div style={{
                      padding: '8px 12px', borderRadius: 6, fontSize: 12,
                      background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                      border: '1px solid rgba(245,158,11,0.2)',
                    }}>
                      No {allowedParentTypes.join('/')} issues in this project yet.
                    </div>
                  ) : (
                    <select
                      className="form-select"
                      value={parentId}
                      onChange={e => setParentId(e.target.value)}
                      required={taskType === 'subtask'}
                    >
                      <option value="">{taskType === 'subtask' ? '— Select parent —' : '— None (top-level) —'}</option>
                      {parentCandidates.map(t => {
                        const tm = TYPE_META[t.task_type];
                        return (
                          <option key={t.id} value={t.id}>
                            {tm?.icon} {t.key_prefix}-{t.task_number}: {t.title.slice(0, 35)}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                {submitLoading ? 'Creating…' : `Create ${TYPE_META[taskType]?.label || 'Issue'}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
