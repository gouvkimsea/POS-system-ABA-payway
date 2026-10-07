import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

export const pinLoginSchema = z.object({
  storeId: z.string().uuid('Valid store ID is required'),
  pinCode: z.string().min(4, 'PIN must be at least 4 digits').max(6, 'PIN maximum 6 digits'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PinLoginInput = z.infer<typeof pinLoginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
