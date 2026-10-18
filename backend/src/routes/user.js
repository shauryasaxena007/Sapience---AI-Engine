
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { requireAuth } from '../middleware/auth.js';
import { upload, saveImage } from '../services/fileService.js';

const router = Router();
router.use(requireAuth);

router.get('/profile', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT
       u.id, u.email, u.display_name, u.avatar_file_id,
       s.theme, s.web_search_default, s.default_section_id,
       c.provider_email AS ms_email, c.status AS ms_status
     FROM users u
     LEFT JOIN user_settings s ON s.user_id = u.id
     LEFT JOIN connected_accounts c
       ON c.user_id = u.id AND c.provider = 'microsoft'
     WHERE u.id = ?`,
    [req.user.id]
  );

  const r = rows[0];
  if (!r) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  res.json({
    data: {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      avatarUrl: r.avatar_file_id
        ? `/api/v1/files/${r.avatar_file_id}`
        : null,
      settings: {
        theme: r.theme,
        webSearchDefault: Boolean(r.web_search_default),
        defaultSectionId: r.default_section_id,
      },
      connections: {
        microsoft: r.ms_status
          ? { email: r.ms_email, status: r.ms_status }
          : null,
      },
    },
  });
}));

router.patch('/profile', asyncHandler(async (req, res) => {
  const body = z.object({
    displayName: z.string().trim().min(1).max(80),
  }).parse(req.body);

  await query(
    'UPDATE users SET display_name = ? WHERE id = ?',
    [body.displayName, req.user.id]
  );

  res.json({ data: { displayName: body.displayName } });
}));

router.patch('/settings', asyncHandler(async (req, res) => {
  const body = z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    webSearchDefault: z.boolean().optional(),
    defaultSectionId: z.string().max(255).nullable().optional(),
  }).parse(req.body);

  const updates = [];
  const values = [];

  if (body.theme !== undefined) {
    updates.push('theme = ?');
    values.push(body.theme);
  }

  if (body.webSearchDefault !== undefined) {
    updates.push('web_search_default = ?');
    values.push(body.webSearchDefault);
  }

  if (body.defaultSectionId !== undefined) {
    updates.push('default_section_id = ?');
    values.push(body.defaultSectionId);
  }

  if (updates.length > 0) {
    values.push(req.user.id);
    await query(
      `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`,
      values
    );
  }

  res.json({ data: { ok: true } });
}));

router.post('/avatar', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, 'FILE_REQUIRED', 'Please select an image.');
  }

  const file = await saveImage(req.user.id, req.file);

  await query(
    'UPDATE users SET avatar_file_id = ? WHERE id = ?',
    [file.id, req.user.id]
  );

  res.json({ data: { avatarUrl: `/api/v1/files/${file.id}` } });
}));

router.delete('/', asyncHandler(async (req, res) => {
  await query('DELETE FROM users WHERE id = ?', [req.user.id]);

  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });

  res.status(204).end();
}));

export default router;
