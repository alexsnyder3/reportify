import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Queue names
export const QUEUE_NAMES = {
  TRANSCRIPTION: 'transcription',
  PHOTO_ANALYSIS: 'photo-analysis',
  REPORT_GENERATION: 'report-generation',
  JOB_DETECTION: 'job-detection',
} as const;

// Create queues
export const transcriptionQueue = new Queue(QUEUE_NAMES.TRANSCRIPTION, { connection });
export const photoAnalysisQueue = new Queue(QUEUE_NAMES.PHOTO_ANALYSIS, { connection });
export const reportQueue = new Queue(QUEUE_NAMES.REPORT_GENERATION, { connection });
export const jobDetectionQueue = new Queue(QUEUE_NAMES.JOB_DETECTION, { connection });

export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

export { connection };
