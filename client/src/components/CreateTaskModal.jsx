import React, { useState } from 'react';
import { COLUMNS } from '../pages/BoardPage.jsx';
import { TYPE_META } from './TaskCard.jsx';
import { useToast } from './Toast.jsx';
import api from '../api.js';

// Hierarchy rules: which types can be parents of which
const PARENT_RULES = {
  epic:    [],                           // epics have no parent
  story:   ['epic'],                     // stories live under epics
  task:    ['epic', 'story'],            // tasks live under epics or stories
  subtask: ['task', 'story'],            // subtasks live under tasks or stories
  bug:     ['epic', 'story', 'task'],    // bugs can sit under any of these
};

function parentLabel(type) {
  const allowed = PARENT_RULES[type] || [];
  if (!allowed.length) return null;
  const map = { epic: 'Epic', story: 'Story', task: 'Task' };
  return 'Parent ' + allowed.map(t => map[t]).join(' / ');
}

export default function CreateTaskModal({ defaultStatus, projectId, members, onClose, onCreated, allTasks = [], sprints = [], initialParentId, initialType }) {
  const { toast } = useToast();
  const activeSprint = sprints.find(s => s.status === 'active');
  const [form, setForm] = useState({
    title: '', description: '', status: defaultStatus || 'backlog',
    priority: 'medium', task_type: initialType || 'task', assigneeId: '', parentId: initialParentId || '',
    sprint_id: activeSprint?.id || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  // When changing type, reset parentId if its type is no longer valid
  const handleTypeChange = (newType) => {
    const allowed = PARENT_RULES[newType] || [];
    const currentParent = allTasks.find(t => String(t.id) === String(form.parentId));
    const parentStillValid = currentParent && allowed.includes(currentParent.task_type);
    setForm(p => ({ ...p, task_type: newType, parentId: parentStillValid ? p.parentId : '' }));
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate parent requirement
    const allowedParents = PARENT_RULES[form.task_type] || [];
    if (form.task_type === 'subtask' && !form.parentId) {
      setError('Subtasks must have a parent Task or Story.');
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.post('/tasks', {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        task_type: form.task_type,
        projectId,
        assigneeId: form.assigneeId || null,
        parentId: form.parentId || null,
        sprint_id: form.sprint_id || null,
      });

      onClose();
      if (onCreated) onCreated(data);

      toast({
        message: 'Issue created successfully',
        issueKey: `${data.key_prefix}-${data.task_number}`,
        projectId,
        taskId: data.id,
        type: 'success',
      });

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create issue. Please try again.');
      setLoading(false);
    }
  };

  const allowedParentTypes = PARENT_RULES[form.task_type] || [];
  const hasParent = allowedParentTypes.length > 0;
  const parentCandidates = allTasks.filter(t => allowedParentTypes.includes(t.task_type));
  const pLabel = parentLabel(form.task_type);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span className="modal-title">Create Issue</span>
          <button className="modal-close" onClick={onClose} id="create-task-close">✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          {/* Issue Type picker */}
          <div className="form-group">
            <label className="form-label">Issue Type</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(TYPE_META).map(([key, { icon, label }]) => (
                <button
                  key={key} type="button"
                  id={`type-${key}`}
                  className={`btn btn-sm ${form.task_type === key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleTypeChange(key)}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
            {/* Hierarchy hint */}
            {hasParent && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                {form.task_type === 'subtask' && '⚠ Subtasks must be linked to a parent Task or Story.'}
                {form.task_type === 'story' && '💡 Optionally link this Story to an Epic.'}
                {form.task_type === 'task' && '💡 Optionally link this Task to an Epic or Story.'}
                {form.task_type === 'bug' && '💡 Optionally link this Bug to an Epic, Story, or Task.'}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              id="task-title" name="title" className="form-input"
              placeholder="What needs to be done?"
              value={form.title} onChange={handle} required autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              id="task-desc" name="description" className="form-textarea"
              placeholder="Add details, acceptance criteria…"
              value={form.description} onChange={handle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Column</label>
              <select id="task-status" name="status" className="form-select" value={form.status} onChange={handle}>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select id="task-priority" name="priority" className="form-select" value={form.priority} onChange={handle}>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: hasParent ? '1fr 1fr' : '1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Assign To</label>
              <select id="task-assignee" name="assigneeId" className="form-select" value={form.assigneeId} onChange={handle}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {/* Parent selector — shown for all types except epic */}
            {hasParent && (
              <div className="form-group">
                <label className="form-label">
                  {pLabel}
                  {form.task_type === 'subtask' && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                </label>
                {parentCandidates.length === 0 ? (
                  <div style={{
                    padding: '8px 12px', borderRadius: 6, fontSize: 12,
                    background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    No {allowedParentTypes.join(' / ')} issues found in this project yet.
                  </div>
                ) : (
                  <select
                    id="task-parent"
                    name="parentId"
                    className="form-select"
                    value={form.parentId}
                    onChange={handle}
                    required={form.task_type === 'subtask'}
                    style={{ borderColor: form.task_type === 'subtask' && !form.parentId ? 'rgba(239,68,68,0.4)' : undefined }}
                  >
                    <option value="">
                      {form.task_type === 'subtask' ? '— Select parent —' : '— None (top-level) —'}
                    </option>
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

          {/* Sprint selector */}
          {sprints.length > 0 && (
            <div className="form-group">
              <label className="form-label">Sprint</label>
              <select id="task-sprint" name="sprint_id" className="form-select" value={form.sprint_id} onChange={handle}>
                <option value="">📋 Project Backlog (no sprint)</option>
                {sprints.filter(s => s.status !== 'completed').map(s => (
                  <option key={s.id} value={s.id}>
                    {s.status === 'active' ? '🟢' : '🟡'} {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="create-task-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Creating…</>
              ) : `Create ${TYPE_META[form.task_type]?.label || 'Issue'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
