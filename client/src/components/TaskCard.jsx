import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() || '?';
}

export const TYPE_META = {
  epic:    { icon: '⚡', label: 'Epic' },
  story:   { icon: '📖', label: 'Story' },
  task:    { icon: '✅', label: 'Task' },
  subtask: { icon: '🔧', label: 'Sub-Task' },
  bug:     { icon: '🐛', label: 'Bug' },
};

const PRIORITY_DOT = { high: '🔴', medium: '🟡', low: '🟢' };

export default function TaskCard({ task, dragging }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const meta = TYPE_META[task.task_type] || TYPE_META.task;

  const handleClick = (e) => {
    // Don't navigate if we're in the middle of a drag
    if (isDragging) return;
    e.stopPropagation();
    navigate(`/projects/${task.project_id}/tasks/${task.key_prefix}-${task.task_number}`);
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`task-card ${isDragging || dragging ? 'dragging' : ''}`}
      onClick={handleClick}
    >
      {/* Meta row: type + task ID */}
      <div className="task-card-meta">
        <span className={`type-badge type-${task.task_type}`}>
          {meta.icon} {meta.label}
        </span>
        <span className="task-id">{task.key_prefix}-{task.task_number}</span>
      </div>

      {/* Title */}
      <div className="task-card-title">{task.title}</div>

      {/* Description preview */}
      {task.description && (
        <div className="task-card-desc">{task.description}</div>
      )}

      {/* Footer: priority + assignee */}
      <div className="task-card-footer" style={{ marginTop: 10 }}>
        <span className={`priority-badge priority-${task.priority}`} style={{ textTransform: 'uppercase' }}>
          {PRIORITY_DOT[task.priority]} {task.priority}
        </span>

        {task.assignee_name ? (
          <div className="task-assignee">
            <div
              className="user-avatar task-avatar"
              style={{ background: task.assignee_color || '#7c3aed' }}
              data-tip={task.assignee_name}
            >
              {initials(task.assignee_name)}
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unassigned</span>
        )}
      </div>
    </div>
  );
}
