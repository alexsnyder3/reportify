import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { JwtPayload } from '../types/index.js';
import { UnauthorizedError, NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { UserRole } from '@prisma/client';

const SALT_ROUNDS = 12;

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { organization: true },
  });

  if (!user || !user.isActive || user.deletedAt) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const payload: JwtPayload = {
    userId: user.id,
    orgId: user.organizationId,
    role: user.role,
    email: user.email,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        slug: user.organization.slug,
      },
    },
  };
}

export async function registerWithInvite(
  token: string,
  firstName: string,
  lastName: string,
  password: string,
) {
  const invite = await prisma.invitation.findUnique({ where: { token } });

  if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
    throw new ValidationError('Invitation is invalid or expired');
  }

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
  });
  if (existing) {
    throw new ConflictError('A user with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        organizationId: invite.organizationId,
        email: invite.email,
        passwordHash,
        firstName,
        lastName,
        role: invite.role,
      },
    });

    await tx.invitation.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED' },
    });

    return newUser;
  });

  return loginUser(user.email, password);
}

export async function createUserDirect(
  orgId: string,
  email: string,
  firstName: string,
  lastName: string,
  role: UserRole,
  password: string,
) {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new ConflictError('A user with this email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.user.create({
    data: {
      organizationId: orgId,
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
  if (!user) throw new NotFoundError('User');

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    organization: {
      id: user.organization.id,
      name: user.organization.name,
      slug: user.organization.slug,
    },
  };
}
