import React, { useEffect, useState } from 'react';
import api from '../api.js';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Sector, ComposedChart, Line } from 'recharts';
import { TYPE_META } from '../components/TaskCard.jsx';
import { COLUMNS } from './BoardPage.jsx';
import { useNavigate } from 'react-router-dom';

function ChartModal({ filter, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get(`/tasks/search?${filter.key}=${filter.value}`).then(res => {
      setTasks(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filter]);

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 800, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{filter.label} Issues</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {tasks.length} found
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 10 }}>
          {loading ? (
             <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
          ) : tasks.length === 0 ? (
             <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No issues found.</div>
          ) : (
            <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 100 }}/><col/><col style={{ width: 100 }}/><col style={{ width: 100 }}/><col style={{ width: 120 }}/>
              </colgroup>
              <thead>
                <tr><th>ID</th><th>Title</th><th>Type</th><th>Priority</th><th>Assignee</th></tr>
              </thead>
              <tbody>
                {tasks.map(t => {
                  const tm = TYPE_META[t.task_type] || TYPE_META.task;
                  return (
                    <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${t.project_id}/tasks/${t.key_prefix}-${t.task_number}`)}>
                      <td><span className="task-id" style={{ color: 'var(--accent-purple)' }}>{t.key_prefix}-{t.task_number}</span></td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</td>
                      <td><span className={`type-badge type-${t.task_type}`}>{tm.icon} {tm.label}</span></td>
                      <td><span className={`priority-badge priority-${t.priority}`}>{t.priority}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.assignee_name || 'Unassigned'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartFilter, setChartFilter] = useState(null);
  
  // Filter States
  const [projectId, setProjectId] = useState('all');
  const [dateRangeType, setDateRangeType] = useState('7d'); // 7d, 30d, custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // Hover states for Pie charts
  const [activeIndexType, setActiveIndexType] = useState(null);
  const [activeIndexStatus, setActiveIndexStatus] = useState(null);
  const [activeIndexPriority, setActiveIndexPriority] = useState(null);

  const fetchData = (pId, rangeType, start, end) => {
    setLoading(true);
    let url = `/dashboard?projectId=${pId}`;
    
    let s = start;
    let e = end;

    if (rangeType === '7d') {
      const d = new Date();
      e = d.toISOString().split('T')[0];
      d.setDate(d.getDate() - 6);
      s = d.toISOString().split('T')[0];
    } else if (rangeType === '30d') {
      const d = new Date();
      e = d.toISOString().split('T')[0];
      d.setDate(d.getDate() - 29);
      s = d.toISOString().split('T')[0];
    }

    if (s && e) {
      url += `&startDate=${s}&endDate=${e}`;
    }

    api.get(url).then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    if (dateRangeType !== 'custom') {
      fetchData(projectId, dateRangeType);
    } else if (!customStart && !customEnd) {
      // First time selecting custom, maybe don't fetch yet or use defaults
      fetchData(projectId, dateRangeType);
    }
  }, [projectId, dateRangeType]);

  const handleCustomApply = () => {
    fetchData(projectId, 'custom', customStart, customEnd);
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner"/></div>;

  const { 
    burndown = [], hourStats = [], typeCounts = [], priorityCounts = [], statusCounts = [], stats = {}, totalTickets = 0,
    workloadStats = [], accuracyStats = [], agingTasks = [], projectBurndown = { data: [] }, projects = [], projectHealth = {}
  } = data || {};

  const burndownReady = projectBurndown && projectBurndown.data && projectBurndown.data.length > 0;

  const totalHours = hourStats.reduce((sum, h) => sum + h.total_hours, 0).toFixed(1);
  const completionRate = stats.totalAssigned > 0 ? Math.round((stats.completed / stats.totalAssigned) * 100) : 0;

  // Chart Colors
  const COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
  const PRIORITY_COLORS = { 'High': '#ef4444', 'Medium': '#f59e0b', 'Low': '#10b981' };

  // Map types for Pie Chart
  const typeData = typeCounts.map(t => ({
    name: TYPE_META[t.task_type]?.label || t.task_type,
    value: t.count,
    originalValue: t.task_type,
    filterKey: 'type'
  }));

  // Reformat priority data
  const priorityData = priorityCounts.map(p => ({
    name: p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
    value: p.count,
    originalValue: p.priority,
    filterKey: 'priority'
  }));

  // Map status data
  const statusData = statusCounts.map(s => {
    const col = COLUMNS.find(c => c.id === s.status);
    return {
      name: col ? col.label : s.status,
      value: s.count,
      color: col ? col.color : '#64748b',
      originalValue: s.status,
      filterKey: 'status'
    };
  });

  const handlePieClick = (dataInfo) => {
    let payload = dataInfo?.payload || dataInfo;
    if (payload && payload.filterKey && payload.originalValue) {
      setChartFilter({ key: payload.filterKey, value: payload.originalValue, label: payload.name });
    }
  };

  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <g style={{ filter: `drop-shadow(0px 0px 12px ${fill}99)` }}>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          stroke="none"
        />
      </g>
    );
  };

  return (
    <div className="page-layout" style={{ background: 'var(--bg-document)' }}>
      <style>{`
        .recharts-sector { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .filter-select { 
          background: var(--bg-surface); 
          border: 1px solid var(--border-color); 
          color: var(--text-primary); 
          padding: 10px 20px; 
          border-radius: 10px; 
          font-size: 13px; 
          font-weight: 600; 
          cursor: pointer; 
          outline: none; 
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9L12 15L18 9' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 36px;
        }
        .filter-select:hover { 
          border-color: var(--accent-purple); 
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
          transform: translateY(-1px);
        }
        .date-input { 
          background: var(--bg-surface); 
          border: 1px solid var(--border-color); 
          color: var(--text-primary); 
          padding: 8px 16px; 
          border-radius: 10px; 
          font-size: 13px; 
          outline: none;
          transition: border-color 0.2s;
        }
        .date-input:focus {
          border-color: var(--accent-purple);
        }
        .apply-btn { 
          background: var(--accent-grad); 
          color: white; 
          border: none; 
          padding: 10px 28px; 
          border-radius: 10px; 
          font-size: 14px; 
          font-weight: 700; 
          cursor: pointer; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
        }
        .apply-btn:hover { 
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
          filter: brightness(1.1);
        }
        .apply-btn:active {
          transform: translateY(0) scale(0.98);
        }
      `}</style>
      <div className="page-content" style={{ maxWidth: 1200, margin: '20px auto', padding: '0 20px', paddingBottom: 60 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Analytics & Reporting</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>Visualize team velocity and project distributions.</p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Project</span>
              <select className="filter-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="all">All Projects</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date Range</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="filter-select" value={dateRangeType} onChange={(e) => setDateRangeType(e.target.value)}>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>

                {dateRangeType === 'custom' && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg-panel)', padding: '6px 12px', borderRadius: 14, border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
                    <input type="date" className="date-input" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                    <input type="date" className="date-input" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                    <button className="apply-btn" onClick={handleCustomApply}>Apply</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Project Pulse - High Level Summary */}
        {projectHealth && projectHealth.summary && (
          <div className="dash-panel" style={{ 
            marginBottom: 30, 
            padding: '32px 40px', 
            borderRadius: 20,
            position: 'relative',
            overflow: 'hidden',
            border: 'none',
            background: projectHealth.status === 'bad' 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(20, 20, 25, 1) 100%)' 
              : projectHealth.status === 'warning'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(20, 20, 25, 1) 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(20, 20, 25, 1) 100%)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            borderLeft: `6px solid ${projectHealth.status === 'bad' ? '#ef4444' : projectHealth.status === 'warning' ? '#f59e0b' : '#10b981'}`
          }}>
            {/* Background Accent */}
            <div style={{
              position: 'absolute', top: -100, right: -100, width: 300, height: 300,
              background: projectHealth.status === 'bad' ? '#ef4444' : projectHealth.status === 'warning' ? '#f59e0b' : '#10b981',
              filter: 'blur(120px)', opacity: 0.1, pointerEvents: 'none'
            }} />

            <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ 
                    padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, 
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    background: projectHealth.status === 'bad' ? '#ef4444' : projectHealth.status === 'warning' ? '#f59e0b' : '#10b981',
                    color: '#000'
                  }}>
                    Project Pulse
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
                    Real-time status analysis
                  </span>
                </div>
                
                <h2 style={{ 
                  fontSize: 24, lineHeight: 1.4, color: 'var(--text-primary)', 
                  fontWeight: 600, margin: '0 0 24px 0', maxWidth: 800 
                }}>
                  {projectHealth.summary}
                </h2>

                {projectHealth.nextSteps && (
                  <div style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    padding: '16px 20px', 
                    borderRadius: 12, 
                    marginBottom: 24,
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <span style={{ 
                      fontSize: 10, fontWeight: 900, color: projectHealth.status === 'bad' ? '#ef4444' : projectHealth.status === 'warning' ? '#f59e0b' : '#10b981', 
                      textTransform: 'uppercase', background: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: 4
                    }}>Next Steps</span>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {projectHealth.nextSteps}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 40 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Blockers</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: projectHealth.metrics?.blockers > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                      {projectHealth.metrics?.blockers || 0}
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>high priority</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Stale Tasks</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: projectHealth.metrics?.staleCount > 2 ? '#f59e0b' : 'var(--text-primary)' }}>
                      {projectHealth.metrics?.staleCount || 0}
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>inactive 3d+</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Velocity</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6', textTransform: 'capitalize' }}>
                      {projectHealth.metrics?.velocity || 'stable'}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', padding: '10px 0' }}>
                <div style={{ position: 'relative', width: 120, height: 120, margin: '0 0 16px auto' }}>
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle cx="60" cy="60" r="54" fill="none" stroke={projectHealth.status === 'bad' ? '#ef4444' : projectHealth.status === 'warning' ? '#f59e0b' : '#10b981'} 
                      strokeWidth="8" strokeDasharray={`${(100 - projectHealth.percentagePending) * 3.39} 339`} 
                      transform="rotate(-90 60 60)" strokeLinecap="round" />
                  </svg>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{100 - projectHealth.percentagePending}%</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Done</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: projectHealth.status === 'bad' ? '#ef4444' : 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {projectHealth.daysRemaining < 0 ? 'Project Delayed' : `${projectHealth.daysRemaining} Days to Target`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 30 }}>
          <div className="dash-panel" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Total Issues</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-purple)' }}>{totalTickets}</div>
          </div>
          <div className="dash-panel" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Hours Logged</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#0ea5e9' }}>{totalHours}</div>
          </div>
          <div className="dash-panel" style={{ padding: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Completion Rate</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981' }}>{completionRate}%</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Burndown Chart */}
          <div className="dash-panel" style={{ padding: 24, paddingBottom: 10 }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              Velocity ({dateRangeType === '7d' ? 'Last 7 Days' : dateRangeType === '30d' ? 'Last 30 Days' : 'Custom Range'})
            </h3>
            <div style={{ width: '100%', height: 300, minHeight: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={burndown} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                  <RechartsTooltip 
                    contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-color)', borderRadius: 8 }}
                    itemStyle={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="created" name="Created" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorCreated)" />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time Logging */}
          <div className="dash-panel" style={{ padding: 24, paddingBottom: 10 }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Time Tracked by User</h3>
            {hourStats.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 50 }}>No time logged yet.</div>
            ) : (
              <div style={{ width: '100%', height: 300, minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourStats} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-primary)' }} width={80} />
                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-color)', borderRadius: 8 }} itemStyle={{ color: 'var(--text-primary)' }}/>
                    <Bar dataKey="total_hours" name="Hours" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* --- NEW SECTION: TEAM WORKLOAD & PROJECT BURNDOWN --- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Workload */}
          <div className="dash-panel" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Workload Distribution</h3>
            {workloadStats.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40 }}>No active workload.</div>
            ) : (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadStats} layout="vertical" margin={{ left: 40 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-primary)' }} width={100} />
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8 }} />
                    <Bar dataKey="active_count" name="Active Tasks" fill="var(--accent-purple)" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Project Burndown */}
          <div className="dash-panel" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Project Burndown</h3>
                <div style={{ fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 600, marginTop: 4 }}>
                  {projectBurndown.projectName}
                </div>
              </div>
              {projectBurndown.targetDate && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                  Target: {new Date(projectBurndown.targetDate).toLocaleDateString()}
                </div>
              )}
            </div>
            
            {!burndownReady ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 60 }}>
                Setup a project with a target date and tasks to see your burndown.
              </div>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projectBurndown.data}>
                    <defs>
                      <linearGradient id="colorRemaining" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} minTickGap={30} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <RechartsTooltip 
                      contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8 }}
                      itemStyle={{ fontSize: 12 }}
                    />
                    {/* Ideal Line */}
                    <Line type="monotone" dataKey="ideal" name="Ideal" stroke="rgba(255,255,255,0.3)" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                    {/* Actual Area */}
                    <Area type="monotone" dataKey="remaining" name="Remaining Work" stroke="var(--accent-cyan)" fillOpacity={1} fill="url(#colorRemaining)" strokeWidth={3} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* --- NEW SECTION: ESTIMATION ACCURACY & AGING TASKS --- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Estimation Accuracy */}
          <div className="dash-panel" style={{ padding: 24 }}>
             <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Estimation Accuracy (Last 8 Done)</h3>
             {accuracyStats.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40 }}>No logged data for estimation accuracy.</div>
             ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accuracyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="title" hide />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8 }} />
                      <Bar dataKey="estimated" name="Est. Hours" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={24} />
                      <Bar dataKey="actual" name="Actual Hours" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             )}
          </div>

          {/* Aging Tasks */}
          <div className="dash-panel" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Stale Issues (Aging &gt; 7d)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agingTasks.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40 }}>Everything is moving smoothly!</div>
              ) : agingTasks.map(t => (
                <div key={`${t.key_prefix}-${t.task_number}`} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.key_prefix}-{t.task_number} • Last updated {new Date(t.updated_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800 }}>STALE</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Issue Types */}
          <div className="dash-panel" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Issue Types</h3>
            {typeData.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 50 }}>
                Loading issue types... (Did you restart the backend?)
              </div>
            ) : (
              <>
                <div style={{ width: '100%', height: 300, minHeight: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={typeData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={70} 
                        outerRadius={100} 
                        paddingAngle={5} 
                        dataKey="value" 
                        style={{ cursor: 'pointer' }} 
                        stroke="none"
                        onClick={handlePieClick}
                        onMouseEnter={(_, index) => setActiveIndexType(index)}
                        onMouseLeave={() => setActiveIndexType(null)}
                        activeIndex={activeIndexType}
                        activeShape={renderActiveShape}
                      >
                        {typeData.map((entry, index) => <Cell key={`cell-type-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-color)', borderRadius: 8 }} itemStyle={{ color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                  {typeData.map((entry, i) => (
                    <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length] }}/>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Priority & Status Breakdown */}
          <div className="dash-panel" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Priority (Outer) & Status (Inner)</h3>
            {(priorityData.length === 0 && statusData.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 50 }}>No data available.</div>
            ) : (
              <>
                <div style={{ width: '100%', height: 300, minHeight: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={statusData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={0}
                        outerRadius={75} 
                        dataKey="value" 
                        style={{ cursor: 'pointer' }} 
                        stroke="none"
                        onClick={handlePieClick}
                        onMouseEnter={(_, index) => setActiveIndexStatus(index)}
                        onMouseLeave={() => setActiveIndexStatus(null)}
                        activeIndex={activeIndexStatus}
                        activeShape={renderActiveShape}
                      >
                        {statusData.map((entry, index) => <Cell key={`cell-status-${index}`} fill={entry.color} stroke="none" />)}
                      </Pie>
                      <Pie 
                        data={priorityData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={90} 
                        outerRadius={110} 
                        paddingAngle={2} 
                        dataKey="value" 
                        style={{ cursor: 'pointer' }} 
                        stroke="none"
                        onClick={handlePieClick}
                        onMouseEnter={(_, index) => setActiveIndexPriority(index)}
                        onMouseLeave={() => setActiveIndexPriority(null)}
                        activeIndex={activeIndexPriority}
                        activeShape={renderActiveShape}
                      >
                        {priorityData.map((entry, index) => <Cell key={`cell-priority-${index}`} fill={PRIORITY_COLORS[entry.name] || '#64748b'} stroke="none" />)}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-color)', borderRadius: 8 }} itemStyle={{ color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }}/> <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>High</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }}/> <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Med</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }}/> <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Low</span></div>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
      
      {chartFilter && (
        <ChartModal filter={chartFilter} onClose={() => setChartFilter(null)} />
      )}
    </div>
  );
}
