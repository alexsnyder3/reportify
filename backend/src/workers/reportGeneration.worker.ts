import { Worker, Job } from 'bullmq';
import { prisma } from '../utils/prisma.js';
import { generateFieldReport, generateSafetyReport, PhotoContext } from '../services/deepseek.service.js';
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

  const photos: PhotoContext[] = entry.photos
    .filter((ep) => ep.photo.analysis)
    .map((ep) => ({
      description: ep.photo.analysis!.description,
      tags: ep.photo.analysis!.tags ?? [],
      safetyFlags: ep.photo.analysis!.safetyFlags ?? [],
    }));

  const projectName = entry.job?.name || 'Unassigned Project';
  const supervisorName = `${entry.user.firstName} ${entry.user.lastName}`;
  const date = entry.recordedAt.toISOString().split('T')[0];

  const jobAddress = entry.job?.address || undefined;
  const jobProjectNumber = (entry.job as any)?.projectNumber || undefined;
  const latitude = entry.latitude || entry.job?.latitude || undefined;
  const longitude = entry.longitude || entry.job?.longitude || undefined;
  const jobContext = (entry.job as any)?.context || undefined;

  try {
    const [supervisorResult, safetyResult] = await Promise.all([
      generateFieldReport({
        transcript: entry.transcript.text,
        projectName,
        supervisorName,
        date,
        photos,
        jobAddress,
        projectNumber: jobProjectNumber,
        latitude,
        longitude,
        jobContext,
      }),
      generateSafetyReport({
        transcript: entry.transcript.text,
        projectName,
        supervisorName,
        date,
        photos,
        jobAddress,
        projectNumber: jobProjectNumber,
        latitude,
        longitude,
        jobContext,
      }),
    ]);

    const reportsToCreate = [
      { type: 'GENERAL_FIELD_REPORT' as const, content: supervisorResult.content, rawMarkdown: supervisorResult.rawMarkdown },
      { type: 'SAFETY_REPORT' as const, content: safetyResult.content, rawMarkdown: safetyResult.rawMarkdown },
    ];

    for (const r of reportsToCreate) {
      const report = await prisma.report.create({
        data: {
          organizationId: entry.organizationId,
          userId: entry.userId,
          jobId: entry.jobId,
          type: r.type,
          title: `${projectName} — ${date}`,
          status: 'DRAFT',
          content: r.content as object,
          rawMarkdown: r.rawMarkdown,
          generatedBy: 'deepseek',
          entries: {
            create: { entryId: entry.id },
          },
        },
      });

      await prisma.reportVersion.create({
        data: {
          reportId: report.id,
          version: 1,
          content: r.content as object,
        },
      });
    }

    await prisma.entry.update({
      where: { id: entryId },
      data: { status: 'REPORT_GENERATED' },
    });

    logger.info('Reports generated', { entryId });
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
