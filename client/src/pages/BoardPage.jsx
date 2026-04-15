import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import KanbanColumn from '../components/KanbanColumn.jsx';
import { useNavbar } from '../contexts/NavbarContext.jsx';
import TaskCard, { TYPE_META } from '../components/TaskCard.jsx';
import CreateTaskModal from '../components/CreateTaskModal.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api.js';
import { socket } from '../socket.js';

export const COLUMNS = [
  { id: 'open',         label: 'Open',                  color: '#3b82f6' },
  { id: 'gathering',    label: 'Gathering Requirements', color: '#8b5cf6' },
  { id: 'inprogress',   label: 'In Progress',            color: '#f59e0b' },
  { id: 'qa_testing',   label: 'QA Testing',             color: '#ec4899' },
  { id: 'qa_completed', label: 'QA Completed',           color: '#22c55e' },
  { id: 'stakeholder',  label: 'Stakeholder Review',     color: '#f97316' },
  { id: 'done',         label: 'Live / Done',            color: '#15803d' },
];

export default function BoardPage() {
  const { user, isAdmin } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { setHeaderData, clearHeaderData } = useNavbar();
  const [project, setProject] = useState(null);
  const [viewMode, setViewMode] = useState('board');
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null); // the currently active sprint for this project
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [createInColumn, setCreateInColumn] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    const init = async () => {
      try {
        const [projRes, tasksRes, sprintsRes] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/tasks?projectId=${projectId}`),
          api.get(`/sprints?projectId=${projectId}`),
        ]);
        setProject(projRes.data);
        setMembers(projRes.data.members || []);
        setTasks(tasksRes.data);
        setSprints(sprintsRes.data);
        setActiveSprint(sprintsRes.data.find(s => s.status === 'active') || null);
      } catch { navigate('/projects'); }
      finally { setLoading(false); }
    };
    init();

    socket.emit('join_project', projectId);

    const onTaskCreated = (newTask) => {
      setTasks(prev => {
        if (prev.some(t => t.id === newTask.id)) return prev;
        return [newTask, ...prev];
      });
    };

    const onTaskUpdated = (updatedTask) => {
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    };

    const onTaskDeleted = ({ id }) => {
      setTasks(prev => prev.filter(t => t.id !== id));
    };

    socket.on('task_created', onTaskCreated);
    socket.on('task_updated', onTaskUpdated);
    socket.on('task_deleted', onTaskDeleted);

    return () => {
      socket.emit('leave_project', projectId);
      socket.off('task_created', onTaskCreated);
      socket.off('task_updated', onTaskUpdated);
      socket.off('task_deleted', onTaskDeleted);
    };
  }, [projectId, navigate]);

  useEffect(() => {
    if (project) {
      setHeaderData({ projectName: project.name, onBack: () => navigate('/home') });
    }
    return () => clearHeaderData();
  }, [project, setHeaderData, clearHeaderData, navigate]);

  const filteredTasks = tasks.filter(t => {
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterAssignee !== 'all' && String(t.assignee_id) !== filterAssignee) return false;
    if (filterType !== 'all' && t.task_type !== filterType) return false;
    return true;
  });



  const handleDragStart = ({ active }) => {
    setActiveTask(tasks.find(t => t.id === active.id) || null);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;
    const targetCol = over.id;
    const task = tasks.find(t => t.id === active.id);
    if (!task || task.status === targetCol) return;

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: targetCol } : t));
    try {
      await api.patch(`/tasks/${task.id}`, { status: targetCol });
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const handleTaskCreated = task => {
    setTasks(prev => [task, ...prev]);
    setCreateInColumn(null);
  };

  const patchProject = async (updates) => {
    try {
      const { data } = await api.patch(`/projects/${projectId}`, updates);
      setProject(data);
    } catch (err) {
      console.error('Failed to update project metadata', err);
    }
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner"/></div>;

  const canEditProject = isAdmin || project?.owner_id === user?.id;
  const SPRINT_STATUS_COLOR = { planning: '#8b5cf6', active: '#10b981', completed: '#6b7280' };

  // Sprint-filtered board tasks: if there's an active sprint, only show its tasks on the board
  const sprintFilteredTasks = activeSprint
    ? filteredTasks.filter(t => t.sprint_id === activeSprint.id || t.status === 'backlog')
    : filteredTasks;

  const boardTasks = sprintFilteredTasks.filter(t => t.status !== 'backlog');
  const backlogTasks = filteredTasks.filter(t => t.status === 'backlog');
  const tasksByCol = col => boardTasks.filter(t => t.status === col);

  return (
    <div className="board-page">
      {/* Sprint Alert Banner — shown when there's an active sprint */}
      {activeSprint && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 20px', background: 'rgba(16,185,129,0.08)',
          borderBottom: '1px solid rgba(16,185,129,0.2)',
          fontSize: 13,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
          <strong style={{ color: '#10b981' }}>Active: {activeSprint.name}</strong>
          {activeSprint.goal && <span style={{ color: 'var(--text-secondary)' }}>· 🎯 {activeSprint.goal}</span>}
          {activeSprint.end_date && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 12 }}>
              Ends {new Date(activeSprint.end_date).toLocaleDateString()}
            </span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 4, fontSize: 11 }}
            onClick={() => navigate(`/projects/${projectId}/backlog`)}
          >
            📋 Sprint Planning
          </button>
        </div>
      )}

      <div className="board-toolbar">
        <span className="board-toolbar-title">{viewMode === 'board' ? 'Kanban Board' : 'Project Backlog'}</span>
        <span className="board-task-count">{viewMode === 'board' ? boardTasks.length : backlogTasks.length} issues</span>
        <div style={{ flex: 1 }} />
        
        <div className="admin-tabs" style={{ margin: '0 16px', background: 'var(--bg-secondary)', padding: 4, borderRadius: 8 }}>
          <button className={`admin-tab ${viewMode === 'board' ? 'active' : ''}`} style={{ padding: '4px 12px', minWidth: 80 }} onClick={() => setViewMode('board')}>Board</button>
          <button className={`admin-tab ${viewMode === 'backlog' ? 'active' : ''}`} style={{ padding: '4px 12px', minWidth: 80 }} onClick={() => setViewMode('backlog')}>Backlog ({tasks.filter(t => t.status === 'backlog').length})</button>
        </div>

        <div className="board-filter-group">
          <span className="board-filter-label">Type:</span>
          <select id="filter-type" className="board-filter-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">All</option>
            <option value="epic">⚡ Epic</option>
            <option value="story">📖 Story</option>
            <option value="task">✅ Task</option>
            <option value="subtask">🔧 Sub-Task</option>
            <option value="bug">🐛 Bug</option>
          </select>
        </div>
        <div className="board-filter-group">
          <span className="board-filter-label">Priority:</span>
          <select id="filter-priority" className="board-filter-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">All</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
        <div className="board-filter-group">
          <span className="board-filter-label">Assignee:</span>
          <select id="filter-assignee" className="board-filter-select" value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
            <option value="all">All</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {project && (
        <div className="board-meta-banner" style={{ display: 'flex', gap: 24, margin: '16px 20px 16px', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Project Goal</div>
            {canEditProject ? (
              <input 
                style={{ width: '100%', background: 'transparent', border: '1px dashed transparent', padding: '4px 8px', margin: '-4px -8px', borderRadius: 4, color: 'var(--text-primary)', fontSize: 14 }}
                placeholder="Click to add a project goal/objective..."
                defaultValue={project.project_goal || ''}
                onBlur={(e) => {
                  if (e.target.value !== project.project_goal) patchProject({ project_goal: e.target.value });
                }}
                onKeyDown={e => e.key === 'Enter' && e.target.blur()}
              />
            ) : (
              <div style={{ fontSize: 14, color: project.project_goal ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {project.project_goal || 'No goal set.'}
              </div>
            )}
          </div>
          <div style={{ width: 200, borderLeft: '1px solid var(--border)', paddingLeft: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Target Date</div>
            {canEditProject ? (
              <input 
                type="date"
                style={{ background: 'transparent', border: '1px dashed transparent', padding: '2px 8px', margin: '-2px -8px', borderRadius: 4, color: project.estimated_completion_date ? 'var(--accent-purple)' : 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}
                defaultValue={project.estimated_completion_date || ''}
                onChange={(e) => patchProject({ estimated_completion_date: e.target.value })}
              />
            ) : (
              <div style={{ fontSize: 14, fontWeight: 500, color: project.estimated_completion_date ? 'var(--accent-purple)' : 'var(--text-muted)' }}>
                {project.estimated_completion_date ? new Date(project.estimated_completion_date).toLocaleDateString() : 'Unscheduled'}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="board-content">
        {viewMode === 'board' ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="board-container">
              {COLUMNS.map((col, i) => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  tasks={tasksByCol(col.id)}
                  style={{ animationDelay: `${i * 40}ms` }}
                  onAddTask={() => setCreateInColumn(col.id)}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && <TaskCard task={activeTask} dragging />}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="admin-container" style={{ margin: '20px auto', maxWidth: 1000, background: 'var(--bg-surface)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 20, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Backlog</span>
              <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--bg-secondary)', borderRadius: 12, color: 'var(--text-muted)' }}>{backlogTasks.length}</span>
            </h3>
            {backlogTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                No issues in the backlog.
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Key</th>
                    <th>Title & Type</th>
                    <th style={{ width: 140 }}>Assignee</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backlogTasks.map(t => {
                    const tm = TYPE_META[t.task_type] || TYPE_META.task;
                    return (
                      <tr key={t.id} style={{ cursor: 'pointer' }} onDoubleClick={() => navigate(`/projects/${t.project_id}/tasks/${t.key_prefix}-${t.task_number}`)}>
                        <td onClick={() => navigate(`/projects/${t.project_id}/tasks/${t.key_prefix}-${t.task_number}`)}>
                          <span className="task-id" style={{ color: 'var(--accent-purple)' }}>{t.key_prefix}-{t.task_number}</span>
                        </td>
                        <td onClick={() => navigate(`/projects/${t.project_id}/tasks/${t.key_prefix}-${t.task_number}`)}>
                          <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                            {t.title}
                            <span className={`type-badge type-${t.task_type}`} style={{ fontSize: 10, padding: '2px 6px' }}>{tm.icon} {tm.label}</span>
                          </div>
                        </td>
                        <td onClick={() => navigate(`/projects/${t.project_id}/tasks/${t.key_prefix}-${t.task_number}`)} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          {t.assignee_name || 'Unassigned'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-sm btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.patch(`/tasks/${t.id}`, { status: 'open' });
                                setTasks(prev => prev.map(pt => pt.id === t.id ? { ...pt, status: 'open' } : pt));
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                          >
                            → Move to Board
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {createInColumn && (
        <CreateTaskModal
          defaultStatus={createInColumn}
          projectId={projectId}
          members={members}
          allTasks={tasks}
          sprints={sprints}
          onClose={() => setCreateInColumn(null)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
