import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '@pos/types';
import {
  inventoryLocationSchema,
  stockAdjustmentSchema,
  stockTransferSchema,
} from '@pos/validation';
import { StockMovementType } from '@prisma/client';

export const inventoryRouter: Router = Router();

// ==============================================================================
// 1. INVENTORY LOCATIONS MANAGEMENT
// ==============================================================================

/**
 * GET /api/inventory/locations
 * List all inventory storage locations with product & quantity metrics
 */
inventoryRouter.get(
  '/locations',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = (req.query.storeId as string) || user.storeId;

      const where: any = {
        store: { businessId: user.businessId },
      };
      if (storeId) {
        where.storeId = storeId;
      }

      const locations = await prisma.inventoryLocation.findMany({
        where,
        include: {
          store: { select: { id: true, name: true, code: true } },
          inventory: {
            select: {
              quantity: true,
              productId: true,
            },
          },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });

      const formatted = locations.map((loc) => {
        const totalItems = loc.inventory.length;
        const totalQuantity = loc.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
        return {
          id: loc.id,
          storeId: loc.storeId,
          storeName: loc.store.name,
          name: loc.name,
          code: loc.code,
          description: loc.description,
          isDefault: loc.isDefault,
          isActive: loc.isActive,
          totalItems,
          totalQuantity,
          createdAt: loc.createdAt.toISOString(),
          updatedAt: loc.updatedAt.toISOString(),
        };
      });

      res.status(200).json({
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
 * POST /api/inventory/locations
 * Create a new inventory storage location
 */
inventoryRouter.post(
  '/locations',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = inventoryLocationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid location data' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      // Verify store belongs to user's business
      const store = await prisma.store.findFirst({
        where: { id: input.storeId, businessId: user.businessId },
      });
      if (!store) {
        res.status(404).json({
          success: false,
          error: { code: 'STORE_NOT_FOUND', message: 'Target store not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check code uniqueness within store
      const dup = await prisma.inventoryLocation.findFirst({
        where: { storeId: input.storeId, code: input.code },
      });
      if (dup) {
        res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_CODE', message: `Location code "${input.code}" already exists for this store` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const location = await prisma.$transaction(async (tx) => {
        // If set as default, remove default from other locations in the store
        if (input.isDefault) {
          await tx.inventoryLocation.updateMany({
            where: { storeId: input.storeId, isDefault: true },
            data: { isDefault: false },
          });
        }

        return tx.inventoryLocation.create({
          data: {
            storeId: input.storeId,
            name: input.name,
            code: input.code,
            description: input.description || null,
            isDefault: input.isDefault ?? false,
            isActive: input.isActive ?? true,
          },
        });
      });

      res.status(201).json({
        success: true,
        data: location,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/inventory/locations/:id
 * Update an inventory storage location
 */
inventoryRouter.put(
  '/locations/:id',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const locationId = String(req.params.id);

      const existing = await prisma.inventoryLocation.findFirst({
        where: { id: locationId, store: { businessId: user.businessId } },
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Location not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = inventoryLocationSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid location data' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      const updated = await prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.inventoryLocation.updateMany({
            where: { storeId: existing.storeId, isDefault: true, id: { not: locationId } },
            data: { isDefault: false },
          });
        }

        return tx.inventoryLocation.update({
          where: { id: locationId },
          data: {
            name: input.name ?? existing.name,
            code: input.code ?? existing.code,
            description: input.description !== undefined ? input.description : existing.description,
            isDefault: input.isDefault !== undefined ? input.isDefault : existing.isDefault,
            isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
          },
        });
      });

      res.status(200).json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/inventory/locations/:id
 * Soft delete or deactivate inventory location
 */
inventoryRouter.delete(
  '/locations/:id',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const locationId = String(req.params.id);

      const existing = await prisma.inventoryLocation.findFirst({
        where: { id: locationId, store: { businessId: user.businessId } },
        include: { inventory: { where: { quantity: { gt: 0 } } } },
      });
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Location not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (existing.isDefault) {
        res.status(400).json({
          success: false,
          error: { code: 'CANNOT_DELETE_DEFAULT', message: 'Default store location cannot be deleted' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (existing.inventory.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'LOCATION_HAS_STOCK',
            message: 'Location has active inventory. Transfer or adjust stock to 0 before deleting',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await prisma.inventoryLocation.update({
        where: { id: locationId },
        data: { isActive: false },
      });

      res.status(200).json({
        success: true,
        data: { message: `Location "${existing.name}" deactivated successfully` },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 2. STOCK LEVELS & LOW STOCK ALERTS
// ==============================================================================

/**
 * GET /api/inventory/stock
 * View granular inventory balances with low-stock indicators and multi-filters
 */
inventoryRouter.get(
  '/stock',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = (req.query.storeId as string) || user.storeId;
      const locationId = req.query.locationId as string;
      const productId = req.query.productId as string;
      const search = (req.query.search as string)?.trim();
      const lowStockOnly = req.query.lowStockOnly === 'true';

      const where: any = {
        store: { businessId: user.businessId },
        product: { deletedAt: null },
      };

      if (storeId) {
        where.storeId = storeId;
      }
      if (locationId) {
        where.locationId = locationId;
      }
      if (productId) {
        where.productId = productId;
      }
      if (search) {
        where.OR = [
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { nameKhmer: { contains: search, mode: 'insensitive' } } },
          { product: { sku: { contains: search, mode: 'insensitive' } } },
          { product: { barcode: { contains: search, mode: 'insensitive' } } },
          { variant: { name: { contains: search, mode: 'insensitive' } } },
          { variant: { sku: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const items = await prisma.inventory.findMany({
        where,
        include: {
          store: { select: { id: true, name: true } },
          location: { select: { id: true, name: true, code: true } },
          product: {
            select: {
              id: true,
              name: true,
              nameKhmer: true,
              sku: true,
              barcode: true,
              unit: true,
              reorderLevel: true,
              alertLowStock: true,
              costPriceUSD: true,
              sellingPriceUSD: true,
              category: { select: { name: true } },
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              size: true,
              color: true,
              weight: true,
              model: true,
            },
          },
        },
        orderBy: [{ product: { name: 'asc' } }, { location: { name: 'asc' } }],
      });

      const formatted = items.map((inv) => {
        const qty = Number(inv.quantity);
        const resQty = Number(inv.reservedQuantity);
        const avail = Math.max(0, qty - resQty);
        const minLvl = Number(inv.minStockLevel);
        const reorderLvl = inv.product.reorderLevel;
        const isLow = qty <= minLvl || qty <= reorderLvl;

        return {
          id: inv.id,
          storeId: inv.storeId,
          storeName: inv.store.name,
          locationId: inv.locationId,
          locationName: inv.location.name,
          locationCode: inv.location.code,
          productId: inv.productId,
          productName: inv.product.name,
          productNameKhmer: inv.product.nameKhmer,
          productSku: inv.product.sku,
          productBarcode: inv.product.barcode,
          productUnit: inv.product.unit,
          categoryName: inv.product.category?.name || null,
          costPriceUSD: Number(inv.product.costPriceUSD),
          sellingPriceUSD: Number(inv.product.sellingPriceUSD),
          variantId: inv.variantId,
          variantName: inv.variant?.name || null,
          variantSku: inv.variant?.sku || null,
          variantAttributes: inv.variant
            ? {
                size: inv.variant.size,
                color: inv.variant.color,
                weight: inv.variant.weight,
                model: inv.variant.model,
              }
            : null,
          quantity: qty,
          reservedQuantity: resQty,
          availableQuantity: avail,
          minStockLevel: minLvl,
          reorderLevel: reorderLvl,
          maxStockLevel: inv.maxStockLevel ? Number(inv.maxStockLevel) : null,
          isLowStock: isLow,
          updatedAt: inv.updatedAt.toISOString(),
        };
      });

      const filtered = lowStockOnly ? formatted.filter((item) => item.isLowStock) : formatted;

      res.status(200).json({
        success: true,
        data: filtered,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/inventory/low-stock
 * Summary of all items that are currently at or below their reorder level
 */
inventoryRouter.get(
  '/low-stock',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = (req.query.storeId as string) || user.storeId;

      const where: any = {
        store: { businessId: user.businessId },
        product: { deletedAt: null },
      };
      if (storeId) {
        where.storeId = storeId;
      }

      const allInv = await prisma.inventory.findMany({
        where,
        include: {
          store: { select: { name: true } },
          location: { select: { name: true, code: true } },
          product: {
            select: {
              id: true,
              name: true,
              nameKhmer: true,
              sku: true,
              reorderLevel: true,
              alertLowStock: true,
              unit: true,
              category: { select: { name: true } },
            },
          },
          variant: { select: { name: true, sku: true } },
        },
      });

      const lowStockItems = allInv
        .filter((inv) => Number(inv.quantity) <= Number(inv.minStockLevel) || Number(inv.quantity) <= inv.product.reorderLevel)
        .map((inv) => ({
          inventoryId: inv.id,
          productId: inv.productId,
          productName: inv.product.name,
          productNameKhmer: inv.product.nameKhmer,
          sku: inv.variant ? inv.variant.sku : inv.product.sku,
          variantName: inv.variant?.name || null,
          categoryName: inv.product.category?.name || null,
          locationName: inv.location.name,
          currentStock: Number(inv.quantity),
          reorderLevel: inv.product.reorderLevel,
          minStockLevel: Number(inv.minStockLevel),
          unit: inv.product.unit,
          shortfall: Math.max(0, inv.product.reorderLevel - Number(inv.quantity)),
        }));

      res.status(200).json({
        success: true,
        data: {
          totalLowStockCount: lowStockItems.length,
          items: lowStockItems,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 3. TRANSACTIONAL STOCK ADJUSTMENTS & TRANSFERS
// ==============================================================================

/**
 * POST /api/inventory/adjust
 * Adjust stock levels transactionally.
 * MANDATORY REQUIREMENT: Must record a specific reason notes and run inside DB transaction!
 */
inventoryRouter.post(
  '/adjust',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = stockAdjustmentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid adjustment data. A reason is strictly required.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      // Verify location belongs to business
      const location = await prisma.inventoryLocation.findFirst({
        where: { id: input.locationId, store: { businessId: user.businessId } },
        include: { store: true },
      });
      if (!location) {
        res.status(404).json({
          success: false,
          error: { code: 'LOCATION_NOT_FOUND', message: 'Target inventory location not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verify product belongs to business
      const product = await prisma.product.findFirst({
        where: { id: input.productId, businessId: user.businessId, deletedAt: null },
      });
      if (!product) {
        res.status(404).json({
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Target product not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verify variant if provided
      if (input.variantId) {
        const variant = await prisma.productVariant.findFirst({
          where: { id: input.variantId, productId: input.productId, deletedAt: null },
        });
        if (!variant) {
          res.status(404).json({
            success: false,
            error: { code: 'VARIANT_NOT_FOUND', message: 'Target product variant not found' },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      // Map adjustment types to Prisma StockMovementType
      const movementTypeMap: Record<string, StockMovementType> = {
        PURCHASE: StockMovementType.PURCHASE,
        RETURN: StockMovementType.RETURN,
        ADJUSTMENT_IN: StockMovementType.ADJUSTMENT_IN,
        ADJUSTMENT_OUT: StockMovementType.ADJUSTMENT_OUT,
        DAMAGE: StockMovementType.DAMAGE,
        EXPIRED: StockMovementType.EXPIRED,
      };

      const movementType = movementTypeMap[input.type] || StockMovementType.ADJUSTMENT_IN;

      // Calculate quantity change direction
      // If user passed a positive number for DAMAGE/EXPIRED/ADJUSTMENT_OUT, invert it to negative
      let netChange = input.quantityChange;
      if (['ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRED'].includes(input.type) && netChange > 0) {
        netChange = -netChange;
      }
      if (['PURCHASE', 'RETURN', 'ADJUSTMENT_IN'].includes(input.type) && netChange < 0) {
        netChange = Math.abs(netChange);
      }

      // STRICT REQUIREMENT: EXECUTE ALL STOCK CHANGES IN PRISMA DATABASE TRANSACTION
      const result = await prisma.$transaction(async (tx) => {
        // Find existing inventory record
        const invRecord = await tx.inventory.findFirst({
          where: {
            storeId: location.storeId,
            locationId: location.id,
            productId: input.productId,
            variantId: input.variantId || null,
          },
        });

        const qtyBefore = invRecord ? Number(invRecord.quantity) : 0;
        const qtyAfter = qtyBefore + netChange;

        if (qtyAfter < 0) {
          throw new Error(
            `Insufficient stock balance. Current stock is ${qtyBefore}, cannot adjust by ${netChange}`,
          );
        }

        let updatedInv;
        if (invRecord) {
          updatedInv = await tx.inventory.update({
            where: { id: invRecord.id },
            data: { quantity: qtyAfter },
          });
        } else {
          updatedInv = await tx.inventory.create({
            data: {
              storeId: location.storeId,
              locationId: location.id,
              productId: input.productId,
              variantId: input.variantId || null,
              quantity: qtyAfter,
              minStockLevel: product.reorderLevel,
            },
          });
        }

        // STRICT REQUIREMENT: NEVER CHANGE STOCK WITHOUT RECORDING REASON & MOVEMENT LOG
        const movement = await tx.stockMovement.create({
          data: {
            storeId: location.storeId,
            locationId: location.id,
            productId: input.productId,
            variantId: input.variantId || null,
            type: movementType,
            quantityChange: netChange,
            quantityBefore: qtyBefore,
            quantityAfter: qtyAfter,
            unitCost: input.unitCost ?? Number(product.costPriceUSD),
            referenceType: input.referenceType || 'MANUAL_ADJUSTMENT',
            referenceId: input.referenceId || null,
            notes: input.reason.trim(), // Mandatory reason
            createdById: user.userId,
          },
        });

        return {
          inventory: updatedInv,
          movement,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          quantityChange: netChange,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          message: `Stock successfully adjusted for "${product.name}"`,
          quantityBefore: result.quantityBefore,
          quantityAfter: result.quantityAfter,
          quantityChange: result.quantityChange,
          movementId: result.movement.id,
          reason: input.reason,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message?.includes('Insufficient stock balance')) {
        res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT_STOCK', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /api/inventory/transfer
 * Transfer stock between two locations within a single database transaction
 */
inventoryRouter.post(
  '/transfer',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = stockTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid transfer parameters. A reason is strictly required.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const input = parsed.data;

      const [fromLoc, toLoc, product] = await Promise.all([
        prisma.inventoryLocation.findFirst({
          where: { id: input.fromLocationId, store: { businessId: user.businessId } },
          include: { store: true },
        }),
        prisma.inventoryLocation.findFirst({
          where: { id: input.toLocationId, store: { businessId: user.businessId } },
          include: { store: true },
        }),
        prisma.product.findFirst({
          where: { id: input.productId, businessId: user.businessId, deletedAt: null },
        }),
      ]);

      if (!fromLoc || !toLoc) {
        res.status(404).json({
          success: false,
          error: { code: 'LOCATION_NOT_FOUND', message: 'Source or destination location not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!product) {
        res.status(404).json({
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // EXECUTE BOTH MOVEMENTS IN A SINGLE ATOMIC TRANSACTION
      const result = await prisma.$transaction(async (tx) => {
        // 1. Check source stock
        const sourceInv = await tx.inventory.findFirst({
          where: {
            storeId: fromLoc.storeId,
            locationId: fromLoc.id,
            productId: input.productId,
            variantId: input.variantId || null,
          },
        });

        const sourceBefore = sourceInv ? Number(sourceInv.quantity) : 0;
        if (sourceBefore < input.quantity) {
          throw new Error(
            `Insufficient stock in "${fromLoc.name}". Available: ${sourceBefore}, requested: ${input.quantity}`,
          );
        }

        const sourceAfter = sourceBefore - input.quantity;

        // Decrement source inventory
        await tx.inventory.update({
          where: { id: sourceInv!.id },
          data: { quantity: sourceAfter },
        });

        // Record TRANSFER_OUT movement
        const moveOut = await tx.stockMovement.create({
          data: {
            storeId: fromLoc.storeId,
            locationId: fromLoc.id,
            productId: input.productId,
            variantId: input.variantId || null,
            type: StockMovementType.TRANSFER_OUT,
            quantityChange: -input.quantity,
            quantityBefore: sourceBefore,
            quantityAfter: sourceAfter,
            unitCost: Number(product.costPriceUSD),
            referenceType: 'TRANSFER',
            referenceId: toLoc.id,
            notes: `Transfer to ${toLoc.name}: ${input.reason}`,
            createdById: user.userId,
          },
        });

        // 2. Increment destination inventory
        const destInv = await tx.inventory.findFirst({
          where: {
            storeId: toLoc.storeId,
            locationId: toLoc.id,
            productId: input.productId,
            variantId: input.variantId || null,
          },
        });

        const destBefore = destInv ? Number(destInv.quantity) : 0;
        const destAfter = destBefore + input.quantity;

        if (destInv) {
          await tx.inventory.update({
            where: { id: destInv.id },
            data: { quantity: destAfter },
          });
        } else {
          await tx.inventory.create({
            data: {
              storeId: toLoc.storeId,
              locationId: toLoc.id,
              productId: input.productId,
              variantId: input.variantId || null,
              quantity: destAfter,
              minStockLevel: product.reorderLevel,
            },
          });
        }

        // Record TRANSFER_IN movement
        const moveIn = await tx.stockMovement.create({
          data: {
            storeId: toLoc.storeId,
            locationId: toLoc.id,
            productId: input.productId,
            variantId: input.variantId || null,
            type: StockMovementType.TRANSFER_IN,
            quantityChange: input.quantity,
            quantityBefore: destBefore,
            quantityAfter: destAfter,
            unitCost: Number(product.costPriceUSD),
            referenceType: 'TRANSFER',
            referenceId: fromLoc.id,
            notes: `Transfer from ${fromLoc.name}: ${input.reason}`,
            createdById: user.userId,
          },
        });

        return {
          sourceBefore,
          sourceAfter,
          destBefore,
          destAfter,
          moveOutId: moveOut.id,
          moveInId: moveIn.id,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          message: `Successfully transferred ${input.quantity} of "${product.name}" from ${fromLoc.name} to ${toLoc.name}`,
          details: result,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.message?.includes('Insufficient stock')) {
        res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT_STOCK', message: error.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  },
);

// ==============================================================================
// 4. STOCK MOVEMENT AUDIT HISTORY
// ==============================================================================

/**
 * GET /api/inventory/movements
 * Query complete stock movement audit logs with multi-dimensional filtering
 */
inventoryRouter.get(
  '/movements',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = (req.query.storeId as string) || user.storeId;
      const productId = req.query.productId as string;
      const locationId = req.query.locationId as string;
      const movementType = req.query.type as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const search = (req.query.search as string)?.trim();
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      const where: any = {
        store: { businessId: user.businessId },
      };

      if (storeId) {
        where.storeId = storeId;
      }
      if (productId) {
        where.productId = productId;
      }
      if (locationId) {
        where.locationId = locationId;
      }
      if (movementType) {
        where.type = movementType;
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }
      if (search) {
        where.OR = [
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { sku: { contains: search, mode: 'insensitive' } } },
          { notes: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [totalCount, movements] = await Promise.all([
        prisma.stockMovement.count({ where }),
        prisma.stockMovement.findMany({
          where,
          include: {
            store: { select: { name: true } },
            location: { select: { name: true, code: true } },
            product: { select: { id: true, name: true, nameKhmer: true, sku: true, unit: true } },
            variant: { select: { id: true, name: true, sku: true } },
            createdBy: { select: { id: true, fullName: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
      ]);

      const formatted = movements.map((m) => ({
        id: m.id,
        storeId: m.storeId,
        storeName: m.store.name,
        locationId: m.locationId,
        locationName: m.location.name,
        productId: m.productId,
        productName: m.product.name,
        productNameKhmer: m.product.nameKhmer,
        productSku: m.product.sku,
        productUnit: m.product.unit,
        variantId: m.variantId,
        variantName: m.variant?.name || null,
        variantSku: m.variant?.sku || null,
        type: m.type,
        quantityChange: Number(m.quantityChange),
        quantityBefore: Number(m.quantityBefore),
        quantityAfter: Number(m.quantityAfter),
        unitCost: Number(m.unitCost),
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        notes: m.notes,
        createdById: m.createdById,
        createdByName: m.createdBy.fullName || m.createdBy.username,
        createdAt: m.createdAt.toISOString(),
      }));

      res.status(200).json({
        success: true,
        data: {
          items: formatted,
          pagination: {
            total: totalCount,
            limit,
            offset,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);
