import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('4000').transform((val) => parseInt(val, 10)),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  REFRESH_TOKEN_SECRET: z.string().default('refresh_super_secret_pos_token_key_32_chars!'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Phnom_Penh'),
  DEFAULT_CURRENCY: z.string().default('USD'),
  DEFAULT_EXCHANGE_RATE_KHR: z.string().default('4100.00').transform((val) => parseFloat(val)),
  DEFAULT_TAX_RATE: z.string().default('0.10').transform((val) => parseFloat(val)),
});

export const env = envSchema.parse(process.env);
