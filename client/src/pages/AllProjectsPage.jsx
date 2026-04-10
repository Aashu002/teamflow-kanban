import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { useNavbar } from '../contexts/NavbarContext.jsx';

export default function AllProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setHeaderData, clearHeaderData } = useNavbar();

  const loadProjects = () => {
    api.get('/projects/all-directory').then(res => {
      setProjects(res.data);
    }).catch(() => toast({ message: 'Failed to load projects', type: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { 
    loadProjects(); 
    setHeaderData({ projectName: 'Projects Directory' });
    return () => clearHeaderData();
  }, [setHeaderData, clearHeaderData]);

  const handleJoin = async (id) => {
    try {
      await api.post(`/projects/${id}/requests`);
      toast({ message: 'Join request sent!', type: 'success' });
      setProjects(prev => prev.map(p => p.id === id ? { ...p, request_status: 'pending' } : p));
    } catch {
      toast({ message: 'Failed to send request', type: 'error' });
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-section-header" style={{ marginBottom: 12 }}>
          <div>
            <div className="admin-section-title">All Projects Directory</div>
            <div className="admin-section-sub">Browse and join open projects in the workspace</div>
          </div>
        </div>

        <div className="divider" />

        {loading ? <div className="loading-spinner" style={{ margin: '40px auto' }} /> : (
          <div className="dash-projects-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {projects.length === 0 && <p className="text-muted">No projects found.</p>}
            {projects.map(p => (
              <div key={p.id} className="dash-project-card" style={{ cursor: 'default' }}>
                <div className="dash-proj-top">
                  <div className="dash-proj-icon">{p.key_prefix?.slice(0, 2) || '📁'}</div>
                  <span className="task-id" style={{ color: 'var(--accent-purple)' }}>{p.key_prefix}</span>
                </div>
                <div className="dash-proj-name">{p.name}</div>
                {p.description && <div className="dash-proj-desc">{p.description}</div>}
                
                <div className="dash-proj-meta" style={{ marginTop: 'auto', paddingTop: 16 }}>
                  <span>👑 Owner: {p.owner_name || 'System'}</span>
                </div>
                
                <div className="divider" style={{ margin: '16px 0' }} />
                
                {p.is_member ? (
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => navigate(`/projects/${p.id}/board`)}>
                    Go to Board
                  </button>
                ) : p.request_status === 'pending' ? (
                  <button className="btn btn-secondary" style={{ width: '100%', opacity: 0.7 }} disabled>
                    Request Pending
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleJoin(p.id)}>
                    Request to Join
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
