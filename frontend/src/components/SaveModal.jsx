import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import Modal from './Modal.jsx';

export default function SaveModal({ message, question, selection, defaultSectionId, onClose }) {
  const toast = useToast();
  const [state, setState] = useState('loading'); // loading | disconnected | ready | error
  const [error, setError] = useState('');
  const [notebooks, setNotebooks] = useState([]);
  const [sections, setSections] = useState([]);
  const [notebookId, setNotebookId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [title, setTitle] = useState((question || 'NoteWise answer').slice(0, 120));
  const [mode, setMode] = useState(selection ? 'selection' : 'full');
  const [includeSources, setIncludeSources] = useState(true);
  const [saving, setSaving] = useState(false);

  const fail = (e) => {
    if (e.code === 'ONENOTE_NOT_CONNECTED' || e.code === 'ONENOTE_RECONNECT_REQUIRED') setState('disconnected');
    else { setError(e.message); setState('error'); }
  };

  useEffect(() => {
    (async () => {
      try {
        const nb = (await api.get('/onenote/notebooks')).items;
        setNotebooks(nb); setState('ready');
        if (nb[0]) setNotebookId(nb[0].id);
      } catch (e) { fail(e); }
    })();
  }, []);

  useEffect(() => {
    if (!notebookId) return;
    setSections([]); setSectionId('');
    api.get(`/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`)
      .then((d) => { setSections(d.items); setSectionId(d.items.find((s) => s.id === defaultSectionId)?.id || d.items[0]?.id || ''); })
      .catch(fail);
  }, [notebookId]); // eslint-disable-line

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const section = sections.find((s) => s.id === sectionId);
      const r = await api.post('/onenote/save', {
        messageId: message.id, sectionId, sectionName: section?.name, title: title.trim(),
        mode, selectedText: mode === 'selection' ? selection : undefined, includeSources,
      });
      toast('Saved to OneNote', 'success', r.pageUrl ? { label: 'Open page', href: r.pageUrl, external: true } : undefined);
      onClose();
    } catch (err) {
      if (err.code === 'ONENOTE_RECONNECT_REQUIRED') setState('disconnected');
      else toast(err.message, 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Save to OneNote" onClose={onClose}>
      {state === 'loading' && <div className="space-y-3"><div className="skeleton h-9" /><div className="skeleton h-9" /><div className="skeleton h-9" /></div>}
      {state === 'disconnected' && (
        <div className="space-y-4 text-sm">
          <p>Connect your Microsoft account to save answers into your own notebooks. If you connected before, your sign-in may have expired.</p>
          <Link to="/onenote" className="btn-primary w-full" onClick={onClose}>Go to OneNote settings</Link>
        </div>
      )}
      {state === 'error' && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {state === 'ready' && (
        <form onSubmit={save} className="space-y-3 text-sm">
          {notebooks.length === 0 && <p className="text-mute">No notebooks found. Create one in OneNote first, then try again.</p>}
          <label className="block font-medium">Notebook
            <select className="field mt-1" value={notebookId} onChange={(e) => setNotebookId(e.target.value)}>
              {notebooks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </label>
          <label className="block font-medium">Section
            <select className="field mt-1" value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
              {sections.length === 0 && <option value="">No sections in this notebook</option>}
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block font-medium">Page title
            <input className="field mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </label>
          <fieldset className="space-y-1">
            <legend className="font-medium">What to save</legend>
            <label className="flex items-center gap-2"><input type="radio" checked={mode === 'full'} onChange={() => setMode('full')} /> Full answer</label>
            <label className={`flex items-center gap-2 ${selection ? '' : 'opacity-50'}`}>
              <input type="radio" disabled={!selection} checked={mode === 'selection'} onChange={() => setMode('selection')} /> Selected text only
              {!selection && <span className="text-xs text-mute">(select text in the answer first)</span>}
            </label>
          </fieldset>
          <label className="flex items-center gap-2"><input type="checkbox" checked={includeSources} onChange={(e) => setIncludeSources(e.target.checked)} /> Include sources</label>
          <button className="btn-primary w-full" disabled={saving || !sectionId || !title.trim()}>{saving ? 'Saving…' : 'Save page'}</button>
        </form>
      )}
    </Modal>
  );
}
