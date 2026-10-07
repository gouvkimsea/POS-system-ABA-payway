import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS, PosInitData, PosProduct, PosCartItem, HeldOrderSummary } from '@pos/types';
import {
  checkoutInputSchema,
  createCustomerInputSchema,
  orderCalculationSchema,
  addPaymentSchema,
  voidOrderSchema,
  refundOrderSchema,
  cancelOrderSchema,
} from '@pos/validation';
import { OrderStatus, StockMovementType, PaymentStatus, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { TransactionEngine, TransactionEngineError } from '../services/transaction/TransactionEngine.js';
import { FinancialCalculator } from '../services/transaction/FinancialCalculator.js';
import { paymentRegistry } from '../services/payment/PaymentRegistry.js';

export const posRouter: Router = Router();

// Helper to format order number: ORD-YYYYMMDD-XXXX
function generateOrderNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ORD-${dateStr}-${rand}`;
}

// Helper to format receipt number: RCP-YYYYMMDD-XXXX
function generateReceiptNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `RCP-${dateStr}-${rand}`;
}

/**
 * GET /api/pos/init
 * Initializes the POS register terminal with catalog, categories, customers, and store info
 */
posRouter.get(
  '/init',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const businessId = user.businessId;

      // 1. Resolve store
      let store = user.storeId
        ? await prisma.store.findUnique({ where: { id: user.storeId } })
        : null;

      if (!store) {
        store = await prisma.store.findFirst({
          where: { businessId, isActive: true },
        });
      }

      if (!store) {
        res.status(404).json({
          success: false,
          error: { code: 'STORE_NOT_FOUND', message: 'No active store found for business' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 2. Resolve business
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      });

      // 3. Resolve active cash register
      let register = await prisma.cashRegister.findFirst({
        where: { storeId: store.id, isActive: true },
      });

      if (!register) {
        register = await prisma.cashRegister.create({
          data: {
            storeId: store.id,
            name: 'Counter 01 Main POS',
            code: 'REG-01',
            isActive: true,
          },
        });
      }

      // 4. Fetch Categories with product counts
      const categories = await prisma.category.findMany({
        where: { businessId, isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { products: { where: { isActive: true } } },
          },
        },
      });

      // 5. Fetch Products with current Store Inventory
      const products = await prisma.product.findMany({
        where: { businessId, isActive: true },
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          inventory: {
            where: { storeId: store.id },
            select: { quantity: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Map products to PosProduct DTO
      const mappedProducts: PosProduct[] = products.map((p) => {
        const stockQty = p.inventory.reduce((acc, inv) => acc + Number(inv.quantity), 0);

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          description: p.description,
          costPriceUSD: Number(p.costPriceUSD),
          sellingPriceUSD: Number(p.sellingPriceUSD),
          sellingPriceKHR: Number(p.sellingPriceKHR),
          taxRate: Number(p.taxRate),
          isTaxInclusive: p.isTaxInclusive,
          trackInventory: p.trackInventory,
          alertLowStock: p.alertLowStock,
          unit: p.unit,
          imageUrl: p.imageUrl,
          stockQuantity: stockQty,
          categoryId: p.categoryId,
          categoryName: p.category?.name,
          categoryColor: p.category?.color || '#4f46e5',
        };
      });

      // 6. Fetch Customers
      const customers = await prisma.customer.findMany({
        where: { businessId, deletedAt: null },
        orderBy: { name: 'asc' },
        take: 100,
      });

      // 7. Fetch Payment Methods
      const paymentMethods = await prisma.paymentMethod.findMany({
        where: { businessId, isActive: true },
        orderBy: { isDefault: 'desc' },
      });

      // 8. Fetch Discounts
      const discounts = await prisma.discount.findMany({
        where: { businessId, isActive: true },
      });

      const exchangeRate = Number(business?.baseExchangeRate || 4100.0);

      const initData: PosInitData = {
        business: {
          id: business?.id || businessId,
          name: business?.name || 'Angkor Fresh Mart',
          code: business?.code || 'AFM-01',
          defaultCurrency: business?.defaultCurrency || 'USD',
        },
        store: {
          id: store.id,
          name: store.name,
          code: store.code,
          address: store.address,
          phone: store.phone,
          receiptHeader: store.receiptHeader,
          receiptFooter: store.receiptFooter,
        },
        register: {
          id: register.id,
          name: register.name,
          code: register.code,
        },
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          color: c.color,
          icon: c.icon,
          sortOrder: c.sortOrder,
          productCount: c._count.products,
        })),
        products: mappedProducts,
        customers: customers.map((cust) => ({
          id: cust.id,
          name: cust.name,
          phone: cust.phone,
          email: cust.email,
          loyaltyPoints: cust.loyaltyPoints,
          creditBalanceUSD: Number(cust.creditBalanceUSD),
        })),
        paymentMethods: paymentMethods.map((pm) => ({
          id: pm.id,
          name: pm.name,
          code: pm.code,
          type: pm.type,
          isDefault: pm.isDefault,
        })),
        discounts: discounts.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          type: d.type,
          value: Number(d.value),
        })),
        exchangeRateKHR: exchangeRate,
        taxRate: 0.1, // 10%
      };

      res.status(200).json({
        success: true,
        data: initData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/pos/products
 * Search products by keyword, barcode, or category
 */
posRouter.get(
  '/products',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const businessId = user.businessId;
      const search = (req.query.search as string)?.trim();
      const barcode = (req.query.barcode as string)?.trim();
      const categoryId = req.query.categoryId as string;

      const store = user.storeId
        ? await prisma.store.findUnique({ where: { id: user.storeId } })
        : await prisma.store.findFirst({ where: { businessId, isActive: true } });

      const whereClause: Prisma.ProductWhereInput = {
        businessId,
        isActive: true,
      };

      if (barcode) {
        whereClause.barcode = barcode;
      } else if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (categoryId && categoryId !== 'all') {
        whereClause.categoryId = categoryId;
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          inventory: {
            where: { storeId: store?.id || '' },
            select: { quantity: true },
          },
        },
        orderBy: { name: 'asc' },
        take: 50,
      });

      const mapped: PosProduct[] = products.map((p) => {
        const stockQty = p.inventory.reduce((acc, inv) => acc + Number(inv.quantity), 0);

        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          description: p.description,
          costPriceUSD: Number(p.costPriceUSD),
          sellingPriceUSD: Number(p.sellingPriceUSD),
          sellingPriceKHR: Number(p.sellingPriceKHR),
          taxRate: Number(p.taxRate),
          isTaxInclusive: p.isTaxInclusive,
          trackInventory: p.trackInventory,
          alertLowStock: p.alertLowStock,
          unit: p.unit,
          imageUrl: p.imageUrl,
          stockQuantity: stockQty,
          categoryId: p.categoryId,
          categoryName: p.category?.name,
          categoryColor: p.category?.color || '#4f46e5',
        };
      });

      res.status(200).json({
        success: true,
        data: mapped,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/pos/customers
 * Search customers
 */
posRouter.get(
  '/customers',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const businessId = user.businessId;
      const search = (req.query.search as string)?.trim();

      const whereClause: Prisma.CustomerWhereInput = {
        businessId,
        deletedAt: null,
      };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const customers = await prisma.customer.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
        take: 20,
      });

      res.status(200).json({
        success: true,
        data: customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          loyaltyPoints: c.loyaltyPoints,
          creditBalanceUSD: Number(c.creditBalanceUSD),
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/pos/customers
 * Quick create new customer from checkout
 */
posRouter.post(
  '/customers',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = createCustomerInputSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid customer input',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const customer = await prisma.customer.create({
        data: {
          businessId: user.businessId,
          name: parsed.data.name,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
          loyaltyPoints: 0,
          creditBalanceUSD: 0,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          loyaltyPoints: customer.loyaltyPoints,
          creditBalanceUSD: Number(customer.creditBalanceUSD),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/pos/checkout
 * Process and complete sales transaction using TransactionEngine
 */
posRouter.post(
  '/checkout',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const headerIdempotencyKey = req.header('idempotency-key');
      const payload = { ...req.body };
      if (!payload.idempotencyKey && typeof headerIdempotencyKey === 'string') {
        payload.idempotencyKey = headerIdempotencyKey;
      }

      const parsed = checkoutInputSchema.safeParse(payload);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid checkout payload',
            issues: parsed.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await TransactionEngine.checkout(parsed.data, {
        userId: user.userId,
        businessId: user.businessId,
        storeId: parsed.data.storeId || user.storeId,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof TransactionEngineError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /api/pos/calculate
 * Calculate financial quote (subtotal, line discounts, order discount, tax, totals) server-side
 */
posRouter.post(
  '/calculate',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = orderCalculationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid calculation payload',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const breakdown = await FinancialCalculator.calculate({
        items: parsed.data.items,
        businessId: user.businessId,
        discountCode: parsed.data.discountCode,
        discountUSD: parsed.data.discountUSD,
      });

      res.status(200).json({
        success: true,
        data: FinancialCalculator.toQuote(breakdown),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: error.message || 'Failed to calculate order quote',
        },
        timestamp: new Date().toISOString(),
      });
    }
  },
);

/**
 * GET /api/pos/orders/:id
 * Retrieve full order details by ID
 */
posRouter.get(
  '/orders/:id',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.id as string;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          payments: { include: { paymentMethod: true } },
          receipt: true,
          customer: true,
          cashier: { select: { id: true, fullName: true, username: true } },
        },
      });

      if (!order) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/pos/orders/:id/payments
 * Add payment to a partially paid order
 */
posRouter.post(
  '/orders/:id/payments',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = addPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid payment payload',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const orderId = req.params.id as string;
      const result = await TransactionEngine.addPayment(orderId, parsed.data, {
        userId: user.userId,
        businessId: user.businessId,
        storeId: user.storeId,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof TransactionEngineError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /api/pos/orders/:id/void
 * Void order and reverse stock with mandatory reason
 */
posRouter.post(
  '/orders/:id/void',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_VOID),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = voidOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Void reason is required',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const orderId = req.params.id as string;
      const result = await TransactionEngine.voidOrder(orderId, parsed.data, {
        userId: user.userId,
        businessId: user.businessId,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof TransactionEngineError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /api/pos/orders/:id/refund
 * Refund an order (partial or full) with inventory restock option
 */
posRouter.post(
  '/orders/:id/refund',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_REFUND),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = refundOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid refund request',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const orderId = req.params.id as string;
      const result = await TransactionEngine.refundOrder(orderId, parsed.data, {
        userId: user.userId,
        businessId: user.businessId,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof TransactionEngineError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /api/pos/orders/:id/cancel
 * Cancel a pending order
 */
posRouter.post(
  '/orders/:id/cancel',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_VOID),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = cancelOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Cancel reason is required',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const orderId = req.params.id as string;
      const result = await TransactionEngine.cancelOrder(orderId, parsed.data, {
        userId: user.userId,
        businessId: user.businessId,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error instanceof TransactionEngineError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * GET /api/pos/payment-methods
 * Get all available configured payment methods with provider capability details
 */
posRouter.get(
  '/payment-methods',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const dbMethods = await prisma.paymentMethod.findMany({
        where: { businessId: user.businessId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });

      const enriched = dbMethods.map((pm) => {
        let providerInfo = null;
        try {
          const provider = paymentRegistry.get(pm.code);
          providerInfo = {
            providerName: provider.name,
            providerType: provider.type,
            supportsRefund: !!provider.refundPayment,
            supportsVerification: !!provider.verifyPayment,
          };
        } catch {
          providerInfo = null;
        }

        return {
          id: pm.id,
          name: pm.name,
          code: pm.code,
          type: pm.type,
          isDefault: pm.isDefault,
          config: pm.config,
          provider: providerInfo,
        };
      });

      res.status(200).json({
        success: true,
        data: enriched,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/pos/hold
 * Put current sale on hold
 */
posRouter.post(
  '/hold',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { items, customerId, notes } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_HOLD', message: 'Cannot hold an empty cart' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const storeId =
        user.storeId ||
        (await prisma.store.findFirst({ where: { businessId: user.businessId, isActive: true } }))
          ?.id;

      if (!storeId) {
        res.status(400).json({
          success: false,
          error: { code: 'STORE_REQUIRED', message: 'Valid store could not be resolved' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const orderNumber = `HOLD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      let subtotalUSD = 0;
      const orderItemsData: any[] = [];

      for (const item of items) {
        const unitPrice = Number(item.unitPriceUSD || item.product?.sellingPriceUSD || 0);
        const qty = Number(item.quantity || 1);
        const lineTotal = Number((unitPrice * qty).toFixed(2));
        subtotalUSD += lineTotal;

        orderItemsData.push({
          productId: item.productId || item.product?.id,
          productName: item.productName || item.product?.name || 'Item',
          sku: item.sku || item.product?.sku || 'SKU',
          barcode: item.barcode || item.product?.barcode,
          quantity: new Prisma.Decimal(qty),
          unitCostUSD: new Prisma.Decimal(0),
          unitPriceUSD: new Prisma.Decimal(unitPrice),
          unitPriceKHR: new Prisma.Decimal(Math.round(unitPrice * 4100)),
          discountAmountUSD: new Prisma.Decimal(0),
          taxAmountUSD: new Prisma.Decimal(0),
          subtotalUSD: new Prisma.Decimal(lineTotal),
          totalUSD: new Prisma.Decimal(lineTotal),
          totalKHR: new Prisma.Decimal(Math.round(lineTotal * 4100)),
        });
      }

      const heldOrder = await prisma.order.create({
        data: {
          orderNumber,
          businessId: user.businessId,
          storeId,
          cashierId: user.userId,
          customerId: customerId || null,
          status: OrderStatus.PENDING,
          subtotalUSD: new Prisma.Decimal(subtotalUSD),
          totalUSD: new Prisma.Decimal(subtotalUSD),
          totalKHR: new Prisma.Decimal(Math.round(subtotalUSD * 4100)),
          notes: notes || 'Held Sale',
          items: {
            create: orderItemsData,
          },
        },
      });

      res.status(200).json({
        success: true,
        data: {
          id: heldOrder.id,
          orderNumber: heldOrder.orderNumber,
          totalUSD: Number(heldOrder.totalUSD),
          message: 'Sale successfully placed on hold',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/pos/held-orders
 * List active held orders
 */
posRouter.get(
  '/held-orders',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const businessId = user.businessId;

      const heldOrders = await prisma.order.findMany({
        where: {
          businessId,
          status: OrderStatus.PENDING,
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  barcode: true,
                  sellingPriceUSD: true,
                  sellingPriceKHR: true,
                  imageUrl: true,
                  unit: true,
                  categoryId: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const summaries: HeldOrderSummary[] = heldOrders.map((order) => {
        const cartItems: PosCartItem[] = order.items.map((oi) => ({
          product: {
            id: oi.product.id,
            name: oi.product.name,
            sku: oi.product.sku,
            barcode: oi.product.barcode,
            description: null,
            costPriceUSD: 0,
            sellingPriceUSD: Number(oi.product.sellingPriceUSD),
            sellingPriceKHR: Number(oi.product.sellingPriceKHR),
            taxRate: 0.1,
            isTaxInclusive: true,
            trackInventory: true,
            alertLowStock: 5,
            unit: oi.product.unit,
            imageUrl: oi.product.imageUrl,
            stockQuantity: 99,
            categoryId: oi.product.categoryId,
          },
          quantity: Number(oi.quantity),
          unitPriceUSD: Number(oi.unitPriceUSD),
          unitPriceKHR: Number(oi.unitPriceKHR),
          discountUSD: Number(oi.discountAmountUSD),
          subtotalUSD: Number(oi.subtotalUSD),
          totalUSD: Number(oi.totalUSD),
          totalKHR: Number(oi.totalKHR),
        }));

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: order.customer?.name || null,
          itemCount: order.items.length,
          totalUSD: Number(order.totalUSD),
          totalKHR: Number(order.totalKHR),
          createdAt: order.createdAt.toISOString(),
          notes: order.notes,
          items: cartItems,
        };
      });

      res.status(200).json({
        success: true,
        data: summaries,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/pos/held-orders/:id/recall
 * Recall a held order and remove it from pending state
 */
posRouter.post(
  '/held-orders/:id/recall',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order || order.status !== OrderStatus.PENDING) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Held order not found or not in pending state' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Delete the held order record once recalled
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } });

      const cartItems: PosCartItem[] = order.items.map((oi) => ({
        product: {
          id: oi.product.id,
          name: oi.product.name,
          sku: oi.product.sku,
          barcode: oi.product.barcode,
          description: oi.product.description,
          costPriceUSD: Number(oi.product.costPriceUSD),
          sellingPriceUSD: Number(oi.product.sellingPriceUSD),
          sellingPriceKHR: Number(oi.product.sellingPriceKHR),
          taxRate: Number(oi.product.taxRate),
          isTaxInclusive: oi.product.isTaxInclusive,
          trackInventory: oi.product.trackInventory,
          alertLowStock: oi.product.alertLowStock,
          unit: oi.product.unit,
          imageUrl: oi.product.imageUrl,
          stockQuantity: 99,
          categoryId: oi.product.categoryId,
        },
        quantity: Number(oi.quantity),
        unitPriceUSD: Number(oi.unitPriceUSD),
        unitPriceKHR: Number(oi.unitPriceKHR),
        discountUSD: Number(oi.discountAmountUSD),
        subtotalUSD: Number(oi.subtotalUSD),
        totalUSD: Number(oi.totalUSD),
        totalKHR: Number(oi.totalKHR),
      }));

      res.status(200).json({
        success: true,
        data: {
          items: cartItems,
          customer: order.customer
            ? {
                id: order.customer.id,
                name: order.customer.name,
                phone: order.customer.phone,
                email: order.customer.email,
                loyaltyPoints: order.customer.loyaltyPoints,
                creditBalanceUSD: Number(order.customer.creditBalanceUSD),
              }
            : null,
          notes: order.notes,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/pos/held-orders/:id
 * Delete or cancel a held order
 */
posRouter.delete(
  '/held-orders/:id',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;

      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } });

      res.status(200).json({
        success: true,
        data: { message: 'Held order deleted successfully' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);
