import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { setTheme } from '../lib/theme.js';

export default function ProfilePage() {
  const { user, reload, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [name, setName] = useState(user.displayName);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });

  const run = async (fn, ok) => {
    try { await fn(); if (ok) toast(ok, 'success'); await reload(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const onAvatar = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) run(() => api.upload('/user/avatar', f), 'Profile picture updated');
  };

  const changeTheme = (theme) => { setTheme(theme); run(() => api.patch('/user/settings', { theme })); };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">Profile and settings</h1>

        <section className="card flex flex-wrap items-center gap-4 p-5">
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="Your profile" className="h-16 w-16 rounded-full object-cover" />
            : <span className="grid h-16 w-16 place-items-center rounded-full bg-accent text-2xl font-semibold text-accent-ink">{user.displayName[0]?.toUpperCase()}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{user.displayName}</p>
            <p className="truncate text-sm text-mute">{user.email}</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onAvatar} />
          <button className="btn-ghost" onClick={() => fileRef.current.click()}>Change picture</button>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Name</h2>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => api.patch('/user/profile', { displayName: name }), 'Name saved'); }}>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required aria-label="Display name" />
            <button className="btn-primary" disabled={!name.trim() || name === user.displayName}>Save</button>
          </form>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Preferences</h2>
          <label className="flex items-center justify-between gap-4 text-sm">Theme
            <select className="field w-40" value={user.settings.theme} onChange={(e) => changeTheme(e.target.value)}>
              <option value="system">Match device</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">Search the web by default
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={user.settings.webSearchDefault}
              onChange={(e) => run(() => api.patch('/user/settings', { webSearchDefault: e.target.checked }))} />
          </label>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold">Connected services</h2>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Microsoft OneNote</p>
              <p className="text-mute">{user.connections.microsoft ? `${user.connections.microsoft.status === 'active' ? 'Connected' : 'Needs reconnecting'}${user.connections.microsoft.email ? ` as ${user.connections.microsoft.email}` : ''}` : 'Not connected'}</p>
            </div>
            <Link to="/onenote" className="btn-ghost">Manage</Link>
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Change password</h2>
          <form className="space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await api.post('/auth/change-password', pw); toast('Password changed. Please log in again.', 'success'); await logout(); navigate('/login'); }
            catch (err) { toast(err.message, 'error'); }
          }}>
            <input className="field" type="password" placeholder="Current password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            <input className="field" type="password" placeholder="New password (8+ characters)" autoComplete="new-password" minLength={8} required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            <button className="btn-ghost">Update password</button>
          </form>
        </section>

        <section className="flex flex-wrap gap-3">
          <button className="btn-ghost" onClick={async () => { await logout(); navigate('/login'); }}>Log out</button>
          <button className="btn-danger" onClick={async () => {
            if (!window.confirm('Delete your account and all chats permanently? This cannot be undone.')) return;
            try { await api.del('/user'); await logout(); navigate('/register'); } catch (e) { toast(e.message, 'error'); }
          }}>Delete account</button>
        </section>
      </div>
    </div>
  );
}
