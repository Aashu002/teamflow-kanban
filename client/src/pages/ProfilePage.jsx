import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { useNavbar } from '../contexts/NavbarContext.jsx';

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/8.x/bottts/svg?seed=Felix',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Aneka',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Mimi',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Buster',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Bella',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Max',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Leo',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Cookie',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Ginger',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Oscar'
];

const TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Calcutta",
  "Asia/Tokyo",
  "Australia/Sydney"
];

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { showToast } = useToast();
  const { setHeaderData, clearHeaderData } = useNavbar();
  
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [email, setEmail] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchProfile();
    setHeaderData({ projectName: 'My Profile' });
    return () => clearHeaderData();
  }, [setHeaderData, clearHeaderData]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/me');
      setProfileData(res.data);
      setName(res.data.name || '');
      setTimezone(res.data.timezone || 'UTC');
      setEmail(res.data.email || '');
      setAvatarUrl(res.data.avatar_url || null);
    } catch (err) {
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!name) return showToast('Name cannot be empty', 'error');

    try {
      const res = await api.put('/users/me/profile', {
        name, timezone, avatar_url: avatarUrl
      });
      // update context so navbar changes immediately
      updateUser({ name, timezone, avatar_url: avatarUrl });
      showToast('Profile updated effectively!', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update profile', 'error');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      return showToast('Please fill all password fields', 'error');
    }
    if (newPassword !== confirmPassword) {
      return showToast('New passwords do not match', 'error');
    }

    try {
      await api.put('/users/me/password', { currentPassword, newPassword });
      showToast('Password changed successfully. Please log in again.', 'success');
      // Sign-out the user after password change per requirement
      setTimeout(() => logout(), 1500);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to change password', 'error');
    }
  };

  if (loading) {
    return (
      <div className="board-page">
        <div className="flex-center" style={{ flex: 1 }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="board-page" style={{ overflowY: 'auto' }}>
      
      <div className="admin-container" style={{ padding: '40px 32px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 32 }}>My Profile</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* General Profile Section */}
            <div className="auth-card" style={{ width: '100%', maxWidth: 'none', padding: '24px', animation: 'none' }}>
              <h2 style={{ fontSize: 18, marginBottom: 20 }}>General Information</h2>
              <form onSubmit={handleProfileSave}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={email} disabled style={{ opacity: 0.6 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Timezone</label>
                  <select className="form-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: 24 }}>
                  <label className="form-label">Avatar Options</label>
                  <div className="avatar-picker-grid">
                    <div 
                      className={`avatar-option ${avatarUrl === null ? 'selected' : ''}`}
                      onClick={() => setAvatarUrl(null)}
                      title="Use initials"
                    >
                      <div className="user-avatar" style={{ background: profileData?.avatar_color, width: 44, height: 44, fontSize: 16 }}>
                        {name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
                      </div>
                    </div>
                    {AVATAR_OPTIONS.map(url => (
                      <div 
                        key={url} 
                        className={`avatar-option ${avatarUrl === url ? 'selected' : ''}`}
                        onClick={() => setAvatarUrl(url)}
                      >
                        <img src={url} alt="avatar" />
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 24, textAlign: 'right' }}>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            </div>

            {/* Security Section */}
            <div className="auth-card" style={{ width: '100%', maxWidth: 'none', padding: '24px', animation: 'none' }}>
              <h2 style={{ fontSize: 18, marginBottom: 20 }}>Security</h2>
              <form onSubmit={handlePasswordChange}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input className="form-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="form-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <div style={{ marginTop: 24, textAlign: 'right' }}>
                  <button type="submit" className="btn btn-danger">Change Password</button>
                </div>
              </form>
            </div>
          </div>

          {/* Projects Section */}
          <div className="auth-card" style={{ width: '100%', maxWidth: 'none', padding: '24px', animation: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18 }}>My Projects</h2>
              <span className="col-badge" style={{ fontSize: 14 }}>{profileData?.projects?.length || 0} Total</span>
            </div>

            {(!profileData?.projects || profileData.projects.length === 0) ? (
              <p className="text-muted" style={{ fontSize: 14 }}>You are not part of any projects yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {profileData.projects.map(p => {
                  const isOwner = p.owner_id === user.id;
                  return (
                    <div key={p.id} className="project-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="project-card-icon" style={{ width: 36, height: 36, fontSize: 16 }}>⚡</div>
                        <div>
                          <div className="project-card-name" style={{ marginBottom: 2 }}>{p.name}</div>
                          <div className="text-muted" style={{ fontSize: 11, fontFamily: 'monospace' }}>{p.key_prefix}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className={`role-badge ${isOwner ? 'role-admin' : 'role-member'}`}>
                          {isOwner ? 'Owner' : 'Member'}
                        </span>
                        <a href={`/projects/${p.id}/board`} className="btn btn-secondary btn-sm">View</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
