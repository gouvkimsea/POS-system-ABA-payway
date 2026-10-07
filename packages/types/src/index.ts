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

// ------------------------------------------------------------------------------
// AUTHENTICATION & AUTHORIZATION (RBAC) CONTRACTS
// ------------------------------------------------------------------------------

export const PERMISSIONS = {
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  SALES_CREATE: 'sales.create',
  SALES_REFUND: 'sales.refund',
  SALES_VOID: 'sales.void',
  REPORTS_VIEW: 'reports.view',
  USERS_MANAGE: 'users.manage',
  SETTINGS_MANAGE: 'settings.manage',
  REGISTER_OPEN: 'register.open',
  REGISTER_CLOSE: 'register.close',
  CASH_MANAGE: 'cash.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

export type RoleCode = 'ADMIN' | 'MANAGER' | 'CASHIER' | string;

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  businessId: string;
  storeId?: string | null;
  roles: RoleCode[];
  permissions: PermissionCode[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface LoginResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface TokenPayload {
  userId: string;
  username: string;
  businessId: string;
  storeId?: string | null;
  roles: RoleCode[];
  permissions: PermissionCode[];
}
