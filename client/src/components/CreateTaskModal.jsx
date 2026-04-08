import React, { useState } from 'react';
import { COLUMNS } from '../pages/BoardPage.jsx';
import { TYPE_META } from './TaskCard.jsx';
import { useToast } from './Toast.jsx';
import api from '../api.js';

export default function CreateTaskModal({ defaultStatus, projectId, members, onClose, onCreated, allTasks = [] }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: '', description: '', status: defaultStatus,
    priority: 'medium', task_type: 'task', assigneeId: '', parentId: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

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
      });

      // 1. Close dialog immediately
      onClose();

      // 2. Add task to board
      if (onCreated) onCreated(data);

      // 3. Fire toast with clickable issue ID
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

  const parentCandidates = allTasks.filter(t => t.task_type !== 'subtask');

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
                  onClick={() => setForm(p => ({ ...p, task_type: key }))}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: form.task_type === 'subtask' ? '1fr 1fr' : '1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Assign To</label>
              <select id="task-assignee" name="assigneeId" className="form-select" value={form.assigneeId} onChange={handle}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            {form.task_type === 'subtask' && (
              <div className="form-group">
                <label className="form-label">Parent Issue</label>
                <select id="task-parent" name="parentId" className="form-select" value={form.parentId} onChange={handle}>
                  <option value="">None</option>
                  {parentCandidates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.key_prefix}-{t.task_number}: {t.title.slice(0, 30)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="create-task-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Creating…</>
              ) : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
