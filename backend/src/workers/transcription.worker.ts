import { Worker, Job } from 'bullmq';
import { prisma } from '../utils/prisma.js';
import { transcribeAudio } from '../services/whisper.service.js';
import { getSignedDownloadUrl } from '../services/storage.service.js';
import { reportQueue, connection, defaultJobOptions, QUEUE_NAMES } from './queue.js';
import { logger } from '../utils/logger.js';
export interface TranscriptionJobData {
  entryId: string;
  audioFileKey: string;
  orgId: string;
}

async function processTranscription(job: Job<TranscriptionJobData>) {
  const { entryId, audioFileKey, orgId } = job.data;
  logger.info('Processing transcription', { entryId, jobId: job.id });

  // Mark as processing
  await prisma.entry.update({
    where: { id: entryId },
    data: { status: 'PROCESSING' },
  });

  try {
    // Download audio from storage
    const signedUrl = await getSignedDownloadUrl(audioFileKey);
    const audioResponse = await fetch(signedUrl);
    if (!audioResponse.ok) throw new Error('Failed to download audio file');
    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

    const filename = audioFileKey.split('/').pop() || 'audio.m4a';

    // Transcribe with Whisper
    const transcription = await transcribeAudio(audioBuffer, filename);

    // Save transcript
    await prisma.transcript.upsert({
      where: { entryId },
      create: {
        entryId,
        text: transcription.text,
        language: transcription.language,
        durationSeconds: transcription.duration,
        wordCount: transcription.text.split(/\s+/).length,
      },
      update: {
        text: transcription.text,
        language: transcription.language,
        durationSeconds: transcription.duration,
        wordCount: transcription.text.split(/\s+/).length,
      },
    });

    await prisma.entry.update({
      where: { id: entryId },
      data: { status: 'TRANSCRIBED' },
    });

    logger.info('Transcription complete', { entryId });

    // Queue report generation
    await reportQueue.add(
      QUEUE_NAMES.REPORT_GENERATION,
      { entryId, orgId },
      defaultJobOptions,
    );
  } catch (err) {
    logger.error('Transcription failed', { entryId, error: String(err) });
    await prisma.entry.update({
      where: { id: entryId },
      data: { status: 'FAILED' },
    });
    throw err;
  }
}

export function startTranscriptionWorker() {
  const worker = new Worker(QUEUE_NAMES.TRANSCRIPTION, processTranscription, { connection });

  worker.on('completed', (job) => logger.info('Transcription job completed', { jobId: job.id }));
  worker.on('failed', (job, err) =>
    logger.error('Transcription job failed', { jobId: job?.id, error: String(err) }),
  );

  return worker;
}
