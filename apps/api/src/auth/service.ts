import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../db/index.js';
import { generateTokens, hashToken, verifyRefreshToken } from './token.js';
import { AuthUser, LoginResult, PermissionCode, RoleCode } from '@pos/types';
import { logger } from '../logger/index.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  /**
   * Resolve user roles and granular permissions
   */
  static async resolveUserRolesAndPermissions(userId: string): Promise<{
    roles: RoleCode[];
    permissions: PermissionCode[];
    storeId: string | null;
    authorizedStoreIds: string[] | null;
  }> {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const rolesSet = new Set<string>();
    const permissionsSet = new Set<string>();
    const storeIdsSet = new Set<string>();
    let hasBusinessWideAccess = false;
    let storeId: string | null = null;

    for (const ur of userRoles) {
      rolesSet.add(ur.role.name);
      if (ur.role.name === 'ADMIN' || ur.storeId === null) {
        hasBusinessWideAccess = true;
      }
      if (ur.storeId) {
        storeIdsSet.add(ur.storeId);
        if (!storeId) storeId = ur.storeId;
      }
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(rp.permission.code);
      }
    }

    const authorizedStoreIds = hasBusinessWideAccess ? null : Array.from(storeIdsSet);

    return {
      roles: Array.from(rolesSet),
      permissions: Array.from(permissionsSet),
      storeId,
      authorizedStoreIds,
    };
  }

  /**
   * Password Login
   */
  static async login(
    identifier: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier.toLowerCase() }, { email: identifier.toLowerCase() }],
        deletedAt: null,
      },
    });

    if (!user) {
      await prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entityType: 'User',
          details: { reason: 'User not found', identifier },
          ipAddress,
        },
      });
      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      };
    }

    // Account status check: Inactive
    if (!user.isActive) {
      await prisma.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: 'LOGIN_REJECTED',
          entityType: 'User',
          details: { reason: 'Account disabled' },
          ipAddress,
        },
      });
      throw {
        statusCode: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'Your account has been deactivated. Please contact your manager.',
      };
    }

    // Account status check: Locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      await prisma.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: 'LOGIN_REJECTED',
          entityType: 'User',
          details: { reason: 'Account locked', remainingMinutes },
          ipAddress,
        },
      });
      throw {
        statusCode: 423,
        code: 'ACCOUNT_LOCKED',
        message: `Account is temporarily locked due to repeated failed login attempts. Please try again in ${remainingMinutes} minute(s).`,
      };
    }

    // Password verification
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const willLock = attempts >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = willLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil,
        },
      });

      await prisma.auditLog.create({
        data: {
          businessId: user.businessId,
          userId: user.id,
          action: willLock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
          entityType: 'User',
          details: { failedAttempts: attempts, locked: willLock },
          ipAddress,
        },
      });

      if (willLock) {
        throw {
          statusCode: 423,
          code: 'ACCOUNT_LOCKED',
          message:
            'Account locked due to 5 consecutive failed login attempts. Please try again in 15 minutes.',
        };
      }

      throw {
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: `Invalid username or password. Remaining attempts before lockout: ${MAX_FAILED_ATTEMPTS - attempts}`,
      };
    }

    // Successful login: reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const { roles, permissions, storeId, authorizedStoreIds } =
      await this.resolveUserRolesAndPermissions(user.id);

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      businessId: user.businessId,
      storeId,
      authorizedStoreIds,
      roles,
      permissions,
    };

    const tokens = generateTokens({
      userId: user.id,
      username: user.username,
      businessId: user.businessId,
      storeId,
      authorizedStoreIds,
      roles,
      permissions,
    });

    // Create session in database
    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(tokens.refreshToken),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId: user.businessId,
        storeId,
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entityType: 'User',
        details: { method: 'PASSWORD', roles },
        ipAddress,
      },
    });

    return { user: authUser, tokens };
  }

  /**
   * Fast Touch PIN Login for Cashiers
   */
  static async pinLogin(
    username: string,
    pin: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const user = await prisma.user.findFirst({
      where: { username: username.toLowerCase(), deletedAt: null },
    });

    if (!user || !user.pinCodeHash) {
      throw { statusCode: 401, code: 'INVALID_PIN', message: 'Invalid cashier identifier or PIN' };
    }

    if (!user.isActive) {
      throw {
        statusCode: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'Your cashier account is disabled.',
      };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw {
        statusCode: 423,
        code: 'ACCOUNT_LOCKED',
        message: 'Account is locked. Contact your manager.',
      };
    }

    const isPinValid = await bcrypt.compare(pin, user.pinCodeHash);
    if (!isPinValid) {
      const attempts = user.failedLoginAttempts + 1;
      const willLock = attempts >= MAX_FAILED_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: willLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
      throw { statusCode: 401, code: 'INVALID_PIN', message: 'Incorrect PIN code' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const { roles, permissions, storeId, authorizedStoreIds } =
      await this.resolveUserRolesAndPermissions(user.id);

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      businessId: user.businessId,
      storeId,
      authorizedStoreIds,
      roles,
      permissions,
    };

    const tokens = generateTokens({
      userId: user.id,
      username: user.username,
      businessId: user.businessId,
      storeId,
      authorizedStoreIds,
      roles,
      permissions,
    });

    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(tokens.refreshToken),
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId: user.businessId,
        storeId,
        userId: user.id,
        action: 'PIN_LOGIN_SUCCESS',
        entityType: 'User',
        details: { method: 'PIN' },
        ipAddress,
      },
    });

    return { user: authUser, tokens };
  }

  /**
   * Refresh Token
   */
  static async refresh(
    refreshToken: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; expiresInSeconds: number }> {
    const verified = verifyRefreshToken(refreshToken);
    if (!verified) {
      throw {
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is expired or invalid',
      };
    }

    const tokenHash = hashToken(refreshToken);
    const session = await prisma.userSession.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        isValid: true,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || !session.user || !session.user.isActive) {
      throw {
        statusCode: 401,
        code: 'SESSION_EXPIRED',
        message: 'Session has been revoked or expired',
      };
    }

    const { roles, permissions, storeId, authorizedStoreIds } =
      await this.resolveUserRolesAndPermissions(session.userId);

    const tokens = generateTokens({
      userId: session.user.id,
      username: session.user.username,
      businessId: session.user.businessId,
      storeId,
      authorizedStoreIds,
      roles,
      permissions,
    });

    if (ipAddress && session.ipAddress !== ipAddress) {
      await prisma.userSession.update({
        where: { id: session.id },
        data: { ipAddress },
      });
    }

    return {
      accessToken: tokens.accessToken,
      expiresInSeconds: tokens.expiresInSeconds,
    };
  }

  /**
   * Logout (Revoke Session)
   */
  static async logout(refreshToken?: string, userId?: string, ipAddress?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.userSession.updateMany({
        where: { refreshTokenHash: tokenHash },
        data: { isValid: false },
      });
    } else if (userId) {
      await prisma.userSession.updateMany({
        where: { userId },
        data: { isValid: false },
      });
    }

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await prisma.auditLog.create({
          data: {
            businessId: user.businessId,
            userId,
            action: 'LOGOUT',
            entityType: 'User',
            details: { message: 'User logged out' },
            ipAddress,
          },
        });
      }
    }
  }

  /**
   * Request Password Reset
   */
  static async requestPasswordReset(
    identifier: string,
    ipAddress?: string,
  ): Promise<{ message: string; token?: string }> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier.toLowerCase() }, { email: identifier.toLowerCase() }],
        deletedAt: null,
      },
    });

    if (!user) {
      // Return safe message without leaking user existence
      return {
        message:
          'If an account matches those details, password reset instructions have been generated.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(resetToken);

    // Invalidate existing unused tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, isUsed: false },
      data: { isUsed: true },
    });

    // Create new reset token valid for 1 hour
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId: user.businessId,
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        details: { requestedFor: identifier },
        ipAddress,
      },
    });

    logger.info(`[Auth] Password reset token created for user ${user.username}`);

    return {
      message:
        'If an account matches those details, password reset instructions have been generated.',
    };
  }

  /**
   * Complete Password Reset
   */
  static async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
  ): Promise<void> {
    const tokenHash = hashToken(token);
    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetRecord || !resetRecord.user) {
      throw {
        statusCode: 400,
        code: 'INVALID_RESET_TOKEN',
        message: 'Reset token is invalid or has expired',
      };
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atomic transaction: update password, mark token used, revoke sessions
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: newPasswordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { isUsed: true },
      }),
      prisma.userSession.updateMany({
        where: { userId: resetRecord.userId },
        data: { isValid: false },
      }),
      prisma.auditLog.create({
        data: {
          businessId: resetRecord.user.businessId,
          userId: resetRecord.userId,
          action: 'PASSWORD_RESET_COMPLETED',
          entityType: 'User',
          details: { message: 'Password updated and previous sessions revoked' },
          ipAddress,
        },
      }),
    ]);
  }
}
