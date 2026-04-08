import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import BoardPage from './pages/BoardPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import TaskDetailPage from './pages/TaskDetailPage.jsx';
import api from './api.js';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/projects" replace />;
  return children;
}

export default function App() {
  const [needsSetup, setNeedsSetup] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/auth/needs-setup')
      .then(r => setNeedsSetup(r.data.needsSetup))
      .catch(() => setNeedsSetup(false));
  }, []);

  if (needsSetup === null) {
    return <div className="loading-screen"><div className="loading-spinner" /></div>;
  }

  return (
    <BrowserRouter>
      {/* ToastProvider is inside BrowserRouter so useNavigate works in toasts */}
      <ToastProvider>
        <Routes>
          <Route path="/setup" element={
            needsSetup ? <SetupPage onSetupDone={() => setNeedsSetup(false)} /> : <Navigate to="/login" replace />
          } />
          <Route path="/login" element={
            needsSetup ? <Navigate to="/setup" replace /> : (user ? <Navigate to="/projects" replace /> : <LoginPage />)
          } />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId/board" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId/tasks/:taskId" element={<ProtectedRoute><TaskDetailPage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="*" element={<Navigate to={user ? '/projects' : '/login'} replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
