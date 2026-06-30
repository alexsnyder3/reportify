import 'dotenv/config';

// Prevent unhandled errors from crashing the server
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (suppressed):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (suppressed):', err);
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { ensureBucketExists } from './services/storage.service.js';
import { startTranscriptionWorker } from './workers/transcription.worker.js';
import { startPhotoAnalysisWorker } from './workers/photoAnalysis.worker.js';
import { startReportWorker } from './workers/reportGeneration.worker.js';
import { logger } from './utils/logger.js';
import { prisma } from './utils/prisma.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/users.routes.js';
import jobRoutes from './routes/jobs.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import entryRoutes from './routes/entries.routes.js';
import reportRoutes from './routes/reports.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Railway's reverse proxy
app.set('trust proxy', 1);

// ─── Security ───────────────────────────────
app.use(helmet());
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow any vercel.app subdomain and explicitly listed origins
    if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Logging & Parsing ──────────────────────
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Health ──────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── API Routes ──────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ─── Error Handling ──────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Start ───────────────────────────────────
async function start() {
  try {
    // Verify DB connection
    await prisma.$connect();
    logger.info('Database connected');

    // Ensure S3/MinIO bucket exists (non-fatal — storage may not be configured yet)
    try {
      await ensureBucketExists();
      logger.info('Storage bucket ready');
    } catch (err) {
      logger.warn('Storage bucket check failed — uploads will not work until S3 is configured', { error: String(err) });
    }

    // Start background workers (non-fatal — Redis may not be available)
    try {
      startTranscriptionWorker();
      startPhotoAnalysisWorker();
      startReportWorker();
      logger.info('Background workers started');
    } catch (err) {
      logger.warn('Background workers failed to start — AI processing unavailable', { error: String(err) });
    }

    app.listen(PORT, () => {
      logger.info(`Reportify API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: String(err) });
    process.exit(1);
  }
}

start();
