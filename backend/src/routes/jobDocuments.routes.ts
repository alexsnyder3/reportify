import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { DocStatus } from '@prisma/client';
import { uploadFile } from '../services/storage.service.js';
import { documentAnalysisQueue, defaultJobOptions } from '../workers/queue.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// POST /api/job-documents/:jobId/upload
router.post('/:jobId/upload', authorize('ADMIN', 'MANAGER'), upload.array('files', 10), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = String(req.params.jobId);
    const files = req.files as Express.Multer.File[];
    if (!files?.length) { res.status(400).json({ success: false, error: 'No files provided' }); return; }

    const job = await prisma.job.findFirst({ where: { id: jobId, organizationId: req.user!.orgId, deletedAt: null } });
    if (!job) throw new NotFoundError('Job');

    const created = await Promise.all(files.map(async (file) => {
      const fileKey = `documents/${req.user!.orgId}/${jobId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      await uploadFile(fileKey, file.buffer, file.mimetype);

      const doc = await prisma.jobDocument.create({
        data: {
          jobId,
          organizationId: req.user!.orgId,
          fileName: file.originalname,
          fileKey,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          status: DocStatus.PROCESSING,
        },
      });

      await documentAnalysisQueue.add('analyze', {
        documentId: doc.id,
        jobId,
        orgId: req.user!.orgId,
      }, defaultJobOptions);

      return doc;
    }));

    res.status(201).json({ success: true, data: created });
  } catch (err) { next(err); }
});

// GET /api/job-documents/:jobId
router.get('/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = String(req.params.jobId);
    const job = await prisma.job.findFirst({ where: { id: jobId, organizationId: req.user!.orgId, deletedAt: null } });
    if (!job) throw new NotFoundError('Job');

    const docs = await prisma.jobDocument.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { documents: docs, context: job.context } });
  } catch (err) { next(err); }
});

// DELETE /api/job-documents/:jobId/:docId
router.delete('/:jobId/:docId', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobId = String(req.params.jobId);
    const docId = String(req.params.docId);

    const doc = await prisma.jobDocument.findFirst({
      where: { id: docId, jobId, organizationId: req.user!.orgId },
    });
    if (!doc) throw new NotFoundError('Document');

    await prisma.jobDocument.delete({ where: { id: doc.id } });

    const remaining = await prisma.jobDocument.findMany({
      where: { jobId, status: DocStatus.READY },
      orderBy: { createdAt: 'asc' },
    });
    const combinedContext = remaining
      .map((d: { fileName: string; extractedText: string | null }) => `## ${d.fileName}\n${d.extractedText ?? ''}`)
      .join('\n\n---\n\n');
    await prisma.job.update({ where: { id: jobId }, data: { context: combinedContext || null } });

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
