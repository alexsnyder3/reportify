import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { prisma } from '../utils/prisma.js';
import { createUserDirect } from '../services/auth.service.js';
import { sendInvite, listInvites, revokeInvite } from '../services/invite.service.js';
import { NotFoundError } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'SUPERVISOR']),
  password: z.string().min(8),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MANAGER', 'SUPERVISOR']).default('SUPERVISOR'),
});

// GET /api/users
router.get('/', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.orgId, deletedAt: null },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// POST /api/users  (admin creates user directly with password)
router.post('/', authorize('ADMIN'), validate(createUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await createUserDirect(
      req.user!.orgId,
      req.body.email,
      req.body.firstName,
      req.body.lastName,
      req.body.role,
      req.body.password,
    );
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
});

// POST /api/users/invite
router.post('/invite', authorize('ADMIN'), validate(inviteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invite = await sendInvite(req.user!.orgId, req.body.email, req.body.role, req.user!.userId);
    res.status(201).json({ success: true, data: invite });
  } catch (err) { next(err); }
});

// GET /api/users/invites
router.get('/invites', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invites = await listInvites(req.user!.orgId);
    res.json({ success: true, data: invites });
  } catch (err) { next(err); }
});

// DELETE /api/users/invites/:id
router.delete('/invites/:id', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeInvite(req.user!.orgId, String(req.params.id));
    res.json({ success: true });
  } catch (err) { next(err); }
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'SUPERVISOR']).optional(),
  password: z.string().min(8).optional(),
});

// PATCH /api/users/:id  (edit profile, name, email, phone, role, password)
router.patch('/:id', authorize('ADMIN'), validate(updateUserSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.orgId },
    });
    if (!user) throw new NotFoundError('User');

    const { password, ...rest } = req.body as z.infer<typeof updateUserSchema>;
    const data: Record<string, unknown> = { ...rest };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.user.update({
      where: { id: String(req.params.id) },
      data,
      select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true, isActive: true, lastLoginAt: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/deactivate
router.patch('/:id/deactivate', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.orgId },
    });
    if (!user) throw new NotFoundError('User');
    const updated = await prisma.user.update({
      where: { id: String(req.params.id) },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

export default router;
