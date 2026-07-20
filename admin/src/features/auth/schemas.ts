import { z } from 'zod';

/** Mirrors backend AdminLoginDto (email ≤254, password 1–128). */
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').max(254),
  password: z.string().min(1, 'Password is required').max(128),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/** Mirrors backend TotpVerifyDto code rules (6-digit authenticator code). */
export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

export type TotpCodeFormValues = z.infer<typeof totpCodeSchema>;
