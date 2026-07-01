import { Worker, Job } from 'bullmq';
import { prisma } from '../utils/prisma.js';
import { DocStatus } from '@prisma/client';
import { getSignedDownloadUrl } from '../services/storage.service.js';
import { connection, QUEUE_NAMES } from './queue.js';
import { logger } from '../utils/logger.js';

export interface DocumentAnalysisJobData {
  documentId: string;
  jobId: string;
  orgId: string;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamically import pdf-parse (CJS module)
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js' as any)).default ?? (await import('pdf-parse/lib/pdf-parse.js' as any));
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function summarizeDocumentWithAI(text: string, fileName: string, imageUrl?: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  let content: object[];

  if (imageUrl) {
    // Drawing/image — use vision
    content = [
      { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
      {
        type: 'text',
        text: `This is a construction drawing or site plan named "${fileName}". Describe what you see in detail: the type of work, materials, dimensions, structural elements, site layout, notes, and any specifications visible. This summary will be used as context when generating field reports for this job.`,
      },
    ];
  } else {
    // Text document — summarize
    const truncated = text.slice(0, 12000); // stay within token limits
    content = [
      {
        type: 'text',
        text: `You are analyzing a construction document named "${fileName}". Extract and summarize the key information that would be useful for a field supervisor writing daily reports. Include:
- Scope of work / project description
- Key materials and specifications
- Safety requirements or special conditions
- Milestones, phases, or sequencing
- Any other details relevant to daily field reporting

Document text:
---
${truncated}
---

Write a concise professional summary (200-400 words) that a supervisor can reference when reporting on daily progress.`,
      },
    ];
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      temperature: 0.2,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function processDocumentAnalysis(job: Job<DocumentAnalysisJobData>) {
  const { documentId, jobId, orgId } = job.data;
  logger.info('Processing document analysis', { documentId });

  const doc = await prisma.jobDocument.findUnique({ where: { id: documentId } });
  if (!doc) { logger.warn('Document not found', { documentId }); return; }

  try {
    const signedUrl = await getSignedDownloadUrl(doc.fileKey);
    const res = await fetch(signedUrl);
    if (!res.ok) throw new Error('Failed to download document');

    const buffer = Buffer.from(await res.arrayBuffer());
    const isImage = doc.mimeType.startsWith('image/');

    let summary = '';
    if (isImage) {
      const freshUrl = await getSignedDownloadUrl(doc.fileKey);
      summary = await summarizeDocumentWithAI('', doc.fileName, freshUrl);
    } else {
      // PDF or text
      let text = '';
      try {
        text = await extractTextFromPdf(buffer);
      } catch {
        // If PDF parsing fails, try treating as plain text
        text = buffer.toString('utf8').slice(0, 12000);
      }
      summary = await summarizeDocumentWithAI(text, doc.fileName);
    }

    // Save extracted text and mark ready
    await prisma.jobDocument.update({
      where: { id: documentId },
      data: { status: DocStatus.READY, extractedText: summary },
    });

    // Rebuild the job's combined context from all ready documents
    const allDocs = await prisma.jobDocument.findMany({
      where: { jobId, status: DocStatus.READY },
      orderBy: { createdAt: 'asc' },
      select: { fileName: true, extractedText: true },
    });

    const combinedContext = allDocs
      .map((d: { fileName: string; extractedText: string | null }) => `## ${d.fileName}\n${d.extractedText ?? ''}`)
      .join('\n\n---\n\n');

    await prisma.job.update({ where: { id: jobId }, data: { context: combinedContext } });

    logger.info('Document analysis complete', { documentId });
  } catch (err) {
    logger.error('Document analysis failed', { documentId, error: String(err) });
    await prisma.jobDocument.update({ where: { id: documentId }, data: { status: DocStatus.FAILED } });
    throw err;
  }
}

export function startDocumentAnalysisWorker() {
  const worker = new Worker(QUEUE_NAMES.DOCUMENT_ANALYSIS, processDocumentAnalysis, { connection });
  worker.on('completed', (job) => logger.info('Document job completed', { jobId: job.id }));
  worker.on('failed', (job, err) => logger.error('Document job failed', { jobId: job?.id, error: String(err) }));
  worker.on('error', (err) => logger.error('Document worker error', { error: String(err) }));
  return worker;
}
