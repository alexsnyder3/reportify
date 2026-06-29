import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '../types/index.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(err);
    }
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}

// Ensure the request targets the same org as the JWT
export function requireSameOrg(req: Request, _res: Response, next: NextFunction): void {
  const paramOrgId = req.params.orgId;
  if (paramOrgId && req.user?.orgId !== paramOrgId && req.user?.role !== 'ADMIN') {
    return next(new ForbiddenError('Organization mismatch'));
  }
  next();
}
