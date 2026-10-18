import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { query } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';

export const MAX_BYTES = 5 * 1024 * 1024;
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

/** Detect the real type from the first bytes. Never trust the filename or browser-sent type. */
function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}


export async function saveImage(userId, file) {
  if (!file) {
    throw new AppError(
      400,
      'FILE_REQUIRED',
      'Choose an image to upload.'
    );
  }

  const type = sniff(file.buffer);

  if (!type) {
    throw new AppError(
      400,
      'FILE_TYPE',
      'Only JPEG, PNG or WebP images are allowed.'
    );
  }

  await fs.mkdir(dir, { recursive: true });

  const id = crypto.randomUUID();
  const key = `${crypto.randomUUID()}.${type.ext}`;

  const filePath = path.join(dir, key);

  await fs.writeFile(filePath, file.buffer);

  try {
    await query(
      `INSERT INTO files
       (id, user_id, storage_key, original_name, mime_type, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        key,
        (file.originalname || '').slice(0, 200),
        type.mime,
        file.size,
      ]
    );

    const { rows } = await query(
      `SELECT id, mime_type, size_bytes
       FROM files
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    return rows[0];
  } catch (error) {
    await fs.unlink(filePath).catch(() => {});
    throw error;
  }
}


export async function getFileForUser(userId, fileId) {
  const { rows } = await query(`SELECT * FROM files WHERE id=$1 AND user_id=$2`, [fileId, userId]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'File not found.');
  return { ...rows[0], fullPath: path.join(dir, rows[0].storage_key) };
}

export async function deleteFileFromDisk(storageKey) {
  await fs.rm(path.join(dir, storageKey), { force: true });
}
