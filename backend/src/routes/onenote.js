import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { requireAuth } from '../middleware/auth.js';
import * as one from '../services/onenoteService.js';

const router = Router();

// The callback is a browser redirect, so it handles its own errors by redirecting to the UI.
router.get('/callback', requireAuth, async (req, res) => {
  const back = (qs) => res.redirect(`${env.clientUrl}/onenote?${qs}`);
  if (req.query.error) return back(`error=${encodeURIComponent(String(req.query.error_description || req.query.error).slice(0, 120))}`);
  try {
    await one.handleCallback(req.user.id, String(req.query.code || ''), String(req.query.state || ''));
    back('connected=1');
  } catch (e) {
    back(`error=${encodeURIComponent(e.message.slice(0, 120))}`);
  }
});

router.use(requireAuth);

router.get('/connect', asyncHandler(async (req, res) => {
  res.json({ data: { url: await one.buildAuthUrl(req.user.id) } });
}));

router.get('/status', asyncHandler(async (req, res) => {
  const c = await one.getConnection(req.user.id);
  res.json({ data: { connected: !!c && c.status === 'active', status: c?.status || null, email: c?.provider_email || null } });
}));

router.get('/notebooks', asyncHandler(async (req, res) => {
  res.json({ data: { items: await one.listNotebooks(req.user.id) } });
}));

router.get('/notebooks/:id/sections', asyncHandler(async (req, res) => {
  res.json({ data: { items: await one.listSections(req.user.id, req.params.id) } });
}));

router.post('/save', asyncHandler(async (req, res) => {
  const body = z.object({
    messageId: z.string().uuid(),
    sectionId: z.string().min(1).max(255),
    sectionName: z.string().max(255).optional(),
    title: z.string().trim().min(1).max(200),
    mode: z.enum(['full', 'selection']).default('full'),
    selectedText: z.string().max(20000).optional(),
    includeSources: z.boolean().default(true),
  }).parse(req.body);

  // ownership check: message must belong to one of this user's chats
  const { rows } = await query(
    `SELECT m.id, m.content, (SELECT content FROM messages q WHERE q.conversation_id = m.conversation_id
        AND q.role='user' AND q.created_at <= m.created_at ORDER BY q.created_at DESC LIMIT 1) AS question
     FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.id=? AND c.user_id= ? AND m.role='assistant'`, [body.messageId, req.user.id]);
  const msg = rows[0];
  if (!msg) throw new AppError(404, 'NOT_FOUND', 'Answer not found.');

  let sources = [];
  if (body.includeSources) {
 sources = (await query(
  `SELECT position, title, url
   FROM message_sources
   WHERE message_id=?
   ORDER BY position`,
  [msg.id]
)).rows; }
  const text = body.mode === 'selection' && body.selectedText ? body.selectedText : msg.content;
  const stamp = new Date().toUTCString();
  const html = [
    msg.question ? `<p><i>Question:</i> ${one.escapeHtml(msg.question)}</p>` : '',
    one.markdownToHtml(text),
    sources.length
      ? `<h3>Sources</h3><ol>${sources.map((s) => `<li><a href="${one.escapeHtml(s.url)}">${one.escapeHtml(s.title || s.url)}</a></li>`).join('')}</ol>`
      : '',
    `<p><i>Saved from NoteWise on ${stamp}</i></p>`,
  ].join('\n');

  try {
  const page = await one.createPage(
    req.user.id,
    body.sectionId,
    { title: body.title, html }
  );

  await query(
    `INSERT INTO saved_items
      (user_id, message_id, title, onenote_page_id,
       onenote_page_url, section_name, status)
     VALUES (?, ?, ?, ?, ?, ?, 'success')`,
    [
      req.user.id,
      msg.id,
      body.title,
      page.id,
      page.url,
      body.sectionName || null
    ]
  );

  res.status(201).json({ data: { pageUrl: page.url } });
}catch (err) {
  await query(
    `INSERT INTO saved_items
      (user_id, message_id, title, section_name, status, error_message)
     VALUES (?, ?, ?, ?, 'failed', ?)`,
    [
      req.user.id,
      msg.id,
      body.title,
      body.sectionName || null,
      String(err.message).slice(0, 300)
    ]
  );

  throw err;
}
}));

router.get('/saved', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, title, onenote_page_url, section_name, status, created_at
FROM saved_items
WHERE user_id=?
ORDER BY created_at DESC
LIMIT 50`,
    [req.user.id]);
  res.json({ data: { items: rows.map((r) => ({ id: r.id, title: r.title, url: r.onenote_page_url, section: r.section_name, status: r.status, createdAt: r.created_at })) } });
}));

router.delete('/disconnect', asyncHandler(async (req, res) => {
  await one.disconnect(req.user.id);
  res.status(204).end();
}));

export default router;
