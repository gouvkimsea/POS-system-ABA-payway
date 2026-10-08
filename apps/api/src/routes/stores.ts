import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import { requireAuth, requirePermission, isUserAuthorizedForStore } from '../middleware/auth.js';
import { PERMISSIONS } from '@pos/types';
import {
  createStoreSchema,
  updateStoreSchema,
  storeSettingsSchema,
  createStoreRegisterSchema,
  updateStoreRegisterSchema,
  assignStoreUserSchema,
  updateStoreProductSchema,
} from '@pos/validation';

export const storesRouter = Router();

// ==============================================================================
// 1. STORE LIST & DETAILS
// ==============================================================================

/**
 * GET /api/stores
 * List stores for the current business
 * Admins see all stores; branch-scoped users only see authorized stores
 */
storesRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const where: any = {
      businessId: user.businessId,
      deletedAt: null,
    };

    // Branch authorization scoping
    if (!user.roles.includes('ADMIN') && user.authorizedStoreIds) {
      where.id = { in: user.authorizedStoreIds };
    }

    const stores = await prisma.store.findMany({
      where,
      include: {
        _count: {
          select: {
            cashRegisters: true,
            userRoles: true,
            inventory: true,
            orders: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    const data = stores.map((s) => ({
      id: s.id,
      businessId: s.businessId,
      name: s.name,
      code: s.code,
      phone: s.phone,
      email: s.email,
      address: s.address,
      receiptHeader: s.receiptHeader,
      receiptFooter: s.receiptFooter,
      settings: s.settings as any,
      isActive: s.isActive,
      registerCount: s._count.cashRegisters,
      userCount: s._count.userRoles,
      inventoryCount: s._count.inventory,
      orderCount: s._count.orders,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/stores
 * Create a new store / branch
 */
storesRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = createStoreSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid store data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      // Check unique code within business
      const existing = await prisma.store.findUnique({
        where: {
          businessId_code: {
            businessId: user.businessId,
            code: input.code,
          },
        },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_CODE',
            message: `A store with code '${input.code}' already exists in your business.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Create store, default inventory location, and default register
      const store = await prisma.$transaction(async (tx) => {
        const createdStore = await tx.store.create({
          data: {
            businessId: user.businessId,
            name: input.name,
            code: input.code,
            phone: input.phone || null,
            email: input.email || null,
            address: input.address || null,
            receiptHeader: input.receiptHeader || null,
            receiptFooter: input.receiptFooter || null,
            settings: (input.settings as any) || {
              defaultCurrency: 'USD',
              timezone: 'Asia/Phnom_Penh',
              taxRate: 0.1,
              autoPrintReceipt: true,
              allowNegativeStock: false,
            },
            isActive: input.isActive ?? true,
          },
        });

        // 1. Create default inventory location for this store
        await tx.inventoryLocation.create({
          data: {
            storeId: createdStore.id,
            name: 'Main Storefront',
            code: 'MAIN',
            description: 'Primary on-shelf and counter inventory',
            isDefault: true,
            isActive: true,
          },
        });

        // 2. Create default cash register for this store
        await tx.cashRegister.create({
          data: {
            storeId: createdStore.id,
            name: 'Register 01',
            code: 'REG-01',
            isActive: true,
          },
        });

        // 3. Audit log
        await tx.auditLog.create({
          data: {
            businessId: user.businessId,
            storeId: createdStore.id,
            userId: user.userId,
            action: 'STORE_CREATED',
            entityType: 'Store',
            entityId: createdStore.id,
            details: { name: createdStore.name, code: createdStore.code },
          },
        });

        return createdStore;
      });

      res.status(201).json({
        success: true,
        data: store,
        message: `Branch "${store.name}" created successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/stores/:id
 * Retrieve specific store details, settings, and registers
 */
storesRouter.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const storeId = req.params.id as string;

    if (!isUserAuthorizedForStore(user, storeId)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_STORE_ACCESS',
          message: 'You are not authorized to view this store.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        businessId: user.businessId,
        deletedAt: null,
      },
      include: {
        cashRegisters: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        inventoryLocations: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        },
        userRoles: {
          include: {
            user: {
              select: { id: true, username: true, fullName: true, email: true, isActive: true },
            },
            role: {
              select: { id: true, name: true, description: true },
            },
          },
        },
        _count: {
          select: {
            inventory: true,
            orders: true,
          },
        },
      },
    });

    if (!store) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Store not found' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...store,
        settings: store.settings as any,
        inventoryCount: store._count.inventory,
        orderCount: store._count.orders,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/stores/:id
 * Update store basic details
 */
storesRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = updateStoreSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid store data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      // If code changed, check uniqueness
      if (input.code) {
        const existing = await prisma.store.findFirst({
          where: {
            businessId: user.businessId,
            code: input.code,
            NOT: { id: storeId },
          },
        });
        if (existing) {
          res.status(409).json({
            success: false,
            error: {
              code: 'DUPLICATE_CODE',
              message: `Store code '${input.code}' is already taken.`,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const updated = await prisma.store.update({
        where: { id: storeId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.code && { code: input.code }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.email !== undefined && { email: input.email }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.receiptHeader !== undefined && { receiptHeader: input.receiptHeader }),
          ...(input.receiptFooter !== undefined && { receiptFooter: input.receiptFooter }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.settings && { settings: input.settings as any }),
        },
      });

      res.json({
        success: true,
        data: updated,
        message: 'Store updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 2. STORE SETTINGS
// ==============================================================================

/**
 * GET /api/stores/:id/settings
 * Fetch store settings
 */
storesRouter.get(
  '/:id/settings',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const store = await prisma.store.findFirst({
        where: { id: storeId, businessId: user.businessId },
        select: { id: true, name: true, settings: true, receiptHeader: true, receiptFooter: true },
      });

      if (!store) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Store not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: {
          storeId: store.id,
          storeName: store.name,
          settings: store.settings || {},
          receiptHeader: store.receiptHeader,
          receiptFooter: store.receiptFooter,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/stores/:id/settings
 * Update store settings
 */
storesRouter.put(
  '/:id/settings',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = storeSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid settings data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const settings = parsed.data;

      const updated = await prisma.store.update({
        where: { id: storeId },
        data: {
          settings: settings as any,
          ...(settings.receiptHeader !== undefined && { receiptHeader: settings.receiptHeader }),
          ...(settings.receiptFooter !== undefined && { receiptFooter: settings.receiptFooter }),
        },
      });

      res.json({
        success: true,
        data: updated.settings,
        message: 'Store settings saved successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 3. STORE REGISTERS
// ==============================================================================

/**
 * GET /api/stores/:id/registers
 * List cash registers for this store
 */
storesRouter.get(
  '/:id/registers',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const registers = await prisma.cashRegister.findMany({
        where: { storeId },
        include: {
          sessions: {
            where: { status: 'OPEN' },
            include: {
              cashier: { select: { id: true, username: true, fullName: true } },
            },
          },
          _count: {
            select: { orders: true, sessions: true },
          },
        },
        orderBy: { code: 'asc' },
      });

      const formatted = registers.map((reg) => ({
        id: reg.id,
        storeId: reg.storeId,
        name: reg.name,
        code: reg.code,
        isActive: reg.isActive,
        activeSession: reg.sessions[0]
          ? {
              id: reg.sessions[0].id,
              cashierName: reg.sessions[0].cashier.fullName,
              openedAt: reg.sessions[0].openedAt.toISOString(),
            }
          : null,
        totalOrders: reg._count.orders,
        totalSessions: reg._count.sessions,
        createdAt: reg.createdAt.toISOString(),
      }));

      res.json({
        success: true,
        data: formatted,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/stores/:id/registers
 * Create a new cash register for this store
 */
storesRouter.post(
  '/:id/registers',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = createStoreRegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid register data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      // Unique code check within store
      const existing = await prisma.cashRegister.findUnique({
        where: {
          storeId_code: {
            storeId,
            code: input.code,
          },
        },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_CODE',
            message: `Register code '${input.code}' already exists in this store.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const register = await prisma.cashRegister.create({
        data: {
          storeId,
          name: input.name,
          code: input.code,
          isActive: input.isActive ?? true,
        },
      });

      res.status(201).json({
        success: true,
        data: register,
        message: `Register "${register.name}" created successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/stores/:id/registers/:registerId
 * Update cash register
 */
storesRouter.put(
  '/:id/registers/:registerId',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;
      const registerId = req.params.registerId as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = updateStoreRegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      if (input.code) {
        const existing = await prisma.cashRegister.findFirst({
          where: {
            storeId,
            code: input.code,
            NOT: { id: registerId },
          },
        });
        if (existing) {
          res.status(409).json({
            success: false,
            error: {
              code: 'DUPLICATE_CODE',
              message: `Register code '${input.code}' already exists.`,
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const updated = await prisma.cashRegister.update({
        where: { id: registerId },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.code && { code: input.code }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
      });

      res.json({
        success: true,
        data: updated,
        message: 'Register updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 4. STORE USERS & PERMISSIONS
// ==============================================================================

/**
 * GET /api/stores/:id/users
 * List users assigned to this store
 */
storesRouter.get(
  '/:id/users',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const userRoles = await prisma.userRole.findMany({
        where: { storeId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
              phone: true,
              isActive: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              rolePermissions: {
                select: {
                  permission: { select: { code: true, name: true, category: true } },
                },
              },
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      });

      const formatted = userRoles.map((ur) => ({
        assignmentId: ur.id,
        userId: ur.user.id,
        username: ur.user.username,
        fullName: ur.user.fullName,
        email: ur.user.email,
        phone: ur.user.phone,
        isActive: ur.user.isActive,
        roleId: ur.role.id,
        roleName: ur.role.name,
        roleDescription: ur.role.description,
        permissions: ur.role.rolePermissions.map((rp) => rp.permission.code),
        assignedAt: ur.assignedAt.toISOString(),
      }));

      res.json({
        success: true,
        data: formatted,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/stores/:id/users
 * Assign a user to this store with a role
 */
storesRouter.post(
  '/:id/users',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = assignStoreUserSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid assignment data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { userId, roleId } = parsed.data;

      // Check user and role belong to current business
      const [targetUser, targetRole] = await Promise.all([
        prisma.user.findFirst({ where: { id: userId, businessId: user.businessId } }),
        prisma.role.findFirst({ where: { id: roleId, businessId: user.businessId } }),
      ]);

      if (!targetUser) {
        res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found in business' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!targetRole) {
        res.status(404).json({
          success: false,
          error: { code: 'ROLE_NOT_FOUND', message: 'Role not found in business' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Upsert user role assignment
      const assignment = await prisma.userRole.upsert({
        where: {
          userId_roleId_storeId: {
            userId,
            roleId,
            storeId,
          },
        },
        create: {
          userId,
          roleId,
          storeId,
        },
        update: {},
      });

      res.status(201).json({
        success: true,
        data: assignment,
        message: `User ${targetUser.fullName} assigned to store as ${targetRole.name}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/stores/:id/users/:userId/roles/:roleId
 * Unassign user role from this store
 */
storesRouter.delete(
  '/:id/users/:userId/roles/:roleId',
  requireAuth,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;
      const userId = req.params.userId as string;
      const roleId = req.params.roleId as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.userRole.deleteMany({
        where: {
          userId,
          roleId,
          storeId,
        },
      });

      res.json({
        success: true,
        message: 'Store role assignment removed successfully.',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 5. STORE-SPECIFIC PRODUCTS & PRICING
// ==============================================================================

/**
 * GET /api/stores/:id/products
 * List products and their store-specific overrides
 */
storesRouter.get(
  '/:id/products',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const products = await prisma.product.findMany({
        where: { businessId: user.businessId, deletedAt: null },
        include: {
          category: { select: { id: true, name: true } },
          storeProducts: {
            where: { storeId },
          },
          inventory: {
            where: { storeId },
            select: { quantity: true, minStockLevel: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      const data = products.map((p) => {
        const override = p.storeProducts[0] || null;
        const totalStock = p.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          categoryName: p.category?.name || 'Uncategorized',
          basePriceUSD: Number(p.sellingPriceUSD),
          basePriceKHR: Number(p.sellingPriceKHR),
          isCatalogActive: p.isActive,
          // Store specific overrides
          storeOverrideId: override?.id || null,
          isStoreActive: override ? override.isActive : p.isActive,
          storePriceUSD: override?.customPriceUSD != null ? Number(override.customPriceUSD) : null,
          storePriceKHR: override?.customPriceKHR != null ? Number(override.customPriceKHR) : null,
          effectivePriceUSD:
            override?.customPriceUSD != null
              ? Number(override.customPriceUSD)
              : Number(p.sellingPriceUSD),
          effectivePriceKHR:
            override?.customPriceKHR != null
              ? Number(override.customPriceKHR)
              : Number(p.sellingPriceKHR),
          minStockLevel:
            override?.minStockLevel != null ? Number(override.minStockLevel) : p.alertLowStock,
          stockOnHand: totalStock,
        };
      });

      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/stores/:id/products/:productId
 * Upsert store-specific product override (custom price, active status, min stock)
 */
storesRouter.put(
  '/:id/products/:productId',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;
      const productId = req.params.productId as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = updateStoreProductSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid product override data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      // Find existing override
      const existing = await prisma.storeProduct.findFirst({
        where: { storeId, productId, variantId: null },
      });

      let override;
      if (existing) {
        override = await prisma.storeProduct.update({
          where: { id: existing.id },
          data: {
            ...(input.isActive !== undefined && { isActive: input.isActive }),
            ...(input.customPriceUSD !== undefined && { customPriceUSD: input.customPriceUSD }),
            ...(input.customPriceKHR !== undefined && { customPriceKHR: input.customPriceKHR }),
            ...(input.minStockLevel !== undefined && { minStockLevel: input.minStockLevel }),
            ...(input.maxStockLevel !== undefined && { maxStockLevel: input.maxStockLevel }),
          },
        });
      } else {
        override = await prisma.storeProduct.create({
          data: {
            storeId,
            productId,
            isActive: input.isActive ?? true,
            customPriceUSD: input.customPriceUSD !== undefined ? input.customPriceUSD : null,
            customPriceKHR: input.customPriceKHR !== undefined ? input.customPriceKHR : null,
            minStockLevel: input.minStockLevel !== undefined ? input.minStockLevel : null,
            maxStockLevel: input.maxStockLevel !== undefined ? input.maxStockLevel : null,
          },
        });
      }

      res.json({
        success: true,
        data: override,
        message: 'Store product settings updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 6. STORE INVENTORY OVERVIEW
// ==============================================================================

/**
 * GET /api/stores/:id/inventory
 * Store-specific inventory summary
 */
storesRouter.get(
  '/:id/inventory',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = req.params.id as string;

      if (!isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN_STORE_ACCESS', message: 'Unauthorized for this store.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const inventory = await prisma.inventory.findMany({
        where: { storeId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              costPriceUSD: true,
              sellingPriceUSD: true,
              category: { select: { name: true } },
            },
          },
          location: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: [{ product: { name: 'asc' } }, { location: { name: 'asc' } }],
      });

      const items = inventory.map((inv) => {
        const qty = Number(inv.quantity);
        const minStock = Number(inv.minStockLevel);
        const costPrice = Number(inv.product.costPriceUSD);
        const sellingPrice = Number(inv.product.sellingPriceUSD);

        return {
          id: inv.id,
          storeId: inv.storeId,
          productId: inv.productId,
          productName: inv.product.name,
          sku: inv.product.sku,
          barcode: inv.product.barcode,
          categoryName: inv.product.category?.name || 'Uncategorized',
          locationId: inv.locationId,
          locationName: inv.location.name,
          quantity: qty,
          reservedQuantity: Number(inv.reservedQuantity),
          minStockLevel: minStock,
          costPriceUSD: costPrice,
          sellingPriceUSD: sellingPrice,
          totalValuationUSD: qty * costPrice,
          isLowStock: qty <= minStock,
          isOutOfStock: qty <= 0,
          updatedAt: inv.updatedAt.toISOString(),
        };
      });

      res.json({
        success: true,
        data: items,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);
