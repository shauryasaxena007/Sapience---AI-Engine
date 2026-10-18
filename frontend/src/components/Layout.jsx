import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { setTheme } from '../lib/theme.js';
import Icon from './Icon.jsx';

function Logo() {
  return (
    <Link to="/chat" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-ink"><Icon name="note" className="h-4 w-4" /></span>
      Sapience AI
    </Link>
  );
}

function ChatItem({ chat, active, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const submit = () => { setEditing(false); if (title.trim() && title !== chat.title) onRename(chat.id, title.trim()); else setTitle(chat.title); };
  if (editing) {
    return (
      <input autoFocus className="field my-0.5" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={submit}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setEditing(false); setTitle(chat.title); } }} />
    );
  }
  return (
    <div className={`group flex items-center rounded-lg ${active ? 'bg-accent/10' : 'hover:bg-paper'}`}>
      <NavLink to={`/chat/${chat.id}`} className={`min-w-0 flex-1 truncate px-3 py-2 text-sm ${active ? 'font-semibold text-accent' : ''}`}>{chat.title}</NavLink>
      <button className="p-1.5 text-mute opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100" onClick={() => setEditing(true)} aria-label={`Rename ${chat.title}`}><Icon name="pencil" className="h-4 w-4" /></button>
      <button className="p-1.5 pr-2 text-mute opacity-0 hover:text-red-500 focus:opacity-100 group-hover:opacity-100" onClick={() => onDelete(chat)} aria-label={`Delete ${chat.title}`}><Icon name="trash" className="h-4 w-4" /></button>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const activeId = useMatch('/chat/:id')?.params.id;
  const [open, setOpen] = useState(() => window.innerWidth >= 1024);
  const [chats, setChats] = useState([]);
  const [q, setQ] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const searchRef = useRef(null);

  const loadChats = useCallback(async (term = q) => {
    try {
      const d = await api.get(`/chats${term ? `?q=${encodeURIComponent(term)}` : ''}`);
      setChats(d.items);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoadingChats(false); }
  }, [q, toast]);

  useEffect(() => { const t = setTimeout(() => loadChats(q), q ? 250 : 0); return () => clearTimeout(t); }, [q]); // eslint-disable-line
  useEffect(() => { if (window.innerWidth < 1024) setOpen(false); }, [location.pathname]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const rename = async (id, title) => {
    try { await api.patch(`/chats/${id}`, { title }); setChats((c) => c.map((x) => (x.id === id ? { ...x, title } : x))); }
    catch (e) { toast(e.message, 'error'); }
  };
  const remove = async (chat) => {
    if (!window.confirm(`Delete "${chat.title}"? This cannot be undone.`)) return;
    try {
      await api.del(`/chats/${chat.id}`);
      setChats((c) => c.filter((x) => x.id !== chat.id));
      if (activeId === chat.id) navigate('/chat');
      toast('Chat deleted', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };

  const dark = document.documentElement.classList.contains('dark');
  const [, force] = useState(0);
  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    setTheme(next); force((n) => n + 1);
    api.patch('/user/settings', { theme: next }).catch(() => {});
  };

  const navLink = ({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-accent/10 font-semibold text-accent' : 'text-mute hover:bg-paper hover:text-ink'}`;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <button className="rounded-lg p-2 text-mute hover:bg-paper hover:text-ink" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Hide sidebar' : 'Show sidebar'} aria-expanded={open}><Icon name="menu" /></button>
        <Logo />
        <div className="flex-1" />
        <button className="rounded-lg p-2 text-mute hover:bg-paper hover:text-ink" onClick={toggleTheme} aria-label="Toggle dark mode"><Icon name={dark ? 'sun' : 'moon'} /></button>
        <Link to="/profile" className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-paper" aria-label="Profile">
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            : <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-ink">{user.displayName[0]?.toUpperCase()}</span>}
          <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">{user.displayName}</span>
        </Link>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {open && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
        <aside className={`${open ? 'translate-x-0' : '-translate-x-full lg:hidden'} fixed inset-y-0 left-0 top-14 z-30 flex w-72 flex-col border-r border-line bg-surface transition-transform lg:static lg:top-auto`}>
          <div className="space-y-2 p-3">
            <Link to="/chat" className="btn-primary w-full"><Icon name="plus" className="h-4 w-4" /> New chat</Link>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-mute" />
              <input ref={searchRef} className="field pl-8" placeholder="Search chats  (Ctrl+K)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search chats" />
            </div>
          </div>
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2" aria-label="Chat history">
            {loadingChats && [1, 2, 3, 4].map((i) => <div key={i} className="skeleton mx-1 my-2 h-8" />)}
            {!loadingChats && chats.length === 0 && <p className="px-3 py-6 text-sm text-mute">{q ? 'No chats match your search.' : 'Your conversations will appear here once you ask something.'}</p>}
            {chats.map((c) => <ChatItem key={c.id} chat={c} active={c.id === activeId} onRename={rename} onDelete={remove} />)}
          </nav>
          <div className="space-y-0.5 border-t border-line p-2">
            <NavLink to="/onenote" className={navLink}><Icon name="note" className="h-4 w-4" /> OneNote</NavLink>
            <NavLink to="/about" className={navLink}><Icon name="link" className="h-4 w-4" /> About</NavLink>
            <button className="w-full text-left" onClick={async () => { await logout(); navigate('/login'); }}>
              <span className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-mute hover:bg-paper hover:text-ink">Log out</span>
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-hidden">
          <Outlet context={{ chats, setChats, reloadChats: loadChats }} />
        </main>
      </div>
    </div>
  );
}
