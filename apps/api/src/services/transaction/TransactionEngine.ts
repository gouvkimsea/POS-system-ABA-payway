import { prisma } from '../../db/index.js';
import { Prisma, StockMovementType, OrderStatus, PaymentStatus } from '@prisma/client';
import {
  CheckoutInput,
  CheckoutResult,
  AddPaymentInput,
  VoidOrderInput,
  RefundOrderInput,
  CancelOrderInput,
} from '@pos/types';
import { FinancialCalculator } from './FinancialCalculator.js';
import { IdempotencyManager } from './IdempotencyManager.js';
import { paymentRegistry } from '../payment/PaymentRegistry.js';
import { logger } from '../../logger/index.js';

export class TransactionEngineError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
    public details?: any,
  ) {
    super(message);
    this.name = 'TransactionEngineError';
  }
}

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const hex = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${date}-${hex}${rand.toString().slice(-2)}`;
}

function generateReceiptNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const hex = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RCP-${date}-${hex}${rand.toString().slice(-2)}`;
}

export class TransactionEngine {
  /**
   * Complete Checkout Workflow with 15-step transaction execution
   */
  public static async checkout(
    input: CheckoutInput,
    user: { userId: string; businessId: string; storeId?: string | null },
  ): Promise<CheckoutResult> {
    const idempotencyKey = input.idempotencyKey?.trim();

    // STEP 1: Idempotency & Double-Click Protection
    if (idempotencyKey) {
      // 1a. Check if order was already completed for this key
      const cached = await IdempotencyManager.getCompletedResult<CheckoutResult>(idempotencyKey);
      if (cached) {
        logger.info(`[TransactionEngine] Returning cached order for idempotencyKey: ${idempotencyKey}`);
        return cached;
      }

      const existingOrder = await prisma.order.findUnique({
        where: { idempotencyKey },
        include: {
          items: true,
          payments: { include: { paymentMethod: true } },
          receipt: true,
          customer: true,
        },
      });

      if (existingOrder) {
        logger.info(`[TransactionEngine] Returning existing DB order for idempotencyKey: ${idempotencyKey}`);
        return this.formatOrderResult(existingOrder);
      }

      // 1b. Acquire in-flight lock to protect against rapid double-clicks
      const lockAcquired = await IdempotencyManager.acquireLock(idempotencyKey, 20);
      if (!lockAcquired) {
        throw new TransactionEngineError(
          'DUPLICATE_IN_FLIGHT',
          'A transaction is currently processing with this idempotency key. Duplicate attempt blocked.',
          409,
        );
      }
    }

    try {
      // STEP 2: Resolve Store & Register Context
      const storeId =
        input.storeId ||
        user.storeId ||
        (await prisma.store.findFirst({ where: { businessId: user.businessId, isActive: true } }))
          ?.id;

      if (!storeId) {
        throw new TransactionEngineError('STORE_REQUIRED', 'Store could not be resolved', 400);
      }

      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) {
        throw new TransactionEngineError('STORE_NOT_FOUND', `Store ${storeId} not found`, 404);
      }

      const business = await prisma.business.findUnique({ where: { id: user.businessId } });
      const exchangeRateKHR = Number(business?.baseExchangeRate || 4100.0);

      let location = await prisma.inventoryLocation.findFirst({
        where: { storeId, isDefault: true, isActive: true },
      });
      if (!location) {
        location = await prisma.inventoryLocation.findFirst({
          where: { storeId, isActive: true },
        });
      }

      // STEP 3-7: Calculate Subtotal, Tax, Discounts, Totals via Server Financial Calculator
      const breakdown = await FinancialCalculator.calculate({
        items: input.items,
        businessId: user.businessId,
        discountCode: input.discountCode,
        discountUSD: input.discountUSD,
        exchangeRateKHR,
      });

      // STEP 8-10: Process Payment Methods via Payment Abstraction Layer
      const processedPayments: any[] = [];
      let totalEffectivePaidUSD = 0;
      let totalEffectivePaidKHR = 0;
      let totalTenderUSD = 0;
      let totalTenderKHR = 0;

      for (const payInput of input.payments) {
        const provider = paymentRegistry.get(payInput.paymentMethodCode);

        // Call payment provider abstraction
        const result = await provider.processPayment({
          paymentMethodCode: payInput.paymentMethodCode,
          amountUSD: payInput.amountUSD,
          amountKHR: payInput.amountKHR,
          tenderAmountUSD: payInput.tenderAmountUSD,
          tenderAmountKHR: payInput.tenderAmountKHR,
          exchangeRateKHR,
          transactionRef: payInput.transactionRef,
          metadata: payInput.metadata,
        });

        if (!result.success || result.status === 'FAILED') {
          throw new TransactionEngineError(
            result.errorCode || 'PAYMENT_FAILED',
            result.errorMessage || `Payment failed for method: ${provider.name}`,
            400,
            { gatewayResponse: result.gatewayResponse },
          );
        }

        // Find or resolve PaymentMethod database ID
        const dbMethod = await prisma.paymentMethod.findFirst({
          where: { businessId: user.businessId, code: payInput.paymentMethodCode },
        });

        if (!dbMethod) {
          throw new TransactionEngineError(
            'PAYMENT_METHOD_NOT_FOUND',
            `Payment method ${payInput.paymentMethodCode} is not configured in this store`,
            400,
          );
        }

        totalEffectivePaidUSD += result.amountUSD;
        totalEffectivePaidKHR += result.amountKHR;
        totalTenderUSD += result.tenderAmountUSD;
        totalTenderKHR += result.tenderAmountKHR;

        processedPayments.push({
          paymentMethodId: dbMethod.id,
          methodCode: dbMethod.code,
          methodName: dbMethod.name,
          result,
        });
      }

      totalEffectivePaidUSD = Number(totalEffectivePaidUSD.toFixed(2));

      // Validate payment coverage
      const orderTotalUSD = breakdown.totalUSD;
      let changeUSD = 0;
      let changeKHR = 0;
      let orderStatus: OrderStatus = OrderStatus.PAID;

      if (totalEffectivePaidUSD >= orderTotalUSD) {
        // Covered in full (Exact payment or Overpayment)
        // Change is calculated from combined cash/tender overpayment
        const combinedTenderUSD = totalTenderUSD + totalTenderKHR / exchangeRateKHR;
        if (combinedTenderUSD > orderTotalUSD) {
          changeUSD = Math.max(0, Number((combinedTenderUSD - orderTotalUSD).toFixed(2)));
          changeKHR = Math.round(changeUSD * exchangeRateKHR);
        }
        orderStatus = OrderStatus.PAID;
      } else {
        // Underpayment check
        if (!input.allowPartialPayment) {
          throw new TransactionEngineError(
            'UNDERPAYMENT_ERROR',
            `Tendered payment ($${totalEffectivePaidUSD.toFixed(2)}) is less than total amount due ($${orderTotalUSD.toFixed(2)}). Partial payment was not requested.`,
            400,
            {
              totalDueUSD: orderTotalUSD,
              totalPaidUSD: totalEffectivePaidUSD,
              remainingUSD: Number((orderTotalUSD - totalEffectivePaidUSD).toFixed(2)),
            },
          );
        }
        orderStatus = OrderStatus.PARTIALLY_PAID;
      }

      // STEP 11-15: Database Transaction Execution
      const orderNumber = generateOrderNumber();
      const receiptNumber = generateReceiptNumber();

      const createdOrder = await prisma.$transaction(async (tx: any) => {
        // 11. Create Order
        const order = await tx.order.create({
          data: {
            orderNumber,
            idempotencyKey: idempotencyKey || null,
            businessId: user.businessId,
            storeId,
            registerId: input.registerId || null,
            cashierId: user.userId,
            customerId: input.customerId || null,
            status: orderStatus,
            currency: 'USD',
            exchangeRateKHR: new Prisma.Decimal(exchangeRateKHR),
            subtotalUSD: new Prisma.Decimal(breakdown.subtotalUSD),
            discountAmountUSD: new Prisma.Decimal(breakdown.effectiveDiscountUSD),
            taxRate: new Prisma.Decimal(breakdown.taxRate),
            taxAmountUSD: new Prisma.Decimal(breakdown.taxUSD),
            totalUSD: new Prisma.Decimal(breakdown.totalUSD),
            totalKHR: new Prisma.Decimal(breakdown.totalKHR),
            paidUSD: new Prisma.Decimal(totalEffectivePaidUSD),
            paidKHR: new Prisma.Decimal(totalEffectivePaidKHR),
            totalPaidUSD: new Prisma.Decimal(totalTenderUSD + totalTenderKHR / exchangeRateKHR),
            changeUSD: new Prisma.Decimal(changeUSD),
            changeKHR: new Prisma.Decimal(changeKHR),
            notes: input.notes || null,
          },
        });

        // 12. Create Order Items & Decrement Inventory
        for (const item of breakdown.items) {
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              sku: item.sku,
              barcode: item.barcode,
              quantity: new Prisma.Decimal(item.quantity),
              unitCostUSD: new Prisma.Decimal(item.costPriceUSD),
              unitPriceUSD: new Prisma.Decimal(item.unitPriceUSD),
              unitPriceKHR: new Prisma.Decimal(Math.round(item.unitPriceUSD * exchangeRateKHR)),
              discountAmountUSD: new Prisma.Decimal(item.lineDiscountUSD),
              taxAmountUSD: new Prisma.Decimal(0),
              subtotalUSD: new Prisma.Decimal(item.lineSubtotalUSD),
              totalUSD: new Prisma.Decimal(item.lineTotalUSD),
              totalKHR: new Prisma.Decimal(item.lineTotalKHR),
              notes: item.notes || null,
            },
          });

          // Deduct inventory if tracking is enabled
          if (item.trackInventory && location) {
            let inv = await tx.inventory.findFirst({
              where: {
                storeId,
                locationId: location.id,
                productId: item.productId,
                variantId: item.variantId || null,
              },
            });

            const currentQty = inv ? Number(inv.quantity) : 0;
            const newQty = currentQty - item.quantity;

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
                  productId: item.productId,
                  variantId: item.variantId || null,
                  quantity: new Prisma.Decimal(newQty),
                },
              });
            }

            // Create immutable stock movement record
            await tx.stockMovement.create({
              data: {
                storeId,
                locationId: location.id,
                productId: item.productId,
                variantId: item.variantId || null,
                type: StockMovementType.SALE,
                quantityChange: new Prisma.Decimal(-item.quantity),
                quantityBefore: new Prisma.Decimal(currentQty),
                quantityAfter: new Prisma.Decimal(newQty),
                unitCost: new Prisma.Decimal(item.costPriceUSD),
                referenceType: 'ORDER',
                referenceId: order.id,
                createdById: user.userId,
                notes: `POS checkout sale #${orderNumber}`,
              },
            });
          }
        }

        // 13. Create Payment Records
        for (const pp of processedPayments) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              paymentMethodId: pp.paymentMethodId,
              amountUSD: new Prisma.Decimal(pp.result.amountUSD),
              amountKHR: new Prisma.Decimal(pp.result.amountKHR),
              tenderAmountUSD: new Prisma.Decimal(pp.result.tenderAmountUSD),
              tenderAmountKHR: new Prisma.Decimal(pp.result.tenderAmountKHR),
              changeUSD: new Prisma.Decimal(pp.result.changeUSD),
              changeKHR: new Prisma.Decimal(pp.result.changeKHR),
              transactionRef: pp.result.transactionRef,
              gatewayResponse: pp.result.gatewayResponse ? pp.result.gatewayResponse : undefined,
              status: PaymentStatus.COMPLETED,
            },
          });
        }

        // 14. Create Receipt Record
        const receipt = await tx.receipt.create({
          data: {
            orderId: order.id,
            receiptNumber,
            headerText: store.receiptHeader || 'Angkor Fresh Mart - Thank You!',
            footerText: store.receiptFooter || 'Goods sold are refundable within 7 days with receipt.',
            qrCodeData: `AFM-PAY:${orderNumber}:${breakdown.totalUSD}`,
          },
        });

        // 15. Record Audit Information
        await tx.auditLog.create({
          data: {
            businessId: user.businessId,
            storeId,
            userId: user.userId,
            action: orderStatus === OrderStatus.PAID ? 'ORDER_COMPLETED' : 'ORDER_PARTIALLY_PAID',
            entityType: 'Order',
            entityId: order.id,
            details: {
              orderNumber,
              receiptNumber,
              totalUSD: breakdown.totalUSD,
              paidUSD: totalEffectivePaidUSD,
              status: orderStatus,
              itemCount: breakdown.items.length,
            },
          },
        });

        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: {
            items: true,
            payments: { include: { paymentMethod: true } },
            receipt: true,
            customer: true,
          },
        });
      });

      const formatted = this.formatOrderResult(createdOrder);

      // Cache idempotent result
      if (idempotencyKey) {
        await IdempotencyManager.saveCompletedResult(idempotencyKey, formatted);
      }

      return formatted;
    } finally {
      if (idempotencyKey) {
        await IdempotencyManager.releaseLock(idempotencyKey);
      }
    }
  }

  /**
   * Add a payment to an existing PARTIALLY_PAID order
   */
  public static async addPayment(
    orderId: string,
    input: AddPaymentInput,
    user: { userId: string; businessId: string; storeId?: string | null },
  ): Promise<CheckoutResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: { include: { paymentMethod: true } },
        items: true,
        receipt: true,
        customer: true,
      },
    });

    if (!order) {
      throw new TransactionEngineError('ORDER_NOT_FOUND', `Order ${orderId} not found`, 404);
    }

    if (order.status !== OrderStatus.PARTIALLY_PAID && order.status !== OrderStatus.PENDING) {
      throw new TransactionEngineError(
        'ORDER_NOT_PAYABLE',
        `Cannot add payment to order with status ${order.status}`,
        400,
      );
    }

    const payInput = input.payment;
    const provider = paymentRegistry.get(payInput.paymentMethodCode);

    const result = await provider.processPayment({
      paymentMethodCode: payInput.paymentMethodCode,
      amountUSD: payInput.amountUSD,
      amountKHR: payInput.amountKHR,
      tenderAmountUSD: payInput.tenderAmountUSD,
      tenderAmountKHR: payInput.tenderAmountKHR,
      exchangeRateKHR: Number(order.exchangeRateKHR),
      transactionRef: payInput.transactionRef,
      metadata: payInput.metadata,
      orderNumber: order.orderNumber,
    });

    if (!result.success || result.status === 'FAILED') {
      throw new TransactionEngineError(
        result.errorCode || 'PAYMENT_FAILED',
        result.errorMessage || `Payment failed for method: ${provider.name}`,
        400,
      );
    }

    const dbMethod = await prisma.paymentMethod.findFirst({
      where: { businessId: user.businessId, code: payInput.paymentMethodCode },
    });

    if (!dbMethod) {
      throw new TransactionEngineError(
        'PAYMENT_METHOD_NOT_FOUND',
        `Payment method ${payInput.paymentMethodCode} not found`,
        400,
      );
    }

    const updatedOrder = await prisma.$transaction(async (tx: any) => {
      // 1. Create payment record
      await tx.payment.create({
        data: {
          orderId: order.id,
          paymentMethodId: dbMethod.id,
          amountUSD: new Prisma.Decimal(result.amountUSD),
          amountKHR: new Prisma.Decimal(result.amountKHR),
          tenderAmountUSD: new Prisma.Decimal(result.tenderAmountUSD),
          tenderAmountKHR: new Prisma.Decimal(result.tenderAmountKHR),
          changeUSD: new Prisma.Decimal(result.changeUSD),
          changeKHR: new Prisma.Decimal(result.changeKHR),
          transactionRef: result.transactionRef,
          status: PaymentStatus.COMPLETED,
        },
      });

      // 2. Recalculate totals
      const newPaidUSD = Number(order.paidUSD) + result.amountUSD;
      const newPaidKHR = Number(order.paidKHR) + result.amountKHR;
      const totalUSD = Number(order.totalUSD);

      let newStatus: OrderStatus = OrderStatus.PARTIALLY_PAID;
      let newChangeUSD = Number(order.changeUSD);
      let newChangeKHR = Number(order.changeKHR);

      if (newPaidUSD >= totalUSD) {
        newStatus = OrderStatus.PAID;
        newChangeUSD = Math.max(0, Number((newPaidUSD - totalUSD).toFixed(2)));
        newChangeKHR = Math.round(newChangeUSD * Number(order.exchangeRateKHR));
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          paidUSD: new Prisma.Decimal(newPaidUSD),
          paidKHR: new Prisma.Decimal(newPaidKHR),
          changeUSD: new Prisma.Decimal(newChangeUSD),
          changeKHR: new Prisma.Decimal(newChangeKHR),
          status: newStatus,
        },
      });

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          storeId: order.storeId,
          userId: user.userId,
          action: newStatus === OrderStatus.PAID ? 'ORDER_COMPLETED' : 'PAYMENT_ADDED',
          entityType: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            additionalPaidUSD: result.amountUSD,
            totalPaidUSD: newPaidUSD,
            newStatus,
          },
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: {
          items: true,
          payments: { include: { paymentMethod: true } },
          receipt: true,
          customer: true,
        },
      });
    });

    return this.formatOrderResult(updatedOrder);
  }

  /**
   * Void an order, reverse inventory, and mark payments voided
   */
  public static async voidOrder(
    orderId: string,
    input: VoidOrderInput,
    user: { userId: string; businessId: string },
  ): Promise<{ success: boolean; orderId: string; status: OrderStatus }> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });

    if (!order) {
      throw new TransactionEngineError('ORDER_NOT_FOUND', `Order ${orderId} not found`, 404);
    }

    if (order.status === OrderStatus.VOIDED || order.status === OrderStatus.REFUNDED) {
      throw new TransactionEngineError(
        'ORDER_ALREADY_CLOSED',
        `Cannot void order that is already ${order.status}`,
        400,
      );
    }

    // Default floor location for stock restoration
    const location = await prisma.inventoryLocation.findFirst({
      where: { storeId: order.storeId, isActive: true },
    });

    await prisma.$transaction(async (tx: any) => {
      // 1. Update order status to VOIDED
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.VOIDED, notes: `[VOIDED: ${input.reason}] ${order.notes || ''}`.trim() },
      });

      // 2. Mark payments as VOIDED
      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: { status: PaymentStatus.VOIDED },
      });

      // 3. Restore inventory items
      if (location) {
        for (const item of order.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product?.trackInventory) {
            let inv = await tx.inventory.findFirst({
              where: {
                storeId: order.storeId,
                locationId: location.id,
                productId: item.productId,
                variantId: item.variantId,
              },
            });

            const currentQty = inv ? Number(inv.quantity) : 0;
            const newQty = currentQty + Number(item.quantity);

            if (inv) {
              await tx.inventory.update({
                where: { id: inv.id },
                data: { quantity: new Prisma.Decimal(newQty) },
              });
            } else {
              inv = await tx.inventory.create({
                data: {
                  storeId: order.storeId,
                  locationId: location.id,
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: new Prisma.Decimal(newQty),
                },
              });
            }

            // Record reversal movement
            await tx.stockMovement.create({
              data: {
                storeId: order.storeId,
                locationId: location.id,
                productId: item.productId,
                variantId: item.variantId,
                type: StockMovementType.RETURN,
                quantityChange: item.quantity,
                quantityBefore: new Prisma.Decimal(currentQty),
                quantityAfter: new Prisma.Decimal(newQty),
                unitCost: item.unitCostUSD,
                referenceType: 'VOID_ORDER',
                referenceId: order.id,
                createdById: user.userId,
                notes: `Void order #${order.orderNumber}: ${input.reason}`,
              },
            });
          }
        }
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          storeId: order.storeId,
          userId: user.userId,
          action: 'ORDER_VOIDED',
          entityType: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            reason: input.reason,
            totalUSD: Number(order.totalUSD),
          },
        },
      });
    });

    return { success: true, orderId: order.id, status: OrderStatus.VOIDED };
  }

  /**
   * Refund an order (partial or full)
   */
  public static async refundOrder(
    orderId: string,
    input: RefundOrderInput,
    user: { userId: string; businessId: string },
  ): Promise<{ success: boolean; orderId: string; status: OrderStatus; refundAmountUSD: number }> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payments: true },
    });

    if (!order) {
      throw new TransactionEngineError('ORDER_NOT_FOUND', `Order ${orderId} not found`, 404);
    }

    if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.COMPLETED) {
      throw new TransactionEngineError(
        'ORDER_NOT_REFUNDABLE',
        `Cannot refund order with status ${order.status}`,
        400,
      );
    }

    const maxRefundUSD = Number(order.paidUSD);
    if (input.amountUSD > maxRefundUSD) {
      throw new TransactionEngineError(
        'REFUND_EXCEEDS_PAID',
        `Refund amount ($${input.amountUSD}) exceeds total amount paid ($${maxRefundUSD})`,
        400,
      );
    }

    const isFullRefund = Math.abs(input.amountUSD - maxRefundUSD) < 0.01;
    const newStatus = isFullRefund ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED;

    const location = await prisma.inventoryLocation.findFirst({
      where: { storeId: order.storeId, isActive: true },
    });

    await prisma.$transaction(async (tx: any) => {
      // 1. Update order status
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          notes: `[REFUNDED $${input.amountUSD.toFixed(2)}: ${input.reason}] ${order.notes || ''}`.trim(),
        },
      });

      // 2. Mark payments as refunded
      await tx.payment.updateMany({
        where: { orderId: order.id },
        data: { status: PaymentStatus.REFUNDED },
      });

      // 3. Return items to stock if requested
      if (input.returnToInventory && location) {
        for (const item of order.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (product?.trackInventory) {
            let inv = await tx.inventory.findFirst({
              where: {
                storeId: order.storeId,
                locationId: location.id,
                productId: item.productId,
                variantId: item.variantId,
              },
            });

            const currentQty = inv ? Number(inv.quantity) : 0;
            const newQty = currentQty + Number(item.quantity);

            if (inv) {
              await tx.inventory.update({
                where: { id: inv.id },
                data: { quantity: new Prisma.Decimal(newQty) },
              });
            }

            await tx.stockMovement.create({
              data: {
                storeId: order.storeId,
                locationId: location.id,
                productId: item.productId,
                variantId: item.variantId,
                type: StockMovementType.RETURN,
                quantityChange: item.quantity,
                quantityBefore: new Prisma.Decimal(currentQty),
                quantityAfter: new Prisma.Decimal(newQty),
                unitCost: item.unitCostUSD,
                referenceType: 'REFUND_ORDER',
                referenceId: order.id,
                createdById: user.userId,
                notes: `Refund order #${order.orderNumber}: ${input.reason}`,
              },
            });
          }
        }
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          storeId: order.storeId,
          userId: user.userId,
          action: isFullRefund ? 'ORDER_REFUNDED' : 'ORDER_PARTIALLY_REFUNDED',
          entityType: 'Order',
          entityId: order.id,
          details: {
            orderNumber: order.orderNumber,
            refundAmountUSD: input.amountUSD,
            reason: input.reason,
            returnToInventory: input.returnToInventory,
          },
        },
      });
    });

    return {
      success: true,
      orderId: order.id,
      status: newStatus,
      refundAmountUSD: input.amountUSD,
    };
  }

  /**
   * Cancel a pending order
   */
  public static async cancelOrder(
    orderId: string,
    input: CancelOrderInput,
    user: { userId: string; businessId: string },
  ): Promise<{ success: boolean; orderId: string; status: OrderStatus }> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new TransactionEngineError('ORDER_NOT_FOUND', `Order ${orderId} not found`, 404);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new TransactionEngineError(
        'ORDER_NOT_PENDING',
        `Only pending orders can be cancelled. Current status is ${order.status}`,
        400,
      );
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, notes: `[CANCELLED: ${input.reason}]` },
      });

      await tx.auditLog.create({
        data: {
          businessId: user.businessId,
          storeId: order.storeId,
          userId: user.userId,
          action: 'ORDER_CANCELLED',
          entityType: 'Order',
          entityId: order.id,
          details: { orderNumber: order.orderNumber, reason: input.reason },
        },
      });
    });

    return { success: true, orderId: order.id, status: OrderStatus.CANCELLED };
  }

  /**
   * Format Order into standardized CheckoutResult DTO
   */
  private static formatOrderResult(order: any): CheckoutResult {
    const subtotalUSD = Number(order.subtotalUSD);
    const discountUSD = Number(order.discountAmountUSD);
    const taxUSD = Number(order.taxAmountUSD);
    const totalUSD = Number(order.totalUSD);
    const totalKHR = Number(order.totalKHR);
    const paidUSD = Number(order.paidUSD);
    const paidKHR = Number(order.paidKHR);
    const changeUSD = Number(order.changeUSD);
    const changeKHR = Number(order.changeKHR);
    const remainingUSD = Math.max(0, Number((totalUSD - paidUSD).toFixed(2)));
    const remainingKHR = Math.round(remainingUSD * Number(order.exchangeRateKHR));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      receiptNumber: order.receipt?.receiptNumber || `RCP-${order.orderNumber.replace('ORD-', '')}`,
      status: order.status as OrderStatus,
      subtotalUSD,
      discountUSD,
      taxUSD,
      taxRate: Number(order.taxRate || 0.1),
      totalUSD,
      totalKHR,
      paidUSD,
      paidKHR,
      remainingUSD,
      remainingKHR,
      changeUSD,
      changeKHR,
      createdAt: order.createdAt.toISOString(),
      idempotencyKey: order.idempotencyKey,
      customer: order.customer
        ? {
            id: order.customer.id,
            name: order.customer.name,
            phone: order.customer.phone,
            email: order.customer.email,
            loyaltyPoints: order.customer.loyaltyPoints,
            creditBalanceUSD: Number(order.customer.creditBalanceUSD || 0),
          }
        : null,
      items: order.items.map((i: any) => ({
        productId: i.productId,
        variantId: i.variantId,
        productName: i.productName,
        sku: i.sku,
        barcode: i.barcode,
        quantity: Number(i.quantity),
        unitPriceUSD: Number(i.unitPriceUSD),
        discountUSD: Number(i.discountAmountUSD),
        subtotalUSD: Number(i.subtotalUSD),
        totalUSD: Number(i.totalUSD),
        totalKHR: Number(i.totalKHR),
      })),
      payments: order.payments.map((p: any) => ({
        id: p.id,
        paymentMethodCode: p.paymentMethod?.code || 'UNKNOWN',
        paymentMethodName: p.paymentMethod?.name || 'Payment',
        amountUSD: Number(p.amountUSD),
        amountKHR: Number(p.amountKHR),
        tenderAmountUSD: Number(p.tenderAmountUSD),
        tenderAmountKHR: Number(p.tenderAmountKHR),
        changeUSD: Number(p.changeUSD),
        changeKHR: Number(p.changeKHR),
        transactionRef: p.transactionRef,
        status: p.status as PaymentStatus,
      })),
      receipt: {
        id: order.receipt?.id || '',
        receiptNumber: order.receipt?.receiptNumber || '',
        headerText: order.receipt?.headerText || null,
        footerText: order.receipt?.footerText || null,
        qrCodeData: order.receipt?.qrCodeData || null,
      },
    };
  }
}
