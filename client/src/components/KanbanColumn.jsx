import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard.jsx';

export default function KanbanColumn({ col, tasks, style, onAddTask }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="kanban-column" style={style}>
      <div className="kanban-column-header">
        <div className="col-indicator" style={{ background: col.color }} />
        <span className="col-name">{col.label}</span>
        <span className="col-badge">{tasks.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`kanban-column-body ${isOver ? 'drag-over' : ''}`}
      >
        {tasks.map(task => (
          // TaskCard handles its own click → navigate to detail page
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && !isOver && (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No tasks here
          </div>
        )}
      </div>

      <div className="kanban-column-footer">
        <button className="add-task-btn" onClick={() => onAddTask(col.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add task
        </button>
      </div>
    </div>
  );
}
