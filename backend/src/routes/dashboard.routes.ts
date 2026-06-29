import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';

const router = Router();
router.use(authenticate, authorize('ADMIN', 'MANAGER'));

// GET /api/dashboard
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId;

    const [
      totalUsers,
      totalJobs,
      totalEntries,
      unprocessedEntries,
      totalReports,
      recentEntries,
      failedEntries,
    ] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId, deletedAt: null, isActive: true } }),
      prisma.job.count({ where: { organizationId: orgId, deletedAt: null, isActive: true } }),
      prisma.entry.count({ where: { organizationId: orgId, deletedAt: null } }),
      prisma.entry.count({
        where: { organizationId: orgId, status: { in: ['UPLOADED', 'PROCESSING'] } },
      }),
      prisma.report.count({ where: { organizationId: orgId, deletedAt: null } }),
      prisma.entry.findMany({
        where: { organizationId: orgId, deletedAt: null },
        include: {
          user: { select: { firstName: true, lastName: true } },
          job: { select: { name: true } },
          transcript: { select: { text: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.entry.count({
        where: { organizationId: orgId, status: 'FAILED' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalJobs,
          totalEntries,
          unprocessedEntries,
          totalReports,
          failedEntries,
        },
        recentEntries,
      },
    });
  } catch (err) { next(err); }
});

export default router;
