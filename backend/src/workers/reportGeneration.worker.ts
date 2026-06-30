import { Worker, Job } from 'bullmq';
import { prisma } from '../utils/prisma.js';
import { generateFieldReport } from '../services/deepseek.service.js';
import { connection, QUEUE_NAMES } from './queue.js';
import { logger } from '../utils/logger.js';

export interface ReportJobData {
  entryId: string;
  orgId: string;
}

async function processReportGeneration(job: Job<ReportJobData>) {
  const { entryId } = job.data;
  logger.info('Generating report', { entryId });

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: {
      user: true,
      job: true,
      transcript: true,
      photos: {
        include: {
          photo: { include: { analysis: true } },
        },
      },
    },
  });

  if (!entry || !entry.transcript) {
    logger.warn('Entry or transcript not found for report generation', { entryId });
    return;
  }

  const photoDescriptions = entry.photos
    .map((ep) => ep.photo.analysis?.description)
    .filter(Boolean) as string[];

  const projectName = entry.job?.name || 'Unassigned Project';
  const supervisorName = `${entry.user.firstName} ${entry.user.lastName}`;
  const date = entry.recordedAt.toISOString().split('T')[0];

  try {
    const { content, rawMarkdown } = await generateFieldReport({
      transcript: entry.transcript.text,
      projectName,
      supervisorName,
      date,
      photoDescriptions,
      jobAddress: entry.job?.address || undefined,
      projectNumber: (entry.job as any)?.projectNumber || undefined,
      latitude: entry.latitude || entry.job?.latitude || undefined,
      longitude: entry.longitude || entry.job?.longitude || undefined,
    });

    const report = await prisma.report.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        jobId: entry.jobId,
        type: 'GENERAL_FIELD_REPORT',
        title: `${projectName} — ${date}`,
        status: 'DRAFT',
        content: content as object,
        rawMarkdown,
        generatedBy: 'deepseek',
        entries: {
          create: { entryId: entry.id },
        },
      },
    });

    // Save a version snapshot
    await prisma.reportVersion.create({
      data: {
        reportId: report.id,
        version: 1,
        content: content as object,
      },
    });

    await prisma.entry.update({
      where: { id: entryId },
      data: { status: 'REPORT_GENERATED' },
    });

    logger.info('Report generated', { entryId, reportId: report.id });
  } catch (err) {
    logger.error('Report generation failed', { entryId, error: String(err) });
    throw err;
  }
}

export function startReportWorker() {
  const worker = new Worker(QUEUE_NAMES.REPORT_GENERATION, processReportGeneration, { connection });
  worker.on('completed', (job) => logger.info('Report job completed', { jobId: job.id }));
  worker.on('failed', (job, err) =>
    logger.error('Report job failed', { jobId: job?.id, error: String(err) }),
  );
  worker.on('error', (err) => logger.error('Report worker error', { error: String(err) }));
  return worker;
}
