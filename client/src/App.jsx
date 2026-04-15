import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { NavbarProvider } from './contexts/NavbarContext.jsx';
import Navbar from './components/Navbar.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SetupPage from './pages/SetupPage.jsx';
import HomePage from './pages/HomePage.jsx';
import BoardPage from './pages/BoardPage.jsx';
import BacklogPage from './pages/BacklogPage.jsx';
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
  if (user.role !== 'admin' && user.role !== 'lead') return <Navigate to="/home" replace />;
  return children;
}

function AuthenticatedLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

export default function App() {
  const [needsSetup, setNeedsSetup] = useState(null);
  const [dbError, setDbError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/auth/needs-setup')
      .then(r => {
        setNeedsSetup(r.data.needsSetup);
        setDbError(null);
      })
      .catch((err) => {
        console.error('Initial check failed:', err);
        if (err.response?.status === 500) {
          setDbError(err.response.data.details || 'Connection Refused');
        } else {
          setNeedsSetup(false);
        }
      });
  }, []);

  if (dbError) {
    return (
      <div className="fatal-error-screen">
        <div className="error-card shadow-lg">
          <div className="error-icon">⚠️</div>
          <h2>Database Connection Error</h2>
          <p>TeamFlow cannot connect to the PostgreSQL database.</p>
          <div className="error-details">
            <code>{dbError}</code>
          </div>
          <div className="error-actions">
            <p className="tip"><strong>Tip:</strong> Ensure your <code>DATABASE_URL</code> is correctly set in the Render Dashboard environment variables.</p>
            <button className="btn-primary" onClick={() => window.location.reload()}>Retry Connection</button>
          </div>
        </div>
      </div>
    );
  }

  if (needsSetup === null) {
    return <div className="loading-screen"><div className="loading-spinner" /></div>;
  }

  return (
    <BrowserRouter>
      <NavbarProvider>
        <ToastProvider>
          <Routes>
            <Route path="/setup" element={
              needsSetup ? <SetupPage onSetupDone={() => setNeedsSetup(false)} /> : <Navigate to="/login" replace />
            } />
            <Route path="/login" element={
              needsSetup ? <Navigate to="/setup" replace /> : (user ? <Navigate to="/home" replace /> : <LoginPage />)
            } />

            {/* Authenticated Routes with Global Navbar */}
            <Route element={<ProtectedRoute><AuthenticatedLayout /></ProtectedRoute>}>
              <Route path="/home" element={<HomePage />} />
              
              {/* Board, Backlog & Task Detail */}
              <Route path="/projects/:projectId/board" element={<BoardPage />} />
              <Route path="/projects/:projectId/backlog" element={<BacklogPage />} />
              <Route path="/projects/:projectId/tasks/:taskKey" element={<TaskDetailPage />} />

              {/* Admin */}
              <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

              {/* Profile */}
              <Route path="/profile" element={<ProfilePage />} />
              
              {/* Global Pages */}
              <Route path="/projects/all" element={<AllProjectsPage />} />
              <Route path="/issues" element={<IssuesPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Route>

            {/* Catch-all → home or login */}
            <Route path="*" element={<Navigate to={user ? '/home' : '/login'} replace />} />
          </Routes>
        </ToastProvider>
      </NavbarProvider>
    </BrowserRouter>
  );
}
