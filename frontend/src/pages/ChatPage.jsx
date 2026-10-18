import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, streamMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import Answer from '../components/Answer.jsx';
import Composer from '../components/Composer.jsx';
import SaveModal from '../components/SaveModal.jsx';

const SUGGESTIONS = [
  'What is machine learning, in plain words?',
  'How does OAuth 2.0 work?',
  'Explain database normalization with an example',
];

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { setChats, reloadChats } = useOutletContext();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followUps, setFollowUps] = useState([]);
  const [saving, setSaving] = useState(null);
  const abortRef = useRef(null);
  const skipLoad = useRef(null);
  const bottom = useRef(null);

  useEffect(() => {
    setFollowUps([]);
    if (!id) { setMessages([]); return; }
    if (skipLoad.current === id) { skipLoad.current = null; return; } // we just created it and are streaming into it
    let cancelled = false;
    setLoading(true);
    api.get(`/chats/${id}`)
      .then((d) => !cancelled && setMessages(d.messages))
      .catch((e) => { toast(e.message, 'error'); if (e.status === 404) navigate('/chat', { replace: true }); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages.length, busy]);

  const patchLast = (fn) => setMessages((m) => m.map((x, i) => (i === m.length - 1 ? fn(x) : x)));

  const send = async ({ text, useWeb, file }) => {
    setFollowUps([]); setBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    let chatId = id;
    try {
      if (!chatId) {
        const chat = await api.post('/chats');
        chatId = chat.id;
        skipLoad.current = chatId;
        setChats((c) => [chat, ...c]);
        navigate(`/chat/${chatId}`, { replace: true });
      }
      let fileIds = [];
      const localImage = file ? URL.createObjectURL(file) : null;
      if (file) fileIds = [(await api.upload('/files', file)).id];

      setMessages((m) => [
        ...m,
        { id: null, role: 'user', content: text, images: localImage ? [localImage] : [], sources: [] },
        { id: null, role: 'assistant', content: '', sources: [], streaming: true },
      ]);

      await streamMessage(chatId, { text, useWeb, fileIds }, (evt) => {
        if (evt.type === 'sources') patchLast((m) => ({ ...m, sources: evt.sources }));
        else if (evt.type === 'token') patchLast((m) => ({ ...m, content: m.content + evt.text }));
        else if (evt.type === 'done') patchLast((m) => ({ ...m, id: evt.messageId, streaming: false }));
        else if (evt.type === 'title') setChats((c) => c.map((x) => (x.id === chatId ? { ...x, title: evt.title } : x)));
        else if (evt.type === 'followups') setFollowUps(evt.followUps);
        else if (evt.type === 'error') toast(evt.message, 'error');
      }, abort.signal);
    } catch (e) {
      if (e.name !== 'AbortError') toast(e.message || 'Could not send your message.', 'error');
    } finally {
      setBusy(false);
      abortRef.current = null;
      // reload from the server so ids, sources and stopped answers are exact
      if (chatId) {
        api.get(`/chats/${chatId}`).then((d) => setMessages(d.messages)).catch(() => {});
        reloadChats('');
      }
    }
  };

  const questionFor = (index) => messages.slice(0, index).reverse().find((m) => m.role === 'user')?.content;
  const empty = !id && messages.length === 0;
  const defaultWeb = user.settings.webSearchDefault;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
          {loading && <><div className="skeleton h-10 w-1/2" /><div className="skeleton h-40" /></>}
          {empty && (
            <div className="py-12 text-center sm:py-20">
              <h1 className="font-serif text-3xl sm:text-4xl">What would you like to find out?</h1>
              <p className="mx-auto mt-3 max-w-md text-mute">Answers include numbered sources. Save the useful ones straight to OneNote.</p>
              <div className="mx-auto mt-8 grid max-w-xl gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="card px-4 py-3 text-left text-sm hover:border-accent" onClick={() => send({ text: s, useWeb: defaultWeb })} disabled={busy}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-ink">
                {m.images?.map((src) => <img key={src} src={src} alt="Attached" className="mb-2 max-h-48 rounded-lg" />)}
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ) : (
            <Answer
              key={m.id || `tmp-${i}`} message={m} isStreaming={!!m.streaming && busy}
              followUps={i === messages.length - 1 ? followUps : []}
              onFollowUp={(f) => send({ text: f, useWeb: defaultWeb })}
              onSave={(msg, selection) => setSaving({ message: msg, question: questionFor(i), selection })}
            />
          ))}
          <div ref={bottom} />
        </div>
      </div>
      <div className="border-t border-line bg-paper px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <Composer busy={busy} onSend={send} onStop={() => abortRef.current?.abort()} defaultWeb={defaultWeb} />
          <p className="mt-2 text-center text-xs text-mute">AI can make mistakes. Check the sources for anything important.</p>
        </div>
      </div>
      {saving && <SaveModal {...saving} defaultSectionId={user.settings.defaultSectionId} onClose={() => setSaving(null)} />}
    </div>
  );
}
