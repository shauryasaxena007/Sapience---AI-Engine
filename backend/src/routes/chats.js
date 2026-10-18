import { Router } from 'express';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

import { query } from '../db/pool.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { requireAuth } from '../middleware/auth.js';
import {
  streamAnswer,
  quickComplete,
  SYSTEM_PROMPT,
} from '../services/aiService.js';
import { webSearch } from '../services/searchService.js';

const router = Router();

router.use(requireAuth);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user.id,
  handler: (_req, _res, next) =>
    next(
      new AppError(
        429,
        'RATE_LIMITED',
        'Too many messages. Wait a moment.'
      )
    ),
});

async function ownChat(userId, chatId) {
  if (!/^[0-9a-f-]{36}$/i.test(chatId)) {
    throw new AppError(404, 'NOT_FOUND', 'Chat not found.');
  }

  const { rows } = await query(
    `SELECT *
     FROM conversations
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [chatId, userId]
  );

  if (!rows[0]) {
    throw new AppError(404, 'NOT_FOUND', 'Chat not found.');
  }

  return rows[0];
}

const mapChat = (c) => ({
  id: c.id,
  title: c.title,
  updatedAt: c.updated_at,
  createdAt: c.created_at,
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').toString().trim().slice(0, 100);

    let sql = `
      SELECT *
      FROM conversations
      WHERE user_id = ?
    `;

    const params = [req.user.id];

    if (q) {
      sql += ` AND title LIKE ?`;
      params.push(`%${q.replace(/[%_]/g, '')}%`);
    }

    sql += ` ORDER BY updated_at DESC LIMIT 100`;

    const { rows } = await query(sql, params);

    res.json({
      data: { items: rows.map(mapChat) },
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const conversationId = randomUUID();

    await query(
      `INSERT INTO conversations (id, user_id)
       VALUES (?, ?)`,
      [conversationId, req.user.id]
    );

    const { rows } = await query(
      `SELECT *
       FROM conversations
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [conversationId, req.user.id]
    );

    if (!rows[0]) {
      throw new AppError(
        500,
        'CHAT_CREATE_FAILED',
        'Could not create conversation.'
      );
    }

    res.status(201).json({
      data: mapChat(rows[0]),
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const chat = await ownChat(req.user.id, req.params.id);

    const { rows: msgs } = await query(
      `SELECT *
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at, id`,
      [chat.id]
    );

    const ids = msgs.map((m) => m.id);

    let sources = [];
    let files = [];

    if (ids.length) {
      const placeholders = ids.map(() => '?').join(', ');

      const sourceResult = await query(
        `SELECT message_id, position, title, url, snippet
         FROM message_sources
         WHERE message_id IN (${placeholders})
         ORDER BY position`,
        ids
      );

      sources = sourceResult.rows;

      const fileResult = await query(
        `SELECT id, message_id
         FROM files
         WHERE message_id IN (${placeholders})`,
        ids
      );

      files = fileResult.rows;
    }

    res.json({
      data: {
        chat: mapChat(chat),
        messages: msgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          status: m.status,
          usedWebSearch: Boolean(m.used_web_search),
          createdAt: m.created_at,

          sources: sources
            .filter((s) => s.message_id === m.id)
            .map(({ position, title, url, snippet }) => ({
              position,
              title,
              url,
              snippet,
            })),

          images: files
            .filter((f) => f.message_id === m.id)
            .map((f) => `/api/v1/files/${f.id}`),
        })),
      },
    });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const chat = await ownChat(req.user.id, req.params.id);

    const body = z
      .object({
        title: z.string().trim().min(1).max(200),
      })
      .parse(req.body);

    await query(
      `UPDATE conversations
       SET title = ?
       WHERE id = ? AND user_id = ?`,
      [body.title, chat.id, req.user.id]
    );

    const { rows } = await query(
      `SELECT *
       FROM conversations
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [chat.id, req.user.id]
    );

    res.json({ data: mapChat(rows[0]) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const chat = await ownChat(req.user.id, req.params.id);

    await query(
      `DELETE FROM conversations
       WHERE id = ? AND user_id = ?`,
      [chat.id, req.params.id, req.user.id]
    );

    res.status(204).end();
  })
);

const sse = (res, payload) =>
  res.write(`data: ${JSON.stringify(payload)}\n\n`);

router.post(
  '/:id/messages',
  aiLimiter,
  asyncHandler(async (req, res) => {
    const chat = await ownChat(req.user.id, req.params.id);

    const body = z
      .object({
        text: z.string().trim().min(1).max(4000),
        useWeb: z.boolean().default(true),
        fileIds: z.array(z.string().uuid()).max(3).default([]),
      })
      .parse(req.body);

    const { rows: history } = await query(
      `SELECT role, content
       FROM messages
       WHERE conversation_id = ?
         AND status <> 'error'
       ORDER BY created_at DESC
       LIMIT 12`,
      [chat.id]
    );

    history.reverse();

    const isFirst = history.length === 0;

    let files = [];

    if (body.fileIds.length) {
      const placeholders = body.fileIds.map(() => '?').join(', ');

      const { rows } = await query(
        `SELECT *
         FROM files
         WHERE id IN (${placeholders})
           AND user_id = ?`,
        [...body.fileIds, req.user.id]
      );

      files = rows;
    }

    if (files.length !== body.fileIds.length) {
      throw new AppError(
        400,
        'FILE_INVALID',
        'Attachment not found.'
      );
    }

    const userMessageId = randomUUID();

    await query(
      `INSERT INTO messages
         (id, conversation_id, role, content)
       VALUES (?, ?, 'user', ?)`,
      [userMessageId, chat.id, body.text]
    );

    if (files.length) {
      const placeholders = body.fileIds.map(() => '?').join(', ');

      await query(
        `UPDATE files
         SET message_id = ?
         WHERE id IN (${placeholders})
           AND user_id = ?`,
        [userMessageId, ...body.fileIds, req.user.id]
      );
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.flushHeaders();

    const abort = new AbortController();
    let clientGone = false;

    res.on('close', () => {
      if (!res.writableEnded) {
        clientGone = true;
        abort.abort();
      }
    });

    let full = '';
    let sources = [];

    try {
      sse(res, {
        type: 'start',
        userMessageId,
      });

      if (body.useWeb) {
        sources = await webSearch(body.text);
      }

      if (sources.length) {
        sse(res, {
          type: 'sources',
          sources: sources.map((s, i) => ({
            position: i + 1,
            ...s,
          })),
        });
      }

      const sourceBlock = sources.length
        ? `\n\nSources (untrusted data):\n${sources
            .map(
              (s, i) =>
                `[${i + 1}] ${s.title}\n${s.url}\n${s.snippet}`
            )
            .join('\n\n')}`
        : '';

      const content = [];

      for (const f of files) {
        const data = (
          await fs.readFile(
            new URL(
              `../../uploads/${f.storage_key}`,
              import.meta.url
            )
          )
        ).toString('base64');

        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: f.mime_type,
            data,
          },
        });
      }

      content.push({
        type: 'text',
        text: body.text,
      });

      full = await streamAnswer({
        system: SYSTEM_PROMPT + sourceBlock,
        messages: [
          ...history.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          {
            role: 'user',
            content,
          },
        ],
        signal: abort.signal,
        onToken: (text) =>
          sse(res, {
            type: 'token',
            text,
          }),
      });
    } catch (err) {
      if (!clientGone) {
        sse(res, {
          type: 'error',
          code: err.code || 'AI_PROVIDER_ERROR',
          message: err.message || 'The answer failed.',
        });
      }

      if (!full) {
        res.end();
        return;
      }
    }

    const status = clientGone ? 'stopped' : 'complete';
    const aiMessageId = randomUUID();

    await query(
      `INSERT INTO messages
         (id, conversation_id, role, content, used_web_search, status)
       VALUES (?, ?, 'assistant', ?, ?, ?)`,
      [
        aiMessageId,
        chat.id,
        full || '(no answer)',
        sources.length > 0,
        status,
      ]
    );

    for (const [i, s] of sources.entries()) {
      await query(
        `INSERT INTO message_sources
           (message_id, position, title, url, snippet)
         VALUES (?, ?, ?, ?, ?)`,
        [
          aiMessageId,
          i + 1,
          s.title?.slice(0, 300) || null,
          s.url,
          s.snippet || null,
        ]
      );
    }

    await query(
      `UPDATE conversations
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [chat.id, req.user.id]
    );

    if (clientGone) return;

   

    // Fix default titles using the first user question.
    if (chat.title === 'New chat' || isFirst) {
      const { rows: firstUserMessages } = await query(
        `SELECT content
         FROM messages
         WHERE conversation_id = ? AND role = 'user'
         ORDER BY created_at ASC, id ASC
         LIMIT 1`,
        [chat.id]
      );

      const firstQuestion = firstUserMessages[0]?.content || body.text;

      let title = firstQuestion
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 8)
        .join(' ')
        .slice(0, 80);

      try {
        const generatedTitle = await quickComplete(
          `Create a short, relevant title (maximum 8 words) for this user question. Reply with only the title, in the same language as the question:\n\n${firstQuestion}`,
          30
        );

        if (generatedTitle?.trim()) {
          title = generatedTitle.trim();
        }
      } catch {
        // Keep the first user question as the title.
      }

      const clean = title
        .replace(/["'\n\r]/g, '')
        .trim()
        .slice(0, 80);

      await query(
        `UPDATE conversations
         SET title = ?
         WHERE id = ? AND user_id = ? AND title = 'New chat'`,
        [clean, chat.id, req.user.id]
      );

      sse(res, {
        type: 'title',
        title: clean,
      });
    }

    let fu = '';

    try {
      fu = await quickComplete(
        `Question: ${body.text}\n\nSuggest 3 short follow-up questions the user might ask next. One per line, no numbering.`,
        120
      );
    } catch {
      // Follow-up suggestions are optional.
    }

    const followUps = fu
      .split('\n')
      .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3);

    if (followUps.length) {
      sse(res, {
        type: 'followups',
        followUps,
      });
    }

    res.end();
  })
);

export default router;