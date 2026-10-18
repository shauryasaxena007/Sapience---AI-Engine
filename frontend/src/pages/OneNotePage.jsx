import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function OneNotePage() {
  const toast = useToast();
  const { reload } = useAuth();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([api.get('/onenote/status'), api.get('/onenote/saved')]);
      setStatus(s); setSaved(l.items);
    } catch (e) { toast(e.message, 'error'); }
  }, [toast]);

  useEffect(() => {
    load();
    if (params.get('connected')) toast('Microsoft account connected', 'success');
    if (params.get('error')) toast(`Could not connect: ${params.get('error')}`, 'error');
    if (params.toString()) { setParams({}, { replace: true }); reload(); }
  }, []); // eslint-disable-line

  const connect = async () => {
    setBusy(true);
    try { window.location.href = (await api.get('/onenote/connect')).url; }
    catch (e) { toast(e.message, 'error'); setBusy(false); }
  };
  const disconnect = async () => {
    if (!window.confirm('Disconnect your Microsoft account? Pages already saved stay in OneNote.')) return;
    try { await api.del('/onenote/disconnect'); toast('Disconnected', 'success'); await load(); reload(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const expired = status?.status === 'expired';

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-semibold">OneNote</h1>
          <p className="mt-1 text-mute">Save answers into your own Microsoft OneNote notebooks.</p>
        </header>

        <section className="card p-5">
          {!status ? <div className="skeleton h-16" /> : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <span className={`h-2.5 w-2.5 rounded-full ${status.connected ? 'bg-green-500' : expired ? 'bg-amber-500' : 'bg-mute'}`} />
                  {status.connected ? 'Connected' : expired ? 'Connection expired' : 'Not connected'}
                </p>
                {status.email && <p className="text-sm text-mute">{status.email}</p>}
                {expired && <p className="mt-1 text-sm">Microsoft needs you to sign in again.</p>}
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={connect} disabled={busy}>{status.connected ? 'Reconnect' : expired ? 'Reconnect' : 'Connect Microsoft account'}</button>
                {(status.connected || expired) && <button className="btn-danger" onClick={disconnect}>Disconnect</button>}
              </div>
            </div>
          )}
        </section>

        <section className="card p-5 text-sm">
          <h2 className="mb-2 font-semibold">What NoteWise can do</h2>
          <ul className="list-disc space-y-1 pl-5 text-mute">
            <li>Read the names of your notebooks and sections, so you can choose where a page goes.</li>
            <li>Create new pages with your chosen title, the answer, its sources and a timestamp.</li>
          </ul>
          <p className="mt-3 text-mute">It does not read the contents of your existing pages. You can remove access at any time with Disconnect, or from your Microsoft account's app permissions.</p>
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Recently saved</h2>
          {saved === null && <div className="skeleton h-14" />}
          {saved?.length === 0 && <div className="card p-6 text-center text-sm text-mute">Nothing saved yet. Ask a question, then choose Save to OneNote under the answer.</div>}
          <ul className="space-y-2">
            {saved?.map((s) => (
              <li key={s.id} className="card flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.title}</p>
                  <p className="text-xs text-mute">{s.section ? `${s.section} · ` : ''}{new Date(s.createdAt).toLocaleString()}</p>
                </div>
                {s.status === 'success' && s.url
                  ? <a className="shrink-0 font-semibold text-accent underline" href={s.url} target="_blank" rel="noreferrer">Open</a>
                  : <span className="shrink-0 text-red-600 dark:text-red-400">{s.status === 'failed' ? 'Failed' : ''}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
