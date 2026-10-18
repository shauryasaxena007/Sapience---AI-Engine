const BASE = import.meta.env.VITE_API_URL || '/api/v1';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const HEADERS = { 'X-Requested-With': 'notewise' };

let refreshing = null;
function refreshSession() {
  // one refresh at a time, even if several requests fail together
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: HEADERS })
    .then((r) => r.ok)
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function toError(res) {
  const body = await res.json().catch(() => ({}));
  return new ApiError(res.status, body.error?.code || 'ERROR', body.error?.message || 'Something went wrong.');
}

async function request(path, { method = 'GET', body, form, retry = true } = {}) {
  const init = { method, credentials: 'include', headers: { ...HEADERS } };
  if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  if (form) init.body = form;
  let res;
  try { res = await fetch(`${BASE}${path}`, init); }
  catch { throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection.'); }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return request(path, { method, body, form, retry: false });
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return null;
  return (await res.json()).data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: body ?? {} }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, file) => { const form = new FormData(); form.append('file', file); return request(p, { method: 'POST', form }); },
};

/** Streams a chat answer (Server-Sent Events over fetch). Calls onEvent for each event object. */

export async function streamMessage(chatId, payload, onEvent, signal, retry = true) {
  const res = await fetch(`${BASE}/chats/${chatId}/messages`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (
    res.status === 401 &&
    retry &&
    (await refreshSession())
  ) {
    return streamMessage(chatId, payload, onEvent, signal, false);
  }

  if (!res.ok) throw await toError(res);

  if (!res.body) {
    throw new Error('Streaming is not supported by this response.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) break;

      buf += decoder.decode(value, { stream: true });

      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';

      for (const part of parts) {
        const line = part
          .split('\n')
          .find((l) => l.startsWith('data:'));

        if (!line) continue;

        let evt;

        try {
          evt = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }

        onEvent(evt);

        // Stop reading as soon as the server says the answer is complete.
        if (evt.type === 'done') {
          await reader.cancel();
          return;
        }

        if (evt.type === 'error') {
          await reader.cancel();
          return;
        }
      }
    }

    // Process any final event left in the buffer.
    const line = buf
      .split('\n')
      .find((l) => l.startsWith('data:'));

    if (line) {
      try {
        onEvent(JSON.parse(line.slice(5).trim()));
      } catch {
        // Ignore malformed final event.
      }
    }
  } finally {
    reader.releaseLock();
  }
}
