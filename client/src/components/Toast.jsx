import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(p => p.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 300);
  }, []);

  const toast = useCallback(({ message, issueId, issueKey, projectId, taskId, type = 'success', duration = 5000 }) => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, issueId, issueKey, projectId, taskId, type, leaving: false }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const navigate = useNavigate();

  const handleIssueClick = () => {
    if (toast.projectId && toast.taskId) {
      navigate(`/projects/${toast.projectId}/tasks/${toast.taskId}`);
      onDismiss();
    }
  };

  return (
    <div className={`toast toast-${toast.type} ${toast.leaving ? 'toast-leaving' : ''}`}>
      <div className="toast-icon">
        {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
      </div>
      <div className="toast-body">
        <span className="toast-message">{toast.message}</span>
        {toast.issueKey && (
          <button className="toast-issue-link" onClick={handleIssueClick}>
            {toast.issueKey} ↗
          </button>
        )}
      </div>
      <button className="toast-close" onClick={onDismiss}>✕</button>
    </div>
  );
}
