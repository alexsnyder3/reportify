// Photo analysis via OpenAI GPT-4o-mini vision
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError('OpenAI API key not configured', 500);

  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'low' },
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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error('OpenAI vision API error', { status: response.status, text });
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
