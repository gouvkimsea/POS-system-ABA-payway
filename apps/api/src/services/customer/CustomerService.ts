import { prisma } from '../../db/index.js';
import { Prisma } from '@prisma/client';
import {
  CustomerProfile,
  CustomerHistoryResponse,
  CustomerPurchaseHistoryOrder,
  CreateCustomerInput,
  UpdateCustomerInput,
} from '@pos/types';
import { logger } from '../../logger/index.js';

export class CustomerServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'CustomerServiceError';
  }
}

export class CustomerService {
  /**
   * List customers with search, pagination, and walk-in filter
   */
  public static async getCustomers(
    businessId: string,
    options: {
      query?: string;
      isWalkIn?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    customers: CustomerProfile[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      businessId,
      deletedAt: null,
    };

    if (options.isWalkIn !== undefined) {
      where.isWalkIn = options.isWalkIn;
    }

    if (options.query && options.query.trim()) {
      const q = options.query.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isWalkIn: 'desc' }, { name: 'asc' }],
        include: {
          orders: {
            select: {
              id: true,
              totalUSD: true,
              totalPaidUSD: true,
              refundedAmountUSD: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
    ]);

    const mapped: CustomerProfile[] = customers.map((c) => {
      const orders = c.orders || [];
      const totalOrdersCount = orders.length;
      const totalSpentUSD = orders.reduce(
        (sum, o) => sum + Math.max(0, Number(o.totalPaidUSD) - Number(o.refundedAmountUSD)),
        0,
      );
      const lastOrderDate = orders[0]?.createdAt ? orders[0].createdAt.toISOString() : null;

      return {
        id: c.id,
        businessId: c.businessId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        notes: c.notes,
        isWalkIn: c.isWalkIn,
        taxNumber: c.taxNumber,
        loyaltyPoints: c.loyaltyPoints,
        creditBalanceUSD: Number(c.creditBalanceUSD),
        totalOrdersCount,
        totalSpentUSD: Math.round(totalSpentUSD * 100) / 100,
        lastOrderDate,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });

    return {
      customers: mapped,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get customer profile by ID
   */
  public static async getCustomerById(
    businessId: string,
    customerId: string,
  ): Promise<CustomerProfile> {
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId,
        deletedAt: null,
      },
      include: {
        orders: {
          select: {
            id: true,
            totalUSD: true,
            totalPaidUSD: true,
            refundedAmountUSD: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      throw new CustomerServiceError(
        'CUSTOMER_NOT_FOUND',
        `Customer with ID ${customerId} not found`,
        404,
      );
    }

    const orders = customer.orders || [];
    const totalOrdersCount = orders.length;
    const totalSpentUSD = orders.reduce(
      (sum, o) => sum + Math.max(0, Number(o.totalPaidUSD) - Number(o.refundedAmountUSD)),
      0,
    );
    const lastOrderDate = orders[0]?.createdAt ? orders[0].createdAt.toISOString() : null;

    return {
      id: customer.id,
      businessId: customer.businessId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      isWalkIn: customer.isWalkIn,
      taxNumber: customer.taxNumber,
      loyaltyPoints: customer.loyaltyPoints,
      creditBalanceUSD: Number(customer.creditBalanceUSD),
      totalOrdersCount,
      totalSpentUSD: Math.round(totalSpentUSD * 100) / 100,
      lastOrderDate,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }

  /**
   * Get or create default Walk-in Customer for a business
   */
  public static async getWalkInCustomer(businessId: string): Promise<CustomerProfile> {
    let walkIn = await prisma.customer.findFirst({
      where: {
        businessId,
        isWalkIn: true,
        deletedAt: null,
      },
      include: {
        orders: {
          select: {
            id: true,
            totalUSD: true,
            totalPaidUSD: true,
            refundedAmountUSD: true,
            createdAt: true,
          },
        },
      },
    });

    if (!walkIn) {
      walkIn = await prisma.customer.create({
        data: {
          businessId,
          name: 'Walk-in Customer',
          phone: null,
          email: null,
          address: null,
          notes: 'Standard Walk-in / Guest Customer',
          isWalkIn: true,
          loyaltyPoints: 0,
          creditBalanceUSD: 0,
        },
        include: {
          orders: {
            select: {
              id: true,
              totalUSD: true,
              totalPaidUSD: true,
              refundedAmountUSD: true,
              createdAt: true,
            },
          },
        },
      });
    }

    const orders = walkIn.orders || [];
    const totalOrdersCount = orders.length;
    const totalSpentUSD = orders.reduce(
      (sum, o) => sum + Math.max(0, Number(o.totalPaidUSD) - Number(o.refundedAmountUSD)),
      0,
    );

    return {
      id: walkIn.id,
      businessId: walkIn.businessId,
      name: walkIn.name,
      phone: walkIn.phone,
      email: walkIn.email,
      address: walkIn.address,
      notes: walkIn.notes,
      isWalkIn: walkIn.isWalkIn,
      taxNumber: walkIn.taxNumber,
      loyaltyPoints: walkIn.loyaltyPoints,
      creditBalanceUSD: Number(walkIn.creditBalanceUSD),
      totalOrdersCount,
      totalSpentUSD: Math.round(totalSpentUSD * 100) / 100,
      lastOrderDate: null,
      createdAt: walkIn.createdAt.toISOString(),
      updatedAt: walkIn.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new customer profile
   */
  public static async createCustomer(
    businessId: string,
    input: CreateCustomerInput,
  ): Promise<CustomerProfile> {
    if (!input.name || !input.name.trim()) {
      throw new CustomerServiceError('VALIDATION_ERROR', 'Customer name is required', 400);
    }

    // Check unique phone if provided
    if (input.phone && input.phone.trim()) {
      const existing = await prisma.customer.findFirst({
        where: {
          businessId,
          phone: input.phone.trim(),
          deletedAt: null,
        },
      });
      if (existing) {
        throw new CustomerServiceError(
          'DUPLICATE_PHONE',
          `A customer with phone number ${input.phone} already exists`,
          409,
        );
      }
    }

    const customer = await prisma.customer.create({
      data: {
        businessId,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
        taxNumber: input.taxNumber?.trim() || null,
        isWalkIn: input.isWalkIn || false,
        loyaltyPoints: 0,
        creditBalanceUSD: 0,
      },
    });

    logger.info(`[CustomerService] Created customer ${customer.id} (${customer.name})`);

    return {
      id: customer.id,
      businessId: customer.businessId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      isWalkIn: customer.isWalkIn,
      taxNumber: customer.taxNumber,
      loyaltyPoints: customer.loyaltyPoints,
      creditBalanceUSD: Number(customer.creditBalanceUSD),
      totalOrdersCount: 0,
      totalSpentUSD: 0,
      lastOrderDate: null,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }

  /**
   * Update an existing customer profile
   */
  public static async updateCustomer(
    businessId: string,
    customerId: string,
    input: UpdateCustomerInput,
  ): Promise<CustomerProfile> {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    });

    if (!existing) {
      throw new CustomerServiceError('CUSTOMER_NOT_FOUND', `Customer ${customerId} not found`, 404);
    }

    // Check duplicate phone if being updated
    if (input.phone && input.phone.trim() && input.phone.trim() !== existing.phone) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          businessId,
          phone: input.phone.trim(),
          id: { not: customerId },
          deletedAt: null,
        },
      });
      if (duplicate) {
        throw new CustomerServiceError(
          'DUPLICATE_PHONE',
          `A customer with phone number ${input.phone} already exists`,
          409,
        );
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,
        phone: input.phone !== undefined ? (input.phone ? input.phone.trim() : null) : undefined,
        email: input.email !== undefined ? (input.email ? input.email.trim() : null) : undefined,
        address:
          input.address !== undefined ? (input.address ? input.address.trim() : null) : undefined,
        notes: input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : undefined,
        taxNumber:
          input.taxNumber !== undefined
            ? input.taxNumber
              ? input.taxNumber.trim()
              : null
            : undefined,
        isWalkIn: input.isWalkIn !== undefined ? input.isWalkIn : undefined,
        loyaltyPoints: input.loyaltyPoints !== undefined ? input.loyaltyPoints : undefined,
        creditBalanceUSD:
          input.creditBalanceUSD !== undefined
            ? new Prisma.Decimal(input.creditBalanceUSD)
            : undefined,
      },
      include: {
        orders: {
          select: {
            id: true,
            totalUSD: true,
            totalPaidUSD: true,
            refundedAmountUSD: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const orders = updated.orders || [];
    const totalOrdersCount = orders.length;
    const totalSpentUSD = orders.reduce(
      (sum, o) => sum + Math.max(0, Number(o.totalPaidUSD) - Number(o.refundedAmountUSD)),
      0,
    );
    const lastOrderDate = orders[0]?.createdAt ? orders[0].createdAt.toISOString() : null;

    return {
      id: updated.id,
      businessId: updated.businessId,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
      notes: updated.notes,
      isWalkIn: updated.isWalkIn,
      taxNumber: updated.taxNumber,
      loyaltyPoints: updated.loyaltyPoints,
      creditBalanceUSD: Number(updated.creditBalanceUSD),
      totalOrdersCount,
      totalSpentUSD: Math.round(totalSpentUSD * 100) / 100,
      lastOrderDate,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Soft-delete customer
   */
  public static async deleteCustomer(businessId: string, customerId: string): Promise<void> {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    });

    if (!existing) {
      throw new CustomerServiceError('CUSTOMER_NOT_FOUND', `Customer ${customerId} not found`, 404);
    }

    if (existing.isWalkIn) {
      throw new CustomerServiceError(
        'CANNOT_DELETE_WALK_IN',
        'The default walk-in customer profile cannot be deleted',
        400,
      );
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: { deletedAt: new Date() },
    });

    logger.info(`[CustomerService] Soft-deleted customer ${customerId}`);
  }

  /**
   * Get full purchase history for a customer
   */
  public static async getCustomerHistory(
    businessId: string,
    customerId: string,
  ): Promise<CustomerHistoryResponse> {
    const customer = await this.getCustomerById(businessId, customerId);

    const orders = await prisma.order.findMany({
      where: {
        businessId,
        customerId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { name: true } },
        cashier: { select: { fullName: true } },
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            sku: true,
            quantity: true,
            unitPriceUSD: true,
            unitPriceKHR: true,
            totalUSD: true,
            refundedQuantity: true,
          },
        },
        returns: {
          select: {
            id: true,
            returnNumber: true,
            totalUSD: true,
            createdAt: true,
          },
        },
      },
    });

    const mappedOrders: CustomerPurchaseHistoryOrder[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      totalUSD: Number(o.totalUSD),
      totalKHR: Number(o.totalKHR),
      paidUSD: Number(o.paidUSD),
      changeUSD: Number(o.changeUSD),
      refundedAmountUSD: Number(o.refundedAmountUSD),
      storeName: o.store?.name || 'Main Store',
      cashierName: o.cashier?.fullName || 'Cashier',
      itemsCount: o.items.length,
      items: o.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        sku: i.sku,
        quantity: Number(i.quantity),
        unitPriceUSD: Number(i.unitPriceUSD),
        unitPriceKHR: Number(i.unitPriceKHR),
        totalUSD: Number(i.totalUSD),
        refundedQuantity: Number(i.refundedQuantity),
      })),
      returns: o.returns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        totalUSD: Number(r.totalUSD),
        createdAt: r.createdAt.toISOString(),
      })),
    }));

    const totalOrders = mappedOrders.length;
    const totalSpentUSD = mappedOrders.reduce(
      (sum, o) => sum + Math.max(0, o.paidUSD - o.refundedAmountUSD),
      0,
    );
    const averageOrderValueUSD =
      totalOrders > 0 ? Math.round((totalSpentUSD / totalOrders) * 100) / 100 : 0;
    const lastVisitDate = mappedOrders[0]?.createdAt || null;

    return {
      customer,
      orders: mappedOrders,
      summary: {
        totalSpentUSD: Math.round(totalSpentUSD * 100) / 100,
        totalOrders,
        averageOrderValueUSD,
        lastVisitDate,
      },
    };
  }
}
