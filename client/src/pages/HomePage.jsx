import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { TYPE_META } from '../components/TaskCard.jsx';
import { COLUMNS } from './BoardPage.jsx';
import api from '../api.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function timeAgo(dt) {
  if (!dt) return '';
  const diff = (Date.now() - new Date(dt)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name?.split(' ')[0]}! 👋`;
}

const PRIORITY_CONFIG = {
  high:   { icon: '🔴', label: 'High Priority',   bg: 'rgba(239,68,68,0.09)',   border: 'rgba(239,68,68,0.25)',   text: '#f87171' },
  medium: { icon: '🟡', label: 'Medium Priority', bg: 'rgba(245,158,11,0.09)', border: 'rgba(245,158,11,0.25)', text: '#fbbf24' },
  low:    { icon: '🟢', label: 'Low Priority',    bg: 'rgba(34,197,94,0.09)',  border: 'rgba(34,197,94,0.25)',  text: '#4ade80' },
};

const STATUS_COLORS = {
  open:         '#3b82f6',
  gathering:    '#8b5cf6',
  inprogress:   '#f59e0b',
  qa_testing:   '#ec4899',
  qa_completed: '#22c55e',
  stakeholder:  '#f97316',
  done:         '#15803d',
};

// ─── Donut Chart ─────────────────────────────────────────────────────────────

function DonutChart({ statusCounts = [], totalTickets = 0 }) {
  const [selected, setSelected] = useState(null);

  // Build segments from the 8 known columns
  const data = COLUMNS.map(col => ({
    id:    col.id,
    label: col.label,
    color: col.color,
    count: statusCounts.find(s => s.status === col.id)?.count || 0,
  })).filter(d => d.count > 0);

  const total = data.reduce((s, d) => s + d.count, 0) || 1;

  // SVG donut math
  const cx = 100, cy = 100, outerR = 88, innerR = 54;

  const segments = (() => {
    let angle = -Math.PI / 2;
    return data.map(d => {
      const sweep = (d.count / total) * 2 * Math.PI;
      const start = angle;
      const end   = angle + sweep;
      angle = end;

      const cos = (a) => Math.cos(a);
      const sin = (a) => Math.sin(a);
      const large = sweep > Math.PI ? 1 : 0;

      const ox1 = cx + outerR * cos(start), oy1 = cy + outerR * sin(start);
      const ox2 = cx + outerR * cos(end),   oy2 = cy + outerR * sin(end);
      const ix1 = cx + innerR * cos(end),   iy1 = cy + innerR * sin(end);
      const ix2 = cx + innerR * cos(start), iy2 = cy + innerR * sin(start);

      const path = `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`;

      // Label position (mid-angle)
      const mid = start + sweep / 2;
      const lx = cx + (outerR + 14) * cos(mid);
      const ly = cy + (outerR + 14) * sin(mid);

      return { ...d, path, sweep, lx, ly };
    });
  })();

  const sel = selected ? data.find(d => d.id === selected) : null;

  const handleClick = (id) => setSelected(prev => prev === id ? null : id);

  return (
    <div className="donut-chart-wrap">
      {/* Chart + Legend side by side */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>

        {/* SVG Donut */}
        <div style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 200 200" width={190} height={190} style={{ overflow: 'visible' }}>
            {data.length === 0 ? (
              <>
                <circle cx={cx} cy={cy} r={outerR} fill="rgba(255,255,255,0.04)" stroke="var(--border)" strokeWidth="1"/>
                <circle cx={cx} cy={cy} r={innerR} fill="var(--bg-card)"/>
                <text x={cx} y={cy + 5} textAnchor="middle" fill="rgba(148,163,184,0.5)" fontSize="12">No data</text>
              </>
            ) : (
              <>
                {segments.map((seg, i) => {
                  const isSelected = selected === seg.id;
                  const dimmed     = selected && !isSelected;
                  // Slightly "pop" the selected segment outward
                  const midAngle   = -Math.PI / 2 + segments.slice(0, i).reduce((s, sg) => s + sg.sweep, 0) + seg.sweep / 2;
                  const tx = isSelected ? Math.cos(midAngle) * 6 : 0;
                  const ty = isSelected ? Math.sin(midAngle) * 6 : 0;
                  return (
                    <g key={seg.id}
                      onClick={() => handleClick(seg.id)}
                      style={{ cursor: 'pointer', transform: `translate(${tx}px,${ty}px)`, transition: 'transform 0.2s ease' }}
                    >
                      <path
                        d={seg.path}
                        fill={seg.color}
                        opacity={dimmed ? 0.25 : 0.92}
                        stroke="var(--bg-card)"
                        strokeWidth="2"
                        style={{ transition: 'opacity 0.2s' }}
                      />
                    </g>
                  );
                })}

                {/* Donut hole — centre text */}
                <circle cx={cx} cy={cy} r={innerR - 1} fill="var(--bg-card)"/>
                <text x={cx} y={cy - 10} textAnchor="middle" fontSize="24" fontWeight="800"
                  fill={sel ? sel.color : 'var(--text-primary)'}>
                  {sel ? sel.count : totalTickets}
                </text>
                <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9.5" fontWeight="600"
                  fill="rgba(148,163,184,0.75)" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {sel ? 'issues' : 'total'}
                </text>
                <text x={cx} y={cy + 22} textAnchor="middle" fontSize="8.5"
                  fill="rgba(148,163,184,0.55)">
                  {sel ? sel.label : 'across all projects'}
                </text>
              </>
            )}
          </svg>
        </div>

        {/* Legend */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          {data.map(d => {
            const pct = Math.round((d.count / total) * 100);
            const isSelected = selected === d.id;
            return (
              <div
                key={d.id}
                onClick={() => handleClick(d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
                  background: isSelected ? d.color + '18' : 'transparent',
                  border: `1px solid ${isSelected ? d.color + '50' : 'transparent'}`,
                  transition: 'all 0.15s',
                  opacity: selected && !isSelected ? 0.45 : 1,
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }}/>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.label}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: d.color, flexShrink: 0 }}>{d.count}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 28, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
              </div>
            );
          })}
          {data.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tickets yet.</p>
          )}
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 11 }}
            >
              ✕ Clear selection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── All Tasks Modal ──────────────────────────────────────────────────────────

function AllTasksModal({ tasks = [], defaultPriority = 'all', onClose }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState({ priority: defaultPriority, status: 'all', type: 'all' });

  const filtered = tasks.filter(t => {
    if (filter.priority !== 'all' && t.priority !== filter.priority) return false;
    if (filter.status  !== 'all' && t.status    !== filter.status)   return false;
    if (filter.type    !== 'all' && t.task_type  !== filter.type)     return false;
    return true;
  });

  const open = (t) => { navigate(`/projects/${t.project_id}/tasks/${t.key_prefix}-${t.task_number}`); onClose(); };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 920, width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">My Assigned Tickets</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {filtered.length} of {tasks.length} tickets
              {filter.priority !== 'all' && (
                <span style={{ color: PRIORITY_CONFIG[filter.priority]?.text, marginLeft: 6 }}>
                  · {filter.priority} priority
                </span>
              )}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <select className="board-filter-select" value={filter.priority}
            onChange={e => setFilter(p => ({ ...p, priority: e.target.value }))}>
            <option value="all">All Priorities</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
          <select className="board-filter-select" value={filter.status}
            onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
            <option value="all">All Statuses</option>
            {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select className="board-filter-select" value={filter.type}
            onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}>
            <option value="all">All Types</option>
            {Object.entries(TYPE_META).map(([k, { icon, label }]) => (
              <option key={k} value={k}>{icon} {label}</option>
            ))}
          </select>
          {filter.priority !== 'all' && (
            <button className="btn btn-ghost btn-sm"
              onClick={() => setFilter(p => ({ ...p, priority: 'all' }))}>
              ✕ Clear priority filter
            </button>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table className="data-table" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 90 }}/><col/><col style={{ width: 140 }}/>
              <col style={{ width: 90 }}/><col style={{ width: 90 }}/><col style={{ width: 140 }}/>
            </colgroup>
            <thead>
              <tr><th>ID</th><th>Title</th><th>Project</th><th>Type</th><th>Priority</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
                  No tickets match the current filters
                </td></tr>
              )}
              {filtered.map(t => {
                const col = COLUMNS.find(c => c.id === t.status);
                const tm  = TYPE_META[t.task_type] || TYPE_META.task;
                const pri = PRIORITY_CONFIG[t.priority];
                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => open(t)}>
                    <td><span className="task-id" style={{ color: 'var(--accent-purple)' }}>{t.key_prefix}-{t.task_number}</span></td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.project_name}</td>
                    <td><span className={`type-badge type-${t.task_type}`}>{tm.icon} {tm.label}</span></td>
                    <td><span className={`priority-badge priority-${t.priority}`}>{pri?.icon} {t.priority}</span></td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[t.status] || 'var(--text-muted)', background: (STATUS_COLORS[t.status] || '#475569') + '20', padding: '2px 8px', borderRadius: 4 }}>
                        {col?.label || t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const { toast }         = useToast();
  const navigate          = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [ticketFilter, setTicketFilter] = useState(null); // null=closed

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/dashboard');
      setData(d);
    } catch { toast({ message: 'Failed to load dashboard', type: 'error' }); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;

  const {
    projects = [], myTasks = [], activity = [],
    stats = {}, statusCounts = [], totalTickets = 0,
  } = data || {};

  const myOpenTasks = myTasks.filter(t => t.status !== 'done');
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="dashboard-page">
      <div className="dashboard-content">

        {/* ── Hero ── */}
        <div className="dashboard-hero">
          <div className="dashboard-hero-left">
            <h2 className="dashboard-greeting">{greeting(user?.name)}</h2>
            <p className="dashboard-date">{today}</p>
            <p className="dashboard-sub">
              You have{' '}
              <strong style={{ color: stats.high > 0 ? '#f87171' : 'var(--text-primary)' }}>
                {stats.high || 0} high-priority
              </strong>{' '}
              and <strong>{stats.total || 0} open</strong> tickets assigned.
            </p>
          </div>
          <div className="dashboard-hero-stats">
            {[
              { num: projects.length,      label: 'Projects' },
              { num: stats.total    || 0,  label: 'Open'     },
              { num: totalTickets   || 0,  label: 'Total',   color: '#a78bfa' },
              { num: stats.completed || 0, label: 'Done',    color: '#4ade80' },
            ].map(s => (
              <div key={s.label} className="hero-stat-pill">
                <span className="hero-stat-num" style={s.color ? { color: s.color } : {}}>{s.num}</span>
                <span className="hero-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══ ROW 1 (equal height): My Projects | Recent Activity ══ */}
        <div className="dash-dual-grid dash-dual-grid--stretch" style={{ marginBottom: 24 }}>

          {/* My Projects */}
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">
                📁 My Projects
                <span className="dash-section-count">{projects.length}</span>
              </h3>
            </div>
            <div className="dash-panel-projects-body">
              <div className="dash-projects-row">
                {projects.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {isAdmin
                      ? 'No projects yet. Create one from the Admin panel.'
                      : 'No projects assigned. Ask an admin to add you.'}
                  </p>
                )}
                {projects.map((p, i) => {
                  const pct = p.task_count > 0 ? Math.round((p.done_count / p.task_count) * 100) : 0;
                  return (
                    <div key={p.id} className="dash-project-card"
                      style={{ animationDelay: `${i * 55}ms` }}
                      onClick={() => navigate(`/projects/${p.id}/board`)}>
                      <div className="dash-proj-top">
                        <div className="dash-proj-icon">{p.key_prefix?.slice(0, 2) || '📁'}</div>
                        <span className="task-id" style={{ color: 'var(--accent-purple)' }}>{p.key_prefix}</span>
                      </div>
                      <div className="dash-proj-name">{p.name}</div>
                      {p.description && <div className="dash-proj-desc">{p.description}</div>}
                      <div className="dash-proj-meta">
                        <span>🗂 {p.task_count} issues</span>
                        <span>👥 {p.member_count} members</span>
                      </div>
                      <div className="dash-proj-progress">
                        <div className="dash-proj-progress-bar">
                          <div className="dash-proj-progress-fill" style={{ width: `${pct}%` }}/>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="dash-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">⚡ Recent Activity</h3>
            </div>
            <div className="activity-feed" style={{ flex: 1 }}>
              {activity.length === 0 && (
                <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                  No recent activity yet.
                </div>
              )}
              {activity.map(item => (
                <div key={item.id} className="activity-item"
                  style={{ cursor: item.task_id ? 'pointer' : 'default' }}
                  onClick={() => item.project_id && item.task_id &&
                    navigate(`/projects/${item.project_id}/tasks/${item.task_id}`)}>
                  <div className="activity-avatar" style={{ background: item.actor_color || '#7c3aed' }}>
                    {initials(item.actor_name)}
                  </div>
                  <div className="activity-body">
                    <div className="activity-text">
                      <strong>{item.actor_name}</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    </div>
                    <div className="activity-detail">{item.detail}</div>
                    <div className="activity-meta">
                      <span style={{ color: 'var(--accent-purple)', fontSize: 11 }}>{item.project_name}</span>
                      <span>·</span>
                      <span>{timeAgo(item.time)}</span>
                    </div>
                  </div>
                  <div className="activity-type-icon">{item.type === 'comment' ? '💬' : '📝'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ ROW 2 (equal height): My Tickets | Ticket Status Pie Chart ══ */}
        <div className="dash-dual-grid dash-dual-grid--stretch">

          {/* My Assigned Tickets */}
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">
                🎫 My Assigned Tickets
                <span className="dash-section-count">{myOpenTasks.length} open</span>
              </h3>
              <button className="btn btn-secondary btn-sm"
                onClick={() => setTicketFilter('all')} style={{ fontSize: 12 }}>
                View All ({myTasks.length}) →
              </button>
            </div>

            {/* Priority stat cards */}
            <div className="ticket-stats-row">
              {['high', 'medium', 'low'].map(pri => {
                const cfg = PRIORITY_CONFIG[pri];
                return (
                  <div key={pri} className="ticket-stat-card"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, cursor: 'pointer' }}
                    onClick={() => setTicketFilter(pri)}>
                    <div className="ticket-stat-icon">{cfg.icon}</div>
                    <div className="ticket-stat-num" style={{ color: cfg.text }}>{stats[pri] || 0}</div>
                    <div className="ticket-stat-label">{cfg.label}</div>
                  </div>
                );
              })}
              <div className="ticket-stat-card"
                style={{ background: 'rgba(124,58,237,0.09)', border: '1px solid rgba(124,58,237,0.22)', cursor: 'pointer' }}
                onClick={() => setTicketFilter('all')}>
                <div className="ticket-stat-icon">📋</div>
                <div className="ticket-stat-num" style={{ color: '#a78bfa' }}>{stats.total || 0}</div>
                <div className="ticket-stat-label">Total Open</div>
              </div>
            </div>

            {/* Preview list */}
            <div className="ticket-preview-list">
              {myOpenTasks.slice(0, 6).map(t => {
                const tm  = TYPE_META[t.task_type] || TYPE_META.task;
                const pri = PRIORITY_CONFIG[t.priority];
                const col = COLUMNS.find(c => c.id === t.status);
                return (
                  <div key={t.id} className="ticket-preview-item"
                    onClick={() => navigate(`/projects/${t.project_id}/tasks/${t.key_prefix}-${t.task_number}`)}>
                    <span className="ticket-preview-type">{tm.icon}</span>
                    <div className="ticket-preview-body">
                      <div className="ticket-preview-title">{t.title}</div>
                      <div className="ticket-preview-meta">
                        <span className="task-id">{t.key_prefix}-{t.task_number}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>·</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t.project_name}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      <span className={`priority-badge priority-${t.priority}`} style={{ fontSize: 10 }}>
                        {pri?.icon} {t.priority}
                      </span>
                      <span style={{ fontSize: 10, color: STATUS_COLORS[t.status] || 'var(--text-muted)', fontWeight: 600 }}>
                        {col?.label || t.status}
                      </span>
                    </div>
                  </div>
                );
              })}
              {myOpenTasks.length === 0 && (
                <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  🎉 No open tickets assigned to you!
                </div>
              )}
              {myOpenTasks.length > 6 && (
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setTicketFilter('all')}
                  style={{ width: '100%', padding: '10px', color: 'var(--accent-purple)' }}>
                  + {myOpenTasks.length - 6} more · View All →
                </button>
              )}
            </div>
          </div>

          {/* Project Ticket Status — Donut Chart */}
          <div className="dash-panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">
                🥧 Issues by Status
                <span className="dash-section-count">{totalTickets} total</span>
              </h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, marginTop: -8 }}>
              All tickets across your projects · Click a segment to inspect
            </p>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <DonutChart statusCounts={statusCounts} totalTickets={totalTickets} />
            </div>
          </div>
        </div>

      </div>

      {/* Assigned Tickets Modal */}
      {ticketFilter !== null && (
        <AllTasksModal
          tasks={myTasks}
          defaultPriority={ticketFilter}
          onClose={() => setTicketFilter(null)}
        />
      )}
    </div>
  );
}
