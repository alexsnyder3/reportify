import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';

export interface SupervisorReportContent {
  // Header
  jobName: string;
  jobAddress: string;
  projectNumber: string;
  submittedBy: string;
  date: string;
  weather: string;
  temperature: string;
  labourersOnSite: string;
  equipmentOnSite: string;
  supervisorsOnSite: string;
  // Questions
  inspectionsToday: string;       // Q1
  generalNotes: string;           // Q5
  delaysDueToPoorConditions: string; // Q7 Yes/No + details
  workerIllnessSymptoms: string;  // Q8 Yes/No
  toolboxTalk: string;            // Q10
  subtradesOnsite: string;        // Q11
  healthSafetyHazards: string;    // Q12
  // Raw
  transcript: string;
}

function buildSupervisorReportPrompt(params: {
  transcript: string;
  jobName: string;
  jobAddress: string;
  projectNumber: string;
  supervisorName: string;
  date: string;
  weather: string;
  temperature: string;
  photoDescriptions: string[];
}): string {
  const photoSection = params.photoDescriptions.length
    ? `\nPhotos taken at this site:\n${params.photoDescriptions.map((d, i) => `Photo ${i + 1}: ${d}`).join('\n')}`
    : '';

  return `You are a construction site report writer for Snyder Construction. Extract information from the supervisor's voice transcript to fill out a daily Supervisor's Report.

Job Name: ${params.jobName}
Job Address: ${params.jobAddress}
Project Number: ${params.projectNumber}
Supervisor: ${params.supervisorName}
Date: ${params.date}
Weather: ${params.weather}
Temperature: ${params.temperature}
${photoSection}

Transcript:
"${params.transcript}"

Fill in the following report fields based ONLY on what is mentioned in the transcript. Use "N/A" for anything not mentioned. For yes/no questions, answer "Yes" or "No" followed by any relevant details from the transcript.

Respond in JSON format:
{
  "inspectionsToday": "List any inspections mentioned, or 'None'",
  "generalNotes": "Summary of work performed today based on the transcript",
  "delaysDueToPoorConditions": "Yes or No, with details if mentioned",
  "workerIllnessSymptoms": "Yes or No",
  "toolboxTalk": "Description of toolbox talk if mentioned, or 'N/A'",
  "subtradesOnsite": "Subtrades mentioned, or 'N/A'",
  "healthSafetyHazards": "Safety hazards mentioned, or 'N/A'"
}

Use professional construction language. Do not invent information not in the transcript.`;
}

async function fetchWeather(latitude: number, longitude: number): Promise<{ condition: string; tempC: string }> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return { condition: 'N/A', tempC: 'N/A' };
    const data = (await res.json()) as {
      current?: { temperature_2m?: number; weathercode?: number };
    };
    const temp = data.current?.temperature_2m;
    const code = data.current?.weathercode ?? -1;
    const condition = weatherCodeToDescription(code);
    return {
      condition,
      tempC: temp != null ? `${Math.round(temp)}°C` : 'N/A',
    };
  } catch {
    return { condition: 'N/A', tempC: 'N/A' };
  }
}

function weatherCodeToDescription(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 9) return 'Foggy';
  if (code <= 19) return 'Drizzle';
  if (code <= 29) return 'Rain';
  if (code <= 39) return 'Snow';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 84) return 'Rain Showers';
  if (code <= 94) return 'Thunderstorm';
  return 'Stormy';
}

export async function generateFieldReport(params: {
  transcript: string;
  projectName: string;
  supervisorName: string;
  date: string;
  photoDescriptions?: string[];
  jobAddress?: string;
  projectNumber?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ content: SupervisorReportContent; rawMarkdown: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AppError('DeepSeek API key not configured', 500);

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;

  // Fetch weather if coordinates available
  let weather = 'N/A';
  let temperature = 'N/A';
  if (params.latitude && params.longitude) {
    const w = await fetchWeather(params.latitude, params.longitude);
    weather = w.condition;
    temperature = w.tempC;
  }

  const prompt = buildSupervisorReportPrompt({
    transcript: params.transcript,
    jobName: params.projectName,
    jobAddress: params.jobAddress || 'N/A',
    projectNumber: params.projectNumber || 'N/A',
    supervisorName: params.supervisorName,
    date: params.date,
    weather,
    temperature,
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
      temperature: 0.2,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error('DeepSeek API error', { body: text, status: response.status });
    throw new AppError(`DeepSeek report generation failed: Payment required or quota exceeded`, 502);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawText = data.choices?.[0]?.message?.content ?? '{}';

  let extracted: Partial<SupervisorReportContent>;
  try {
    extracted = JSON.parse(rawText);
  } catch {
    logger.error('Failed to parse DeepSeek response', { rawText });
    throw new AppError('Failed to parse report from AI', 502);
  }

  const content: SupervisorReportContent = {
    jobName: params.projectName,
    jobAddress: params.jobAddress || 'N/A',
    projectNumber: params.projectNumber || 'N/A',
    submittedBy: params.supervisorName,
    date: params.date,
    weather,
    temperature,
    labourersOnSite: 'N/A',
    equipmentOnSite: 'N/A',
    supervisorsOnSite: params.supervisorName,
    inspectionsToday: extracted.inspectionsToday || 'None',
    generalNotes: extracted.generalNotes || 'N/A',
    delaysDueToPoorConditions: extracted.delaysDueToPoorConditions || 'No',
    workerIllnessSymptoms: extracted.workerIllnessSymptoms || 'No',
    toolboxTalk: extracted.toolboxTalk || 'N/A',
    subtradesOnsite: extracted.subtradesOnsite || 'N/A',
    healthSafetyHazards: extracted.healthSafetyHazards || 'N/A',
    transcript: params.transcript,
  };

  const rawMarkdown = buildMarkdown(content);
  return { content, rawMarkdown };
}

function buildMarkdown(r: SupervisorReportContent): string {
  return `# Snyder Construction — Supervisor's Report

**Job Name:** ${r.jobName}
**Job Address:** ${r.jobAddress}
**Project Number:** ${r.projectNumber}
**Submitted By:** ${r.submittedBy}
**Date:** ${r.date}

**Weather:** ${r.weather}
**Temperature:** ${r.temperature}
**Labourers on Site:** ${r.labourersOnSite}
**Equipment on Site:** ${r.equipmentOnSite}
**Supervisors on Site:** ${r.supervisorsOnSite}

---

## Question 1 — Inspections Today
${r.inspectionsToday}

## Question 5 — General Notes
${r.generalNotes}

## Question 7 — Delays Due to Poor Site Conditions?
${r.delaysDueToPoorConditions}

## Question 8 — Worker Illness Symptoms?
${r.workerIllnessSymptoms}

## Question 10 — Toolbox Talk
${r.toolboxTalk}

## Question 11 — Subtrades Onsite
${r.subtradesOnsite}

## Question 12 — Health & Safety Specific Hazards Today
${r.healthSafetyHazards}

---
## Original Transcript
${r.transcript}
`;
}
