import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import { UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendInvite(orgId: string, email: string, role: UserRole, invitedByUserId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new NotFoundError('Organization');

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new ConflictError('A user with this email already exists');

  const existingInvite = await prisma.invitation.findFirst({
    where: { email: email.toLowerCase(), organizationId: orgId, status: 'PENDING' },
  });
  if (existingInvite) throw new ConflictError('An invitation has already been sent to this email');

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + Number(process.env.INVITE_EXPIRY_HOURS || 48) * 60 * 60 * 1000);

  const invite = await prisma.invitation.create({
    data: {
      organizationId: orgId,
      email: email.toLowerCase(),
      role,
      token,
      expiresAt,
    },
  });

  const inviteUrl = `${process.env.APP_URL}/accept-invite?token=${token}`;

  try {
    const transport = createTransport();
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `You've been invited to join ${org.name} on Reportify`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've been invited to Reportify</h2>
          <p>You have been invited to join <strong>${org.name}</strong> as a <strong>${role.toLowerCase()}</strong>.</p>
          <p>Click the button below to set up your account. This link expires in ${process.env.INVITE_EXPIRY_HOURS || 48} hours.</p>
          <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;margin:16px 0;">
            Accept Invitation
          </a>
          <p style="color:#6b7280;font-size:14px;">Or copy this link: ${inviteUrl}</p>
          <hr />
          <p style="color:#6b7280;font-size:12px;">This invitation was sent from Reportify. If you did not expect this, you can ignore this email.</p>
        </div>
      `,
    });
    logger.info('Invite email sent', { email, orgId });
  } catch (err) {
    logger.error('Failed to send invite email', { email, error: String(err) });
    // Don't throw — invitation is created, email failure is not fatal
  }

  return { id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt };
}

export async function listInvites(orgId: string) {
  return prisma.invitation.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeInvite(orgId: string, inviteId: string) {
  const invite = await prisma.invitation.findFirst({
    where: { id: inviteId, organizationId: orgId },
  });
  if (!invite) throw new NotFoundError('Invitation');

  return prisma.invitation.update({
    where: { id: inviteId },
    data: { status: 'REVOKED' },
  });
}
