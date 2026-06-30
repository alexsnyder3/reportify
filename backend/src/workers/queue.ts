import { Queue } from 'bullmq';

function redisConnection() {
  // Railway private networking: use REDIS_PRIVATE_URL or REDIS_URL
  const url = process.env.REDIS_PRIVATE_URL || process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
    };
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null as null, enableReadyCheck: false };
  }
}

export const connection = redisConnection();

// Queue names
export const QUEUE_NAMES = {
  TRANSCRIPTION: 'transcription',
  PHOTO_ANALYSIS: 'photo-analysis',
  REPORT_GENERATION: 'report-generation',
  JOB_DETECTION: 'job-detection',
} as const;

function makeQueue(name: string) {
  const q = new Queue(name, { connection });
  q.on('error', () => { /* suppress — Redis may be unavailable */ });
  return q;
}

// Create queues
export const transcriptionQueue = makeQueue(QUEUE_NAMES.TRANSCRIPTION);
export const photoAnalysisQueue = makeQueue(QUEUE_NAMES.PHOTO_ANALYSIS);
export const reportQueue = makeQueue(QUEUE_NAMES.REPORT_GENERATION);
export const jobDetectionQueue = makeQueue(QUEUE_NAMES.JOB_DETECTION);

export const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};
