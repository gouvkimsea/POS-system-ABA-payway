import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from './auth.js';

export function requireRoles(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
    }

    if (req.user.role === Role.SUPER_ADMIN || req.user.role === Role.ADMIN) {
      return next(); // Admins have master access
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient role permissions for this resource' },
      });
    }

    return next();
  };
}

export function requirePermissions(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
      });
    }

    if (req.user.role === Role.SUPER_ADMIN || req.user.role === Role.ADMIN || req.user.permissions.includes('*')) {
      return next();
    }

    const hasAll = requiredPermissions.every((perm) => req.user!.permissions.includes(perm));
    if (!hasAll) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Required permission missing' },
      });
    }

    return next();
  };
}
