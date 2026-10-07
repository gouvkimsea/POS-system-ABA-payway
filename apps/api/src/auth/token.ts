import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { TokenPayload, AuthTokens } from '@pos/types';

const JWT_SECRET =
  process.env.JWT_SECRET || 'dev_pos_jwt_secret_key_minimum_32_characters_long_12345';
const REFRESH_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'dev_pos_refresh_secret_key_minimum_32_characters_long_12345';

const ACCESS_TOKEN_EXPIRY = '1d';
const REFRESH_TOKEN_EXPIRY = '7d';
const EXPIRES_IN_SECONDS = 86400; // 1 day

export function generateTokens(payload: TokenPayload): AuthTokens {
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, jti: crypto.randomUUID() },
    REFRESH_SECRET,
    {
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
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: string; jti: string } | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as { userId: string; jti: string };
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
