/**
 * Shared Type Definitions for Enterprise POS System
 */

export type CurrencyCode = 'USD' | 'KHR' | string;
export type LocaleCode = 'en' | 'km';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  decimals: number;
  rateToUSD: number;
}

export type DatabaseStatus = 'connected' | 'disconnected' | 'error';
export type RedisStatus = 'connected' | 'in-memory-fallback' | 'disconnected';

export interface SystemHealthCheck {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  services: {
    database: {
      status: DatabaseStatus;
      latencyMs?: number;
      error?: string;
    };
    redis: {
      status: RedisStatus;
      latencyMs?: number;
      error?: string;
    };
  };
  version: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface BusinessSummary {
  id: string;
  name: string;
  code: string;
  defaultCurrency: CurrencyCode;
  timezone: string;
}

export interface StoreSummary {
  id: string;
  businessId: string;
  name: string;
  code: string;
}

export interface SystemSettings {
  defaultCurrency: CurrencyCode;
  exchangeRateKHR: number;
  timezone: string;
  supportedCurrencies: CurrencyCode[];
  supportedLocales: LocaleCode[];
}
