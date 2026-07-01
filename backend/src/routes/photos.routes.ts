import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../utils/prisma.js';
import { getSignedDownloadUrl } from '../services/storage.service.js';
import { NotFoundError } from '../utils/errors.js';
import { photoAnalysisQueue, defaultJobOptions } from '../workers/queue.js';

const router = Router();
router.use(authenticate);

const listSchema = z.object({
  jobId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(40),
});

// GET /api/photos — list all photos for the org with signed URLs
router.get('/', validate(listSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId, page, limit } = req.query as unknown as z.infer<typeof listSchema>;
    const skip = (page - 1) * limit;

    const where = {
      organizationId: req.user!.orgId,
      deletedAt: null,
      ...(jobId && { jobId }),
    };

    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          job: { select: { id: true, name: true } },
          analysis: { select: { description: true, tags: true, safetyFlags: true } },
        },
        orderBy: { takenAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.photo.count({ where }),
    ]);

    // Attach signed URLs
    const photosWithUrls = await Promise.all(
      photos.map(async (p) => ({
        ...p,
        url: p.fileKey ? await getSignedDownloadUrl(p.fileKey) : null,
      }))
    );

    res.json({ success: true, data: { photos: photosWithUrls, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET /api/photos/:id/url  — single signed download URL
router.get('/:id/url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photo = await prisma.photo.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.orgId, deletedAt: null },
      select: { id: true, fileKey: true },
    });
    if (!photo || !photo.fileKey) throw new NotFoundError('Photo');

    const url = await getSignedDownloadUrl(photo.fileKey);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
});

// POST /api/photos/retry-failed — re-queue all FAILED photos for the org
router.post('/retry-failed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const failed = await prisma.photo.findMany({
      where: { organizationId: req.user!.orgId, status: 'FAILED', deletedAt: null, fileKey: { not: null } },
      select: { id: true, fileKey: true, mimeType: true },
    });

    await prisma.photo.updateMany({
      where: { id: { in: failed.map((p) => p.id) } },
      data: { status: 'PENDING' },
    });

    for (const photo of failed) {
      await photoAnalysisQueue.add('analyze', {
        photoId: photo.id,
        fileKey: photo.fileKey,
        mimeType: photo.mimeType || 'image/jpeg',
        orgId: req.user!.orgId,
      }, defaultJobOptions);
    }

    res.json({ success: true, data: { queued: failed.length } });
  } catch (err) { next(err); }
});

export default router;
