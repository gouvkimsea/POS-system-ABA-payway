import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';
import { LoginInput, PinLoginInput } from './auth.schema.js';

export class AuthService {
  static async login(input: LoginInput) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: input.username },
          { email: input.username },
        ],
        isActive: true,
      },
      include: {
        business: true,
        store: true,
      },
    });

    if (!user) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' };
    }

    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Record login in audit log
    await prisma.auditLog.create({
      data: {
        businessId: user.businessId,
        storeId: user.storeId,
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user.id,
        metadata: { username: user.username, role: user.role },
      },
    });

    const accessToken = signAccessToken({
      userId: user.id,
      username: user.username,
      businessId: user.businessId,
      storeId: user.storeId,
      role: user.role,
      permissions: user.permissions,
    });

    const refreshToken = signRefreshToken({ userId: user.id });

    return {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        permissions: user.permissions,
        business: {
          id: user.business.id,
          name: user.business.name,
          defaultCurrency: user.business.defaultCurrency,
          baseExchangeRate: Number(user.business.baseExchangeRate),
          timezone: user.business.timezone,
        },
        store: user.store
          ? {
              id: user.store.id,
              name: user.store.name,
              code: user.store.code,
              address: user.store.address,
              receiptHeader: user.store.receiptHeader,
              receiptFooter: user.store.receiptFooter,
            }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }

  static async pinLogin(input: PinLoginInput) {
    // Find active cashiers/managers for the given store
    const users = await prisma.user.findMany({
      where: {
        storeId: input.storeId,
        isActive: true,
        pinCodeHash: { not: null },
      },
      include: {
        business: true,
        store: true,
      },
    });

    let matchedUser = null;
    for (const u of users) {
      if (u.pinCodeHash && (await bcrypt.compare(input.pinCode, u.pinCodeHash))) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      throw { statusCode: 401, code: 'INVALID_PIN', message: 'Invalid cashier PIN for this store terminal' };
    }

    await prisma.user.update({
      where: { id: matchedUser.id },
      data: { lastLoginAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        businessId: matchedUser.businessId,
        storeId: matchedUser.storeId,
        userId: matchedUser.id,
        action: 'PIN_LOGIN',
        entityType: 'User',
        entityId: matchedUser.id,
        metadata: { username: matchedUser.username, role: matchedUser.role },
      },
    });

    const accessToken = signAccessToken({
      userId: matchedUser.id,
      username: matchedUser.username,
      businessId: matchedUser.businessId,
      storeId: matchedUser.storeId,
      role: matchedUser.role,
      permissions: matchedUser.permissions,
    });

    const refreshToken = signRefreshToken({ userId: matchedUser.id });

    return {
      user: {
        id: matchedUser.id,
        username: matchedUser.username,
        fullName: matchedUser.fullName,
        role: matchedUser.role,
        permissions: matchedUser.permissions,
        business: {
          id: matchedUser.business.id,
          name: matchedUser.business.name,
          defaultCurrency: matchedUser.business.defaultCurrency,
          baseExchangeRate: Number(matchedUser.business.baseExchangeRate),
          timezone: matchedUser.business.timezone,
        },
        store: matchedUser.store
          ? {
              id: matchedUser.store.id,
              name: matchedUser.store.name,
              code: matchedUser.store.code,
            }
          : null,
      },
      accessToken,
      refreshToken,
    };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        business: true,
        store: true,
      },
    });

    if (!user || !user.isActive) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User does not exist or is inactive' };
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      permissions: user.permissions,
      business: {
        id: user.business.id,
        name: user.business.name,
        defaultCurrency: user.business.defaultCurrency,
        baseExchangeRate: Number(user.business.baseExchangeRate),
        timezone: user.business.timezone,
      },
      store: user.store
        ? {
            id: user.store.id,
            name: user.store.name,
            code: user.store.code,
            address: user.store.address,
            receiptHeader: user.store.receiptHeader,
            receiptFooter: user.store.receiptFooter,
          }
        : null,
    };
  }
}
