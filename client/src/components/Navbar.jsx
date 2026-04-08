import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function Navbar({ projectName, onBack }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <nav className="navbar">
      {onBack ? (
        <>
          <button className="navbar-back" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Projects
          </button>
          <span className="navbar-sep">›</span>
          <span className="navbar-project-name">{projectName}</span>
        </>
      ) : (
        <Link to="/projects" className="navbar-brand">
          <div className="navbar-brand-icon">⚡</div>
          <span className="navbar-brand-name">TeamFlow</span>
        </Link>
      )}

      <div className="navbar-spacer" />

      <div className="navbar-actions">
        {isAdmin && (
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>
            ⚙️ Admin
          </button>
        )}
        <div className="user-chip">
          <div className="user-avatar" style={{ background: user?.avatar_color }}>
            {initials(user?.name)}
          </div>
          <div>
            <div className="user-chip-name">{user?.name}</div>
            <div className="user-chip-role">{user?.role}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={handleLogout} data-tip="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </div>
    </nav>
  );
}
