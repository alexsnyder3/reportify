import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as jobService from '../services/job.service.js';

const router = Router();
router.use(authenticate);

const createJobSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().min(10).max(10000).default(200),
  notes: z.string().optional(),
});

const updateJobSchema = createJobSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// GET /api/jobs
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await jobService.listJobs(req.user!.orgId);
    res.json({ success: true, data: jobs });
  } catch (err) { next(err); }
});

// GET /api/jobs/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobService.getJob(req.user!.orgId, String(req.params.id));
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
});

// POST /api/jobs
router.post('/', authorize('ADMIN', 'MANAGER'), validate(createJobSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobService.createJob(req.user!.orgId, req.body);
    res.status(201).json({ success: true, data: job });
  } catch (err) { next(err); }
});

// PATCH /api/jobs/:id
router.patch('/:id', authorize('ADMIN', 'MANAGER'), validate(updateJobSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await jobService.updateJob(req.user!.orgId, String(req.params.id), req.body);
    res.json({ success: true, data: job });
  } catch (err) { next(err); }
});

// DELETE /api/jobs/:id
router.delete('/:id', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await jobService.deleteJob(req.user!.orgId, String(req.params.id));
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
