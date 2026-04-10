import React, { useState } from 'react';
import api from '../api.js';

export default function CreateProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', estimated_completion_date: '', project_goal: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

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
          <span className="modal-title">New Project</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input id="proj-name" name="name" className="form-input" placeholder="e.g. Website Redesign" value={form.name} onChange={handle} required autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea id="proj-desc" name="description" className="form-textarea" placeholder="Brief overview of this project…" value={form.description} onChange={handle} />
          </div>
          <div className="form-group">
            <label className="form-label">Project Goal</label>
            <textarea name="project_goal" className="form-textarea" placeholder="What is the main objective of this project?" value={form.project_goal} onChange={handle} rows="2" />
          </div>
          <div className="form-group">
            <label className="form-label">Target Launch Date</label>
            <input type="date" name="estimated_completion_date" className="form-input" value={form.estimated_completion_date} onChange={handle} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            You can add team members from the Admin panel after creating the project.
          </p>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="proj-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
