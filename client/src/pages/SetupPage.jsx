import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import api from '../api.js';

export default function SetupPage({ onSetupDone }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/setup', form);
      login(data.token, data.user);
      onSetupDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">⚡</div>
          <h1>TeamFlow</h1>
        </div>
        <div className="auth-badge">🎉 First-time setup</div>
        <p className="auth-subtitle">
          Create the <strong>admin account</strong>. You'll control all users, projects, and team access from here.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input id="setup-name" name="name" className="form-input" placeholder="Jane Smith" value={form.name} onChange={handle} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input id="setup-email" name="email" type="email" className="form-input" placeholder="jane@company.com" value={form.email} onChange={handle} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input id="setup-password" name="password" type="password" className="form-input" placeholder="Min. 6 characters" value={form.password} onChange={handle} required minLength={6} />
          </div>
          <button id="setup-submit" type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating admin…' : 'Create Admin & Continue →'}
          </button>
        </form>
      </div>
    </div>
  );
}
