
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { AppError, asyncHandler } from '../utils/AppError.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const ACCESS_MIN = 15;
const REFRESH_DAYS = 30;

const cookieBase = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
};

async function issueSession(res, userId) {
  const access = jwt.sign(
    { sub: userId },
    env.jwtSecret,
    { expiresIn: `${ACCESS_MIN}m` }
  );

  const refresh = randomToken(48);

  await query(
    `INSERT INTO refresh_tokens
      (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY))`,
    [randomUUID(), userId, sha256(refresh)]
  );

  res.cookie('access_token', access, {
    ...cookieBase,
    maxAge: ACCESS_MIN * 60 * 1000,
    path: '/',
  });

  res.cookie('refresh_token', refresh, {
    ...cookieBase,
    maxAge: REFRESH_DAYS * 86400 * 1000,
    path: '/api/v1/auth',
  });
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
});

// SIGN UP — create account and sign in immediately
router.post('/register', asyncHandler(async (req, res) => {
  const body = credentials.extend({
    displayName: z.string().trim().min(1).max(80),
  }).parse(req.body);

  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(body.password, 12);

  try {
    await query(
      `INSERT INTO users
        (id, email, password_hash, display_name, email_verified_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, body.email, passwordHash, body.displayName]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new AppError(
        409,
        'EMAIL_EXISTS',
        'An account with this email already exists. Please sign in.'
      );
    }
    throw error;
  }

  await query(
    'INSERT INTO user_settings (user_id) VALUES (?)',
    [userId]
  );

  // Create a session immediately; no verification email required.
  await issueSession(res, userId);

  res.status(201).json({
    data: {
      id: userId,
      email: body.email,
      displayName: body.displayName,
    },
  });
}));

// SIGN IN — email verification is not required
router.post('/login', asyncHandler(async (req, res) => {
  const body = credentials.parse(req.body);

  const { rows } = await query(
    `SELECT id, email, display_name, password_hash
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [body.email]
  );

  const user = rows[0];

  if (!user) {
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Incorrect email or password.'
    );
  }

  const ok = await bcrypt.compare(body.password, user.password_hash);

  if (!ok) {
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Incorrect email or password.'
    );
  }

  await issueSession(res, user.id);

  res.json({
    data: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
    },
  });
}));

// Refresh an existing session
router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;

  if (!token) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Please log in.');
  }

  const { rows } = await query(
    `SELECT id, user_id
     FROM refresh_tokens
     WHERE token_hash = ?
       AND revoked_at IS NULL
       AND expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    [sha256(token)]
  );

  const oldSession = rows[0];

  if (!oldSession) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Please log in again.');
  }

  const { rows: updateResult } = await query(
    `UPDATE refresh_tokens
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE id = ? AND revoked_at IS NULL`,
    [oldSession.id]
  );

  if (updateResult.affectedRows !== 1) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Please log in again.');
  }

  await issueSession(res, oldSession.user_id);

  res.json({ data: { ok: true } });
}));

// Sign out
router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;

  if (token) {
    await query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE token_hash = ? AND revoked_at IS NULL`,
      [sha256(token)]
    );
  }

  res.clearCookie('access_token', {
    ...cookieBase,
    path: '/',
  });

  res.clearCookie('refresh_token', {
    ...cookieBase,
    path: '/api/v1/auth',
  });

  res.status(204).end();
}));

// Change password
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8).max(128),
    }).parse(req.body);

    const { rows } = await query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (
      !rows[0] ||
      !(await bcrypt.compare(body.currentPassword, rows[0].password_hash))
    ) {
      throw new AppError(
        401,
        'INVALID_CREDENTIALS',
        'Current password is incorrect.'
      );
    }

    await query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [await bcrypt.hash(body.newPassword, 12), req.user.id]
    );

    await query(
      `UPDATE refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND revoked_at IS NULL`,
      [req.user.id]
    );

    res.clearCookie('access_token', {
      ...cookieBase,
      path: '/',
    });

    res.clearCookie('refresh_token', {
      ...cookieBase,
      path: '/api/v1/auth',
    });

    res.status(204).end();
  })
);

export default router;
