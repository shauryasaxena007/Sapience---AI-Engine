import { ZodError } from 'zod';
import { env } from '../config/env.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION',
        message: 'Invalid input.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'File is too large.' } });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      code: err.code || 'SERVER_ERROR',
      message: status >= 500 && env.isProd ? 'Something went wrong.' : err.message,
    },
  });
}
