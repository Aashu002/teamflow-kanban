import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
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
  
  // Hover states for Pie charts
  const [activeIndexType, setActiveIndexType] = useState(null);
  const [activeIndexStatus, setActiveIndexStatus] = useState(null);
  const [activeIndexPriority, setActiveIndexPriority] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="loading-spinner"/></div>;

  const { 
    burndown = [], hourStats = [], typeCounts = [], priorityCounts = [], statusCounts = [], stats = {}, totalTickets = 0,
    workloadStats = [], accuracyStats = [], agingTasks = [], projectBurndown = { data: [] }
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
      <style>{`.recharts-sector { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }`}</style>
      <Navbar />
      <div className="page-content" style={{ maxWidth: 1200, margin: '20px auto', padding: '0 20px', paddingBottom: 60 }}>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, margin: '0 0 8px 0', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Analytics & Reporting</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>Visualize team velocity and project distributions.</p>
          </div>
        </div>

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
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Velocity (Last 7 Days)</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
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
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
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
                    <BarChart data={accuracyStats} margin={{ bottom: 20 }}>
                      <XAxis dataKey="title" hide />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <RechartsTooltip contentStyle={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 8 }} />
                      <Bar dataKey="estimated" name="Est. Hours" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual Hours" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
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
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
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
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
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
