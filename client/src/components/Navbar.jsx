import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import GlobalCreateTaskModal from './GlobalCreateTaskModal.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import { socket } from '../socket.js';
import { useNavbar } from '../contexts/NavbarContext.jsx';

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function Dropdown({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="nav-dropdown-container" ref={ref}>
      <button className="navbar-nav-link" onClick={() => setOpen(!open)}>
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4 }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="nav-dropdown-menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { projectName, onBack } = useNavbar();
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);
  const [showGlobalCreate, setShowGlobalCreate] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => {
    // Initiate connection on auth mount
    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <Link to="/home" className="navbar-brand">
            <div className="navbar-brand-icon">⚡</div>
            <span className="navbar-brand-name">TeamFlow</span>
          </Link>

          {projectName && (
            <div className="navbar-breadcrumb">
              <span className="navbar-sep">/</span>
              {onBack ? (
                <button className="navbar-back-breadcrumb" onClick={onBack} title="Back to board">
                  {projectName}
                </button>
              ) : (
                <span className="navbar-project-name-breadcrumb">{projectName}</span>
              )}
            </div>
          )}

          <div className="navbar-main-links" style={{ marginLeft: 24, paddingLeft: 24, borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
            <Link to="/analytics" className="navbar-nav-link">Dashboards</Link>
            
            <Dropdown label="Projects">
              <button className="user-dropdown-item" onClick={() => navigate('/projects/all')}>
                🌍 All Projects directory
              </button>
              {/* Show Backlog link when on a project page */}
              {location.pathname.match(/\/projects\/(\.+?)\//) && (() => {
                const match = location.pathname.match(/\/projects\/([^/]+)/);
                const pid = match?.[1];
                if (!pid || pid === 'all') return null;
                return (
                  <button className="user-dropdown-item" onClick={() => navigate(`/projects/${pid}/backlog`)}>
                    📋 Project Backlog & Sprints
                  </button>
                );
              })()}
            </Dropdown>

            <Dropdown label="Issues">
              <button className="user-dropdown-item" onClick={() => navigate('/issues?tab=created')}>
                🙋‍♂️ Created By Me
              </button>
              <button className="user-dropdown-item" onClick={() => navigate('/issues?tab=search')}>
                🔍 Search for Issues
              </button>
            </Dropdown>

            <button className="btn btn-primary btn-sm" style={{ marginLeft: 16 }} onClick={() => setShowGlobalCreate(true)}>
              Create Issue
            </button>
          </div>


          {!isConnected && (
            <div style={{ marginLeft: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>Reconnecting...</span>
            </div>
          )}
        </div>

        <div className="navbar-spacer" />

        <div className="navbar-actions" style={{ gap: 16 }}>
          <div className="navbar-search-trigger" onClick={() => setShowGlobalSearch(true)}>
            <span className="search-trigger-icon">🔍</span>
            <span className="search-trigger-text">Search...</span>
            <span className="search-trigger-key">⌘K</span>
          </div>

          <div className="user-dropdown-container" ref={userDropdownRef}>
            <div className="user-chip clickable-chip" onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} title="Menu">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="avatar" className="user-avatar" style={{ objectFit: 'cover' }} />
              ) : (
                <div className="user-avatar" style={{ background: user?.avatar_color }}>
                  {initials(user?.name)}
                </div>
              )}
              <div className="user-chip-info">
                <div className="user-chip-name">{user?.name}</div>
                <div className="user-chip-role">{user?.role}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ marginLeft: 4 }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </div>

            {isUserDropdownOpen && (
              <div className="user-dropdown-menu">
                <button className="user-dropdown-item" onClick={() => { setIsUserDropdownOpen(false); navigate('/profile'); }}>
                  <span className="user-dropdown-icon">👤</span> My Profile
                </button>
                {(isAdmin || user?.role === 'lead') && (
                  <button className="user-dropdown-item" onClick={() => { setIsUserDropdownOpen(false); navigate('/admin'); }}>
                    <span className="user-dropdown-icon">⚙️</span> Management
                  </button>
                )}
                <div className="user-dropdown-divider"></div>
                <button className="user-dropdown-item text-danger" onClick={handleLogout}>
                  <span className="user-dropdown-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                    </svg>
                  </span>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {showGlobalCreate && (
        <GlobalCreateTaskModal onClose={() => setShowGlobalCreate(false)} />
      )}

      {showGlobalSearch && (
        <GlobalSearch onClose={() => setShowGlobalSearch(false)} />
      )}
    </>
  );
}
