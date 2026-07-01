import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { getSignedDownloadUrl } from '../services/storage.service.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

// GET /api/photos/:id/url  — returns a short-lived signed download URL
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

export default router;
