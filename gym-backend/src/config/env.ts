import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8004),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  // Requests per IP per 15 minutes. Keep the production defaults; local
  // E2E runs log in dozens of times and may raise AUTH_RATE_LIMIT_MAX.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Gym Platform <no-reply@gym.local>'),

  GOOGLE_CLIENT_ID: z.string().optional(),

  // Google AI Studio (Gemini) API key. Optional — AI features degrade gracefully
  // with a clear "AI features not configured" error when absent, rather than crashing.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),

  // Used to build absolute URLs for locally-stored uploads. Point this at a real
  // S3/Cloudinary-backed CDN URL in production instead of switching storage backends.
  PUBLIC_URL: z.string().default('http://localhost:8004'),

  // Web Push (browser notifications). Generate with `npx web-push generate-vapid-keys`.
  // Optional — push subscribe/send endpoints return a clear "not configured" error when absent.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@gym.local'),

  // Razorpay (payment gateway). Optional — checkout falls back to an instant
  // demo-completion flow (clearly labeled) when absent, so membership purchase
  // still works end-to-end without a merchant account.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

  // Razorpay webhook signing secret (Dashboard > Webhooks > set a secret, distinct
  // from the API key secret above). Optional — without it, the webhook endpoint
  // stays disabled and payment confirmation relies solely on the client-side
  // checkout callback.
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
