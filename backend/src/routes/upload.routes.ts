import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { uploadAudioEntry, uploadPhotoEntry } from '../services/entry.service.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

const MAX_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 100);

const storage = multer.memoryStorage();

const audioUpload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio type: ${file.mimetype}`));
    }
  },
});

const photoUpload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported image type: ${file.mimetype}`));
    }
  },
});

// POST /api/upload/audio
router.post('/audio', audioUpload.single('audio'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new ValidationError('Audio file is required');

    const {
      recordedAt,
      durationSeconds,
      latitude,
      longitude,
      gpsAccuracy,
      deviceEntryId,
    } = req.body;

    const entry = await uploadAudioEntry({
      orgId: req.user!.orgId,
      userId: req.user!.userId,
      audioBuffer: req.file.buffer,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      gpsAccuracy: gpsAccuracy ? parseFloat(gpsAccuracy) : undefined,
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
      durationSeconds: durationSeconds ? parseFloat(durationSeconds) : undefined,
      deviceEntryId,
      deviceMeta: req.body.deviceMeta ? JSON.parse(req.body.deviceMeta) : undefined,
    });

    res.status(201).json({ success: true, data: { entryId: entry.id, status: entry.status } });
  } catch (err) { next(err); }
});

// POST /api/upload/photo
router.post('/photo', photoUpload.single('photo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new ValidationError('Photo file is required');

    const { takenAt, latitude, longitude, gpsAccuracy, devicePhotoId } = req.body;

    const photo = await uploadPhotoEntry({
      orgId: req.user!.orgId,
      userId: req.user!.userId,
      photoBuffer: req.file.buffer,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      gpsAccuracy: gpsAccuracy ? parseFloat(gpsAccuracy) : undefined,
      takenAt: takenAt ? new Date(takenAt) : new Date(),
      devicePhotoId,
      deviceMeta: req.body.deviceMeta ? JSON.parse(req.body.deviceMeta) : undefined,
    });

    res.status(201).json({ success: true, data: { photoId: photo.id, status: photo.status } });
  } catch (err) { next(err); }
});

export default router;
