import { Worker, Job } from 'bullmq';
import { prisma } from '../utils/prisma.js';
import { analyzePhoto } from '../services/gemini.service.js';
import { getSignedDownloadUrl } from '../services/storage.service.js';
import { connection, QUEUE_NAMES } from './queue.js';
import { logger } from '../utils/logger.js';
export interface PhotoAnalysisJobData {
  photoId: string;
  fileKey: string;
  mimeType: string;
  orgId: string;
}

async function processPhotoAnalysis(job: Job<PhotoAnalysisJobData>) {
  const { photoId, fileKey, mimeType, orgId } = job.data;
  logger.info('Processing photo analysis', { photoId });

  await prisma.photo.update({ where: { id: photoId }, data: { status: 'PROCESSING' } });

  try {
    const signedUrl = await getSignedDownloadUrl(fileKey);
    const res = await fetch(signedUrl);
    if (!res.ok) throw new Error('Failed to download photo');
    const buffer = Buffer.from(await res.arrayBuffer());

    const analysis = await analyzePhoto(buffer, mimeType);

    await prisma.photoAnalysis.upsert({
      where: { photoId },
      create: {
        photoId,
        description: analysis.description,
        tags: analysis.tags,
        safetyFlags: analysis.safetyFlags,
        rawResponse: analysis.rawResponse as object,
      },
      update: {
        description: analysis.description,
        tags: analysis.tags,
        safetyFlags: analysis.safetyFlags,
        rawResponse: analysis.rawResponse as object,
      },
    });

    await prisma.photo.update({ where: { id: photoId }, data: { status: 'ANALYZED' } });

    // Link photo to nearby entries (same user, same job, within 2 hours)
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (photo?.jobId && photo.userId) {
      const twoHoursAgo = new Date(photo.takenAt.getTime() - 2 * 60 * 60 * 1000);
      const twoHoursAhead = new Date(photo.takenAt.getTime() + 2 * 60 * 60 * 1000);

      const nearbyEntries = await prisma.entry.findMany({
        where: {
          userId: photo.userId,
          jobId: photo.jobId,
          recordedAt: { gte: twoHoursAgo, lte: twoHoursAhead },
        },
      });

      for (const entry of nearbyEntries) {
        await prisma.entryPhoto.upsert({
          where: { entryId_photoId: { entryId: entry.id, photoId } },
          create: { entryId: entry.id, photoId },
          update: {},
        });
      }
    }

    logger.info('Photo analysis complete', { photoId });
  } catch (err) {
    logger.error('Photo analysis failed', { photoId, error: String(err) });
    await prisma.photo.update({ where: { id: photoId }, data: { status: 'FAILED' } });
    throw err;
  }
}

export function startPhotoAnalysisWorker() {
  const worker = new Worker(QUEUE_NAMES.PHOTO_ANALYSIS, processPhotoAnalysis, { connection });
  worker.on('completed', (job) => logger.info('Photo analysis job completed', { jobId: job.id }));
  worker.on('failed', (job, err) =>
    logger.error('Photo analysis job failed', { jobId: job?.id, error: String(err) }),
  );
  worker.on('error', (err) => logger.error('Photo analysis worker error', { error: String(err) }));
  return worker;
}
