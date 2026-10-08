import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/token.js';
import { TokenPayload, PermissionCode, RoleCode } from '@pos/types';

// Extend Express Request interface to include authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication Middleware
 * Validates JWT bearer token from Authorization header
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing. Please provide a valid Bearer token.',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_EXPIRED_OR_INVALID',
        message: 'Your session has expired or the token is invalid. Please log in again.',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.user = payload;
  next();
}

/**
 * Role-Based Authorization Guard
 */
export function requireRole(...allowedRoles: RoleCode[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`,
          details: { userRoles: req.user.roles },
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Granular Permission-Based Authorization Guard
 */
export function requirePermission(...requiredPermissions: PermissionCode[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check if user has ALL required permissions (or if user has ADMIN role)
    const isAdmin = req.user.roles.includes('ADMIN');
    const hasAllPermissions =
      isAdmin || requiredPermissions.every((p) => req.user?.permissions.includes(p));

    if (!hasAllPermissions) {
      const missing = requiredPermissions.filter((p) => !req.user?.permissions.includes(p));
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Missing required permission(s): [${missing.join(', ')}]`,
          details: { missingPermissions: missing, userPermissions: req.user.permissions },
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Check if the user is authorized for a specific store.
 * Administrators and business-wide users (authorizedStoreIds === null) have access to ALL stores.
 * Branch-scoped users can only access stores in their authorizedStoreIds list.
 */
export function isUserAuthorizedForStore(user: TokenPayload, storeId?: string | null): boolean {
  if (!storeId) return true;
  if (user.roles.includes('ADMIN')) return true;
  if (user.authorizedStoreIds === null || user.authorizedStoreIds === undefined) return true;
  return user.authorizedStoreIds.includes(storeId);
}

/**
 * Middleware: require store authorization
 * Extracts storeId from req.params.storeId, req.query.storeId, or req.body.storeId
 */
export function requireStoreAccess(storeIdExtractor?: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const storeId = storeIdExtractor
      ? storeIdExtractor(req)
      : ((req.params.storeId || req.query.storeId || req.body.storeId) as string | undefined);

    if (storeId && !isUserAuthorizedForStore(req.user, storeId)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_STORE_ACCESS',
          message: `Access denied. You are not authorized to access store ${storeId}.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
