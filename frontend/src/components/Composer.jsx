import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useToast } from '../lib/toast.jsx';

const MAX = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function Composer({ busy, onSend, onStop, defaultWeb }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [web, setWeb] = useState(defaultWeb);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const ta = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => setWeb(defaultWeb), [defaultWeb]);
  useEffect(() => {
    if (!ta.current) return;
    ta.current.style.height = 'auto';
    ta.current.style.height = Math.min(ta.current.scrollHeight, 200) + 'px';
  }, [text]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!TYPES.includes(f.type)) return toast('Use a JPEG, PNG or WebP image.', 'error');
    if (f.size > MAX) return toast('Images must be 5 MB or smaller.', 'error');
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const clearFile = () => { setFile(null); setPreview(null); };

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend({ text: t, useWeb: web, file });
    setText(''); clearFile();
  };

  return (
    <div className="card p-2 shadow-sm focus-within:border-accent">
      {preview && (
        <div className="relative m-1 inline-block">
          <img src={preview} alt="Attachment preview" className="h-16 w-16 rounded-lg object-cover" />
          <button className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-ink text-paper" onClick={clearFile} aria-label="Remove image"><Icon name="x" className="h-3 w-3" /></button>
        </div>
      )}
      <textarea
        ref={ta} rows={1} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Ask anything…  (Enter to send, Shift+Enter for a new line)" aria-label="Your question"
        className="max-h-52 w-full resize-none bg-transparent px-2 py-2 text-[15px] placeholder:text-mute focus:outline-none"
      />
      <div className="flex items-center gap-1 px-1 pb-1">
        <input ref={fileInput} type="file" accept={TYPES.join(',')} className="hidden" onChange={pick} />
        <button className="rounded-lg p-2 text-mute hover:bg-paper hover:text-ink" onClick={() => fileInput.current.click()} aria-label="Attach an image"><Icon name="image" /></button>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-mute hover:bg-paper">
          <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={web} onChange={(e) => setWeb(e.target.checked)} /> Search the web
        </label>
        <div className="flex-1" />
        {busy
          ? <button className="btn-ghost" onClick={onStop}><Icon name="stop" className="h-4 w-4" /> Stop</button>
          : <button className="btn-primary" onClick={submit} disabled={!text.trim()}><Icon name="send" className="h-4 w-4" /> Ask</button>}
      </div>
    </div>
  );
}
