import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma.js';
import { uploadFile, buildKey } from './storage.service.js';
import { detectJobFromGPS } from './job.service.js';
import { transcriptionQueue, photoAnalysisQueue, defaultJobOptions, QUEUE_NAMES } from '../workers/queue.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 100);
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export async function uploadAudioEntry(params: {
  orgId: string;
  userId: string;
  audioBuffer: Buffer;
  originalFilename: string;
  mimeType: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  recordedAt: Date;
  durationSeconds?: number;
  deviceEntryId?: string;
  deviceMeta?: object;
}) {
  if (params.audioBuffer.length > MAX_BYTES) {
    throw new Error(`File too large. Maximum size is ${MAX_UPLOAD_MB}MB`);
  }

  const fileId = uuidv4();
  const ext = params.originalFilename.split('.').pop() || 'm4a';
  const key = buildKey(params.orgId, 'audio', `${fileId}.${ext}`);

  await uploadFile(key, params.audioBuffer, params.mimeType);

  // GPS job detection
  let jobId: string | undefined;
  let jobConfidence: number | undefined;
  if (params.latitude != null && params.longitude != null) {
    const match = await detectJobFromGPS(params.orgId, params.latitude, params.longitude);
    if (match) {
      jobId = match.jobId;
      jobConfidence = match.confidence;
      logger.info('Job auto-detected', { entryId: fileId, jobId, confidence: match.confidence });
    }
  }

  const entry = await prisma.entry.create({
    data: {
      id: fileId,
      organizationId: params.orgId,
      userId: params.userId,
      jobId: jobId ?? null,
      jobDetectedId: jobId ?? null,
      jobConfidence: jobConfidence ?? null,
      audioFileKey: key,
      audioFileSizeBytes: params.audioBuffer.length,
      durationSeconds: params.durationSeconds,
      latitude: params.latitude,
      longitude: params.longitude,
      gpsAccuracy: params.gpsAccuracy,
      recordedAt: params.recordedAt,
      deviceEntryId: params.deviceEntryId,
      deviceMeta: params.deviceMeta as object,
      status: 'UPLOADED',
    },
  });

  // Queue transcription
  await transcriptionQueue.add(
    QUEUE_NAMES.TRANSCRIPTION,
    { entryId: entry.id, audioFileKey: key, orgId: params.orgId },
    defaultJobOptions,
  );

  return entry;
}

export async function uploadPhotoEntry(params: {
  orgId: string;
  userId: string;
  photoBuffer: Buffer;
  originalFilename: string;
  mimeType: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number;
  takenAt: Date;
  devicePhotoId?: string;
  deviceMeta?: object;
}) {
  if (params.photoBuffer.length > MAX_BYTES) {
    throw new Error(`File too large. Maximum size is ${MAX_UPLOAD_MB}MB`);
  }

  const photoId = uuidv4();
  const ext = params.originalFilename.split('.').pop() || 'jpg';
  const key = buildKey(params.orgId, 'photo', `${photoId}.${ext}`);

  await uploadFile(key, params.photoBuffer, params.mimeType);

  // GPS job detection
  let jobId: string | undefined;
  if (params.latitude != null && params.longitude != null) {
    const match = await detectJobFromGPS(params.orgId, params.latitude, params.longitude);
    if (match) jobId = match.jobId;
  }

  const photo = await prisma.photo.create({
    data: {
      id: photoId,
      organizationId: params.orgId,
      userId: params.userId,
      jobId: jobId ?? null,
      fileKey: key,
      fileSizeBytes: params.photoBuffer.length,
      mimeType: params.mimeType,
      latitude: params.latitude,
      longitude: params.longitude,
      gpsAccuracy: params.gpsAccuracy,
      takenAt: params.takenAt,
      devicePhotoId: params.devicePhotoId,
      deviceMeta: params.deviceMeta as object,
      status: 'UPLOADED',
    },
  });

  // Queue photo analysis
  await photoAnalysisQueue.add(
    QUEUE_NAMES.PHOTO_ANALYSIS,
    { photoId: photo.id, fileKey: key, mimeType: params.mimeType, orgId: params.orgId },
    defaultJobOptions,
  );

  return photo;
}

export async function listEntries(orgId: string, filters: {
  userId?: string;
  jobId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}) {
  const { page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where = {
    organizationId: orgId,
    deletedAt: null,
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.jobId && { jobId: filters.jobId }),
    ...(filters.dateFrom || filters.dateTo
      ? {
          recordedAt: {
            ...(filters.dateFrom && { gte: filters.dateFrom }),
            ...(filters.dateTo && { lte: filters.dateTo }),
          },
        }
      : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.entry.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        job: { select: { id: true, name: true } },
        transcript: { select: { text: true } },
        photos: { include: { photo: { select: { id: true, fileKey: true, thumbnailKey: true } } } },
      },
      orderBy: { recordedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.entry.count({ where }),
  ]);

  return { entries, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getEntry(orgId: string, entryId: string) {
  const entry = await prisma.entry.findFirst({
    where: { id: entryId, organizationId: orgId, deletedAt: null },
    include: {
      user: true,
      job: true,
      transcript: true,
      photos: {
        include: {
          photo: { include: { analysis: true } },
        },
      },
      reports: {
        include: { report: { select: { id: true, title: true, status: true, createdAt: true } } },
      },
    },
  });
  if (!entry) throw new NotFoundError('Entry');
  return entry;
}

export async function reassignEntryJob(orgId: string, entryId: string, jobId: string | null) {
  const entry = await prisma.entry.findFirst({ where: { id: entryId, organizationId: orgId } });
  if (!entry) throw new NotFoundError('Entry');

  if (jobId) {
    const job = await prisma.job.findFirst({ where: { id: jobId, organizationId: orgId } });
    if (!job) throw new NotFoundError('Job');
  }

  return prisma.entry.update({ where: { id: entryId }, data: { jobId } });
}
