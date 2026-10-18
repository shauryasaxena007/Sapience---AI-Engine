import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { csrfHeader } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chats.js';
import fileRoutes from './routes/files.js';
import onenoteRoutes from './routes/onenote.js';

export const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const api = express.Router();
api.get('/health', (_req, res) => res.json({ status: 'ok' }));
api.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600 }));
api.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40 }));
api.use(csrfHeader);
api.use('/auth', authRoutes);
api.use('/user', userRoutes);
api.use('/chats', chatRoutes);
api.use('/files', fileRoutes);
api.use('/onenote', onenoteRoutes);
app.use('/api/v1', api);

app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }));
app.use(errorHandler);
