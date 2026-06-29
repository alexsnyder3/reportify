import { UserRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: UserRole;
  email: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// Express augmentation
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
