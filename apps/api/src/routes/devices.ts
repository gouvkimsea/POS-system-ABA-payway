import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { registerDeviceInputSchema } from '@pos/validation';

export const devicesRouter: Router = Router();

/**
 * GET /api/devices
 * Lists registered devices for the current store
 */
devicesRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.query.storeId as string || req.user?.storeId;

    const devices = await prisma.device.findMany({
      where: storeId ? { storeId } : undefined,
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
devicesRouter.post('/register', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
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
});

/**
 * GET /api/devices/:identifier
 * Retrieves a device and its hardware configuration by identifier
 */
devicesRouter.get('/:identifier', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const identifier = String(req.params.identifier);

    const device = await prisma.device.findUnique({
      where: { deviceIdentifier: identifier },
      include: {
        store: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!device) {
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
});

/**
 * PUT /api/devices/:identifier/hardware-config
 * Updates the hardware configuration for a registered device
 */
devicesRouter.put('/:identifier/hardware-config', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
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

    const device = await prisma.device.update({
      where: { deviceIdentifier: identifier },
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
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Device '${req.params.identifier}' not found`,
        },
      });
      return;
    }
    next(err);
  }
});
