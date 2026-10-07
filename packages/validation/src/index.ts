import { z } from 'zod';

export const healthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  timestamp: z.string(),
  uptimeSeconds: z.number(),
  environment: z.string(),
  services: z.object({
    database: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
    redis: z.object({
      status: z.enum(['connected', 'in-memory-fallback', 'disconnected']),
      latencyMs: z.number().optional(),
      error: z.string().optional(),
    }),
  }),
  version: z.string(),
});

export const apiPingSchema = z.object({
  message: z.string().optional(),
});

// Authentication Schemas
export const loginInputSchema = z.object({
  username: z.string().min(1, 'Username or email is required').trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const pinLoginInputSchema = z.object({
  username: z.string().min(1, 'Username is required').trim(),
  pin: z.string().min(4, 'PIN must be at least 4 digits').max(8).trim(),
  storeId: z.string().optional(),
});

export type PinLoginInput = z.infer<typeof pinLoginInputSchema>;

export const refreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenInputSchema>;

export const forgotPasswordInputSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required').trim(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>;

export const resetPasswordInputSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters long'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
