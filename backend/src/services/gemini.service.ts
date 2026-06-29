import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface PhotoAnalysisResult {
  description: string;
  tags: string[];
  safetyFlags: string[];
  rawResponse?: object;
}

const ANALYSIS_PROMPT = `You are analyzing a construction site photo for a professional field report.

Describe what you see in detail, focusing on:
- Type of work being performed
- Construction materials visible
- Equipment or machinery present
- Number of workers if visible
- Progress stage of the work
- Any safety concerns or PPE compliance
- Quality issues or deficiencies visible
- Site conditions (weather, cleanliness, organization)

Respond in JSON format:
{
  "description": "detailed professional description",
  "tags": ["tag1", "tag2", ...],
  "safetyFlags": ["concern1", ...] // empty array if none
}`;

export async function analyzePhoto(imageBuffer: Buffer, mimeType = 'image/jpeg'): Promise<PhotoAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError('Gemini API key not configured', 500);

  const base64Image = imageBuffer.toString('base64');

  const body = {
    contents: [
      {
        parts: [
          { text: ANALYSIS_PROMPT },
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error('Gemini API error', { status: response.status, text });
    throw new AppError(`Gemini analysis failed: ${response.statusText}`, 502);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    // Strip markdown code fences if present
    const jsonStr = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr) as {
      description: string;
      tags: string[];
      safetyFlags: string[];
    };
    return {
      description: parsed.description || rawText,
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      safetyFlags: Array.isArray(parsed.safetyFlags) ? parsed.safetyFlags : [],
      rawResponse: data,
    };
  } catch {
    return {
      description: rawText,
      tags: [],
      safetyFlags: [],
      rawResponse: data,
    };
  }
}
