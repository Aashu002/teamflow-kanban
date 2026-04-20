import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { TYPE_META } from '../components/TaskCard.jsx';
import { COLUMNS } from './BoardPage.jsx';
import api from '../api.js';
import { socket } from '../socket.js';
import { useNavbar } from '../contexts/NavbarContext.jsx';
import CreateTaskModal from '../components/CreateTaskModal.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(n) {
  return n?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function Avatar({ name, color, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || '#7c3aed', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

function fmtDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtHours(h) {
  if (!h || h === 0) return '0h';
  const whole = Math.floor(h);
  const mins  = Math.round((h - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
}

// ─── Sidebar Card Section ─────────────────────────────────────────────────────

function SideCard({ title, icon, children }) {
  return (
    <div className="td-side-card">
      <div className="td-side-card-header">
        <span className="td-side-card-icon">{icon}</span>
        <span className="td-side-card-title">{title}</span>
      </div>
      <div className="td-side-card-body">{children}</div>
    </div>
  );
}

// ─── Drag & Drop Attachment Zone ──────────────────────────────────────────────

function DropZone({ onAttach, compact = false }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(f => onAttach(f));
  };

  return (
    <div
      className={`td-drop-zone ${dragging ? 'td-drop-zone--active' : ''} ${compact ? 'td-drop-zone--compact' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" multiple style={{ display: 'none' }}
        onChange={e => Array.from(e.target.files).forEach(f => onAttach(f))} />
      <div className="td-drop-zone-content">
        <span className="td-drop-zone-icon">{dragging ? '📂' : '📎'}</span>
        <span className="td-drop-zone-text">
          {dragging ? 'Drop to attach' : compact ? 'Attach files' : 'Drop files here or click to browse'}
        </span>
      </div>
    </div>
  );
}

// ─── Comment Rich-Text Editor ─────────────────────────────────────────────────

function CommentEditor({ value, onChange, onAttach, placeholder = 'Add a comment…', rows = 3, autoFocus = false }) {
  const taRef  = useRef(null);
  const filRef = useRef(null);

  const fmt = (prefix, suffix = prefix) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const selected = value.slice(s, e) || 'text';
    const newVal = value.slice(0, s) + prefix + selected + suffix + value.slice(e);
    onChange(newVal);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = s + prefix.length;
      ta.selectionEnd   = s + prefix.length + selected.length;
    }, 0);
  };

  const handleAttachFile = (file) => {
    if (onAttach) onAttach(file, (url, name) => {
      onChange(value + `\n[${name}](${url})`);
    });
  };

  return (
    <div className="ce-wrap">
      <div className="ce-toolbar">
        <button type="button" className="ce-btn" onClick={() => fmt('**')} title="Bold"><b>B</b></button>
        <button type="button" className="ce-btn ce-italic" onClick={() => fmt('_')} title="Italic">I</button>
        <button type="button" className="ce-btn" onClick={() => fmt('`')} title="Inline code">{'`'}</button>
        <button type="button" className="ce-btn" onClick={() => fmt('```\n', '\n```')} title="Code block">{'{ }'}</button>
        <button type="button" className="ce-btn" onClick={() => fmt('~~')} title="Strikethrough">S̶</button>
        <div className="ce-divider"/>
        <button type="button" className="ce-btn" title="Attach file"
          onClick={() => filRef.current?.click()}>📎</button>
        <input ref={filRef} type="file" multiple style={{ display: 'none' }}
          onChange={e => Array.from(e.target.files).forEach(f => handleAttachFile(f))} />
      </div>
      <textarea
        ref={taRef}
        className="ce-textarea"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            taRef.current?.dispatchEvent(new CustomEvent('ce-submit', { bubbles: true }));
          }
        }}
      />
      <div className="ce-footer">
        <span className="ce-hint">⌘+Enter to submit · Markdown supported</span>
      </div>
    </div>
  );
}

// ─── Log Hours Modal ──────────────────────────────────────────────────────────

function LogHoursModal({ taskId, onLogged, onClose }) {
  const [hours, setHours] = useState('');
  const [note,  setNote]  = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    const h = parseFloat(hours);
    if (!h || h <= 0) { toast({ message: 'Enter valid hours', type: 'error' }); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/tasks/${taskId}/log-hours`, { hours: h, note });
      onLogged(data);
      onClose();
      toast({ message: `Logged ${fmtHours(h)}`, type: 'success' });
    } catch { toast({ message: 'Failed to log hours', type: 'error' }); }
    finally  { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400, width: '90vw' }}>
        <div className="modal-header">
          <div className="modal-title">⏱ Log Hours</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Hours spent <span style={{ color: '#f87171' }}>*</span></label>
            <input type="number" min="0.25" step="0.25" className="form-input"
              placeholder="e.g. 2.5" value={hours} onChange={e => setHours(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="form-label">Note (optional)</label>
            <textarea className="form-input" rows={3} placeholder="What did you work on?"
              value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary"   onClick={submit}  disabled={saving}>
              {saving ? 'Logging…' : '+ Log Hours'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Link Task Modal ──────────────────────────────────────────────────────────

function LinkTaskModal({ sourceTaskId, onLinked, onClose }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [linkType, setLinkType] = useState('relates_to');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const delay = setTimeout(() => {
      setLoading(true);
      api.get('/tasks/search', { params: { search: search.trim() } })
        .then(res => setResults(res.data.filter(t => t.id !== sourceTaskId)))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(delay);
  }, [search, sourceTaskId]);

  const handleLink = async (targetId) => {
    setSaving(true);
    try {
      const { data } = await api.post(`/tasks/${sourceTaskId}/links`, { linkedTaskId: targetId, linkType });
      onLinked(data);
      toast({ message: 'Task linked', type: 'success' });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.error || 'Failed to link task', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500, width: '90vw' }}>
        <div className="modal-header">
          <div className="modal-title">🔗 Link Issue</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Link Type</label>
            <select className="form-select" value={linkType} onChange={e => setLinkType(e.target.value)}>
              <option value="relates_to">Relates to</option>
              <option value="blocks">Blocks</option>
              <option value="is_blocked_by">Is blocked by</option>
              <option value="clones">Clones</option>
            </select>
          </div>
          <div>
            <label className="form-label">Search for task</label>
            <input type="text" className="form-input" placeholder="Type task title or key (e.g. TF-123)"
              value={search} onChange={e => setSearch(e.target.value)} autoFocus />
          </div>
          
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)' }}>
            {loading ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Searching...</div> : (
              results.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                  {search.trim() ? 'No tasks found.' : 'Type to search...'}
                </div>
              ) : (
                results.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--accent-purple)' }}>{r.key_prefix}-{r.task_number}</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => handleLink(r.id)}>
                      Select
                    </button>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Task Modal ─────────────────────────────────────────────────────────

function EditTaskModal({ task, onUpdate, onClose }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [type, setType] = useState(task.task_type);
  const [priority, setPriority] = useState(task.priority);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!title.trim()) return toast({ message: 'Title is required', type: 'error' });
    setSaving(true);
    try {
      const { data } = await api.patch(`/tasks/${task.id}`, { title, description, task_type: type, priority });
      onUpdate(data);
      toast({ message: 'Task updated', type: 'success' });
      onClose();
    } catch {
      toast({ message: 'Failed to update task', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600, width: '95vw' }}>
        <div className="modal-header">
          <div className="modal-title">✏️ Edit Task</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="form-label">Title</label>
            <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label className="form-label">Issue Type</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <CommentEditor value={description} onChange={setDescription} rows={8} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Move Task Modal ─────────────────────────────────────────────────────────

function MoveTaskModal({ task, onMoved, onClose }) {
  const [projects, setProjects] = useState([]);
  const [targetProjectId, setTargetProjectId] = useState(task.project_id);
  const [type, setType] = useState(task.task_type);
  const [priority, setPriority] = useState(task.priority);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    api.get('/projects').then(res => {
      setProjects(res.data);
      setLoading(false);
    }).catch(() => toast({ message: 'Failed to load projects', type: 'error' }));
  }, [toast]);

  const handleMove = async () => {
    setMoving(true);
    try {
      const { data } = await api.post(`/tasks/${task.id}/move`, {
        targetProjectId: parseInt(targetProjectId),
        task_type: type,
        priority
      });
      onMoved(data);
      toast({ message: 'Task moved successfully', type: 'success' });
      onClose();
    } catch (err) {
      toast({ message: err.response?.data?.error || 'Failed to move task', type: 'error' });
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 450, width: '90vw' }}>
        <div className="modal-header">
          <div className="modal-title">🚚 Move Task</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {loading ? <div className="loading-spinner" style={{ margin: '20px auto' }} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Transfer this issue to another project. Note: The <b>Issue Key</b> will change to match the new project's numbering.
            </p>
            <div>
              <label className="form-label">Target Project</label>
              <select className="form-select" value={targetProjectId} onChange={e => setTargetProjectId(e.target.value)}>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.key_prefix})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Change Type</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Change Priority</label>
              <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose} disabled={moving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleMove} disabled={moving}>
                {moving ? 'Moving...' : 'Move Task'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const { projectId, taskKey } = useParams();
  const navigate  = useNavigate();
  const { setHeaderData, clearHeaderData } = useNavbar();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const taskNumber = parseInt(taskKey?.split('-').pop(), 10);

  const [task, setTask]            = useState(null);
  const taskRef = useRef(null);
  const [loading, setLoading]      = useState(true);
  const [users, setUsers]          = useState([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState('');
  const [editingDesc,  setEditingDesc]  = useState(false);
  const [descDraft,    setDescDraft]    = useState('');
  const [commentText,  setCommentText]  = useState('');
  const [editingComment, setEditingComment]   = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [showLogHours, setShowLogHours] = useState(false);
  const [editingEst, setEditingEst]  = useState(false);
  const [estDate, setEstDate]        = useState('');
  const [estTime, setEstTime]        = useState('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showCreateChildModal, setShowCreateChildModal] = useState(false);
  const [sprints, setSprints] = useState([]);
  const [sprintSaving, setSprintSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data } = await api.get(`/tasks/by-key/${projectId}/${taskNumber}`);
      setTask(data);
      taskRef.current = data;
      const ec = data.estimated_completion;
      if (ec) {
        const d = new Date(ec);
        setEstDate(d.toISOString().slice(0, 10));
        setEstTime(d.toISOString().slice(11, 16));
      }
    } catch {
      toast({ message: 'Task not found', type: 'error' });
      navigate(`/projects/${projectId}/board`);
    } finally { setLoading(false); }
  }, [projectId, taskNumber, navigate, toast]);

  useEffect(() => {
    if (task) {
      setHeaderData({ 
        projectName: `${task.key_prefix}-${task.task_number}`, 
        onBack: () => navigate(`/projects/${task.project_id}/board`) 
      });
    }
    return () => clearHeaderData();
  }, [task, setHeaderData, clearHeaderData, navigate]);

  useEffect(() => {
    loadData();

    socket.emit('join_project', projectId);

    const onTaskUpdated = (updatedTask) => {
      if (updatedTask.id === taskRef.current?.id) {
        setTask(prev => ({ ...prev, ...updatedTask }));
        taskRef.current = { ...taskRef.current, ...updatedTask };
      }
    };
    
    // Simplest way to sync side-data effortlessly is to just re-fetch the task data,
    // or optionally we manually inject the comments. Re-fetching provides total consistency.
    const onComponentUpdate = () => loadData();

    socket.on('task_updated', onTaskUpdated);
    socket.on('comment_added', onComponentUpdate);
    socket.on('comment_updated', onComponentUpdate);
    socket.on('comment_deleted', onComponentUpdate);

    return () => {
      socket.emit('leave_project', projectId);
      socket.off('task_updated', onTaskUpdated);
      socket.off('comment_added', onComponentUpdate);
      socket.off('comment_updated', onComponentUpdate);
      socket.off('comment_deleted', onComponentUpdate);
    };
  }, [projectId, loadData]);

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
    if (projectId) {
      api.get(`/sprints?projectId=${projectId}`).then(r => setSprints(r.data)).catch(() => {});
    }
  }, [projectId]);

  const patch = useCallback(async (body) => {
    const { data } = await api.patch(`/tasks/${task.id}`, body);
    setTask(prev => ({ ...prev, ...data }));
  }, [task?.id]);

  const saveTitle = async () => {
    const t = titleDraft.trim();
    if (t && t !== task.title) { try { await patch({ title: t }); } catch {} }
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    try { await patch({ description: descDraft }); } catch {}
    setEditingDesc(false);
  };

  const saveEstimated = async () => {
    if (!estDate) { setEditingEst(false); return; }
    const dt = estTime ? `${estDate}T${estTime}:00` : `${estDate}T00:00:00`;
    try { await patch({ estimated_completion: dt }); toast({ message: 'Saved', type: 'success' }); }
    catch {}
    setEditingEst(false);
  };

  const addComment = async () => {
    const c = commentText.trim();
    if (!c) return;
    try {
      const { data } = await api.post(`/tasks/${task.id}/comments`, { content: c });
      setTask(prev => ({ ...prev, comments: [...(prev.comments || []), data] }));
      setCommentText('');
    } catch { toast({ message: 'Failed to add comment', type: 'error' }); }
  };

  const saveComment = async (cid) => {
    const c = editCommentText.trim();
    if (!c) return;
    try {
      const { data } = await api.patch(`/tasks/${task.id}/comments/${cid}`, { content: c });
      setTask(prev => ({ ...prev, comments: prev.comments.map(x => x.id === cid ? data : x) }));
      setEditingComment(null);
    } catch {}
  };

  const deleteComment = async (cid) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.delete(`/tasks/${task.id}/comments/${cid}`);
      setTask(prev => ({ ...prev, comments: prev.comments.filter(x => x.id !== cid) }));
    } catch {}
  };

  const onNewHourLog = (log) => {
    const updated = [log, ...(task.hourLogs || [])];
    setTask(prev => ({ ...prev, hourLogs: updated, totalHoursLogged: updated.reduce((s, l) => s + l.hours, 0) }));
  };

  const deleteHourLog = async (logId) => {
    if (!confirm('Remove this log?')) return;
    try {
      await api.delete(`/tasks/${task.id}/log-hours/${logId}`);
      const updated = task.hourLogs.filter(l => l.id !== logId);
      setTask(prev => ({ ...prev, hourLogs: updated, totalHoursLogged: updated.reduce((s, l) => s + l.hours, 0) }));
    } catch {}
  };

  const handleAttach = async (file, cb) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post(`/tasks/${task.id}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTask(prev => ({ ...prev, attachments: [...(prev.attachments || []), data] }));
      if (cb) cb(`/uploads/${data.filename}`, data.original_name);
      toast({ message: 'Attached!', type: 'success' });
    } catch { toast({ message: 'Upload failed', type: 'error' }); }
  };

  const deleteAttachment = async (aid) => {
    if (!confirm('Remove attachment?')) return;
    try {
      await api.delete(`/tasks/${task.id}/attachments/${aid}`);
      setTask(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== aid) }));
    } catch {}
  };

  const deleteTask = async () => {
    if (!confirm(`Delete "${task.title}"?`)) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      toast({ message: 'Task deleted', type: 'success' });
      navigate(`/projects/${projectId}/board`);
    } catch { toast({ message: 'Failed to delete task', type: 'error' }); }
  };

  const onNewLink = (link) => {
    setTask(prev => ({ ...prev, links: [...(prev.links || []), link] }));
  };

  const deleteLink = async (linkId) => {
    if (!confirm('Remove this link?')) return;
    try {
      await api.delete(`/tasks/${task.id}/links/${linkId}`);
      setTask(prev => ({ ...prev, links: prev.links.filter(l => l.id !== linkId) }));
    } catch {}
  };

  const getChildType = (parentType) => {
    if (parentType === 'epic') return 'story';
    if (parentType === 'story') return 'task';
    return 'subtask';
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;
  if (!task)   return null;

  const canEdit   = isAdmin || task.creator_id === user?.id || task.assignee_id === user?.id || task.project_owner_id === user?.id;
  const isAssignee = task.assignee_id === user?.id;
  const tm  = TYPE_META[task.task_type] || TYPE_META.task;
  const col = COLUMNS.find(c => c.id === task.status);
  const hoursLogged = task.totalHoursLogged || 0;
  const hoursEst    = task.hours_estimated  || 0;
  const hoursPct    = hoursEst > 0 ? Math.min((hoursLogged / hoursEst) * 100, 100) : 0;
  const estDisplay  = task.estimated_completion
    ? new Date(task.estimated_completion).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="task-detail-page">

      <div className="td-layout">
        {/* ── MAIN CONTENT ── */}
        <div className="td-main">

          {/* Breadcrumbs: OGLA › OGLA-5 › OGLA-6 */}
          <nav className="td-breadcrumbs">
            <span
              className="td-crumb td-crumb--link"
              onClick={() => navigate(`/projects/${projectId}/board`)}
              title="Back to board"
            >
              📋 {task.key_prefix}
            </span>
            {task.parent_id && task.parent_title && (
              <>
                <span className="td-crumb-arrow">›</span>
                <span
                  className="td-crumb td-crumb--link"
                  onClick={() => navigate(`/projects/${projectId}/tasks/${task.parent_key_prefix}-${task.parent_task_number}`)}
                >
                  {TYPE_META[task.parent_task_type]?.icon} {task.parent_key_prefix}-{task.parent_task_number}
                </span>
              </>
            )}
            <span className="td-crumb-arrow">›</span>
            <span className="td-crumb td-crumb--current">{tm.icon} {task.key_prefix}-{task.task_number}</span>
          </nav>

          {/* Title */}
          <div className="td-title-wrap">
            {editingTitle ? (
              <input
                className="td-title-input"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                autoFocus
              />
            ) : (
              <h1
                className="td-title"
                onClick={() => canEdit && (setTitleDraft(task.title), setEditingTitle(true))}
                title={canEdit ? 'Click to edit title' : undefined}
              >
                {task.title}
              </h1>
            )}
          </div>

          {/* Action bar — directly below Title */}
          <div className="td-action-bar" style={{ margin: '16px 0 24px 0' }}>
            {canEdit && (
              <button className="btn btn-secondary btn-sm"
                onClick={() => setShowEditModal(true)}>
                ✏️ Edit
              </button>
            )}
            {canEdit && (
              <button className="btn btn-secondary btn-sm"
                onClick={() => setShowMoveModal(true)}>
                🚚 Move
              </button>
            )}
            {canEdit && (
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                📎 Attach
                <input type="file" style={{ display: 'none' }} onChange={e => handleAttach(e.target.files[0])} />
              </label>
            )}
            {canEdit && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowLinkModal(true)}>
                🔗 Link
              </button>
            )}
            {(isAdmin || task.creator_id === user?.id || task.project_owner_id === user?.id) && (
              <button className="btn btn-danger btn-sm" onClick={deleteTask}>🗑 Delete</button>
            )}
          </div>

          {/* Quick details row */}
          <div className="td-details-grid">
            {[
              { label: 'Type', value: <span className={`type-badge type-${task.task_type}`}>{tm.icon} {tm.label}</span> },
              { label: 'Priority', value: <span className={`priority-badge priority-${task.priority}`}>{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span> },
              { label: 'Status', value: (
                <select className="td-inline-select" value={task.status}
                  onChange={e => patch({ status: e.target.value })} disabled={!canEdit}>
                  {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )},
            ].map(({ label, value }) => (
              <div key={label} className="td-detail-row">
                <span className="td-detail-label">{label}</span>
                <span className="td-detail-value">{value}</span>
              </div>
            ))}
          </div>

          {/* ── Linked Issues ── */}
          {task.links?.length > 0 && (
            <div className="td-section">
              <h3 className="td-section-title">Linked Issues <span className="td-count">{task.links.length}</span></h3>
              <div className="td-subtask-list">
                {task.links.map(l => {
                  const sm = TYPE_META[l.other_task_type] || TYPE_META.task;
                  const sc = COLUMNS.find(c => c.id === l.other_task_status);
                  
                  let relationText = l.link_type.replace(/_/g, ' ');
                  if (!l.isSource && l.link_type === 'blocks') relationText = 'is blocked by';
                  else if (!l.isSource && l.link_type === 'is_blocked_by') relationText = 'blocks';

                  return (
                    <div key={l.id} className="td-subtask-item" style={{ position: 'relative' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginRight: 10, minWidth: 60, textTransform: 'uppercase' }}>
                        {relationText}
                      </span>
                      <span className="td-subtask-type" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${projectId}/tasks/${l.other_task_key}`)}>{sm.icon}</span>
                      <span className="task-id" style={{ color: 'var(--accent-purple)', cursor: 'pointer' }} onClick={() => navigate(`/projects/${projectId}/tasks/${l.other_task_key}`)}>{l.other_task_key}</span>
                      <span className="td-subtask-title" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${projectId}/tasks/${l.other_task_key}`)}>{l.other_task_title}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4 }}>
                        {sc?.label || l.other_task_status}
                      </span>
                      <button className="btn btn-ghost btn-xs" style={{ marginLeft: 6, padding: '2px 6px' }} onClick={() => deleteLink(l.id)}>
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Description ── */}
          <div className="td-section">
            <h3 className="td-section-title">Description</h3>
            {editingDesc ? (
              <div>
                <CommentEditor
                  value={descDraft}
                  onChange={setDescDraft}
                  onAttach={handleAttach}
                  placeholder="Add a description…"
                  rows={6}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={saveDesc}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingDesc(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div
                className="td-desc-content"
                onClick={() => canEdit && (setDescDraft(task.description || ''), setEditingDesc(true))}
                style={{ cursor: canEdit ? 'text' : 'default', padding: '12px 16px', borderRadius: '8px', border: '1px solid transparent', transition: 'border-color var(--transition)' }}
                onMouseEnter={e => canEdit && (e.currentTarget.style.borderColor = 'var(--border)')}
                onMouseLeave={e => canEdit && (e.currentTarget.style.borderColor = 'transparent')}
              >
                {task.description
                  ? <div className="markdown-body"><ReactMarkdown>{String(task.description || '')}</ReactMarkdown></div>
                  : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No description. Click to add one.</span>}
              </div>
            )}
          </div>

          {/* ── Child Issues / Subtasks ── */}
          <div className="td-section">
            <h3 className="td-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                Child Issues
                {task.subtasks?.length > 0 && <span className="td-count">{task.subtasks.length}</span>}
              </span>
              {canEdit && (
                <button className="btn btn-ghost btn-sm" style={{ fontWeight: 600, color: 'var(--accent-purple)' }} onClick={() => setShowCreateChildModal(true)}>
                  + Add Child
                </button>
              )}
            </h3>
            
            {task.subtasks?.length > 0 ? (
              <div className="td-subtask-list">
                {task.subtasks.map(st => {
                  const stm = TYPE_META[st.task_type] || TYPE_META.task;
                  const stc = COLUMNS.find(c => c.id === st.status);
                  return (
                    <div key={st.id} className="td-subtask-item">
                      <span className="td-subtask-type" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${projectId}/tasks/${st.key_prefix}-${st.task_number}`)}>{stm.icon}</span>
                      <span className="task-id" style={{ color: 'var(--accent-purple)', cursor: 'pointer' }} onClick={() => navigate(`/projects/${projectId}/tasks/${st.key_prefix}-${st.task_number}`)}>{st.key_prefix}-{st.task_number}</span>
                      <span className="td-subtask-title" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${projectId}/tasks/${st.key_prefix}-${st.task_number}`)}>{st.title}</span>
                      {st.assignee_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', marginRight: 12 }}>
                          <Avatar name={st.assignee_name} color={st.assignee_color} size={20} />
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{st.assignee_name.split(' ')[0]}</span>
                        </div>
                      )}
                      <span style={{ marginLeft: st.assignee_name ? 0 : 'auto', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4 }}>
                        {stc?.label || st.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '16px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No child issues attached.
              </div>
            )}
          </div>

          {/* ── Attachments ── */}
          <div className="td-section">
            <h3 className="td-section-title">
              Attachments
              {task.attachments?.length > 0 && <span className="td-count">{task.attachments.length}</span>}
            </h3>
            <DropZone onAttach={handleAttach} />
            {task.attachments?.length > 0 && (
              <div className="td-attach-list" style={{ marginTop: 10 }}>
                {task.attachments.map(a => (
                  <div key={a.id} className="td-attach-item">
                    <span className="td-attach-icon">
                      {/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(a.original_name) ? '🖼' : '📄'}
                    </span>
                    <div className="td-attach-info">
                      <a href={`/uploads/${a.filename}`} target="_blank" rel="noreferrer" className="td-attach-name">
                        {a.original_name}
                      </a>
                      <div className="td-attach-meta">
                        {(a.size / 1024).toFixed(1)} KB · {a.user_name} · {fmtDate(a.created_at)}
                      </div>
                    </div>
                    {(isAdmin || a.user_id === user?.id) && (
                      <button className="btn btn-ghost btn-icon" onClick={() => deleteAttachment(a.id)} title="Remove">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Activity / Comments ── */}
          <div className="td-section">
            <h3 className="td-section-title">
              Activity <span className="td-count">{task.comments?.length || 0}</span>
            </h3>
            <div className="td-comments">
              {(task.comments || []).map(c => (
                <div key={c.id} className="td-comment">
                  <Avatar name={c.user_name} color={c.user_color} size={30} />
                  <div className="td-comment-body">
                    <div className="td-comment-header">
                      <strong>{c.user_name}</strong>
                      <span className="td-comment-ts">{fmtDate(c.created_at)}</span>
                      {(c.user_id === user?.id || isAdmin) && (
                        <div className="td-comment-actions">
                          <button className="btn btn-ghost btn-xs"
                            onClick={() => { setEditingComment(c.id); setEditCommentText(c.content); }}>
                            Edit
                          </button>
                          <button className="btn btn-ghost btn-xs" onClick={() => deleteComment(c.id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    {editingComment === c.id ? (
                      <div>
                        <CommentEditor
                          value={editCommentText}
                          onChange={setEditCommentText}
                          onAttach={handleAttach}
                          rows={3}
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => saveComment(c.id)}>Save</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingComment(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="td-comment-content markdown-body">
                        <ReactMarkdown>{String(c.content || '')}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* New comment */}
              <div className="td-new-comment">
                <Avatar name={user?.name} color={user?.avatar_color} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CommentEditor
                    value={commentText}
                    onChange={setCommentText}
                    onAttach={(file, cb) => handleAttach(file, cb)}
                    placeholder="Add a comment… (Markdown supported)"
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={addComment}
                      disabled={!commentText.trim()}
                    >
                      Comment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="td-sidebar">

          {/* People */}
          <SideCard title="People" icon="👥">
            <div className="td-side-row">
              <span className="td-side-label">Assignee</span>
              {canEdit ? (
                <select className="td-side-select" value={task.assignee_id || ''}
                  onChange={e => patch({ assigneeId: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {task.assignee_name
                    ? <><Avatar name={task.assignee_name} color={task.assignee_color} size={22} />
                        <span style={{ fontSize: 12 }}>{task.assignee_name}</span></>
                    : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unassigned</span>}
                </div>
              )}
            </div>
            <div className="td-side-row" style={{ marginBottom: 0 }}>
              <span className="td-side-label">Reporter</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Avatar name={task.creator_name} color={task.creator_color} size={22} />
                <span style={{ fontSize: 12 }}>{task.creator_name || '—'}</span>
              </div>
            </div>
          </SideCard>

          {/* Time Tracking */}
          <SideCard title="Time Tracking" icon="⏱">
            {/* Hours bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Hours logged</span>
                <span style={{ fontWeight: 700, color: hoursLogged > 0 ? (hoursLogged > hoursEst && hoursEst > 0 ? '#ef4444' : 'var(--accent-cyan)') : 'var(--text-muted)' }}>
                  {fmtHours(hoursLogged)}
                  {hoursEst > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {fmtHours(hoursEst)}</span>}
                </span>
              </div>
              
              <div style={{ 
                height: 10, 
                borderRadius: 5, 
                background: 'var(--bg-elevated)', 
                overflow: 'hidden', 
                display: 'flex',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
                border: hoursLogged > hoursEst && hoursEst > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent'
              }}>
                {task.hourLogs?.length > 0 ? (
                  [...task.hourLogs].reverse().map((l, i) => {
                    const segmentWidth = hoursEst > 0 ? (l.hours / Math.max(hoursEst, hoursLogged)) * 100 : 0;
                    const shades = ['#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#67e8f9'];
                    const color = hoursLogged > hoursEst && hoursEst > 0 ? `rgba(239,68,68, ${0.4 + (i % 5)*0.1})` : shades[i % shades.length];
                    
                    return (
                      <div 
                        key={l.id} 
                        style={{ 
                          width: `${segmentWidth}%`, 
                          height: '100%', 
                          background: color,
                          transition: 'width 0.4s ease',
                          cursor: 'default'
                        }}
                        title={`${new Date(l.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${fmtHours(l.hours)}${l.note ? ` (${l.note})` : ''}`}
                      />
                    );
                  })
                ) : null}
              </div>
              {hoursLogged > hoursEst && hoursEst > 0 && (
                <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4, fontWeight: 600 }}>
                   ⚠️ Over estimate by {fmtHours(hoursLogged - hoursEst)}
                </div>
              )}
            </div>

            {/* Est hours — assignee or admin */}
            <div className="td-side-row">
              <span className="td-side-label">Est. hours</span>
              {(isAssignee || isAdmin) ? (
                <input type="number" min="0" step="0.5" className="td-side-input"
                  placeholder="0"
                  defaultValue={hoursEst || ''}
                  onBlur={e => patch({ hours_estimated: parseFloat(e.target.value) || 0 })} />
              ) : (
                <span style={{ fontSize: 12 }}>{hoursEst ? fmtHours(hoursEst) : '—'}</span>
              )}
            </div>

            {/* Log Hours — ONLY assignee */}
            {isAssignee && (
              <button className="btn btn-secondary btn-sm"
                style={{ width: '100%', marginTop: 4, marginBottom: 12 }}
                onClick={() => setShowLogHours(true)}>
                + Log Hours
              </button>
            )}

            {/* Estimated completion */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Est. Completion
              </div>
              {(isAssignee || isAdmin) ? (
                editingEst ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="date" className="td-side-input" style={{ flex: 1 }}
                        value={estDate} onChange={e => setEstDate(e.target.value)} />
                      <input type="time" className="td-side-input" style={{ flex: 1 }}
                        value={estTime} onChange={e => setEstTime(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={saveEstimated}>Save</button>
                      <button className="btn btn-ghost btn-sm"   style={{ flex: 1 }} onClick={() => setEditingEst(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="td-est-pill" onClick={() => setEditingEst(true)}
                    title="Click to set estimated completion">
                    {estDisplay || '+ Set completion date'}
                  </div>
                )
              ) : (
                <div style={{ fontSize: 12, color: estDisplay ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {estDisplay || '—'}
                </div>
              )}
            </div>

            {/* Logs list removed as per user request */}
          </SideCard>

          {/* Dates */}
          <SideCard title="Dates" icon="📅">
            <div className="td-side-row">
              <span className="td-side-label">Created</span>
              <span style={{ fontSize: 12 }}>{fmtDate(task.created_at)}</span>
            </div>
            <div className="td-side-row" style={{ marginBottom: 0 }}>
              <span className="td-side-label">Updated</span>
              <span style={{ fontSize: 12 }}>{fmtDate(task.updated_at)}</span>
            </div>
          </SideCard>

          <SideCard title="Issue Info" icon="🔖">
            <div className="td-side-row">
              <span className="td-side-label">Issue ID</span>
              <span className="task-id" style={{ color: 'var(--accent-purple)' }}>{task.key_prefix}-{task.task_number}</span>
            </div>
            <div className="td-side-row">
              <span className="td-side-label">Priority</span>
              <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
            </div>
            <div className="td-side-row">
              <span className="td-side-label">Type</span>
              <span className={`type-badge type-${task.task_type}`}>{tm.icon} {tm.label}</span>
            </div>
            <div className="td-side-row">
              <span className="td-side-label">Sprint</span>
              <select
                disabled={sprintSaving}
                value={task.sprint_id || ''}
                className="form-select"
                style={{ fontSize: 11, padding: '3px 6px', minWidth: 0, flex: 1 }}
                onChange={async (e) => {
                  const newSprintId = e.target.value ? Number(e.target.value) : null;
                  const oldSprintId = task.sprint_id;
                  setSprintSaving(true);
                  try {
                    if (oldSprintId) {
                      await api.delete(`/sprints/${oldSprintId}/tasks/${task.id}`);
                    }
                    if (newSprintId) {
                      await api.post(`/sprints/${newSprintId}/tasks`, { taskId: task.id });
                    }
                    setTask(prev => ({ ...prev, sprint_id: newSprintId }));
                    toast({ message: newSprintId ? 'Added to sprint' : 'Removed from sprint', type: 'success' });
                  } catch {
                    toast({ message: 'Failed to update sprint', type: 'error' });
                  } finally {
                    setSprintSaving(false);
                  }
                }}
              >
                <option value="">— No Sprint —</option>
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.status === 'active' ? '🟢' : s.status === 'completed' ? '✓' : '○'}
                  </option>
                ))}
              </select>
            </div>
            {task.parent_id && (
              <div className="td-side-row" style={{ marginBottom: 0 }}>
                <span className="td-side-label">Parent</span>
                <span
                  style={{ fontSize: 12, color: 'var(--accent-purple)', cursor: 'pointer', textDecoration: 'underline dotted' }}
                  onClick={() => navigate(`/projects/${projectId}/tasks/${task.parent_key_prefix}-${task.parent_task_number}`)}>
                  {task.parent_key_prefix}-{task.parent_task_number}
                </span>
              </div>
            )}
          </SideCard>
        </aside>
      </div>

      {showLogHours && (
        <LogHoursModal 
          taskId={task.id} 
          onLogged={onNewHourLog} 
          onClose={() => setShowLogHours(false)} 
        />
      )}

      {showLinkModal && (
        <LinkTaskModal 
          sourceTaskId={task.id} 
          onLinked={onNewLink} 
          onClose={() => setShowLinkModal(false)} 
        />
      )}

      {showEditModal && (
        <EditTaskModal
          task={task}
          onUpdate={(t) => setTask(prev => ({ ...prev, ...t }))}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showMoveModal && (
        <MoveTaskModal
          task={task}
          onMoved={(t) => navigate(`/projects/${t.project_id}/tasks/${t.key_prefix}-${t.task_number}`, { replace: true })}
          onClose={() => setShowMoveModal(false)}
        />
      )}

      {showCreateChildModal && (
        <CreateTaskModal
          projectId={projectId}
          members={users}
          allTasks={[task]} 
          initialParentId={task.id}
          initialType={getChildType(task.task_type)}
          onClose={() => setShowCreateChildModal(false)}
          onCreated={(newTask) => {
            setTask(prev => ({ ...prev, subtasks: [...(prev.subtasks || []), newTask] }));
          }}
        />
      )}
    </div>
  );
}
