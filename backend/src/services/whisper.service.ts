import FormData from 'form-data';
import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  language = 'en',
): Promise<TranscriptionResult> {
  const apiKey = process.env.WHISPER_API_KEY;
  if (!apiKey) throw new AppError('Whisper API key not configured', 500);

  const form = new FormData();
  form.append('file', audioBuffer, { filename, contentType: 'audio/mpeg' });
  form.append('model', 'whisper-1');
  form.append('language', language);
  form.append('response_format', 'verbose_json');

  const response = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error('Whisper API error', { status: response.status, body });
    throw new AppError(`Whisper transcription failed: ${response.statusText}`, 502);
  }

  const data = (await response.json()) as {
    text: string;
    language?: string;
    duration?: number;
  };

  return {
    text: data.text,
    language: data.language,
    duration: data.duration,
  };
}
