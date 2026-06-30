import { prisma } from '../utils/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const EARTH_RADIUS_METERS = 6371000;

// Haversine formula — returns distance in meters between two GPS points
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface JobMatch {
  jobId: string;
  jobName: string;
  distanceMeters: number;
  confidence: number; // 0-1
}

// Compare GPS coords against all active jobs in the org. Returns best match or null.
export async function detectJobFromGPS(
  orgId: string,
  latitude: number,
  longitude: number,
): Promise<JobMatch | null> {
  const jobs = await prisma.job.findMany({
    where: { organizationId: orgId, isActive: true, deletedAt: null },
    select: { id: true, name: true, latitude: true, longitude: true, radiusMeters: true },
  });

  const candidates: JobMatch[] = [];

  for (const job of jobs) {
    if (job.latitude == null || job.longitude == null) continue;

    const dist = haversineDistance(latitude, longitude, job.latitude, job.longitude);
    if (dist <= job.radiusMeters) {
      // Confidence: 1.0 at center, 0.0 at edge of radius
      const confidence = Math.max(0, 1 - dist / job.radiusMeters);
      candidates.push({ jobId: job.id, jobName: job.name, distanceMeters: dist, confidence });
    }
  }

  if (candidates.length === 0) return null;

  // Return the closest match
  candidates.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return candidates[0];
}

export async function listJobs(orgId: string) {
  return prisma.job.findMany({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getJob(orgId: string, jobId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: orgId, deletedAt: null },
  });
  if (!job) throw new NotFoundError('Job');
  return job;
}

export async function createJob(orgId: string, data: {
  name: string;
  address?: string;
  projectNumber?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  notes?: string;
}) {
  return prisma.job.create({
    data: { ...data, organizationId: orgId },
  });
}

export async function updateJob(orgId: string, jobId: string, data: {
  name?: string;
  address?: string;
  projectNumber?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  isActive?: boolean;
  notes?: string;
}) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId: orgId, deletedAt: null } });
  if (!job) throw new NotFoundError('Job');

  return prisma.job.update({ where: { id: jobId }, data });
}

export async function deleteJob(orgId: string, jobId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId: orgId, deletedAt: null } });
  if (!job) throw new NotFoundError('Job');

  return prisma.job.update({ where: { id: jobId }, data: { deletedAt: new Date() } });
}
