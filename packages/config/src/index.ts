import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables if running in Node
if (typeof process !== 'undefined' && process.env) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PORT: z.coerce.number().default(4000),
  WEB_PORT: z.coerce.number().default(3000),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/pos_db?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  LOG_LEVEL: z.string().default('info'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Phnom_Penh'),
  DEFAULT_CURRENCY: z.string().default('USD'),
  DEFAULT_EXCHANGE_RATE_KHR: z.coerce.number().default(4100),
  SUPPORTED_CURRENCIES: z.string().default('USD,KHR'),
  DEFAULT_LOCALE: z.string().default('en'),
  SUPPORTED_LOCALES: z.string().default('en,km'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Environment validation errors:', parsed.error.format());
    // Fall back to defaults rather than crashing in tests or dev
    cachedConfig = envSchema.parse({});
  } else {
    cachedConfig = parsed.data;
  }
  return cachedConfig;
}

export const CONSTANTS = {
  CURRENCIES: {
    USD: { code: 'USD', symbol: '$', decimals: 2 },
    KHR: { code: 'KHR', symbol: '៛', decimals: 0 },
  },
  DEFAULT_EXCHANGE_RATE_KHR: 4100,
  DEFAULT_TIMEZONE: 'Asia/Phnom_Penh',
  APP_VERSION: '1.0.0',
};
