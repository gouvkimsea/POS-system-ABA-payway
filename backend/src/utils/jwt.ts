import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Role } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  username: string;
  businessId: string;
  storeId?: string | null;
  role: Role;
  permissions: string[];
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
}

export function signRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as any,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as { userId: string };
}
