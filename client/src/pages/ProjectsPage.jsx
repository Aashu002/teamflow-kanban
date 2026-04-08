import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import CreateProjectModal from '../components/CreateProjectModal.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api.js';

export default function ProjectsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    api.get('/projects').then(r => setProjects(r.data)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this project and all its tasks?')) return;
    await api.delete(`/projects/${id}`);
    setProjects(p => p.filter(x => x.id !== id));
  };

  return (
    <div className="projects-page">
      <Navbar />
      <div className="projects-hero">
        <h2>Your Projects</h2>
        <p>{isAdmin ? 'Manage all projects and team members.' : 'View your assigned projects and their Kanban boards.'}</p>
        {isAdmin && (
          <div className="projects-hero-actions">
            <button id="create-project-btn" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + New Project
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="projects-grid">
          {[1,2,3].map(i => (
            <div key={i} className="project-card" style={{ height: 180 }}>
              <div className="skeleton" style={{ height: 40, width: 40, borderRadius: 10, marginBottom: 12 }}/>
              <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 8 }}/>
              <div className="skeleton" style={{ height: 14, width: '85%', marginBottom: 4 }}/>
              <div className="skeleton" style={{ height: 14, width: '70%' }}/>
            </div>
          ))}
        </div>
      ) : (
        <div className="projects-grid">
          {projects.length === 0 ? (
            <div className="projects-empty">
              <div className="projects-empty-icon">📋</div>
              <h3>{isAdmin ? 'No projects yet' : 'No projects assigned'}</h3>
              <p>{isAdmin ? 'Create your first project to get started.' : 'Ask your admin to add you to a project.'}</p>
            </div>
          ) : projects.map(p => (
            <div key={p.id} className="project-card" onClick={() => navigate(`/projects/${p.id}/board`)}>
              <div className="project-card-header">
                <div className="project-card-icon">📁</div>
                {isAdmin && (
                  <div className="project-card-menu">
                    <button id={`delete-project-${p.id}`} className="btn btn-ghost btn-icon btn-sm" onClick={e => handleDelete(e, p.id)} data-tip="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="project-card-name">{p.name}</div>
              <div className="project-card-desc">{p.description || 'No description provided.'}</div>
              <div className="project-card-stats">
                <div className="project-stat">
                  <span className="project-stat-value">{p.task_count}</span>
                  <span className="project-stat-label">tasks</span>
                </div>
                <div className="project-stat">
                  <span className="project-stat-value">{p.member_count}</span>
                  <span className="project-stat-label">members</span>
                </div>
                {p.owner_name && (
                  <div className="project-stat" style={{ marginLeft: 'auto' }}>
                    <span className="project-stat-label" style={{ color: 'var(--text-muted)' }}>by {p.owner_name}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={project => { setProjects(p => [project, ...p]); setShowCreate(false); }}
        />
      )}
    </div>
  );
}
