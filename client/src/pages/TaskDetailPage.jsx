import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { TYPE_META } from '../components/TaskCard.jsx';
import { COLUMNS } from './BoardPage.jsx';
import api from '../api.js';
import Navbar from '../components/Navbar.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name) {
  return name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() || '?';
}

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime = '') {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('zip') || mime.includes('tar')) return '📦';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  if (mime.startsWith('video/')) return '🎬';
  return '📎';
}

const STATUS_COLORS = {
  open:          { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa' },
  gathering:     { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa' },
  inprogress:    { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24' },
  review:        { bg: 'rgba(6,182,212,0.15)',   text: '#22d3ee' },
  qa_testing:    { bg: 'rgba(236,72,153,0.15)',  text: '#f472b6' },
  qa_completed:  { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80' },
  stakeholder:   { bg: 'rgba(249,115,22,0.15)',  text: '#fb923c' },
  done:          { bg: 'rgba(100,116,139,0.2)',  text: '#94a3b8' },
};

// ─── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({ comment, currentUser, isAdmin, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const canModify = comment.user_id === currentUser?.id || isAdmin;

  const saveEdit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try { await onEdit(comment.id, text.trim()); setEditing(false); }
    finally { setSaving(false); }
  };

  return (
    <div className="comment-item">
      <div className="user-avatar" style={{ background: comment.user_color || '#7c3aed', width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
        {initials(comment.user_name)}
      </div>
      <div className="comment-body">
        <div className="comment-header">
          <span className="comment-author">{comment.user_name}</span>
          <span className="comment-time">{formatDate(comment.created_at)}</span>
          {comment.updated_at !== comment.created_at && <span className="comment-edited">(edited)</span>}
        </div>
        {editing ? (
          <>
            <textarea
              className="comment-input" value={text}
              onChange={e => setText(e.target.value)}
              autoFocus style={{ width: '100%', marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setText(comment.content); }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="comment-content">{comment.content}</div>
        )}
        {canModify && !editing && (
          <div className="comment-actions">
            <button className="comment-action-btn" onClick={() => setEditing(true)}>Edit</button>
            <button className="comment-action-btn" style={{ color: '#f87171' }} onClick={() => onDelete(comment.id)}>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const { projectId, taskId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [task, setTask] = useState(null);
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Title
  const [title, setTitle] = useState('');
  // Description
  const [desc, setDesc] = useState('');
  const [descEditing, setDescEditing] = useState(false);

  // Comments
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const commentRef = useRef(null);

  // Attachments
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [taskRes, projRes, tasksRes] = await Promise.all([
        api.get(`/tasks/${taskId}`),
        api.get(`/projects/${projectId}`),
        api.get(`/tasks?projectId=${projectId}`)
      ]);
      setTask(taskRes.data);
      setTitle(taskRes.data.title);
      setDesc(taskRes.data.description || '');
      setProject(projRes.data);
      setMembers(projRes.data.members || []);
      setAllTasks(tasksRes.data.filter(t => t.id !== parseInt(taskId)));
    } catch {
      navigate(`/projects/${projectId}/board`);
    } finally {
      setLoading(false);
    }
  }, [taskId, projectId, navigate]);

  useEffect(() => { load(); }, [load]);

  // ── Sidebar patch helper ──────────────────────────────────────────────────

  const patchTask = async (fields) => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/tasks/${taskId}`, fields);
      setTask(prev => ({ ...prev, ...data }));
    } catch (err) {
      toast({ message: err.response?.data?.error || 'Failed to update', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Title blur save ───────────────────────────────────────────────────────

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== task.title) patchTask({ title: trimmed });
  };

  // ── Description ───────────────────────────────────────────────────────────

  const handleDescSave = () => {
    setDescEditing(false);
    if (desc !== (task.description || '')) patchTask({ description: desc });
  };

  // ── Comments ──────────────────────────────────────────────────────────────

  const postComment = async () => {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    setPostingComment(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/comments`, { content: trimmed });
      setTask(prev => ({ ...prev, comments: [...(prev.comments || []), data] }));
      setNewComment('');
    } catch (err) {
      toast({ message: 'Failed to post comment', type: 'error' });
    } finally {
      setPostingComment(false);
    }
  };

  const editComment = async (cid, content) => {
    const { data } = await api.patch(`/tasks/${taskId}/comments/${cid}`, { content });
    setTask(prev => ({ ...prev, comments: prev.comments.map(c => c.id === cid ? data : c) }));
  };

  const deleteComment = async (cid) => {
    if (!confirm('Delete this comment?')) return;
    await api.delete(`/tasks/${taskId}/comments/${cid}`);
    setTask(prev => ({ ...prev, comments: prev.comments.filter(c => c.id !== cid) }));
  };

  // ── Attachments ───────────────────────────────────────────────────────────

  const uploadFile = async (file) => {
    if (file.size > 20 * 1024 * 1024) { toast({ message: 'File too large (max 20 MB)', type: 'error' }); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/tasks/${taskId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTask(prev => ({ ...prev, attachments: [...(prev.attachments || []), data] }));
      toast({ message: `Attached "${file.name}"`, type: 'success', duration: 3000 });
    } catch (err) {
      toast({ message: err.response?.data?.error || 'Upload failed', type: 'error' });
    } finally { setUploading(false); }
  };

  const deleteAttachment = async (aid) => {
    if (!confirm('Delete this attachment?')) return;
    await api.delete(`/tasks/${taskId}/attachments/${aid}`);
    setTask(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== aid) }));
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${task.key_prefix}-${task.task_number}?`)) return;
    await api.delete(`/tasks/${taskId}`);
    navigate(`/projects/${projectId}/board`);
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;
  if (!task) return null;

  const typeMeta = TYPE_META[task.task_type] || TYPE_META.task;
  const colLabel = COLUMNS.find(c => c.id === task.status)?.label || task.status;
  const colColor = STATUS_COLORS[task.status] || STATUS_COLORS.open;
  const isDone = task.status === 'done';
  const canDelete = isAdmin || task.creator_id === user?.id;

  return (
    <div className="task-detail-page">
      <Navbar
        projectName={project?.name}
        onBack={() => navigate(`/projects/${projectId}/board`)}
      />

      <div className="task-detail-body">

        {/* ═══════════ MAIN ═══════════ */}
        <div className="task-detail-main">

          {/* Breadcrumb */}
          <div className="task-breadcrumb" style={{ marginBottom: 16 }}>
            <button onClick={() => navigate(`/projects/${projectId}/board`)}>{project?.name}</button>
            <span>›</span>
            {task.parent_id && task.parent_task_number && (
              <>
                <Link to={`/projects/${projectId}/tasks/${task.parent_id}`}
                  style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                  {task.key_prefix}-{task.parent_task_number}
                </Link>
                <span>›</span>
              </>
            )}
            <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>
              {task.key_prefix}-{task.task_number}
            </span>
            {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Saving…</span>}
          </div>

          {/* Title */}
          <textarea
            className="task-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            rows={1}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          />

          {/* Action bar */}
          <div className="task-actions-bar">
            {/* Status button */}
            <button
              className="status-btn"
              style={{ background: colColor.bg, color: colColor.text, border: `1px solid ${colColor.text}30` }}
              title="Change status in the sidebar →"
            >
              {colLabel}
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setDescEditing(true); setTimeout(() => document.querySelector('.task-desc-editor')?.focus(), 50); }}
            >
              ✏️ Edit
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { commentRef.current?.focus(); }}
            >
              💬 Add Comment
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              📎 Attach
            </button>

            {canDelete && (
              <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={handleDelete}>
                🗑 Delete
              </button>
            )}
          </div>

          {/* ── Details grid (Jira style) ── */}
          <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>▼ Details</div>
          <div className="task-details-grid">
            <div className="task-detail-row">
              <div className="task-detail-cell-label">Type</div>
              <div className="task-detail-cell-value">
                <span className={`type-badge type-${task.task_type}`}>{typeMeta.icon} {typeMeta.label}</span>
                <select
                  value={task.task_type}
                  onChange={e => patchTask({ task_type: e.target.value })}
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                >
                  {Object.entries(TYPE_META).map(([k, { icon, label }]) => (
                    <option key={k} value={k}>{icon} {label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="task-detail-row">
              <div className="task-detail-cell-label">Priority</div>
              <div className="task-detail-cell-value">
                <span className={`priority-badge priority-${task.priority}`}>
                  {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'} {task.priority}
                </span>
                <select
                  value={task.priority}
                  onChange={e => patchTask({ priority: e.target.value })}
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                >
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>
            </div>
            <div className="task-detail-row">
              <div className="task-detail-cell-label">Status</div>
              <div className="task-detail-cell-value">
                <select
                  value={task.status}
                  onChange={e => patchTask({ status: e.target.value })}
                  style={{
                    background: colColor.bg, color: colColor.text,
                    border: 'none', outline: 'none',
                    fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', borderRadius: 4, padding: '2px 6px',
                  }}
                >
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="task-detail-row">
              <div className="task-detail-cell-label">Resolution</div>
              <div className="task-detail-cell-value">
                <span className={`resolution-badge ${isDone ? 'resolution-done' : 'resolution-unresolved'}`}>
                  {isDone ? '✅ Done' : '⬜ Unresolved'}
                </span>
              </div>
            </div>
            {task.task_type === 'subtask' && (
              <div className="task-detail-row">
                <div className="task-detail-cell-label">Parent</div>
                <div className="task-detail-cell-value">
                  {task.parent_id ? (
                    <Link to={`/projects/${projectId}/tasks/${task.parent_id}`}
                      style={{ color: 'var(--accent-purple)', textDecoration: 'none', fontWeight: 600 }}>
                      {task.key_prefix}-{task.parent_task_number}: {task.parent_title}
                    </Link>
                  ) : (
                    <select
                      value={task.parent_id ?? ''}
                      onChange={e => patchTask({ parentId: e.target.value || null })}
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}
                    >
                      <option value="">Set parent…</option>
                      {allTasks.filter(t => t.task_type !== 'subtask').map(t => (
                        <option key={t.id} value={t.id}>{t.key_prefix}-{t.task_number}: {t.title.slice(0, 32)}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Description ── */}
          <div className="task-section">
            <div className="task-section-label">Description</div>
            {descEditing ? (
              <>
                <textarea
                  className="task-desc-editor"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  autoFocus
                  placeholder="Add a description…"
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleDescSave}>Save</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setDescEditing(false); setDesc(task.description || ''); }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div
                onClick={() => setDescEditing(true)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '12px 14px',
                  minHeight: 80, cursor: 'text', fontSize: 14, lineHeight: 1.7,
                  color: desc ? 'var(--text-primary)' : 'var(--text-muted)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {desc || 'No description — click to add one…'}
              </div>
            )}
          </div>

          {/* ── Sub-Tasks ── */}
          {task.task_type !== 'subtask' && (
            <div className="task-section">
              <div className="task-section-label">
                Sub-Tasks
                <span style={{ background: 'var(--bg-elevated)', borderRadius: 4, padding: '1px 7px', fontSize: 11, marginLeft: 8, color: 'var(--text-muted)' }}>
                  {task.subtasks?.length || 0}
                </span>
              </div>
              <div className="subtask-list">
                {(task.subtasks || []).map(st => (
                  <div key={st.id} className="subtask-item" onClick={() => navigate(`/projects/${projectId}/tasks/${st.id}`)}>
                    <span>🔧</span>
                    <span className="subtask-id">{st.key_prefix}-{st.task_number}</span>
                    <span className="subtask-title">{st.title}</span>
                    {st.assignee_name && (
                      <div className="user-avatar" style={{ background: st.assignee_color, width: 20, height: 20, fontSize: 9, flexShrink: 0 }}>
                        {initials(st.assignee_name)}
                      </div>
                    )}
                    <span className="subtask-status" style={{ background: STATUS_COLORS[st.status]?.bg, color: STATUS_COLORS[st.status]?.text }}>
                      {COLUMNS.find(c => c.id === st.status)?.label || st.status}
                    </span>
                  </div>
                ))}
                {!(task.subtasks?.length) && (
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>No sub-tasks. Create one by selecting Sub-Task type.</p>
                )}
              </div>
            </div>
          )}

          {/* ── Attachments ── */}
          <div className="task-section">
            <div className="task-section-label">
              Attachments
              <span style={{ background: 'var(--bg-elevated)', borderRadius: 4, padding: '1px 7px', fontSize: 11, marginLeft: 8, color: 'var(--text-muted)' }}>
                {task.attachments?.length || 0}
              </span>
            </div>
            <div className="attachment-list">
              {(task.attachments || []).map(att => (
                <div key={att.id} className="attachment-item">
                  <div className="attachment-icon">{fileIcon(att.mimetype)}</div>
                  <div className="attachment-info">
                    <a
                      className="attachment-name"
                      href={`/uploads/${att.filename}`}
                      target="_blank" rel="noopener noreferrer"
                    >
                      {att.original_name}
                    </a>
                    <div className="attachment-meta">
                      {formatBytes(att.size)} · Uploaded by <strong>{att.user_name}</strong> · {formatDate(att.created_at)}
                    </div>
                  </div>
                  <a
                    href={`/uploads/${att.filename}`}
                    download={att.original_name}
                    className="btn btn-ghost btn-icon btn-sm"
                    data-tip="Download"
                  >
                    ⬇
                  </a>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => deleteAttachment(att.id)}
                    data-tip="Delete"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <div
              className={`drop-zone ${dragActive ? 'drag-active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
            >
              {uploading ? '⏳ Uploading…' : '📎 Click or drag & drop files here (max 20 MB)'}
            </div>
            <input
              ref={fileInputRef} type="file" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]); e.target.value = ''; }}
            />
          </div>

          {/* ── Activity / Comments ── */}
          <div className="task-section">
            <div className="task-section-label">
              Activity
              <span style={{ background: 'var(--bg-elevated)', borderRadius: 4, padding: '1px 7px', fontSize: 11, marginLeft: 8, color: 'var(--text-muted)' }}>
                {task.comments?.length || 0}
              </span>
            </div>

            <div className="comment-list" style={{ marginBottom: 20 }}>
              {(task.comments || []).length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '4px 0' }}>No comments yet. Be the first to comment!</p>
              )}
              {(task.comments || []).map(c => (
                <CommentItem
                  key={c.id} comment={c} currentUser={user} isAdmin={isAdmin}
                  onDelete={deleteComment} onEdit={editComment}
                />
              ))}
            </div>

            {/* New comment composer */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div className="user-avatar" style={{ background: user?.avatar_color || '#7c3aed', width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                {initials(user?.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div className="comment-editor-wrap">
                  <textarea
                    ref={commentRef}
                    placeholder="Add a comment… (Ctrl+Enter to save)"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postComment(); }}
                    rows={2}
                  />
                  {newComment.trim() && (
                    <div className="comment-editor-toolbar">
                      <button className="btn btn-secondary btn-sm" onClick={() => setNewComment('')}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={postComment} disabled={postingComment}>
                        {postingComment ? 'Posting…' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════ SIDEBAR ═══════════ */}
        <div className="task-detail-sidebar">

          {/* People */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">👥 People</div>

            <div className="sidebar-person-row">
              <span className="sidebar-person-label">Assignee</span>
              <div className="sidebar-person-value">
                {task.assignee_name ? (
                  <div className="user-avatar" style={{ background: task.assignee_color || '#7c3aed', width: 22, height: 22, fontSize: 9 }}>
                    {initials(task.assignee_name)}
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>○</span>
                )}
                <select
                  className="sidebar-person-select"
                  value={task.assignee_id ?? ''}
                  onChange={e => patchTask({ assigneeId: e.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            <div className="sidebar-person-row">
              <span className="sidebar-person-label">Reporter</span>
              <div className="sidebar-person-value">
                {task.creator_name ? (
                  <>
                    <div className="user-avatar" style={{ background: task.creator_color || '#7c3aed', width: 22, height: 22, fontSize: 9 }}>
                      {initials(task.creator_name)}
                    </div>
                    <span style={{ fontSize: 13 }}>{task.creator_name}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Unknown</span>
                )}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">📅 Dates</div>
            <div className="sidebar-date-row">
              <span className="sidebar-date-label">Created</span>
              <span className="sidebar-date-value">{formatDate(task.created_at)}</span>
            </div>
            <div className="sidebar-date-row">
              <span className="sidebar-date-label">Updated</span>
              <span className="sidebar-date-value">{formatDate(task.updated_at)}</span>
            </div>
          </div>

          {/* Issue info */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">🔖 Issue</div>
            <div className="sidebar-date-row">
              <span className="sidebar-date-label">ID</span>
              <span className="task-id" style={{ fontSize: 13, color: 'var(--accent-purple)' }}>
                {task.key_prefix}-{task.task_number}
              </span>
            </div>
            <div className="sidebar-date-row">
              <span className="sidebar-date-label">Project</span>
              <span className="sidebar-date-value">{project?.name}</span>
            </div>
          </div>

          {/* Quick status change */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">🔄 Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {COLUMNS.map(col => (
                <button
                  key={col.id}
                  onClick={() => patchTask({ status: col.id })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                    background: task.status === col.id ? STATUS_COLORS[col.id]?.bg : 'transparent',
                    border: `1px solid ${task.status === col.id ? col.color + '40' : 'transparent'}`,
                    color: task.status === col.id ? STATUS_COLORS[col.id]?.text : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: 12, fontWeight: task.status === col.id ? 700 : 400,
                    fontFamily: 'var(--font)', textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { if (task.status !== col.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (task.status !== col.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                  {col.label}
                  {task.status === col.id && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
