import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import Navbar from '../components/Navbar.jsx';
import KanbanColumn from '../components/KanbanColumn.jsx';
import TaskCard from '../components/TaskCard.jsx';
import CreateTaskModal from '../components/CreateTaskModal.jsx';
import api from '../api.js';

export const COLUMNS = [
  { id: 'open',         label: 'Open',                  color: '#3b82f6' },
  { id: 'gathering',    label: 'Gathering Requirements', color: '#8b5cf6' },
  { id: 'inprogress',   label: 'In Progress',            color: '#f59e0b' },
  { id: 'review',       label: 'In Review',              color: '#06b6d4' },
  { id: 'qa_testing',   label: 'QA Testing',             color: '#ec4899' },
  { id: 'qa_completed', label: 'QA Completed',           color: '#22c55e' },
  { id: 'stakeholder',  label: 'Stakeholder Review',     color: '#f97316' },
  { id: 'done',         label: 'Live / Done',            color: '#64748b' },
];

export default function BoardPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState(null);
  const [createInColumn, setCreateInColumn] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const pollingRef = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadTasks = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks?projectId=${projectId}`);
      setTasks(data);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    const init = async () => {
      try {
        const [projRes, tasksRes] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/tasks?projectId=${projectId}`)
        ]);
        setProject(projRes.data);
        setMembers(projRes.data.members || []);
        setTasks(tasksRes.data);
      } catch { navigate('/projects'); }
      finally { setLoading(false); }
    };
    init();
    pollingRef.current = setInterval(loadTasks, 5000);
    return () => clearInterval(pollingRef.current);
  }, [projectId, loadTasks, navigate]);

  const filteredTasks = tasks.filter(t => {
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterAssignee !== 'all' && String(t.assignee_id) !== filterAssignee) return false;
    if (filterType !== 'all' && t.task_type !== filterType) return false;
    return true;
  });

  const tasksByCol = col => filteredTasks.filter(t => t.status === col);

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

  if (loading) return <div className="loading-screen"><div className="loading-spinner"/></div>;

  return (
    <div className="board-page">
      <Navbar projectName={project?.name} onBack={() => navigate('/projects')} />

      <div className="board-toolbar">
        <span className="board-toolbar-title">Kanban Board</span>
        <span className="board-task-count">{filteredTasks.length} issues</span>
        <div style={{ flex: 1 }} />
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
        <button id="new-task-btn" className="btn btn-primary btn-sm" onClick={() => setCreateInColumn('open')}>
          + Create Issue
        </button>
      </div>

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

      {createInColumn && (
        <CreateTaskModal
          defaultStatus={createInColumn}
          projectId={projectId}
          members={members}
          allTasks={tasks}
          onClose={() => setCreateInColumn(null)}
          onCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
