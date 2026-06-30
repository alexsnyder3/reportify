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

export interface SafetyReportContent {
  // Header
  jobName: string;
  jobAddress: string;
  projectNumber: string;
  submittedBy: string;
  date: string;
  weather: string;
  temperature: string;
  labourersOnSite: string;
  supervisorsOnSite: string;
  // 15 COR-style inspection questions
  firePreventionControl: string;     // Q1
  electricalInstallations: string;   // Q2
  guardsOnToolsEquipment: string;    // Q3
  laddersWalkwaysRamps: string;      // Q4
  scaffoldsWorkPlatforms: string;    // Q5
  ppeAdequate: string;               // Q6
  cranesHoists: string;              // Q7
  heavyEquipment: string;            // Q8
  motorVehicles: string;             // Q9
  barricadesHandrails: string;       // Q10
  materialsHandlingStorage: string;  // Q11
  excavationsShoringSloping: string; // Q12
  flammableStorage: string;          // Q13
  weldingCutting: string;            // Q14
  steelErection: string;             // Q15
  // Raw
  transcript: string;
}

function buildSafetyReportPrompt(params: {
  transcript: string;
  jobName: string;
  jobAddress: string;
  projectNumber: string;
  supervisorName: string;
  date: string;
  weather: string;
  temperature: string;
}): string {
  return `You are a construction site safety inspector for Snyder Construction. Extract information from the supervisor's voice transcript to fill out a monthly Job Operations and Conditions Safety Report (COR-style inspection checklist).

Job Name: ${params.jobName}
Job Address: ${params.jobAddress}
Project Number: ${params.projectNumber}
Supervisor: ${params.supervisorName}
Date: ${params.date}
Weather: ${params.weather}
Temperature: ${params.temperature}

Transcript:
"${params.transcript}"

For each of the 15 safety checklist items below, answer based ONLY on what is mentioned in the transcript:
- Default to "Yes" (adequate/passing) if the topic is not mentioned and there is no indication of a problem.
- Answer "No" only if the transcript explicitly describes a deficiency, hazard, or problem with that item.
- Answer "N/A" if the item clearly does not apply to this site (e.g. no cranes/hoists or heavy equipment in use, no welding, no excavation work).
- If the transcript mentions a Yes/No answer, append a brief detail in parentheses.

Respond in JSON format:
{
  "firePreventionControl": "Yes/No/N/A",
  "electricalInstallations": "Yes/No/N/A",
  "guardsOnToolsEquipment": "Yes/No/N/A",
  "laddersWalkwaysRamps": "Yes/No/N/A",
  "scaffoldsWorkPlatforms": "Yes/No/N/A",
  "ppeAdequate": "Yes/No/N/A",
  "cranesHoists": "Yes/No/N/A",
  "heavyEquipment": "Yes/No/N/A",
  "motorVehicles": "Yes/No/N/A",
  "barricadesHandrails": "Yes/No/N/A",
  "materialsHandlingStorage": "Yes/No/N/A",
  "excavationsShoringSloping": "Yes/No/N/A",
  "flammableStorage": "Yes/No/N/A",
  "weldingCutting": "Yes/No/N/A",
  "steelErection": "Yes/No/N/A"
}

Use professional construction safety language. Do not invent information not in the transcript.`;
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

async function callDeepSeekJSON(prompt: string): Promise<Record<string, string>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AppError('DeepSeek API key not configured', 500);

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;

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

  try {
    return JSON.parse(rawText);
  } catch {
    logger.error('Failed to parse DeepSeek response', { rawText });
    throw new AppError('Failed to parse report from AI', 502);
  }
}

export async function generateSafetyReport(params: {
  transcript: string;
  projectName: string;
  supervisorName: string;
  date: string;
  jobAddress?: string;
  projectNumber?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ content: SafetyReportContent; rawMarkdown: string }> {
  let weather = 'N/A';
  let temperature = 'N/A';
  if (params.latitude && params.longitude) {
    const w = await fetchWeather(params.latitude, params.longitude);
    weather = w.condition;
    temperature = w.tempC;
  }

  const prompt = buildSafetyReportPrompt({
    transcript: params.transcript,
    jobName: params.projectName,
    jobAddress: params.jobAddress || 'N/A',
    projectNumber: params.projectNumber || 'N/A',
    supervisorName: params.supervisorName,
    date: params.date,
    weather,
    temperature,
  });

  const extracted = await callDeepSeekJSON(prompt);

  const content: SafetyReportContent = {
    jobName: params.projectName,
    jobAddress: params.jobAddress || 'N/A',
    projectNumber: params.projectNumber || 'N/A',
    submittedBy: params.supervisorName,
    date: params.date,
    weather,
    temperature,
    labourersOnSite: 'N/A',
    supervisorsOnSite: params.supervisorName,
    firePreventionControl: extracted.firePreventionControl || 'Yes',
    electricalInstallations: extracted.electricalInstallations || 'Yes',
    guardsOnToolsEquipment: extracted.guardsOnToolsEquipment || 'Yes',
    laddersWalkwaysRamps: extracted.laddersWalkwaysRamps || 'Yes',
    scaffoldsWorkPlatforms: extracted.scaffoldsWorkPlatforms || 'Yes',
    ppeAdequate: extracted.ppeAdequate || 'Yes',
    cranesHoists: extracted.cranesHoists || 'N/A',
    heavyEquipment: extracted.heavyEquipment || 'N/A',
    motorVehicles: extracted.motorVehicles || 'Yes',
    barricadesHandrails: extracted.barricadesHandrails || 'Yes',
    materialsHandlingStorage: extracted.materialsHandlingStorage || 'Yes',
    excavationsShoringSloping: extracted.excavationsShoringSloping || 'Yes',
    flammableStorage: extracted.flammableStorage || 'Yes',
    weldingCutting: extracted.weldingCutting || 'Yes',
    steelErection: extracted.steelErection || 'Yes',
    transcript: params.transcript,
  };

  const rawMarkdown = buildSafetyMarkdown(content);
  return { content, rawMarkdown };
}

function buildSafetyMarkdown(r: SafetyReportContent): string {
  return `# Snyder Construction — Inspection Report
**Subject:** B Job Operations and Conditions MONTHLY/SAFETY REP

**Job Name:** ${r.jobName}
**Job Address:** ${r.jobAddress}
**Project Number:** ${r.projectNumber}
**Submitted By:** ${r.submittedBy}
**Date:** ${r.date}

**Weather:** ${r.weather}
**Temperature:** ${r.temperature}
**Labourers on Site:** ${r.labourersOnSite}
**Supervisors on Site:** ${r.supervisorsOnSite}

---

## Question 1 — Fire Prevention and Control Adequate?
${r.firePreventionControl}

## Question 2 — Electrical Installations Adequate?
${r.electricalInstallations}

## Question 3 — Guards on Tools and Equipment Adequate?
${r.guardsOnToolsEquipment}

## Question 4 — Ladders, Walkways, and Ramps Adequate?
${r.laddersWalkwaysRamps}

## Question 5 — Scaffolds, Work Platforms Adequate?
${r.scaffoldsWorkPlatforms}

## Question 6 — PPE Adequate?
${r.ppeAdequate}

## Question 7 — Cranes/Hoists - Inspection and Maintenance Adequate?
${r.cranesHoists}

## Question 8 — Heavy Equipment - Operation and Control Adequate?
${r.heavyEquipment}

## Question 9 — Motor Vehicles - Parking and Control Adequate?
${r.motorVehicles}

## Question 10 — Barricades/Handrails Adequate?
${r.barricadesHandrails}

## Question 11 — Materials Handling/Storage Adequate?
${r.materialsHandlingStorage}

## Question 12 — Excavations, Shoring, and Sloping Adequate?
${r.excavationsShoringSloping}

## Question 13 — Storage of Flammable/Combustible Liquids/Chemicals Adequate?
${r.flammableStorage}

## Question 14 — Welding/Cutting Operations Adequate?
${r.weldingCutting}

## Question 15 — Steel Erection Adequate?
${r.steelErection}

---
## Original Transcript
${r.transcript}
`;
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

  const extracted = await callDeepSeekJSON(prompt) as Partial<SupervisorReportContent>;

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
