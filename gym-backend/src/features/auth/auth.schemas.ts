import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1).optional(),
  }),
});

// `identifier` is an email or mobile number; `email` is still accepted from older clients.
export const loginSchema = z.object({
  body: z
    .object({
      identifier: z.string().trim().min(1).max(254).optional(),
      email: z.string().trim().max(254).optional(),
      password: z.string().min(1),
    })
    .refine((b) => Boolean(b.identifier || b.email), { path: ['identifier'], message: 'Enter your email or mobile number' }),
});

export const otpLoginSendSchema = z.object({ body: z.object({ identifier: z.string().trim().min(1, 'Enter your email or mobile number').max(254) }) });
export const otpLoginVerifySchema = z.object({
  body: z.object({ identifier: z.string().trim().min(1).max(254), code: z.string().trim().length(6, 'Enter the 6-digit code') }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().length(6),
  }),
});

export const emailOnlySchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().length(6),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
});

export const googleLoginSchema = z.object({
  body: z.object({
    idToken: z.string().min(1),
  }),
});

const phone = z.string().trim().min(6, 'Enter your mobile number').max(20);
const mode = z.enum(['login', 'signup']);

export const phoneSendOtpSchema = z.object({
  body: z
    .object({
      phone,
      mode,
      name: z.string().trim().min(1, 'Name is required').max(80).optional(),
      password: z.string().min(8, 'Password must be at least 8 characters').max(128).optional(),
    })
    .refine((b) => b.mode === 'login' || Boolean(b.name), { path: ['name'], message: 'Name is required' })
    .refine((b) => b.mode === 'login' || Boolean(b.password), { path: ['password'], message: 'Choose a password' }),
});

export const phoneVerifySchema = z.object({
  body: z.object({ phone, mode, code: z.string().trim().length(6, 'Enter the 6-digit code') }),
});
