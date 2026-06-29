import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';

export interface ReportContent {
  projectName: string;
  date: string;
  supervisor: string;
  weather?: string;
  summaryOfWork: string;
  labour: string[];
  subcontractors: string[];
  equipment: string[];
  materialsDelivered: string[];
  delays: string[];
  safetyObservations: string[];
  qualityIssues: string[];
  deficiencies: string[];
  photosReferenced: string[];
  actionItems: string[];
  tomorrowsWork: string;
  possibleChangeOrderItems: string[];
  transcript: string;
}

function buildReportPrompt(params: {
  transcript: string;
  projectName: string;
  supervisorName: string;
  date: string;
  photoDescriptions: string[];
}): string {
  const photoSection = params.photoDescriptions.length
    ? `\nPhotos taken at this site:\n${params.photoDescriptions.map((d, i) => `Photo ${i + 1}: ${d}`).join('\n')}`
    : '';

  return `You are a professional construction report writer. Based on the following voice transcript from a construction supervisor, generate a structured General Construction Field Report.

Project: ${params.projectName}
Date: ${params.date}
Supervisor: ${params.supervisorName}
${photoSection}

Transcript:
"${params.transcript}"

Respond in JSON format matching this exact structure:
{
  "projectName": "${params.projectName}",
  "date": "${params.date}",
  "supervisor": "${params.supervisorName}",
  "weather": "weather conditions if mentioned, otherwise null",
  "summaryOfWork": "professional paragraph summarizing all work performed",
  "labour": ["trade or crew type mentioned", ...],
  "subcontractors": ["subcontractor names or trades mentioned", ...],
  "equipment": ["equipment mentioned", ...],
  "materialsDelivered": ["materials delivered or used", ...],
  "delays": ["any delays or issues mentioned", ...],
  "safetyObservations": ["safety items mentioned", ...],
  "qualityIssues": ["quality concerns mentioned", ...],
  "deficiencies": ["deficiencies mentioned", ...],
  "photosReferenced": ["brief description of what each photo shows", ...],
  "actionItems": ["action items or follow-ups required", ...],
  "tomorrowsWork": "summary of planned work for next day if mentioned",
  "possibleChangeOrderItems": ["items that may constitute a change order", ...]
}

Use professional construction industry language. If information is not mentioned in the transcript, use empty arrays or null values. Do not invent information not present in the transcript.`;
}

export async function generateFieldReport(params: {
  transcript: string;
  projectName: string;
  supervisorName: string;
  date: string;
  photoDescriptions?: string[];
}): Promise<{ content: ReportContent; rawMarkdown: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AppError('DeepSeek API key not configured', 500);

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;

  const prompt = buildReportPrompt({
    ...params,
    photoDescriptions: params.photoDescriptions || [],
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error('DeepSeek API error', { status: response.status, text });
    throw new AppError(`DeepSeek report generation failed: ${response.statusText}`, 502);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawText = data.choices?.[0]?.message?.content ?? '{}';

  let content: ReportContent;
  try {
    content = JSON.parse(rawText) as ReportContent;
    content.transcript = params.transcript;
  } catch {
    logger.error('Failed to parse DeepSeek response', { rawText });
    throw new AppError('Failed to parse report from AI', 502);
  }

  // Build a readable markdown version
  const rawMarkdown = buildMarkdown(content);

  return { content, rawMarkdown };
}

function buildMarkdown(r: ReportContent): string {
  const section = (title: string, items: string[]) =>
    items.length ? `\n## ${title}\n${items.map((i) => `- ${i}`).join('\n')}` : '';

  return `# General Construction Field Report

**Project:** ${r.projectName}
**Date:** ${r.date}
**Supervisor:** ${r.supervisor}
${r.weather ? `**Weather:** ${r.weather}` : ''}

## Summary of Work
${r.summaryOfWork}
${section('Labour', r.labour)}
${section('Subcontractors', r.subcontractors)}
${section('Equipment', r.equipment)}
${section('Materials Delivered', r.materialsDelivered)}
${section('Delays', r.delays)}
${section('Safety Observations', r.safetyObservations)}
${section('Quality Issues', r.qualityIssues)}
${section('Deficiencies', r.deficiencies)}
${section('Photos Referenced', r.photosReferenced)}
${section('Action Items', r.actionItems)}

## Tomorrow's Planned Work
${r.tomorrowsWork || 'Not specified'}
${section('Possible Change Order Items', r.possibleChangeOrderItems)}

---
## Original Transcript
${r.transcript}
`;
}
