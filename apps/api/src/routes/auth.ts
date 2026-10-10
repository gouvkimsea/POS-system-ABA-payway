import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth/service.js';
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.js';
import {
  loginInputSchema,
  pinLoginInputSchema,
  refreshTokenInputSchema,
  forgotPasswordInputSchema,
  resetPasswordInputSchema,
} from '@pos/validation';
import { PERMISSIONS } from '@pos/types';

export const authRouter: Router = Router();

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * POST /api/auth/login
 * Standard Username/Email & Password Authentication
 */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid input',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'];
    const result = await AuthService.login(
      parsed.data.username,
      parsed.data.password,
      ip,
      userAgent,
    );

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/auth/pin-login
 * Fast Touch POS PIN Login
 */
authRouter.post('/pin-login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = pinLoginInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid input',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'];
    const result = await AuthService.pinLogin(parsed.data.username, parsed.data.pin, ip, userAgent);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh Expired Access Token
 */
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = refreshTokenInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid refresh token is required' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const ip = getClientIp(req);
    const tokens = await AuthService.refresh(parsed.data.refreshToken, ip);

    res.status(200).json({
      success: true,
      data: tokens,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Revoke Active Session
 */
authRouter.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.body?.refreshToken;
    const ip = getClientIp(req);
    await AuthService.logout(refreshToken, req.user?.userId, ip);

    res.status(200).json({
      success: true,
      data: { message: 'Successfully logged out and session revoked' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Protected Route Returning Authenticated User Profile
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/auth/forgot-password
 * Initiate Password Reset Request
 */
authRouter.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = forgotPasswordInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid input',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const ip = getClientIp(req);
    const result = await AuthService.requestPasswordReset(parsed.data.emailOrUsername, ip);

    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/reset-password
 * Complete Password Reset with Secure Token
 */
authRouter.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resetPasswordInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Invalid input',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const ip = getClientIp(req);
    await AuthService.resetPassword(parsed.data.token, parsed.data.newPassword, ip);

    res.status(200).json({
      success: true,
      data: {
        message: 'Password has been successfully updated. Please log in with your new password.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(error);
  }
});

// ------------------------------------------------------------------------------
// TEST ROUTES DEMONSTRATING PERMISSION & ROLE GUARDS
// ------------------------------------------------------------------------------

/**
 * GET /api/auth/test/protected
 * Requires any valid authenticated session
 */
authRouter.get('/test/protected', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    message: `Hello ${req.user?.username}! You have authenticated access.`,
    user: req.user,
  });
});

/**
 * GET /api/auth/test/admin-only
 * Requires 'users.manage' granular permission
 */
authRouter.get(
  '/test/admin-only',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: `Access GRANTED to user management! Authenticated as ${req.user?.username}.`,
    });
  },
);

/**
 * GET /api/auth/test/sales-only
 * Requires 'sales.create' granular permission
 */
authRouter.get(
  '/test/sales-only',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_CREATE),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: `Access GRANTED to POS sales checkout! Cashier/Operator: ${req.user?.username}.`,
    });
  },
);

/**
 * GET /api/auth/test/inventory-only
 * Requires 'inventory.adjust' granular permission
 */
authRouter.get(
  '/test/inventory-only',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: `Access GRANTED to inventory adjustments! Manager: ${req.user?.username}.`,
    });
  },
);

/**
 * GET /api/auth/test/role-admin-only
 * Requires 'ADMIN' role directly
 */
authRouter.get(
  '/test/role-admin-only',
  requireAuth,
  requireRole('ADMIN'),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: `Access GRANTED to ADMIN role only! Authenticated as ${req.user?.username}.`,
    });
  },
);
