import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { AppError } from '@/middlewares/errorHandler';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export function isGeminiConfigured() {
  return Boolean(env.GEMINI_API_KEY);
}

interface GenerateOptions {
  systemInstruction?: string;
  jsonSchema?: object;
  temperature?: number;
}

// Thin wrapper around the Gemini REST API (generateContent). Kept as a plain fetch
// call instead of the @google/generative-ai SDK so there's no SDK-version drift to
// track — the REST surface is stable and this is the only call site.
export async function generateWithGemini(prompt: string, options: GenerateOptions = {}): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      'AI features are not configured. An administrator must set GEMINI_API_KEY.',
      503
    );
  }

  const url = `${GEMINI_BASE_URL}/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.7,
  };
  if (options.jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.jsonSchema;
  }

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig,
  };
  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Without a limit a stalled request would keep the member's screen spinning forever.
      signal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    logger.error('Gemini API request did not complete', { timedOut, err: err instanceof Error ? err.message : err });
    throw new AppError(timedOut ? 'The AI coach is taking too long to answer. Please try again in a moment.' : 'Could not reach the AI service', timedOut ? 504 : 502);
  }

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Gemini API request failed', { status: res.status, errText });
    if (res.status === 429) {
      throw new AppError('AI service is rate-limited right now. Please try again shortly.', 429);
    }
    throw new AppError('AI service request failed', 502, errText);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw new AppError(`AI declined to respond: ${data.promptFeedback.blockReason}`, 422);
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) {
    throw new AppError('AI service returned an empty response', 502);
  }
  return text;
}

export function parseJsonResponse<T>(raw: string): T {
  // Gemini sometimes wraps JSON in markdown code fences even with responseMimeType set.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.error('Failed to parse AI JSON response', { raw: cleaned });
    throw new AppError('AI returned an unexpected response format', 502);
  }
}
