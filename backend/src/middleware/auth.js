import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function requireAuth(req, _res, next) {
  const token = req.cookies?.access_token;
  if (!token) return next(new AppError(401, 'AUTH_REQUIRED', 'Please log in.'));
  try {
    req.user = { id: jwt.verify(token, env.jwtSecret).sub };
    next();
  } catch {
    next(new AppError(401, 'AUTH_EXPIRED', 'Session expired.'));
  }
}

// CSRF defence for cookie auth: SameSite cookies plus a custom header that
// cross-site pages cannot send without CORS approval.
export function csrfHeader(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'notewise') {
    return next(new AppError(403, 'CSRF', 'Missing request header.'));
  }
  next();
}
