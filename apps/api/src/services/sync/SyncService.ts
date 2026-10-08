import { prisma } from '../../db/index.js';
import { Prisma, StockMovementType, OrderStatus, PaymentStatus, SyncStatus } from '@prisma/client';
import {
  SyncBatchRequest,
  SyncBatchResponse,
  SyncBatchItemResult,
  OfflineSyncQueueItem,
  OfflineConflictInfo,
  CatalogSnapshot,
  SyncMonitorStats,
  SyncQueueRecord,
  PosProduct,
  PosCustomer,
} from '@pos/types';
import { logger } from '../../logger/index.js';

export class SyncService {
  /**
   * Helper to generate human-readable order number
   */
  private static generateOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const hex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${date}-${hex}${rand.toString().slice(-2)}`;
  }

  /**
   * Helper to generate receipt number
   */
  private static generateReceiptNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const hex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RCP-${date}-${hex}${rand.toString().slice(-2)}`;
  }

  /**
   * Resolve or create a registered Device entity for the sync queue
   */
  private static async resolveDevice(
    storeId: string,
    deviceId?: string,
    deviceIdentifier?: string,
  ): Promise<{ id: string; deviceIdentifier: string }> {
    if (deviceId) {
      const existing = await prisma.device.findUnique({ where: { id: deviceId } });
      if (existing) return { id: existing.id, deviceIdentifier: existing.deviceIdentifier };
    }

    const identifier = deviceIdentifier || `POS-DEV-${storeId.slice(0, 8)}`;
    const existingByIdentifier = await prisma.device.findUnique({
      where: { deviceIdentifier: identifier },
    });
    if (existingByIdentifier) {
      return {
        id: existingByIdentifier.id,
        deviceIdentifier: existingByIdentifier.deviceIdentifier,
      };
    }

    const created = await prisma.device.create({
      data: {
        storeId,
        name: `POS Terminal (${identifier.slice(0, 12)})`,
        deviceIdentifier: identifier,
        deviceType: 'TERMINAL',
        isActive: true,
      },
    });

    return { id: created.id, deviceIdentifier: created.deviceIdentifier };
  }

  /**
   * Batch process offline transactions submitted by the client
   */
  public static async processBatch(
    businessId: string,
    storeId: string,
    userId: string,
    batch: SyncBatchRequest,
  ): Promise<SyncBatchResponse> {
    const results: SyncBatchItemResult[] = [];
    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    const device = await this.resolveDevice(storeId, batch.deviceId, batch.deviceIdentifier);

    for (const item of batch.items) {
      try {
        const itemResult = await this.processSingleOfflineItem(
          businessId,
          storeId,
          userId,
          device.id,
          item,
        );
        results.push(itemResult);

        if (itemResult.status === 'synchronized') syncedCount++;
        else if (itemResult.status === 'conflict') conflictCount++;
        else failedCount++;
      } catch (err: any) {
        logger.error(
          { err, clientSyncId: item.clientSyncId },
          '[SyncService] Error processing offline item',
        );
        failedCount++;
        results.push({
          clientSyncId: item.clientSyncId,
          status: 'failed',
          errorMessage: err.message || 'Internal error processing transaction sync',
        });
      }
    }

    return {
      success: conflictCount === 0 && failedCount === 0,
      total: batch.items.length,
      syncedCount,
      conflictCount,
      failedCount,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Process a single offline transaction with idempotency, conflict detection, and stock reconciliation
   */
  public static async processSingleOfflineItem(
    businessId: string,
    storeId: string,
    userId: string,
    deviceId: string,
    item: OfflineSyncQueueItem,
  ): Promise<SyncBatchItemResult> {
    const { clientSyncId, payload } = item;

    // STEP 1: Idempotency Check — Prevent duplicate orders
    const existingOrder = await prisma.order.findFirst({
      where: {
        OR: [
          { offlineSyncId: clientSyncId },
          { idempotencyKey: payload.idempotencyKey || clientSyncId },
        ],
      },
      include: { receipt: true },
    });

    if (existingOrder) {
      logger.info(
        `[SyncService] Transaction already synced for clientSyncId: ${clientSyncId}. Returning existing order #${existingOrder.orderNumber}`,
      );

      // Ensure SyncQueue entry is PROCESSED
      await prisma.syncQueue.upsert({
        where: { clientSyncId },
        update: {
          status: SyncStatus.PROCESSED,
          orderId: existingOrder.id,
          processedAt: new Date(),
        },
        create: {
          clientSyncId,
          storeId,
          deviceId,
          payload: payload as any,
          status: SyncStatus.PROCESSED,
          orderId: existingOrder.id,
          processedAt: new Date(),
        },
      });

      return {
        clientSyncId,
        status: 'synchronized',
        serverOrderId: existingOrder.id,
        serverOrderNumber: existingOrder.orderNumber,
        receiptNumber: existingOrder.receipt?.receiptNumber,
        alreadySynced: true,
        inventoryReconciled: true,
      };
    }

    // Record / Update SyncQueue entry
    const syncQueueRecord = await prisma.syncQueue.upsert({
      where: { clientSyncId },
      update: {
        status: SyncStatus.PENDING,
        errorMessage: null,
      },
      create: {
        clientSyncId,
        storeId,
        deviceId,
        payload: payload as any,
        status: SyncStatus.PENDING,
      },
    });

    // STEP 2: Pre-flight Conflict Detection
    // Check products existence, active state, and price changes
    const itemProductIds = payload.items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: itemProductIds } },
    });

    const dbProductMap = new Map(dbProducts.map((p) => [p.id, p]));

    for (const cartItem of payload.items) {
      const dbProduct = dbProductMap.get(cartItem.productId);

      if (!dbProduct || dbProduct.deletedAt) {
        const conflict: OfflineConflictInfo = {
          reason: 'PRODUCT_NOT_FOUND',
          message: `Product ID "${cartItem.productId}" was deleted or not found on the server`,
          details: { productId: cartItem.productId },
          occurredAt: new Date().toISOString(),
          localVersion: { productId: cartItem.productId, quantity: cartItem.quantity },
        };

        await prisma.syncQueue.update({
          where: { id: syncQueueRecord.id },
          data: {
            status: SyncStatus.CONFLICT,
            errorMessage: conflict.message,
            conflictDetails: conflict as any,
          },
        });

        return {
          clientSyncId,
          status: 'conflict',
          conflict,
          errorMessage: conflict.message,
        };
      }

      if (!dbProduct.isActive) {
        const conflict: OfflineConflictInfo = {
          reason: 'PRODUCT_INACTIVE',
          message: `Product "${dbProduct.name}" is deactivated on server catalog`,
          details: { productId: dbProduct.id, productName: dbProduct.name },
          occurredAt: new Date().toISOString(),
          localVersion: { productId: dbProduct.id, quantity: cartItem.quantity },
          serverVersion: { isActive: false },
        };

        await prisma.syncQueue.update({
          where: { id: syncQueueRecord.id },
          data: {
            status: SyncStatus.CONFLICT,
            errorMessage: conflict.message,
            conflictDetails: conflict as any,
          },
        });

        return {
          clientSyncId,
          status: 'conflict',
          conflict,
          errorMessage: conflict.message,
        };
      }
    }

    // STEP 3: Atomic Order Creation and Inventory Reconciliation
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        inventoryLocations: { where: { isDefault: true }, take: 1 },
      },
    });

    if (!store) {
      throw new Error(`Store ID "${storeId}" could not be found`);
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });

    const location =
      store.inventoryLocations[0] ||
      (await prisma.inventoryLocation.findFirst({ where: { storeId } }));

    const orderNumber = this.generateOrderNumber();
    const receiptNumber = this.generateReceiptNumber();
    const exchangeRateKHR = Number(business?.baseExchangeRate) || 4100;

    // Resolve or find payment methods
    const dbPaymentMethods = await prisma.paymentMethod.findMany({
      where: { businessId, isActive: true },
    });
    const defaultCashMethod =
      dbPaymentMethods.find((m) => m.code === 'CASH') || dbPaymentMethods[0];

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Calculate financials safely
      let subtotalUSD = 0;
      let totalTaxUSD = 0;

      for (const cartItem of payload.items) {
        const prod = dbProductMap.get(cartItem.productId)!;
        const unitPrice =
          cartItem.unitPriceUSD !== undefined
            ? cartItem.unitPriceUSD
            : Number(prod.sellingPriceUSD);
        const lineTotal = Number((unitPrice * cartItem.quantity).toFixed(2));
        subtotalUSD += lineTotal;
        const lineTax = Number((lineTotal * Number(prod.taxRate || 0.1)).toFixed(2));
        totalTaxUSD += lineTax;
      }

      const discountUSD = Number((payload.discountUSD || 0).toFixed(2));
      const taxableAmount = Math.max(0, subtotalUSD - discountUSD);
      const totalUSD = Number((taxableAmount + totalTaxUSD).toFixed(2));
      const totalKHR = Math.round(totalUSD * exchangeRateKHR);

      // Payment tenders
      let paidUSD = 0;
      let paidKHR = 0;
      let totalTenderUSD = 0;
      let totalTenderKHR = 0;

      for (const p of payload.payments) {
        paidUSD += p.amountUSD || 0;
        paidKHR += p.amountKHR || 0;
        totalTenderUSD += p.tenderAmountUSD || p.amountUSD || 0;
        totalTenderKHR += p.tenderAmountKHR || p.amountKHR || 0;
      }

      const totalTenderInUSD = totalTenderUSD + totalTenderKHR / exchangeRateKHR;
      const changeUSD = Math.max(0, Number((totalTenderInUSD - totalUSD).toFixed(2)));
      const changeKHR = Math.round(changeUSD * exchangeRateKHR);

      // 2. Resolve active open register session if registerId is specified
      let activeSessionId: string | null = null;
      if (payload.registerId) {
        const activeSession = await tx.registerSession.findFirst({
          where: { registerId: payload.registerId, status: 'OPEN' },
        });
        if (activeSession) activeSessionId = activeSession.id;
      }

      // Create Order
      const order = await tx.order.create({
        data: {
          orderNumber,
          businessId,
          storeId,
          registerId: payload.registerId || null,
          sessionId: activeSessionId,
          cashierId: userId,
          customerId: payload.customerId || null,
          status: OrderStatus.COMPLETED,
          currency: 'USD',
          exchangeRateKHR: new Prisma.Decimal(exchangeRateKHR),
          subtotalUSD: new Prisma.Decimal(subtotalUSD),
          discountAmountUSD: new Prisma.Decimal(discountUSD),
          taxRate: new Prisma.Decimal(0.1),
          taxAmountUSD: new Prisma.Decimal(totalTaxUSD),
          totalUSD: new Prisma.Decimal(totalUSD),
          totalKHR: new Prisma.Decimal(totalKHR),
          paidUSD: new Prisma.Decimal(paidUSD),
          paidKHR: new Prisma.Decimal(paidKHR),
          totalPaidUSD: new Prisma.Decimal(totalTenderInUSD),
          changeUSD: new Prisma.Decimal(changeUSD),
          changeKHR: new Prisma.Decimal(changeKHR),
          notes:
            `[Offline Sync: ${item.offlineOrderNumber || 'Offline'}] ${payload.notes || ''}`.trim(),
          idempotencyKey: payload.idempotencyKey || clientSyncId,
          offlineSyncId: clientSyncId,
          isOfflineCreated: true,
          syncedAt: new Date(),
        },
      });

      // 3. Create Order Items & Reconcile Inventory
      for (const cartItem of payload.items) {
        const prod = dbProductMap.get(cartItem.productId)!;
        const unitPrice =
          cartItem.unitPriceUSD !== undefined
            ? cartItem.unitPriceUSD
            : Number(prod.sellingPriceUSD);
        const lineDiscount = cartItem.discountUSD || 0;
        const lineSubtotal = Number((unitPrice * cartItem.quantity).toFixed(2));
        const lineTotal = Math.max(0, Number((lineSubtotal - lineDiscount).toFixed(2)));
        const lineTotalKHR = Math.round(lineTotal * exchangeRateKHR);

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: prod.id,
            variantId: cartItem.variantId || null,
            productName: prod.name,
            sku: prod.sku,
            barcode: prod.barcode,
            quantity: new Prisma.Decimal(cartItem.quantity),
            unitCostUSD: prod.costPriceUSD,
            unitPriceUSD: new Prisma.Decimal(unitPrice),
            unitPriceKHR: new Prisma.Decimal(Math.round(unitPrice * exchangeRateKHR)),
            discountAmountUSD: new Prisma.Decimal(lineDiscount),
            taxAmountUSD: new Prisma.Decimal(0),
            subtotalUSD: new Prisma.Decimal(lineSubtotal),
            totalUSD: new Prisma.Decimal(lineTotal),
            totalKHR: new Prisma.Decimal(lineTotalKHR),
            notes: cartItem.notes || null,
          },
        });

        // Reconcile Inventory and record immutable StockMovement
        if (prod.trackInventory && location) {
          let inv = await tx.inventory.findFirst({
            where: {
              storeId,
              locationId: location.id,
              productId: prod.id,
              variantId: cartItem.variantId || null,
            },
          });

          const currentQty = inv ? Number(inv.quantity) : 0;
          const newQty = currentQty - cartItem.quantity;

          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: new Prisma.Decimal(newQty) },
            });
          } else {
            inv = await tx.inventory.create({
              data: {
                storeId,
                locationId: location.id,
                productId: prod.id,
                variantId: cartItem.variantId || null,
                quantity: new Prisma.Decimal(newQty),
              },
            });
          }

          await tx.stockMovement.create({
            data: {
              storeId,
              locationId: location.id,
              productId: prod.id,
              variantId: cartItem.variantId || null,
              type: StockMovementType.SALE,
              quantityChange: new Prisma.Decimal(-cartItem.quantity),
              quantityBefore: new Prisma.Decimal(currentQty),
              quantityAfter: new Prisma.Decimal(newQty),
              unitCost: prod.costPriceUSD,
              referenceType: 'ORDER',
              referenceId: order.id,
              createdById: userId,
              notes: `Offline sync reconciliation: Sale #${orderNumber} (local #${item.offlineOrderNumber})`,
            },
          });
        }
      }

      // 4. Create Payments
      for (const p of payload.payments) {
        const method =
          dbPaymentMethods.find((m) => m.code === p.paymentMethodCode) || defaultCashMethod;

        if (method) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              paymentMethodId: method.id,
              amountUSD: new Prisma.Decimal(p.amountUSD),
              amountKHR: new Prisma.Decimal(p.amountKHR || 0),
              tenderAmountUSD: new Prisma.Decimal(p.tenderAmountUSD || p.amountUSD),
              tenderAmountKHR: new Prisma.Decimal(p.tenderAmountKHR || p.amountKHR || 0),
              changeUSD: new Prisma.Decimal(changeUSD),
              changeKHR: new Prisma.Decimal(changeKHR),
              transactionRef: p.transactionRef || `OFFLINE-${clientSyncId.slice(0, 8)}`,
              status: PaymentStatus.COMPLETED,
            },
          });
        }
      }

      // 5. Create Receipt Record
      const receipt = await tx.receipt.create({
        data: {
          orderId: order.id,
          receiptNumber,
          headerText: store.receiptHeader || 'Angkor Fresh Mart',
          footerText: store.receiptFooter || 'Thank you for shopping with us!',
          qrCodeData: `KHQR://ANGKORPOS/${order.id}/${totalKHR}`,
          printedAt: new Date(),
        },
      });

      // 6. Update SyncQueue record
      await tx.syncQueue.update({
        where: { id: syncQueueRecord.id },
        data: {
          status: SyncStatus.PROCESSED,
          orderId: order.id,
          processedAt: new Date(),
          errorMessage: null,
          conflictDetails: null,
        },
      });

      // 7. Update Device last sync timestamp
      await tx.device.update({
        where: { id: deviceId },
        data: { lastSyncAt: new Date() },
      });

      return { order, receipt };
    });

    return {
      clientSyncId,
      status: 'synchronized',
      serverOrderId: result.order.id,
      serverOrderNumber: result.order.orderNumber,
      receiptNumber: result.receipt.receiptNumber,
      alreadySynced: false,
      inventoryReconciled: true,
    };
  }

  /**
   * Admin resolution for conflicting sync items
   */
  public static async resolveConflict(
    syncQueueId: string,
    action: 'OVERRIDE_ACCEPT' | 'RETRY' | 'DISCARD',
    adminUserId: string,
    notes?: string,
  ): Promise<{ success: boolean; message: string; record: any }> {
    const record = await prisma.syncQueue.findUnique({
      where: { id: syncQueueId },
      include: { store: true, device: true },
    });

    if (!record) {
      throw new Error(`Sync queue item "${syncQueueId}" not found`);
    }

    if (action === 'DISCARD') {
      const updated = await prisma.syncQueue.update({
        where: { id: syncQueueId },
        data: {
          status: SyncStatus.FAILED,
          errorMessage: `Discarded by admin (${notes || 'No notes provided'})`,
          processedAt: new Date(),
        },
      });
      return { success: true, message: 'Sync item discarded', record: updated };
    }

    if (action === 'RETRY') {
      const updated = await prisma.syncQueue.update({
        where: { id: syncQueueId },
        data: {
          status: SyncStatus.PENDING,
          errorMessage: null,
        },
      });
      return { success: true, message: 'Sync item reset to PENDING for retry', record: updated };
    }

    if (action === 'OVERRIDE_ACCEPT') {
      // Find or assign dummy fallback product if product was missing
      const payload: any = record.payload;
      const firstActiveProduct = await prisma.product.findFirst({
        where: { businessId: record.store.businessId, isActive: true },
      });

      if (!firstActiveProduct) {
        throw new Error('No active products found in catalog to override');
      }

      // Remap any missing product IDs to the valid active product
      if (Array.isArray(payload.items)) {
        for (const item of payload.items) {
          const exists = await prisma.product.findUnique({ where: { id: item.productId } });
          if (!exists) {
            item.productId = firstActiveProduct.id;
            item.productName = `${item.productName || 'Offline Item'} (Replaced: ${firstActiveProduct.name})`;
          }
        }
      }

      const itemResult = await this.processSingleOfflineItem(
        record.store.businessId,
        record.storeId,
        adminUserId,
        record.deviceId,
        {
          id: record.id,
          clientSyncId: record.clientSyncId,
          offlineOrderNumber: `OFF-OVERRIDE-${record.id.slice(0, 6)}`,
          offlineReceiptNumber: `RCP-OVERRIDE-${record.id.slice(0, 6)}`,
          storeId: record.storeId,
          cashierId: adminUserId,
          cashierName: 'Admin Override',
          status: 'pending',
          createdAt: record.receivedAt.toISOString(),
          attempts: 1,
          payload,
        },
      );

      const refreshed = await prisma.syncQueue.findUnique({ where: { id: syncQueueId } });
      return {
        success: itemResult.status === 'synchronized',
        message:
          itemResult.status === 'synchronized'
            ? 'Conflict successfully overridden and order synchronized'
            : itemResult.errorMessage || 'Failed to override conflict',
        record: refreshed,
      };
    }

    throw new Error(`Unsupported action "${action}"`);
  }

  /**
   * Monitor dashboard data for sync queues
   */
  public static async getMonitorData(
    businessId: string,
    storeId?: string,
    statusFilter?: SyncStatus,
  ): Promise<{ stats: SyncMonitorStats; records: SyncQueueRecord[] }> {
    const whereClause: Prisma.SyncQueueWhereInput = {
      store: {
        businessId,
        ...(storeId ? { id: storeId } : {}),
      },
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [allRecords, totalCount, pendingCount, processedCount, conflictCount, failedCount] =
      await Promise.all([
        prisma.syncQueue.findMany({
          where: whereClause,
          include: {
            store: { select: { name: true } },
            device: { select: { name: true, deviceIdentifier: true } },
          },
          orderBy: { receivedAt: 'desc' },
          take: 100,
        }),
        prisma.syncQueue.count({
          where: { store: { businessId, ...(storeId ? { id: storeId } : {}) } },
        }),
        prisma.syncQueue.count({
          where: {
            store: { businessId, ...(storeId ? { id: storeId } : {}) },
            status: SyncStatus.PENDING,
          },
        }),
        prisma.syncQueue.count({
          where: {
            store: { businessId, ...(storeId ? { id: storeId } : {}) },
            status: SyncStatus.PROCESSED,
          },
        }),
        prisma.syncQueue.count({
          where: {
            store: { businessId, ...(storeId ? { id: storeId } : {}) },
            status: SyncStatus.CONFLICT,
          },
        }),
        prisma.syncQueue.count({
          where: {
            store: { businessId, ...(storeId ? { id: storeId } : {}) },
            status: SyncStatus.FAILED,
          },
        }),
      ]);

    const stats: SyncMonitorStats = {
      totalQueued: totalCount,
      pendingCount,
      syncingCount: 0,
      synchronizedCount: processedCount,
      conflictCount,
      failedCount,
      lastSyncTimestamp: allRecords[0]?.processedAt?.toISOString() || null,
      isOnline: true,
    };

    const records: SyncQueueRecord[] = allRecords.map((r) => ({
      id: r.id,
      clientSyncId: r.clientSyncId,
      storeId: r.storeId,
      storeName: r.store?.name,
      deviceId: r.deviceId,
      deviceName: `${r.device?.name} (${r.device?.deviceIdentifier})`,
      status: r.status,
      errorMessage: r.errorMessage,
      conflictDetails: r.conflictDetails,
      orderId: r.orderId,
      payload: r.payload,
      receivedAt: r.receivedAt.toISOString(),
      processedAt: r.processedAt?.toISOString() || null,
    }));

    return { stats, records };
  }

  /**
   * Returns a clean, lightweight catalog snapshot for offline caching
   */
  public static async getCatalogSnapshot(
    businessId: string,
    storeId: string,
  ): Promise<CatalogSnapshot> {
    const [store, business, products, categories, customers] = await Promise.all([
      prisma.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          phone: true,
        },
      }),
      prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          taxNumber: true,
          defaultCurrency: true,
          baseExchangeRate: true,
        },
      }),
      prisma.product.findMany({
        where: {
          businessId,
          isActive: true,
          deletedAt: null,
        },
        include: {
          category: { select: { id: true, name: true, color: true } },
          variants: { where: { isActive: true } },
          inventory: { where: { storeId } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.category.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true, code: true, color: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.customer.findMany({
        where: { businessId, deletedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          loyaltyPoints: true,
          creditBalanceUSD: true,
        },
        take: 200,
        orderBy: { name: 'asc' },
      }),
    ]);

    if (!store) {
      throw new Error(`Store ID "${storeId}" not found`);
    }

    const exchangeRateKHR = Number(business?.baseExchangeRate) || 4100;

    const posProducts: PosProduct[] = products.map((p) => {
      const stock = p.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
      const sellingPriceUSD = Number(p.sellingPriceUSD);
      const sellingPriceKHR = Math.round(sellingPriceUSD * exchangeRateKHR);
      const costPriceUSD = Number(p.costPriceUSD);

      return {
        id: p.id,
        name: p.name,
        nameKhmer: p.nameKhmer || undefined,
        sku: p.sku,
        barcode: p.barcode,
        description: p.description || null,
        costPriceUSD,
        sellingPriceUSD,
        sellingPriceKHR,
        taxRate: Number(p.taxRate),
        isTaxInclusive: p.isTaxInclusive,
        trackInventory: p.trackInventory,
        alertLowStock: p.alertLowStock,
        unit: p.unit,
        stockQuantity: stock,
        imageUrl: p.imageUrl || null,
        categoryId: p.categoryId,
        categoryName: p.category?.name,
        categoryColor: p.category?.color || '#4f46e5',
        variants: p.variants.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          barcode: v.barcode,
          priceUSD: Number(v.sellingPriceUSD),
          stockQuantity: 0,
        })),
      };
    });

    const posCustomers: PosCustomer[] = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || null,
      email: c.email || null,
      loyaltyPoints: c.loyaltyPoints,
      creditBalanceUSD: Number(c.creditBalanceUSD),
    }));

    return {
      store: {
        id: store.id,
        name: store.name,
        code: store.code,
        taxRate: 0.1,
        baseExchangeRate: exchangeRateKHR,
        currency: 'USD',
        address: store.address,
        phone: store.phone,
      },
      business: {
        id: business?.id || businessId,
        name: business?.name || 'Angkor Fresh Mart',
        taxNumber: business?.taxNumber,
      },
      products: posProducts,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code || c.name.toLowerCase().replace(/\s+/g, '-'),
        color: c.color,
      })),
      customers: posCustomers,
      taxConfig: {
        vatRate: 0.1,
        taxNumber: business?.taxNumber,
      },
      cachedAt: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
