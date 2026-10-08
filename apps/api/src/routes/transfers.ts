import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import { requireAuth, requirePermission, isUserAuthorizedForStore } from '../middleware/auth.js';
import { PERMISSIONS } from '@pos/types';
import {
  createTransferRequestSchema,
  sendTransferSchema,
  receiveTransferSchema,
} from '@pos/validation';
import { StockMovementType, TransferStatus } from '@prisma/client';

export const transfersRouter = Router();

/**
 * Helper: Generate unique transfer number TRF-YYYYMMDD-XXXX
 */
async function generateTransferNumber(businessId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRF-${dateStr}-`;

  const count = await prisma.inventoryTransfer.count({
    where: {
      businessId,
      transferNumber: { startsWith: prefix },
    },
  });

  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}${seq}`;
}

// ==============================================================================
// 1. LIST & DETAIL TRANSFERS
// ==============================================================================

/**
 * GET /api/transfers
 * List inventory transfers with branch-scoping and status filtering
 */
transfersRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const statusParam = req.query.status as string | undefined;
    const storeIdParam = req.query.storeId as string | undefined;

    const where: any = {
      businessId: user.businessId,
    };

    if (statusParam && Object.values(TransferStatus).includes(statusParam as any)) {
      where.status = statusParam as TransferStatus;
    }

    // Branch authorization scoping
    if (!user.roles.includes('ADMIN') && user.authorizedStoreIds) {
      where.OR = [
        { sourceStoreId: { in: user.authorizedStoreIds } },
        { targetStoreId: { in: user.authorizedStoreIds } },
      ];
    }

    if (storeIdParam) {
      if (!where.OR) {
        where.OR = [{ sourceStoreId: storeIdParam }, { targetStoreId: storeIdParam }];
      }
    }

    const transfers = await prisma.inventoryTransfer.findMany({
      where,
      include: {
        sourceStore: { select: { id: true, name: true, code: true } },
        targetStore: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, username: true, fullName: true } },
        sentBy: { select: { id: true, username: true, fullName: true } },
        receivedBy: { select: { id: true, username: true, fullName: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = transfers.map((t) => ({
      id: t.id,
      transferNumber: t.transferNumber,
      businessId: t.businessId,
      sourceStoreId: t.sourceStoreId,
      sourceStoreName: t.sourceStore.name,
      targetStoreId: t.targetStoreId,
      targetStoreName: t.targetStore.name,
      status: t.status,
      notes: t.notes,
      requestedById: t.requestedById,
      requestedByName: t.requestedBy.fullName,
      sentById: t.sentById,
      sentByName: t.sentBy?.fullName || null,
      receivedById: t.receivedById,
      receivedByName: t.receivedBy?.fullName || null,
      requestedAt: t.requestedAt.toISOString(),
      sentAt: t.sentAt?.toISOString() || null,
      receivedAt: t.receivedAt?.toISOString() || null,
      cancelledAt: t.cancelledAt?.toISOString() || null,
      itemsCount: t.items.length,
      items: t.items.map((item) => ({
        id: item.id,
        transferId: item.transferId,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.product.name,
        sku: item.product.sku,
        unit: item.product.unit,
        requestedQuantity: Number(item.requestedQuantity),
        sentQuantity: Number(item.sentQuantity),
        receivedQuantity: Number(item.receivedQuantity),
        notes: item.notes,
      })),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    res.json({
      success: true,
      data: formatted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/transfers/:id
 * Retrieve a specific transfer by ID
 */
transfersRouter.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const transferId = req.params.id as string;

      const transfer = await prisma.inventoryTransfer.findFirst({
        where: {
          id: transferId,
          businessId: user.businessId,
        },
        include: {
          sourceStore: { select: { id: true, name: true, code: true, address: true } },
          targetStore: { select: { id: true, name: true, code: true, address: true } },
          requestedBy: { select: { id: true, username: true, fullName: true, email: true } },
          sentBy: { select: { id: true, username: true, fullName: true, email: true } },
          receivedBy: { select: { id: true, username: true, fullName: true, email: true } },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  barcode: true,
                  unit: true,
                  costPriceUSD: true,
                },
              },
            },
          },
        },
      });

      if (!transfer) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Transfer not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check store authorization
      const hasSourceAccess = isUserAuthorizedForStore(user, transfer.sourceStoreId);
      const hasTargetAccess = isUserAuthorizedForStore(user, transfer.targetStoreId);

      if (!hasSourceAccess && !hasTargetAccess) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized to view transfers for these stores.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const formatted = {
        id: transfer.id,
        transferNumber: transfer.transferNumber,
        businessId: transfer.businessId,
        sourceStore: transfer.sourceStore,
        targetStore: transfer.targetStore,
        status: transfer.status,
        notes: transfer.notes,
        requestedBy: transfer.requestedBy,
        sentBy: transfer.sentBy,
        receivedBy: transfer.receivedBy,
        requestedAt: transfer.requestedAt.toISOString(),
        sentAt: transfer.sentAt?.toISOString() || null,
        receivedAt: transfer.receivedAt?.toISOString() || null,
        cancelledAt: transfer.cancelledAt?.toISOString() || null,
        items: transfer.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku,
          barcode: item.product.barcode,
          unit: item.product.unit,
          costPriceUSD: Number(item.product.costPriceUSD),
          requestedQuantity: Number(item.requestedQuantity),
          sentQuantity: Number(item.sentQuantity),
          receivedQuantity: Number(item.receivedQuantity),
          notes: item.notes,
        })),
        createdAt: transfer.createdAt.toISOString(),
        updatedAt: transfer.updatedAt.toISOString(),
      };

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

// ==============================================================================
// 2. CREATE TRANSFER REQUEST (Store A -> Store B)
// ==============================================================================

/**
 * POST /api/transfers
 * Request an inventory transfer
 */
transfersRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = createTransferRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid transfer data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { sourceStoreId, targetStoreId, notes, items } = parsed.data;

      if (sourceStoreId === targetStoreId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SAME_STORE_TRANSFER',
            message:
              'Source store and destination store cannot be the same. Use internal location transfer instead.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check store access (must have access to either source or target store)
      const hasSourceAccess = isUserAuthorizedForStore(user, sourceStoreId);
      const hasTargetAccess = isUserAuthorizedForStore(user, targetStoreId);

      if (!hasSourceAccess && !hasTargetAccess) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized to create transfers between these stores.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verify both stores belong to current business
      const [sourceStore, targetStore] = await Promise.all([
        prisma.store.findFirst({ where: { id: sourceStoreId, businessId: user.businessId } }),
        prisma.store.findFirst({ where: { id: targetStoreId, businessId: user.businessId } }),
      ]);

      if (!sourceStore || !targetStore) {
        res.status(404).json({
          success: false,
          error: { code: 'STORE_NOT_FOUND', message: 'One or both stores not found in business' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Verify products belong to business
      const productIds = items.map((i) => i.productId);
      const validProducts = await prisma.product.findMany({
        where: { id: { in: productIds }, businessId: user.businessId, deletedAt: null },
      });

      if (validProducts.length !== productIds.length) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_PRODUCTS', message: 'One or more products do not exist' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const transferNumber = await generateTransferNumber(user.businessId);

      const transfer = await prisma.inventoryTransfer.create({
        data: {
          transferNumber,
          businessId: user.businessId,
          sourceStoreId,
          targetStoreId,
          status: TransferStatus.REQUESTED,
          notes: notes || null,
          requestedById: user.userId,
          requestedAt: new Date(),
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId || null,
              requestedQuantity: i.requestedQuantity,
              sentQuantity: 0,
              receivedQuantity: 0,
              notes: i.notes || null,
            })),
          },
        },
        include: {
          sourceStore: { select: { name: true } },
          targetStore: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
      });

      res.status(201).json({
        success: true,
        data: transfer,
        message: `Transfer request ${transferNumber} created successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 3. SEND TRANSFER (Store A -> IN_TRANSIT)
// ==============================================================================

/**
 * POST /api/transfers/:id/send
 * Dispatch transfer: deducts stock from source store and sets status to IN_TRANSIT
 */
transfersRouter.post(
  '/:id/send',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const transferId = req.params.id as string;

      const transfer = await prisma.inventoryTransfer.findFirst({
        where: { id: transferId, businessId: user.businessId },
        include: {
          items: { include: { product: true } },
          sourceStore: true,
          targetStore: true,
        },
      });

      if (!transfer) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Transfer not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Sender must be authorized for source store
      if (!isUserAuthorizedForStore(user, transfer.sourceStoreId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized to dispatch transfers from source store.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (transfer.status !== TransferStatus.REQUESTED) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot send transfer. Current status is ${transfer.status}. Expected REQUESTED.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = sendTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid send data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { notes, items: customSentItems } = parsed.data;

      // Find primary location of source store
      let sourceLocation = await prisma.inventoryLocation.findFirst({
        where: { storeId: transfer.sourceStoreId, isDefault: true, isActive: true },
      });

      if (!sourceLocation) {
        sourceLocation = await prisma.inventoryLocation.findFirst({
          where: { storeId: transfer.sourceStoreId, isActive: true },
        });
      }

      if (!sourceLocation) {
        sourceLocation = await prisma.inventoryLocation.create({
          data: {
            storeId: transfer.sourceStoreId,
            name: 'Main Storefront',
            code: 'MAIN',
            isDefault: true,
            isActive: true,
          },
        });
      }

      const now = new Date();

      // Execute dispatch in a transaction
      const updatedTransfer = await prisma.$transaction(async (tx) => {
        // Map sent quantities
        for (const item of transfer.items) {
          const customItem = customSentItems?.find((ci) => ci.productId === item.productId);
          const sentQty =
            customItem != null ? customItem.sentQuantity : Number(item.requestedQuantity);

          // Update transfer item
          await tx.inventoryTransferItem.update({
            where: { id: item.id },
            data: {
              sentQuantity: sentQty,
              ...(customItem?.notes && { notes: customItem.notes }),
            },
          });

          // Deduct from source store inventory
          const existingInv = await tx.inventory.findFirst({
            where: {
              storeId: transfer.sourceStoreId,
              locationId: sourceLocation.id,
              productId: item.productId,
              variantId: item.variantId,
            },
          });

          const currentQty = existingInv ? Number(existingInv.quantity) : 0;
          const newQty = currentQty - sentQty;

          if (existingInv) {
            await tx.inventory.update({
              where: { id: existingInv.id },
              data: { quantity: newQty },
            });
          } else {
            await tx.inventory.create({
              data: {
                storeId: transfer.sourceStoreId,
                locationId: sourceLocation.id,
                productId: item.productId,
                variantId: item.variantId,
                quantity: newQty,
              },
            });
          }

          // Record StockMovement: TRANSFER_OUT
          await tx.stockMovement.create({
            data: {
              storeId: transfer.sourceStoreId,
              locationId: sourceLocation.id,
              productId: item.productId,
              variantId: item.variantId,
              type: StockMovementType.TRANSFER_OUT,
              quantityChange: -sentQty,
              quantityBefore: currentQty,
              quantityAfter: newQty,
              unitCost: item.product.costPriceUSD,
              referenceType: 'TRANSFER',
              referenceId: transfer.id,
              notes: `Transfer ${transfer.transferNumber} sent to ${transfer.targetStore.name}`,
              createdById: user.userId,
            },
          });
        }

        // Update transfer status
        const updated = await tx.inventoryTransfer.update({
          where: { id: transfer.id },
          data: {
            status: TransferStatus.IN_TRANSIT,
            sentById: user.userId,
            sentAt: now,
            ...(notes && { notes: transfer.notes ? `${transfer.notes}\n[Sent]: ${notes}` : notes }),
          },
          include: {
            sourceStore: { select: { name: true } },
            targetStore: { select: { name: true } },
            sentBy: { select: { fullName: true } },
            items: true,
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            businessId: user.businessId,
            storeId: transfer.sourceStoreId,
            userId: user.userId,
            action: 'TRANSFER_SENT',
            entityType: 'InventoryTransfer',
            entityId: transfer.id,
            details: {
              transferNumber: transfer.transferNumber,
              toStore: transfer.targetStore.name,
            },
          },
        });

        return updated;
      });

      res.json({
        success: true,
        data: updatedTransfer,
        message: `Transfer ${transfer.transferNumber} dispatched and in transit to ${transfer.targetStore.name}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 4. RECEIVE TRANSFER (IN_TRANSIT -> Store B COMPLETED)
// ==============================================================================

/**
 * POST /api/transfers/:id/receive
 * Confirm receipt: increments stock at target store and marks transfer COMPLETED
 */
transfersRouter.post(
  '/:id/receive',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const transferId = req.params.id as string;

      const transfer = await prisma.inventoryTransfer.findFirst({
        where: { id: transferId, businessId: user.businessId },
        include: {
          items: { include: { product: true } },
          sourceStore: true,
          targetStore: true,
        },
      });

      if (!transfer) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Transfer not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Receiver must be authorized for target store
      if (!isUserAuthorizedForStore(user, transfer.targetStoreId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized to receive transfers at target store.',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (transfer.status !== TransferStatus.IN_TRANSIT) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Cannot receive transfer. Current status is ${transfer.status}. Expected IN_TRANSIT.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = receiveTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid receive data',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { notes, items: customReceivedItems } = parsed.data;

      // Find or create primary location of target store
      let targetLocation = await prisma.inventoryLocation.findFirst({
        where: { storeId: transfer.targetStoreId, isDefault: true, isActive: true },
      });

      if (!targetLocation) {
        targetLocation = await prisma.inventoryLocation.findFirst({
          where: { storeId: transfer.targetStoreId, isActive: true },
        });
      }

      if (!targetLocation) {
        targetLocation = await prisma.inventoryLocation.create({
          data: {
            storeId: transfer.targetStoreId,
            name: 'Main Storefront',
            code: 'MAIN',
            isDefault: true,
            isActive: true,
          },
        });
      }

      const now = new Date();

      // Execute receipt in a transaction
      const completedTransfer = await prisma.$transaction(async (tx) => {
        for (const item of transfer.items) {
          const customItem = customReceivedItems?.find((ci) => ci.productId === item.productId);
          const recQty =
            customItem != null ? customItem.receivedQuantity : Number(item.sentQuantity);

          // Update transfer item receivedQuantity
          await tx.inventoryTransferItem.update({
            where: { id: item.id },
            data: {
              receivedQuantity: recQty,
              ...(customItem?.notes && {
                notes: item.notes ? `${item.notes}\n[Rec]: ${customItem.notes}` : customItem.notes,
              }),
            },
          });

          // Add to target store inventory
          const existingInv = await tx.inventory.findFirst({
            where: {
              storeId: transfer.targetStoreId,
              locationId: targetLocation.id,
              productId: item.productId,
              variantId: item.variantId,
            },
          });

          const currentQty = existingInv ? Number(existingInv.quantity) : 0;
          const newQty = currentQty + recQty;

          if (existingInv) {
            await tx.inventory.update({
              where: { id: existingInv.id },
              data: { quantity: newQty },
            });
          } else {
            await tx.inventory.create({
              data: {
                storeId: transfer.targetStoreId,
                locationId: targetLocation.id,
                productId: item.productId,
                variantId: item.variantId,
                quantity: newQty,
              },
            });
          }

          // Record StockMovement: TRANSFER_IN
          await tx.stockMovement.create({
            data: {
              storeId: transfer.targetStoreId,
              locationId: targetLocation.id,
              productId: item.productId,
              variantId: item.variantId,
              type: StockMovementType.TRANSFER_IN,
              quantityChange: recQty,
              quantityBefore: currentQty,
              quantityAfter: newQty,
              unitCost: item.product.costPriceUSD,
              referenceType: 'TRANSFER',
              referenceId: transfer.id,
              notes: `Transfer ${transfer.transferNumber} received from ${transfer.sourceStore.name}`,
              createdById: user.userId,
            },
          });
        }

        // Update transfer status
        const updated = await tx.inventoryTransfer.update({
          where: { id: transfer.id },
          data: {
            status: TransferStatus.COMPLETED,
            receivedById: user.userId,
            receivedAt: now,
            ...(notes && {
              notes: transfer.notes ? `${transfer.notes}\n[Received]: ${notes}` : notes,
            }),
          },
          include: {
            sourceStore: { select: { name: true } },
            targetStore: { select: { name: true } },
            receivedBy: { select: { fullName: true } },
            items: true,
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            businessId: user.businessId,
            storeId: transfer.targetStoreId,
            userId: user.userId,
            action: 'TRANSFER_COMPLETED',
            entityType: 'InventoryTransfer',
            entityId: transfer.id,
            details: {
              transferNumber: transfer.transferNumber,
              fromStore: transfer.sourceStore.name,
            },
          },
        });

        return updated;
      });

      res.json({
        success: true,
        data: completedTransfer,
        message: `Transfer ${transfer.transferNumber} received and completed successfully. Stock updated at ${transfer.targetStore.name}.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// ==============================================================================
// 5. CANCEL TRANSFER
// ==============================================================================

/**
 * POST /api/transfers/:id/cancel
 * Cancel a transfer (returns stock if already sent)
 */
transfersRouter.post(
  '/:id/cancel',
  requireAuth,
  requirePermission(PERMISSIONS.INVENTORY_ADJUST),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const transferId = req.params.id as string;

      const transfer = await prisma.inventoryTransfer.findFirst({
        where: { id: transferId, businessId: user.businessId },
        include: {
          items: { include: { product: true } },
          sourceStore: true,
          targetStore: true,
        },
      });

      if (!transfer) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Transfer not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (transfer.status === TransferStatus.COMPLETED) {
        res.status(400).json({
          success: false,
          error: { code: 'CANNOT_CANCEL', message: 'Completed transfers cannot be cancelled.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (transfer.status === TransferStatus.CANCELLED) {
        res.status(400).json({
          success: false,
          error: { code: 'ALREADY_CANCELLED', message: 'Transfer is already cancelled.' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const now = new Date();

      await prisma.$transaction(async (tx) => {
        // If transfer was in transit, return stock to source store!
        if (transfer.status === TransferStatus.IN_TRANSIT) {
          const sourceLocation = await tx.inventoryLocation.findFirst({
            where: { storeId: transfer.sourceStoreId, isActive: true },
          });

          if (sourceLocation) {
            for (const item of transfer.items) {
              const sentQty = Number(item.sentQuantity);
              if (sentQty > 0) {
                const existingInv = await tx.inventory.findFirst({
                  where: {
                    storeId: transfer.sourceStoreId,
                    locationId: sourceLocation.id,
                    productId: item.productId,
                    variantId: item.variantId,
                  },
                });

                const currentQty = existingInv ? Number(existingInv.quantity) : 0;
                const newQty = currentQty + sentQty;

                if (existingInv) {
                  await tx.inventory.update({
                    where: { id: existingInv.id },
                    data: { quantity: newQty },
                  });
                }

                await tx.stockMovement.create({
                  data: {
                    storeId: transfer.sourceStoreId,
                    locationId: sourceLocation.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    type: StockMovementType.TRANSFER_IN,
                    quantityChange: sentQty,
                    quantityBefore: currentQty,
                    quantityAfter: newQty,
                    unitCost: item.product.costPriceUSD,
                    referenceType: 'TRANSFER_REVERSAL',
                    referenceId: transfer.id,
                    notes: `Transfer ${transfer.transferNumber} cancelled, stock returned to ${transfer.sourceStore.name}`,
                    createdById: user.userId,
                  },
                });
              }
            }
          }
        }

        await tx.inventoryTransfer.update({
          where: { id: transfer.id },
          data: {
            status: TransferStatus.CANCELLED,
            cancelledAt: now,
          },
        });

        await tx.auditLog.create({
          data: {
            businessId: user.businessId,
            userId: user.userId,
            action: 'TRANSFER_CANCELLED',
            entityType: 'InventoryTransfer',
            entityId: transfer.id,
            details: { transferNumber: transfer.transferNumber },
          },
        });
      });

      res.json({
        success: true,
        message: `Transfer ${transfer.transferNumber} cancelled successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);
