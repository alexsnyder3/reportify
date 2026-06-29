// Photo analysis via DeepSeek vision (deepseek-vl2)
// Gemini is not used — DeepSeek handles both reports and photo analysis
import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';

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
- Any safety concerns or PPE compliance issues
- Quality issues or deficiencies visible
- Site conditions (weather, cleanliness, organization)

Respond in JSON format only:
{
  "description": "detailed professional description",
  "tags": ["tag1", "tag2"],
  "safetyFlags": ["concern1"]
}

safetyFlags should be an empty array if there are no concerns.`;

export async function analyzePhoto(imageBuffer: Buffer, mimeType = 'image/jpeg'): Promise<PhotoAnalysisResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new AppError('DeepSeek API key not configured', 500);

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL;
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const body = {
    model: 'deepseek-vl2',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
          {
            type: 'text',
            text: ANALYSIS_PROMPT,
          },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error('DeepSeek vision API error', { status: response.status, text });
    throw new AppError(`Photo analysis failed: ${response.statusText}`, 502);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawText = data.choices?.[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(rawText) as {
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
    logger.warn('Could not parse photo analysis JSON, using raw text', { rawText });
    return {
      description: rawText,
      tags: [],
      safetyFlags: [],
      rawResponse: data,
    };
  }
}
