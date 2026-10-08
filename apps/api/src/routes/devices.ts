import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import { requireAuth, isUserAuthorizedForStore } from '../middleware/auth.js';
import { registerDeviceInputSchema } from '@pos/validation';

export const devicesRouter: Router = Router();

/**
 * GET /api/devices
 * Lists registered devices for the current store
 */
devicesRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const storeId = (req.query.storeId as string) || user.storeId;

    if (storeId && !isUserAuthorizedForStore(user, storeId)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'You are not authorized for this store' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const where: any = {
      store: { businessId: user.businessId },
    };
    if (storeId) {
      where.storeId = storeId;
    } else if (!user.roles.includes('ADMIN') && user.authorizedStoreIds) {
      where.storeId = { in: user.authorizedStoreIds };
    }

    const devices = await prisma.device.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        store: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    res.json({
      success: true,
      data: devices,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/devices/register
 * Registers or updates a device and its hardware settings
 */
devicesRouter.post(
  '/register',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = registerDeviceInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid device registration data',
            details: parsed.error.format(),
          },
        });
        return;
      }

      const { storeId, name, deviceIdentifier, deviceType, hardwareConfig } = parsed.data;

      // Verify store belongs to user's business and user is authorized
      const store = await prisma.store.findFirst({
        where: { id: storeId, businessId: user.businessId },
      });
      if (!store) {
        res.status(404).json({
          success: false,
          error: { code: 'STORE_NOT_FOUND', message: 'Target store not found' },
        });
        return;
      }

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized for this store',
          },
        });
        return;
      }

      const device = await prisma.device.upsert({
        where: { deviceIdentifier },
        create: {
          storeId,
          name,
          deviceIdentifier,
          deviceType: deviceType as any,
          hardwareConfig: hardwareConfig ? (hardwareConfig as any) : undefined,
          lastSyncAt: new Date(),
          isActive: true,
        },
        update: {
          storeId,
          name,
          deviceType: deviceType as any,
          ...(hardwareConfig ? { hardwareConfig: hardwareConfig as any } : {}),
          lastSyncAt: new Date(),
          isActive: true,
        },
      });

      res.status(201).json({
        success: true,
        data: device,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/devices/:identifier
 * Retrieves a device and its hardware configuration by identifier
 */
devicesRouter.get(
  '/:identifier',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const identifier = String(req.params.identifier);

      const device = await prisma.device.findFirst({
        where: {
          deviceIdentifier: identifier,
          store: { businessId: user.businessId },
        },
        include: {
          store: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      if (!device || !isUserAuthorizedForStore(user, device.storeId)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Device '${identifier}' not found`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: device,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /api/devices/:identifier/hardware-config
 * Updates the hardware configuration for a registered device
 */
devicesRouter.put(
  '/:identifier/hardware-config',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const identifier = String(req.params.identifier);
      const { hardwareConfig } = req.body;

      if (!hardwareConfig || typeof hardwareConfig !== 'object') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid hardware configuration object is required',
          },
        });
        return;
      }

      const existing = await prisma.device.findFirst({
        where: {
          deviceIdentifier: identifier,
          store: { businessId: user.businessId },
        },
      });

      if (!existing || !isUserAuthorizedForStore(user, existing.storeId)) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Device '${identifier}' not found`,
          },
        });
        return;
      }

      const device = await prisma.device.update({
        where: { id: existing.id },
        data: {
          hardwareConfig,
          lastSyncAt: new Date(),
        },
      });

      res.json({
        success: true,
        data: device,
        message: 'Hardware configuration saved successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);
