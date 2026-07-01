import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as entryService from '../services/entry.service.js';
import { getSignedDownloadUrl } from '../services/storage.service.js';
import { prisma } from '../utils/prisma.js';
import { reportQueue, defaultJobOptions, QUEUE_NAMES } from '../workers/queue.js';

const router = Router();
router.use(authenticate);

const listSchema = z.object({
  userId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const reassignSchema = z.object({
  jobId: z.string().uuid().nullable(),
});

// GET /api/entries
router.get('/', validate(listSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, jobId, dateFrom, dateTo, page, limit } = req.query as unknown as z.infer<typeof listSchema>;

    // Supervisors can only see their own entries
    const filterUserId =
      req.user!.role === 'SUPERVISOR' ? req.user!.userId : (userId as string | undefined);

    const result = await entryService.listEntries(req.user!.orgId, {
      userId: filterUserId,
      jobId: jobId as string | undefined,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// GET /api/entries/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await entryService.getEntry(req.user!.orgId, String(req.params.id));

    // Supervisors can only see their own
    if (req.user!.role === 'SUPERVISOR' && entry.userId !== req.user!.userId) {
      res.status(403).json({ success: false, error: { message: 'Forbidden' } });
      return;
    }

    // Generate signed URL for audio
    let audioUrl: string | undefined;
    if (entry.audioFileKey) {
      audioUrl = await getSignedDownloadUrl(entry.audioFileKey);
    }

    res.json({ success: true, data: { ...entry, audioUrl } });
  } catch (err) { next(err); }
});

// PATCH /api/entries/:id/job  (reassign entry to a different job)
router.patch('/:id/job', authorize('ADMIN', 'MANAGER'), validate(reassignSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await entryService.reassignEntryJob(req.user!.orgId, String(req.params.id), req.body.jobId);
    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
});

// POST /api/entries/:id/regenerate  (re-run report generation with current job assignment)
router.post('/:id/regenerate', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await entryService.getEntry(req.user!.orgId, String(req.params.id));
    if (!entry.transcript) {
      res.status(400).json({ success: false, error: { message: 'Entry has not been transcribed yet' } });
      return;
    }

    // Soft-delete existing reports for this entry
    const reportIds = entry.reports.map((re: any) => re.report.id);
    if (reportIds.length > 0) {
      await prisma.report.updateMany({
        where: { id: { in: reportIds } },
        data: { deletedAt: new Date() },
      });
    }

    // Reset entry status and re-queue report generation
    await prisma.entry.update({
      where: { id: entry.id },
      data: { status: 'TRANSCRIBED' },
    });

    await reportQueue.add(
      QUEUE_NAMES.REPORT_GENERATION,
      { entryId: entry.id, orgId: req.user!.orgId },
      defaultJobOptions,
    );

    res.json({ success: true, data: { message: 'Report regeneration queued' } });
  } catch (err) { next(err); }
});

// GET /api/entries/:id/audio-url  (get fresh signed URL)
router.get('/:id/audio-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await entryService.getEntry(req.user!.orgId, String(req.params.id));
    if (!entry.audioFileKey) {
      res.status(404).json({ success: false, error: { message: 'No audio file' } });
      return;
    }
    const url = await getSignedDownloadUrl(entry.audioFileKey);
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
});

export default router;
