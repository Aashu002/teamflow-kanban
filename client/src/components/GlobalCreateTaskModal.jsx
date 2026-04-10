import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';

export default function GlobalCreateTaskModal({ onClose }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('task');
  const [priority, setPriority] = useState('medium');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/projects').then(res => {
      setProjects(res.data);
      if (res.data.length > 0) setProjectId(res.data[0].id);
    }).catch(err => {
      setError('Failed to fetch projects');
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId) return setError('Please select a project');
    setSubmitLoading(true);
    setError('');
    try {
      const { data } = await api.post('/tasks', {
        projectId: projectId,
        title,
        description,
        task_type: taskType,
        priority,
        status: 'backlog'
      });
      navigate(`/projects/${projectId}/tasks/${data.key_prefix}-${data.task_number}`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create issue');
      setSubmitLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Create Global Issue</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        {loading ? (
          <div className="loading-spinner" style={{ margin: '30px auto' }} />
        ) : projects.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            You must be a member of a project to create an issue.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            
            <div className="form-group">
              <label className="form-label">Project</label>
              <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)} required>
                <option value="" disabled>Select project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.key_prefix})</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" placeholder="Summarize the issue..." value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" placeholder="Add more details..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Issue Type</label>
                <select className="form-select" value={taskType} onChange={e => setTaskType(e.target.value)}>
                  <option value="epic">⚡ Epic</option>
                  <option value="story">📖 Story</option>
                  <option value="task">✅ Task</option>
                  <option value="bug">🐛 Bug</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Priority</label>
                <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                {submitLoading ? 'Creating...' : 'Create '}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
