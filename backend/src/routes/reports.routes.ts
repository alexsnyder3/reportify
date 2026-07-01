import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

const listSchema = z.object({
  jobId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  type: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// GET /api/reports
router.get('/', validate(listSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId, userId, type, page, limit } = req.query as unknown as z.infer<typeof listSchema>;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      organizationId: req.user!.orgId,
      deletedAt: null,
      ...(jobId && { jobId }),
      ...(userId && { userId }),
      ...(type && { type: type as any }),
    };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          job: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.report.count({ where }),
    ]);

    res.json({ success: true, data: { reports, total, page: Number(page), limit: Number(limit) } });
  } catch (err) { next(err); }
});

// GET /api/reports/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await prisma.report.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.orgId, deletedAt: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        job: true,
        entries: {
          include: {
            entry: {
              include: {
                transcript: true,
                photos: { include: { photo: { include: { analysis: true } } } },
              },
            },
          },
        },
        versions: { orderBy: { version: 'desc' }, take: 5 },
      },
    });
    if (!report) throw new NotFoundError('Report');
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

// PATCH /api/reports/:id  (update status or content)
router.patch('/:id', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await prisma.report.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.orgId },
    });
    if (!report) throw new NotFoundError('Report');

    const { status, content } = req.body;

    // Save a new version if content is changing
    if (content) {
      const lastVersion = await prisma.reportVersion.findFirst({
        where: { reportId: report.id },
        orderBy: { version: 'desc' },
      });
      await prisma.reportVersion.create({
        data: {
          reportId: report.id,
          version: (lastVersion?.version ?? 0) + 1,
          content,
        },
      });
    }

    const updated = await prisma.report.update({
      where: { id: String(req.params.id) },
      data: {
        ...(status && { status }),
        ...(content && { content }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// DELETE /api/reports/:id  (soft delete)
router.delete('/:id', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await prisma.report.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.orgId },
    });
    if (!report) throw new NotFoundError('Report');
    await prisma.report.update({ where: { id: String(req.params.id) }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
