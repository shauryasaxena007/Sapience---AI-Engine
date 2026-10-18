import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { encrypt, decrypt, randomToken } from '../utils/crypto.js';
import { AppError } from '../utils/AppError.js';

const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
// offline_access = refresh token. Notes.ReadWrite = list notebooks/sections and create pages.
const SCOPES = 'offline_access User.Read Notes.ReadWrite';

const b64url = (buf) => buf.toString('base64url');

export async function buildAuthUrl(userId) {
  if (!env.ms.clientId) throw new AppError(503, 'MS_NOT_CONFIGURED', 'Microsoft app is not configured.');
  const state = randomToken(24);
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  await query(
    `INSERT INTO oauth_states (state, user_id, code_verifier, expires_at) VALUES ($1,$2,$3, now() + interval '10 minutes')`,
    [state, userId, verifier]
  );
  const params = new URLSearchParams({
    client_id: env.ms.clientId,
    response_type: 'code',
    redirect_uri: env.ms.redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${AUTH}/authorize?${params}`;
}

async function tokenRequest(params) {
  const res = await fetch(`${AUTH}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.ms.clientId, client_secret: env.ms.clientSecret, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error_description || 'Token request failed'), { msError: data.error });
  return data;
}

export async function handleCallback(userId, code, state) {
  const { rows } = await query(
    `DELETE FROM oauth_states WHERE state = $1 AND user_id = $2 AND expires_at > now() RETURNING code_verifier`,
    [state, userId]
  );
  if (!rows[0]) throw new AppError(400, 'OAUTH_STATE_INVALID', 'Sign-in session expired. Please try again.');
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.ms.redirectUri,
    code_verifier: rows[0].code_verifier,
  });
  const me = await fetch(`${GRAPH}/me`, { headers: { authorization: `Bearer ${tokens.access_token}` } })
    .then((r) => r.json()).catch(() => ({}));
  await query(
    `INSERT INTO connected_accounts (user_id, provider, provider_email, access_token_enc, refresh_token_enc, scopes, access_expires_at, status)
     VALUES ($1,'microsoft',$2,$3,$4,$5, now() + ($6 || ' seconds')::interval,'active')
     ON CONFLICT (user_id, provider) DO UPDATE SET provider_email=$2, access_token_enc=$3, refresh_token_enc=$4,
       scopes=$5, access_expires_at=now() + ($6 || ' seconds')::interval, status='active', updated_at=now()`,
    [userId, me.mail || me.userPrincipalName || null, encrypt(tokens.access_token),
     tokens.refresh_token ? encrypt(tokens.refresh_token) : null, tokens.scope || SCOPES, String(tokens.expires_in || 3600)]
  );
}

export async function getConnection(userId) {
  const { rows } = await query(`SELECT * FROM connected_accounts WHERE user_id= ? AND provider='microsoft'`, [userId]);
  return rows[0] || null;
}

const reconnect = () => new AppError(401, 'ONENOTE_RECONNECT_REQUIRED', 'Your Microsoft connection expired. Please reconnect.');

async function getValidToken(userId) {
  const conn = await getConnection(userId);
  if (!conn) throw new AppError(409, 'ONENOTE_NOT_CONNECTED', 'Connect your Microsoft account first.');
  if (conn.status !== 'active') throw reconnect();
  // refresh when less than 2 minutes remain
  if (new Date(conn.access_expires_at).getTime() - Date.now() > 120000) return decrypt(conn.access_token_enc);
  if (!conn.refresh_token_enc) throw reconnect();
  try {
    const tokens = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: decrypt(conn.refresh_token_enc),
      scope: SCOPES,
    });
    await query(
      `UPDATE connected_accounts SET access_token_enc=$2, refresh_token_enc=COALESCE($3, refresh_token_enc),
         access_expires_at=now() + ($4 || ' seconds')::interval, updated_at=now() WHERE user_id=$1 AND provider='microsoft'`,
      [userId, encrypt(tokens.access_token), tokens.refresh_token ? encrypt(tokens.refresh_token) : null, String(tokens.expires_in || 3600)]
    );
    return tokens.access_token;
  } catch {
    await query(`UPDATE connected_accounts SET status='expired' WHERE user_id=$1 AND provider='microsoft'`, [userId]);
    throw reconnect();
  }
}

async function graph(userId, path, options = {}, retried = false) {
  const token = await getValidToken(userId);
  const res = await fetch(`${GRAPH}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (res.status === 401 && !retried) {
    await query(`UPDATE connected_accounts SET access_expires_at = now() WHERE user_id=$1 AND provider='microsoft'`, [userId]);
    return graph(userId, path, options, true);
  }
  if (res.status === 401) throw reconnect();
  if (res.status === 403) throw new AppError(403, 'ONENOTE_PERMISSION', 'Permission missing. Reconnect and approve OneNote access.');
  if (res.status === 404) throw new AppError(404, 'ONENOTE_NOT_FOUND', 'That notebook or section no longer exists.');
  if (res.status === 429) throw new AppError(429, 'ONENOTE_THROTTLED', 'Microsoft is busy. Try again in a moment.');
  if (!res.ok) throw new AppError(502, 'ONENOTE_ERROR', `Microsoft Graph error (${res.status}).`);
  return res.json();
}

export const listNotebooks = async (userId) =>
  (await graph(userId, '/me/onenote/notebooks?$select=id,displayName')).value.map((n) => ({ id: n.id, name: n.displayName }));

export const listSections = async (userId, notebookId) =>
  (await graph(userId, `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections?$select=id,displayName`)).value
    .map((s) => ({ id: s.id, name: s.displayName }));

export async function createPage(userId, sectionId, { title, html }) {
  const doc = `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><meta name="created" content="${new Date().toISOString()}" /></head><body>${html}</body></html>`;
  const page = await graph(userId, `/me/onenote/sections/${encodeURIComponent(sectionId)}/pages`, {
    method: 'POST',
    headers: { 'content-type': 'text/html' },
    body: doc,
  });
  return { id: page.id, url: page.links?.oneNoteWebUrl?.href || page.links?.oneNoteClientUrl?.href || null };
}

export async function disconnect(userId) {
  await query(`DELETE FROM connected_accounts WHERE user_id=$1 AND provider='microsoft'`, [userId]);
}

export function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Tiny, safe Markdown to HTML converter. Escapes first, then applies a small set of tags OneNote accepts. */
export function markdownToHtml(md = '') {
  const inline = (t) => escapeHtml(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  let inCode = false;
  for (const raw of md.split('\n')) {
    if (raw.trim().startsWith('```')) {
      closeList();
      out.push(inCode ? '</pre>' : '<pre>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(escapeHtml(raw) + '\n'); continue; }
    const h = raw.match(/^(#{1,3})\s+(.*)$/);
    const ul = raw.match(/^\s*[-*]\s+(.*)$/);
    const ol = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); }
    else if (ul) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); }
    else if (ol) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); }
    else if (raw.trim() === '') closeList();
    else { closeList(); out.push(`<p>${inline(raw)}</p>`); }
  }
  closeList();
  if (inCode) out.push('</pre>');
  return out.join('\n');
}
