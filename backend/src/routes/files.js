import { Router } from 'express';
import fs from 'node:fs/promises';
import { query } from '../db/pool.js';
import { asyncHandler } from '../utils/AppError.js';
import { requireAuth } from '../middleware/auth.js';
import { upload, saveImage, getFileForUser, deleteFileFromDisk } from '../services/fileService.js';

const router = Router();
router.use(requireAuth);

router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  const f = await saveImage(req.user.id, req.file);
  res.status(201).json({ data: { id: f.id, url: `/api/v1/files/${f.id}`, mimeType: f.mime_type, size: f.size_bytes } });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const f = await getFileForUser(req.user.id, req.params.id);
  res.set({ 'Content-Type': f.mime_type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600' });
  res.send(await fs.readFile(f.fullPath));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const f = await getFileForUser(req.user.id, req.params.id);
  await query(`DELETE FROM files WHERE id=$1`, [f.id]);
  await deleteFileFromDisk(f.storage_key);
  res.status(204).end();
}));

export default router;
