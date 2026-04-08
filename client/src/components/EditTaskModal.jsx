import React, { useState } from 'react';
import { COLUMNS } from '../pages/BoardPage.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api.js';

export default function EditTaskModal({ task, members, onClose, onUpdated, onDeleted }) {
  const { user, isAdmin } = useAuth();
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    assigneeId: task.assignee_id ?? ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const save = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.patch(`/tasks/${task.id}`, {
        ...form, assigneeId: form.assigneeId || null
      });
      onUpdated(data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to update'); }
    finally { setLoading(false); }
  };

  const del = async () => {
    if (!confirm('Delete this task?')) return;
    setDeleting(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      onDeleted(task.id);
    } catch (err) { setError(err.response?.data?.error || 'Failed to delete'); setDeleting(false); }
  };

  const canDelete = isAdmin || task.creator_id === user?.id;

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Edit Task</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={save}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input id="edit-task-title" name="title" className="form-input" value={form.title} onChange={handle} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea id="edit-task-desc" name="description" className="form-textarea" value={form.description} onChange={handle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Column</label>
              <select id="edit-task-status" name="status" className="form-select" value={form.status} onChange={handle}>
                {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select id="edit-task-priority" name="priority" className="form-select" value={form.priority} onChange={handle}>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Assign To</label>
            <select id="edit-task-assignee" name="assigneeId" className="form-select" value={form.assigneeId} onChange={handle}>
              <option value="">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            Created by {task.creator_name || 'unknown'} · {new Date(task.created_at).toLocaleDateString()}
          </div>

          <div className="modal-footer">
            {canDelete && (
              <button type="button" id="delete-task-btn" className="btn btn-danger" onClick={del} disabled={deleting} style={{ marginRight: 'auto' }}>
                {deleting ? 'Deleting…' : '🗑 Delete'}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="save-task-btn" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
