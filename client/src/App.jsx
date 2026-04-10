import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import HomePage from './pages/HomePage.jsx';
import BoardPage from './pages/BoardPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import TaskDetailPage from './pages/TaskDetailPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AllProjectsPage from './pages/AllProjectsPage.jsx';
import IssuesPage from './pages/IssuesPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import api from './api.js';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/home" replace />;
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
      <ToastProvider>
        <Routes>
          <Route path="/setup" element={
            needsSetup ? <SetupPage onSetupDone={() => setNeedsSetup(false)} /> : <Navigate to="/login" replace />
          } />
          <Route path="/login" element={
            needsSetup ? <Navigate to="/setup" replace /> : (user ? <Navigate to="/home" replace /> : <LoginPage />)
          } />

          {/* Home is the post-login greeting space */}
          <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />

          {/* Board & Task Detail */}
          <Route path="/projects/:projectId/board" element={<ProtectedRoute><BoardPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId/tasks/:taskKey" element={<ProtectedRoute><TaskDetailPage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

          {/* Profile */}
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          
          {/* Global Pages */}
          <Route path="/projects/all" element={<ProtectedRoute><AllProjectsPage /></ProtectedRoute>} />
          <Route path="/issues" element={<ProtectedRoute><IssuesPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />

          {/* Catch-all → home or login */}
          <Route path="*" element={<Navigate to={user ? '/home' : '/login'} replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
