import { prisma } from '../../config/prisma.js';
import { CreateSaleInput, RefundSaleInput } from './sale.schema.js';
import {
  calculateOrderFinancials,
  calculatePaymentAndChange,
  roundUSD,
  roundKHR,
  convertUSDtoKHR,
} from '../../utils/calculator.js';
import {
  SaleStatus,
  StockMovementType,
  PaymentStatus,
  SessionStatus,
  PaymentMethod,
} from '@prisma/client';
import { wsBroadcast } from '../../websocket/socket.js';

export class SaleService {
  static async createSale(
    businessId: string,
    storeId: string,
    cashierId: string,
    input: CreateSaleInput
  ) {
    // 1. Check for offlineSyncId idempotency
    if (input.offlineSyncId) {
      const existingSale = await prisma.sale.findUnique({
        where: { offlineSyncId: input.offlineSyncId },
        include: { items: true, payments: true },
      });
      if (existingSale) {
        return existingSale;
      }
    }

    // 2. Load business details for exchange rate and default tax rate
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw { statusCode: 404, code: 'BUSINESS_NOT_FOUND', message: 'Business not found' };
    }

    const exchangeRateKHR = Number(business.baseExchangeRate);

    // 3. Find active register session for cashier / register
    let sessionId: string | null = null;
    let registerId: string | null = input.registerId || null;

    const activeSession = await prisma.registerSession.findFirst({
      where: {
        cashierId,
        status: SessionStatus.OPEN,
        register: { storeId },
      },
    });

    if (activeSession) {
      sessionId = activeSession.id;
      registerId = activeSession.registerId;
    }

    // 4. Fetch canonical product data from database (DO NOT trust client prices!)
    const productIds = input.items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        businessId,
        isActive: true,
      },
    });

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // Check that all products exist
    for (const item of input.items) {
      if (!productMap.has(item.productId)) {
        throw {
          statusCode: 400,
          code: 'PRODUCT_NOT_FOUND',
          message: `Product with ID ${item.productId} was not found or is inactive`,
        };
      }
    }

    // 5. Run Server-Side Financial Calculations
    const calculationInputItems = input.items.map((item) => {
      const p = productMap.get(item.productId)!;
      return {
        productId: item.productId,
        variantId: item.variantId || null,
        unitPriceUSD: Number(p.sellingPriceUSD),
        quantity: item.quantity,
        discountAmountUSD: item.discountAmountUSD,
        taxRate: Number(p.taxRate),
        isTaxInclusive: p.isTaxInclusive,
      };
    });

    const financialResult = calculateOrderFinancials({
      items: calculationInputItems,
      orderDiscountType: input.discountType as any,
      orderDiscountValue: input.discountValue,
      defaultTaxRate: 0.10,
      exchangeRateKHR,
    });

    // 6. Validate Payments & Tender
    let totalTenderUSD = 0;
    let totalTenderKHR = 0;
    for (const p of input.payments) {
      totalTenderUSD = roundUSD(totalTenderUSD + p.tenderAmountUSD);
      totalTenderKHR = roundKHR(totalTenderKHR + p.tenderAmountKHR);
    }

    const paymentResult = calculatePaymentAndChange({
      totalUSD: financialResult.totalUSD,
      exchangeRateKHR,
      tenderUSD: totalTenderUSD,
      tenderKHR: totalTenderKHR,
    });

    if (!paymentResult.isFullyPaid) {
      throw {
        statusCode: 400,
        code: 'INSUFFICIENT_PAYMENT',
        message: `Total payment tendered ($${paymentResult.totalPaidUSD.toFixed(2)}) is less than total due ($${financialResult.totalUSD.toFixed(2)}). Remaining due: $${paymentResult.remainingDueUSD.toFixed(2)} / ${paymentResult.remainingDueKHR.toLocaleString()} KHR`,
      };
    }

    // 7. Atomic Database Transaction
    return prisma.$transaction(async (tx) => {
      // Generate daily invoice sequence
      const todayPrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.sale.count({
        where: {
          storeId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });
      const invoiceNumber = `INV-${todayPrefix}-${String(countToday + 1).padStart(4, '0')}`;

      // Create Sale
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          businessId,
          storeId,
          registerId,
          sessionId,
          cashierId,
          customerId: input.customerId || null,
          status: SaleStatus.COMPLETED,
          currency: business.defaultCurrency,
          exchangeRateKHR,
          subtotalUSD: financialResult.subtotalUSD,
          discountType: input.discountType,
          discountValue: input.discountValue,
          discountAmountUSD: financialResult.totalDiscountUSD,
          taxRate: financialResult.taxRate,
          taxAmountUSD: financialResult.taxAmountUSD,
          totalUSD: financialResult.totalUSD,
          totalKHR: financialResult.totalKHR,
          paidUSD: paymentResult.tenderUSD,
          paidKHR: paymentResult.tenderKHR,
          totalPaidUSD: paymentResult.totalPaidUSD,
          changeUSD: paymentResult.changeUSD,
          changeKHR: paymentResult.changeKHR,
          notes: input.notes,
          offlineSyncId: input.offlineSyncId || null,
          isOfflineCreated: !!input.offlineSyncId,
          syncedAt: input.offlineSyncId ? new Date() : null,
        },
      });

      // Create Sale Items & Update Stock
      for (const calcItem of financialResult.items) {
        const prod = productMap.get(calcItem.productId)!;

        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: calcItem.productId,
            variantId: calcItem.variantId,
            productName: prod.name,
            sku: prod.sku,
            barcode: prod.barcode,
            unitPriceUSD: calcItem.unitPriceUSD,
            unitPriceKHR: convertUSDtoKHR(calcItem.unitPriceUSD, exchangeRateKHR),
            unitCostUSD: prod.costPrice,
            quantity: calcItem.quantity,
            discountAmountUSD: calcItem.discountAmountUSD,
            taxAmountUSD: calcItem.taxAmountUSD,
            subtotalUSD: calcItem.subtotalUSD,
            totalUSD: calcItem.totalUSD,
            totalKHR: calcItem.totalKHR,
          },
        });

        // Decrement stock if inventory tracking is enabled
        if (prod.trackInventory) {
          const inv = await tx.inventory.findFirst({
            where: {
              storeId,
              productId: prod.id,
              variantId: calcItem.variantId,
            },
          });

          const currentQty = inv ? Number(inv.quantity) : 0;
          const newQty = currentQty - calcItem.quantity;

          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: newQty },
            });
          } else {
            await tx.inventory.create({
              data: {
                storeId,
                productId: prod.id,
                variantId: calcItem.variantId,
                quantity: newQty,
                minStockLevel: prod.alertLowStock,
              },
            });
          }

          // Record stock movement
          await tx.stockMovement.create({
            data: {
              storeId,
              productId: prod.id,
              variantId: calcItem.variantId,
              type: StockMovementType.SALE,
              quantityChange: -calcItem.quantity,
              quantityBefore: currentQty,
              quantityAfter: newQty,
              unitCost: prod.costPrice,
              referenceType: 'SALE',
              referenceId: sale.id,
              notes: `Sale ${sale.invoiceNumber}`,
              createdById: cashierId,
            },
          });
        }
      }

      // Create Payment records
      for (const p of input.payments) {
        await tx.payment.create({
          data: {
            saleId: sale.id,
            method: p.method,
            amountUSD: p.amountUSD,
            amountKHR: p.amountKHR,
            tenderAmountUSD: p.tenderAmountUSD,
            tenderAmountKHR: p.tenderAmountKHR,
            changeUSD: paymentResult.changeUSD,
            changeKHR: paymentResult.changeKHR,
            transactionRef: p.transactionRef,
            status: PaymentStatus.COMPLETED,
          },
        });
      }

      // Update Register Session cash balance if session is open
      if (sessionId) {
        let cashUSDDelta = 0;
        let cashKHRDelta = 0;

        for (const p of input.payments) {
          if (p.method === PaymentMethod.CASH) {
            cashUSDDelta += p.tenderAmountUSD - paymentResult.changeUSD;
            cashKHRDelta += p.tenderAmountKHR - paymentResult.changeKHR;
          }
        }

        const session = await tx.registerSession.findUnique({
          where: { id: sessionId },
        });

        if (session) {
          await tx.registerSession.update({
            where: { id: sessionId },
            data: {
              totalSalesCount: { increment: 1 },
              totalSalesAmountUSD: roundUSD(Number(session.totalSalesAmountUSD) + financialResult.totalUSD),
              totalSalesAmountKHR: roundKHR(Number(session.totalSalesAmountKHR) + financialResult.totalKHR),
              expectedCashUSD: Math.max(0, roundUSD(Number(session.expectedCashUSD) + cashUSDDelta)),
              expectedCashKHR: Math.max(0, roundKHR(Number(session.expectedCashKHR) + cashKHRDelta)),
            },
          });
        }
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          businessId,
          storeId,
          userId: cashierId,
          action: 'SALE_CREATED',
          entityType: 'Sale',
          entityId: sale.id,
          metadata: {
            invoiceNumber: sale.invoiceNumber,
            totalUSD: sale.totalUSD,
            totalKHR: sale.totalKHR,
            itemsCount: input.items.length,
          },
        },
      });

      // Broadcast sale event to WebSocket listeners
      wsBroadcast({
        type: 'SALE_COMPLETED',
        payload: {
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          totalUSD: Number(sale.totalUSD),
          totalKHR: Number(sale.totalKHR),
          storeId,
        },
      });

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: true,
          payments: true,
          customer: true,
          cashier: { select: { id: true, fullName: true, username: true } },
          store: true,
        },
      });
    });
  }

  static async getSaleById(id: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        customer: true,
        cashier: { select: { id: true, fullName: true, username: true } },
        store: true,
        refunds: { include: { items: true } },
      },
    });

    if (!sale) {
      throw { statusCode: 404, code: 'SALE_NOT_FOUND', message: 'Sale not found' };
    }

    return sale;
  }

  static async refundSale(
    saleId: string,
    businessId: string,
    storeId: string,
    userId: string,
    input: RefundSaleInput
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) {
      throw { statusCode: 404, code: 'SALE_NOT_FOUND', message: 'Sale not found' };
    }

    if (sale.status === SaleStatus.REFUNDED) {
      throw { statusCode: 400, code: 'ALREADY_REFUNDED', message: 'Sale has already been completely refunded' };
    }

    const saleItemMap = new Map(sale.items.map((i) => [i.id, i]));

    let totalRefundUSD = 0;
    for (const refItem of input.items) {
      const item = saleItemMap.get(refItem.saleItemId);
      if (!item) {
        throw { statusCode: 400, code: 'ITEM_NOT_FOUND', message: `Item ${refItem.saleItemId} not found on this sale` };
      }
      if (refItem.quantity > Number(item.quantity)) {
        throw { statusCode: 400, code: 'INVALID_QUANTITY', message: `Refund quantity exceeds item quantity` };
      }
      const itemRefund = roundUSD(Number(item.unitPriceUSD) * refItem.quantity);
      totalRefundUSD = roundUSD(totalRefundUSD + itemRefund);
    }

    const totalRefundKHR = convertUSDtoKHR(totalRefundUSD, Number(sale.exchangeRateKHR));

    return prisma.$transaction(async (tx) => {
      const refundCount = await tx.refund.count();
      const refundNumber = `REF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(refundCount + 1).padStart(4, '0')}`;

      const refund = await tx.refund.create({
        data: {
          saleId: sale.id,
          refundNumber,
          processedById: userId,
          totalRefundUSD,
          totalRefundKHR,
          reason: input.reason,
        },
      });

      for (const refItem of input.items) {
        const item = saleItemMap.get(refItem.saleItemId)!;
        const itemRefundUSD = roundUSD(Number(item.unitPriceUSD) * refItem.quantity);

        await tx.refundItem.create({
          data: {
            refundId: refund.id,
            saleItemId: refItem.saleItemId,
            quantity: refItem.quantity,
            refundAmountUSD: itemRefundUSD,
            restockInventory: refItem.restockInventory,
          },
        });

        if (refItem.restockInventory) {
          const inv = await tx.inventory.findFirst({
            where: { storeId, productId: item.productId, variantId: item.variantId },
          });

          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: { quantity: { increment: refItem.quantity } },
            });
          }

          await tx.stockMovement.create({
            data: {
              storeId,
              productId: item.productId,
              variantId: item.variantId,
              type: StockMovementType.REFUND,
              quantityChange: refItem.quantity,
              quantityBefore: inv ? Number(inv.quantity) : 0,
              quantityAfter: (inv ? Number(inv.quantity) : 0) + refItem.quantity,
              unitCost: item.unitCostUSD,
              referenceType: 'REFUND',
              referenceId: refund.id,
              notes: `Refund ${refundNumber}`,
              createdById: userId,
            },
          });
        }
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: totalRefundUSD >= Number(sale.totalUSD) ? SaleStatus.REFUNDED : SaleStatus.PARTIALLY_REFUNDED,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          storeId,
          userId,
          action: 'REFUND_ISSUED',
          entityType: 'Refund',
          entityId: refund.id,
          metadata: { refundNumber, totalRefundUSD, totalRefundKHR, reason: input.reason },
        },
      });

      return refund;
    });
  }

  static async listSales(businessId: string, storeId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { businessId };
    if (storeId) where.storeId = storeId;

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cashier: { select: { fullName: true, username: true } },
          customer: { select: { name: true, phone: true } },
          payments: true,
          _count: { select: { items: true } },
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return {
      items: sales,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
