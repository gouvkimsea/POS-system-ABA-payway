import { prisma } from '../../db/index.js';
import {
  Prisma,
  ReturnStatus,
  RefundStatus,
  ReturnReason,
  StockMovementType,
  OrderStatus,
  CashMovementType,
} from '@prisma/client';
import {
  ProcessReturnRefundInput,
  ReturnRecord,
  RefundRecord,
  OrderRefundEligibility,
} from '@pos/types';
import { logger } from '../../logger/index.js';

export class ReturnRefundServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ReturnRefundServiceError';
  }
}

function generateReturnNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const hex = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `RET-${date}-${hex}${rand.toString().slice(-2)}`;
}

function generateRefundNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const hex = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `REF-${date}-${hex}${rand.toString().slice(-2)}`;
}

export class ReturnRefundService {
  /**
   * Check order refund eligibility and calculate limits to prevent over-refunding
   */
  public static async getOrderRefundEligibility(
    businessId: string,
    orderIdOrNumber: string,
  ): Promise<OrderRefundEligibility> {
    const order = await prisma.order.findFirst({
      where: {
        businessId,
        OR: [{ id: orderIdOrNumber }, { orderNumber: orderIdOrNumber }],
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new ReturnRefundServiceError('ORDER_NOT_FOUND', `Order not found`, 404);
    }

    if (order.status === OrderStatus.VOIDED || order.status === OrderStatus.CANCELLED) {
      throw new ReturnRefundServiceError(
        'ORDER_NOT_REFUNDABLE',
        `Cannot refund an order with status ${order.status}`,
        400,
      );
    }

    const totalPaidUSD = Number(order.totalPaidUSD);
    const refundedAmountUSD = Number(order.refundedAmountUSD);
    const maxRefundableUSD = Math.max(
      0,
      Math.round((totalPaidUSD - refundedAmountUSD) * 100) / 100,
    );

    const items = order.items.map((item) => {
      const purchasedQty = Number(item.quantity);
      const refundedQty = Number(item.refundedQuantity);
      const maxReturnableQty = Math.max(0, purchasedQty - refundedQty);

      return {
        orderItemId: item.id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        purchasedQuantity: purchasedQty,
        alreadyRefundedQuantity: refundedQty,
        maxReturnableQuantity: maxReturnableQty,
        unitPriceUSD: Number(item.unitPriceUSD),
        unitPriceKHR: Number(item.unitPriceKHR),
        taxAmountUSD: Number(item.taxAmountUSD),
      };
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      customerId: order.customerId,
      customerName: order.customer?.name || null,
      totalUSD: Number(order.totalUSD),
      totalPaidUSD,
      refundedAmountUSD,
      maxRefundableUSD,
      items,
    };
  }

  /**
   * Process item-level and full-order return and refund with inventory restoration
   * and strict over-refund / over-return guardrails.
   */
  public static async processReturnRefund(
    businessId: string,
    userId: string,
    input: ProcessReturnRefundInput,
  ): Promise<{
    returnRecord: ReturnRecord;
    refundRecord: RefundRecord;
    orderStatus: OrderStatus;
  }> {
    // 1. Fetch Order with items, customer, store, and existing returns
    const order = await prisma.order.findFirst({
      where: {
        id: input.orderId,
        businessId,
      },
      include: {
        customer: true,
        store: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new ReturnRefundServiceError(
        'ORDER_NOT_FOUND',
        `Order ${input.orderId} not found`,
        404,
      );
    }

    if (order.status === OrderStatus.VOIDED || order.status === OrderStatus.CANCELLED) {
      throw new ReturnRefundServiceError(
        'ORDER_NOT_REFUNDABLE',
        `Cannot refund an order with status ${order.status}`,
        400,
      );
    }

    if (!input.items || input.items.length === 0) {
      throw new ReturnRefundServiceError(
        'NO_ITEMS_SELECTED',
        'At least one item must be specified for return/refund',
        400,
      );
    }

    // 2. Validate Payment Method for Refund
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        businessId,
        code: input.refundMethodCode,
        isActive: true,
      },
    });

    if (!paymentMethod) {
      throw new ReturnRefundServiceError(
        'INVALID_PAYMENT_METHOD',
        `Refund payment method '${input.refundMethodCode}' is invalid or inactive`,
        400,
      );
    }

    // 3. Validate Each Returned Item to Prevent Over-Returning
    const itemsMap = new Map(order.items.map((i) => [i.id, i]));
    let returnSubtotalUSD = 0;
    const returnTaxUSD = 0;
    const validatedItems: Array<{
      orderItem: (typeof order.items)[0];
      quantity: number;
      itemTotalUSD: number;
      itemTotalKHR: number;
      restockInventory: boolean;
      condition: string;
      notes: string | null;
    }> = [];

    const exchangeRateKHR = Number(order.exchangeRateKHR) || 4100;

    for (const itemInput of input.items) {
      const orderItem = itemsMap.get(itemInput.orderItemId);
      if (!orderItem) {
        throw new ReturnRefundServiceError(
          'INVALID_ORDER_ITEM',
          `Order item ${itemInput.orderItemId} does not belong to this order`,
          400,
        );
      }

      if (itemInput.quantity <= 0) {
        throw new ReturnRefundServiceError(
          'INVALID_QUANTITY',
          `Return quantity for ${orderItem.productName} must be greater than zero`,
          400,
        );
      }

      const purchasedQty = Number(orderItem.quantity);
      const previouslyRefundedQty = Number(orderItem.refundedQuantity);
      const remainingReturnableQty = purchasedQty - previouslyRefundedQty;

      if (itemInput.quantity > remainingReturnableQty + 0.0001) {
        throw new ReturnRefundServiceError(
          'OVER_RETURN_EXCEEDED',
          `Cannot return ${itemInput.quantity} of ${orderItem.productName}. Maximum returnable quantity is ${remainingReturnableQty} (originally purchased: ${purchasedQty}, previously returned: ${previouslyRefundedQty})`,
          400,
        );
      }

      const unitPrice = Number(orderItem.unitPriceUSD);
      const itemSubtotal = unitPrice * itemInput.quantity;
      const itemTotalUSD = Math.round(itemSubtotal * 100) / 100;
      const itemTotalKHR = Math.round(itemTotalUSD * exchangeRateKHR);

      returnSubtotalUSD += itemTotalUSD;

      validatedItems.push({
        orderItem,
        quantity: itemInput.quantity,
        itemTotalUSD,
        itemTotalKHR,
        restockInventory: itemInput.restockInventory ?? true,
        condition: itemInput.condition || 'RESELLABLE',
        notes: itemInput.notes || null,
      });
    }

    const calculatedRefundUSD = Math.round((returnSubtotalUSD + returnTaxUSD) * 100) / 100;
    const calculatedRefundKHR = Math.round(calculatedRefundUSD * exchangeRateKHR);

    // 4. Over-Refund Protection against Order Paid Balance
    const orderPaidUSD = Number(order.totalPaidUSD);
    const existingRefundedUSD = Number(order.refundedAmountUSD);
    const maxAllowableRefundUSD = Math.round((orderPaidUSD - existingRefundedUSD) * 100) / 100;

    if (calculatedRefundUSD > maxAllowableRefundUSD + 0.01) {
      throw new ReturnRefundServiceError(
        'OVER_REFUND_EXCEEDED',
        `Refund amount ($${calculatedRefundUSD.toFixed(2)}) exceeds maximum refundable balance ($${maxAllowableRefundUSD.toFixed(2)}). Total paid: $${orderPaidUSD.toFixed(2)}, Already refunded: $${existingRefundedUSD.toFixed(2)}.`,
        400,
      );
    }

    // 5. Default Floor Location for Restocking
    const location = await prisma.inventoryLocation.findFirst({
      where: { storeId: order.storeId, isActive: true },
    });

    const returnNumber = generateReturnNumber();
    const refundNumber = generateRefundNumber();

    // 6. Check Active Register Session if Cash Refund
    let targetSessionId = input.sessionId || order.sessionId || null;
    if (paymentMethod.code === 'CASH' && !targetSessionId) {
      const activeSession = await prisma.registerSession.findFirst({
        where: {
          cashierId: userId,
          status: 'OPEN',
        },
      });
      if (activeSession) {
        targetSessionId = activeSession.id;
      }
    }

    // 7. Atomic Database Transaction: Return + ReturnItems + Stock Movements + Refund + Order Update
    const result = await prisma.$transaction(async (tx: any) => {
      // 7a. Create Return Record (Relationship: Original Sale -> Return)
      const returnRecord = await tx.return.create({
        data: {
          returnNumber,
          businessId,
          storeId: order.storeId,
          orderId: order.id,
          customerId: order.customerId,
          processedById: userId,
          status: ReturnStatus.COMPLETED,
          reason: input.reason as ReturnReason,
          reasonNotes: input.reasonNotes || null,
          subtotalUSD: new Prisma.Decimal(returnSubtotalUSD),
          taxAmountUSD: new Prisma.Decimal(returnTaxUSD),
          totalUSD: new Prisma.Decimal(calculatedRefundUSD),
          totalKHR: new Prisma.Decimal(calculatedRefundKHR),
        },
      });

      // 7b. Create ReturnItem records & Update OrderItem refunded quantities & update Inventory
      const createdReturnItems = [];
      for (const vItem of validatedItems) {
        const returnItem = await tx.returnItem.create({
          data: {
            returnId: returnRecord.id,
            orderItemId: vItem.orderItem.id,
            productId: vItem.orderItem.productId,
            variantId: vItem.orderItem.variantId,
            quantity: new Prisma.Decimal(vItem.quantity),
            unitPriceUSD: new Prisma.Decimal(vItem.orderItem.unitPriceUSD),
            unitPriceKHR: new Prisma.Decimal(vItem.orderItem.unitPriceKHR),
            taxAmountUSD: new Prisma.Decimal(0),
            totalUSD: new Prisma.Decimal(vItem.itemTotalUSD),
            totalKHR: new Prisma.Decimal(vItem.itemTotalKHR),
            restockInventory: vItem.restockInventory,
            condition: vItem.condition,
            notes: vItem.notes,
          },
        });
        createdReturnItems.push(returnItem);

        // Update OrderItem refunded quantity
        await tx.orderItem.update({
          where: { id: vItem.orderItem.id },
          data: {
            refundedQuantity: {
              increment: new Prisma.Decimal(vItem.quantity),
            },
          },
        });

        // Inventory Updates
        if (vItem.orderItem.product.trackInventory && location) {
          if (vItem.restockInventory) {
            // Restock to inventory
            let inv = await tx.inventory.findFirst({
              where: {
                storeId: order.storeId,
                locationId: location.id,
                productId: vItem.orderItem.productId,
                variantId: vItem.orderItem.variantId,
              },
            });

            const currentQty = inv ? Number(inv.quantity) : 0;
            const newQty = currentQty + vItem.quantity;

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
                  productId: vItem.orderItem.productId,
                  variantId: vItem.orderItem.variantId,
                  quantity: new Prisma.Decimal(newQty),
                },
              });
            }

            // Create StockMovement of type RETURN
            await tx.stockMovement.create({
              data: {
                storeId: order.storeId,
                locationId: location.id,
                productId: vItem.orderItem.productId,
                variantId: vItem.orderItem.variantId,
                type: StockMovementType.RETURN,
                quantityChange: new Prisma.Decimal(vItem.quantity),
                quantityBefore: new Prisma.Decimal(currentQty),
                quantityAfter: new Prisma.Decimal(newQty),
                unitCost: vItem.orderItem.unitCostUSD,
                referenceType: 'RETURN',
                referenceId: returnRecord.id,
                createdById: userId,
                notes: `Return #${returnNumber} for Order #${order.orderNumber} (${input.reason})`,
              },
            });
          } else {
            // Damaged/Defective - not restocked into sellable inventory, record damage audit
            const inv = await tx.inventory.findFirst({
              where: {
                storeId: order.storeId,
                locationId: location.id,
                productId: vItem.orderItem.productId,
                variantId: vItem.orderItem.variantId,
              },
            });
            const currentQty = inv ? Number(inv.quantity) : 0;

            await tx.stockMovement.create({
              data: {
                storeId: order.storeId,
                locationId: location.id,
                productId: vItem.orderItem.productId,
                variantId: vItem.orderItem.variantId,
                type: StockMovementType.DAMAGE,
                quantityChange: new Prisma.Decimal(0),
                quantityBefore: new Prisma.Decimal(currentQty),
                quantityAfter: new Prisma.Decimal(currentQty),
                unitCost: vItem.orderItem.unitCostUSD,
                referenceType: 'RETURN_DAMAGED',
                referenceId: returnRecord.id,
                createdById: userId,
                notes: `Returned as ${vItem.condition} without restock for Order #${order.orderNumber}`,
              },
            });
          }
        }
      }

      // 7c. Create Refund Record (Relationship: Return -> Refund)
      const refundRecord = await tx.refund.create({
        data: {
          refundNumber,
          businessId,
          storeId: order.storeId,
          orderId: order.id,
          returnId: returnRecord.id,
          paymentMethodId: paymentMethod.id,
          sessionId: targetSessionId,
          processedById: userId,
          amountUSD: new Prisma.Decimal(calculatedRefundUSD),
          amountKHR: new Prisma.Decimal(calculatedRefundKHR),
          reason: input.reasonNotes || input.reason,
          status: RefundStatus.COMPLETED,
        },
      });

      // 7d. Update Customer Credit if customer credit refund
      if (paymentMethod.code === 'CUSTOMER_CREDIT' && order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            creditBalanceUSD: {
              increment: new Prisma.Decimal(calculatedRefundUSD),
            },
          },
        });
      }

      // 7e. Adjust Register Session if Cash Refund
      if (paymentMethod.code === 'CASH' && targetSessionId) {
        await tx.registerSession.update({
          where: { id: targetSessionId },
          data: {
            expectedCashUSD: {
              decrement: new Prisma.Decimal(calculatedRefundUSD),
            },
            expectedCashKHR: {
              decrement: new Prisma.Decimal(calculatedRefundKHR),
            },
          },
        });

        // Record CashMovement
        await tx.cashMovement.create({
          data: {
            sessionId: targetSessionId,
            cashierId: userId,
            type: CashMovementType.PAY_OUT,
            amountUSD: new Prisma.Decimal(calculatedRefundUSD),
            amountKHR: new Prisma.Decimal(calculatedRefundKHR),
            reason: `Refund #${refundNumber} for Order #${order.orderNumber}`,
            referenceNumber: refundNumber,
          },
        });
      }

      // 7f. Update Original Order (NEVER DELETE THE ORIGINAL SALE!)
      const newTotalRefundedUSD = existingRefundedUSD + calculatedRefundUSD;
      const isCompletelyRefunded = newTotalRefundedUSD >= orderPaidUSD - 0.01;
      const newOrderStatus = isCompletelyRefunded
        ? OrderStatus.REFUNDED
        : OrderStatus.PARTIALLY_REFUNDED;

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: newOrderStatus,
          refundedAmountUSD: {
            increment: new Prisma.Decimal(calculatedRefundUSD),
          },
          refundedAmountKHR: {
            increment: new Prisma.Decimal(calculatedRefundKHR),
          },
          notes:
            `[REFUNDED $${calculatedRefundUSD.toFixed(2)} (${input.reason}) on ${new Date().toLocaleDateString()}] ${order.notes || ''}`.trim(),
        },
      });

      // 7g. Record Audit Log
      await tx.auditLog.create({
        data: {
          businessId,
          storeId: order.storeId,
          userId,
          action: 'ORDER_REFUNDED',
          entityType: 'Return',
          entityId: returnRecord.id,
          details: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            returnNumber,
            refundNumber,
            refundAmountUSD: calculatedRefundUSD,
            refundMethod: paymentMethod.name,
            reason: input.reason,
            newOrderStatus,
          },
        },
      });

      return {
        returnRecord,
        createdReturnItems,
        refundRecord,
        newOrderStatus,
      };
    });

    // 8. Fetch complete hydrated return and refund objects for response
    const hydratedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    const returnDto: ReturnRecord = {
      id: result.returnRecord.id,
      returnNumber: result.returnRecord.returnNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customer?.name || null,
      processedById: userId,
      processedByName: hydratedUser?.fullName || 'Staff',
      status: result.returnRecord.status,
      reason: result.returnRecord.reason,
      reasonNotes: result.returnRecord.reasonNotes,
      subtotalUSD: Number(result.returnRecord.subtotalUSD),
      taxAmountUSD: Number(result.returnRecord.taxAmountUSD),
      totalUSD: Number(result.returnRecord.totalUSD),
      totalKHR: Number(result.returnRecord.totalKHR),
      items: validatedItems.map((vi, idx) => ({
        id: result.createdReturnItems[idx]?.id || '',
        returnId: result.returnRecord.id,
        orderItemId: vi.orderItem.id,
        productId: vi.orderItem.productId,
        productName: vi.orderItem.productName,
        sku: vi.orderItem.sku,
        quantity: vi.quantity,
        unitPriceUSD: Number(vi.orderItem.unitPriceUSD),
        unitPriceKHR: Number(vi.orderItem.unitPriceKHR),
        taxAmountUSD: 0,
        totalUSD: vi.itemTotalUSD,
        totalKHR: vi.itemTotalKHR,
        restockInventory: vi.restockInventory,
        condition: vi.condition,
        notes: vi.notes,
        createdAt: result.returnRecord.createdAt.toISOString(),
      })),
      refunds: [
        {
          id: result.refundRecord.id,
          refundNumber: result.refundRecord.refundNumber,
          orderId: order.id,
          returnId: result.returnRecord.id,
          paymentMethodCode: paymentMethod.code,
          paymentMethodName: paymentMethod.name,
          amountUSD: Number(result.refundRecord.amountUSD),
          amountKHR: Number(result.refundRecord.amountKHR),
          reason: result.refundRecord.reason,
          transactionRef: result.refundRecord.transactionRef,
          status: result.refundRecord.status,
          processedById: userId,
          processedByName: hydratedUser?.fullName || 'Staff',
          sessionId: targetSessionId,
          createdAt: result.refundRecord.createdAt.toISOString(),
        },
      ],
      createdAt: result.returnRecord.createdAt.toISOString(),
    };

    const refundDto: RefundRecord = {
      id: result.refundRecord.id,
      refundNumber: result.refundRecord.refundNumber,
      orderId: order.id,
      returnId: result.returnRecord.id,
      paymentMethodCode: paymentMethod.code,
      paymentMethodName: paymentMethod.name,
      amountUSD: Number(result.refundRecord.amountUSD),
      amountKHR: Number(result.refundRecord.amountKHR),
      reason: result.refundRecord.reason,
      transactionRef: result.refundRecord.transactionRef,
      status: result.refundRecord.status,
      processedById: userId,
      processedByName: hydratedUser?.fullName || 'Staff',
      sessionId: targetSessionId,
      createdAt: result.refundRecord.createdAt.toISOString(),
    };

    logger.info(
      `[ReturnRefundService] Processed Return ${returnNumber} & Refund ${refundNumber} for Order ${order.orderNumber}. Amount: $${calculatedRefundUSD}`,
    );

    return {
      returnRecord: returnDto,
      refundRecord: refundDto,
      orderStatus: result.newOrderStatus,
    };
  }

  /**
   * List return records with filtering
   */
  public static async getReturnsList(
    businessId: string,
    options: {
      storeId?: string;
      orderId?: string;
      customerId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    returns: ReturnRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ReturnWhereInput = { businessId };
    if (options.storeId) where.storeId = options.storeId;
    if (options.orderId) where.orderId = options.orderId;
    if (options.customerId) where.customerId = options.customerId;

    const [total, returns] = await Promise.all([
      prisma.return.count({ where }),
      prisma.return.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { orderNumber: true } },
          customer: { select: { name: true } },
          processedBy: { select: { fullName: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
            },
          },
          refunds: {
            include: {
              paymentMethod: true,
              processedBy: { select: { fullName: true } },
            },
          },
        },
      }),
    ]);

    const mapped: ReturnRecord[] = returns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      customerId: r.customerId,
      customerName: r.customer?.name || null,
      processedById: r.processedById,
      processedByName: r.processedBy.fullName,
      status: r.status,
      reason: r.reason,
      reasonNotes: r.reasonNotes,
      subtotalUSD: Number(r.subtotalUSD),
      taxAmountUSD: Number(r.taxAmountUSD),
      totalUSD: Number(r.totalUSD),
      totalKHR: Number(r.totalKHR),
      items: r.items.map((item) => ({
        id: item.id,
        returnId: item.returnId,
        orderItemId: item.orderItemId,
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: Number(item.quantity),
        unitPriceUSD: Number(item.unitPriceUSD),
        unitPriceKHR: Number(item.unitPriceKHR),
        taxAmountUSD: Number(item.taxAmountUSD),
        totalUSD: Number(item.totalUSD),
        totalKHR: Number(item.totalKHR),
        restockInventory: item.restockInventory,
        condition: item.condition,
        notes: item.notes,
        createdAt: item.createdAt.toISOString(),
      })),
      refunds: r.refunds.map((ref) => ({
        id: ref.id,
        refundNumber: ref.refundNumber,
        orderId: ref.orderId,
        returnId: ref.returnId,
        paymentMethodCode: ref.paymentMethod.code,
        paymentMethodName: ref.paymentMethod.name,
        amountUSD: Number(ref.amountUSD),
        amountKHR: Number(ref.amountKHR),
        reason: ref.reason,
        transactionRef: ref.transactionRef,
        status: ref.status,
        processedById: ref.processedById,
        processedByName: ref.processedBy.fullName,
        sessionId: ref.sessionId,
        createdAt: ref.createdAt.toISOString(),
      })),
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      returns: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get single return by ID
   */
  public static async getReturnById(businessId: string, returnId: string): Promise<ReturnRecord> {
    const r = await prisma.return.findFirst({
      where: { id: returnId, businessId },
      include: {
        order: { select: { orderNumber: true } },
        customer: { select: { name: true } },
        processedBy: { select: { fullName: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
        refunds: {
          include: {
            paymentMethod: true,
            processedBy: { select: { fullName: true } },
          },
        },
      },
    });

    if (!r) {
      throw new ReturnRefundServiceError('RETURN_NOT_FOUND', `Return ${returnId} not found`, 404);
    }

    return {
      id: r.id,
      returnNumber: r.returnNumber,
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      customerId: r.customerId,
      customerName: r.customer?.name || null,
      processedById: r.processedById,
      processedByName: r.processedBy.fullName,
      status: r.status,
      reason: r.reason,
      reasonNotes: r.reasonNotes,
      subtotalUSD: Number(r.subtotalUSD),
      taxAmountUSD: Number(r.taxAmountUSD),
      totalUSD: Number(r.totalUSD),
      totalKHR: Number(r.totalKHR),
      items: r.items.map((item) => ({
        id: item.id,
        returnId: item.returnId,
        orderItemId: item.orderItemId,
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: Number(item.quantity),
        unitPriceUSD: Number(item.unitPriceUSD),
        unitPriceKHR: Number(item.unitPriceKHR),
        taxAmountUSD: Number(item.taxAmountUSD),
        totalUSD: Number(item.totalUSD),
        totalKHR: Number(item.totalKHR),
        restockInventory: item.restockInventory,
        condition: item.condition,
        notes: item.notes,
        createdAt: item.createdAt.toISOString(),
      })),
      refunds: r.refunds.map((ref) => ({
        id: ref.id,
        refundNumber: ref.refundNumber,
        orderId: ref.orderId,
        returnId: ref.returnId,
        paymentMethodCode: ref.paymentMethod.code,
        paymentMethodName: ref.paymentMethod.name,
        amountUSD: Number(ref.amountUSD),
        amountKHR: Number(ref.amountKHR),
        reason: ref.reason,
        transactionRef: ref.transactionRef,
        status: ref.status,
        processedById: ref.processedById,
        processedByName: ref.processedBy.fullName,
        sessionId: ref.sessionId,
        createdAt: ref.createdAt.toISOString(),
      })),
      createdAt: r.createdAt.toISOString(),
    };
  }
}
