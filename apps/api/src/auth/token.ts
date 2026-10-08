import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { TokenPayload, AuthTokens } from '@pos/types';

const JWT_SECRET =
  process.env.JWT_SECRET || 'dev_pos_jwt_secret_key_minimum_32_characters_long_12345';
const REFRESH_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'dev_pos_refresh_secret_key_minimum_32_characters_long_12345';

// Ensure secret security in production environments
if (process.env.NODE_ENV === 'production') {
  if (
    JWT_SECRET.includes('dev_pos') ||
    JWT_SECRET.length < 32 ||
    REFRESH_SECRET.includes('dev_pos') ||
    REFRESH_SECRET.length < 32
  ) {
    throw new Error(
      'FATAL SECURITY ERROR: JWT_SECRET and REFRESH_TOKEN_SECRET must be strong, unique secrets of at least 32 characters in production.',
    );
  }
}

const ACCESS_TOKEN_EXPIRY = '1d';
const REFRESH_TOKEN_EXPIRY = '7d';
const EXPIRES_IN_SECONDS = 86400; // 1 day

export function generateTokens(payload: TokenPayload): AuthTokens {
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, jti: crypto.randomUUID() },
    REFRESH_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: REFRESH_TOKEN_EXPIRY,
    },
  );

  return {
    accessToken,
    refreshToken,
    expiresInSeconds: EXPIRES_IN_SECONDS,
  };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: string; jti: string } | null {
  try {
    return jwt.verify(token, REFRESH_SECRET, { algorithms: ['HS256'] }) as {
      userId: string;
      jti: string;
    };
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
