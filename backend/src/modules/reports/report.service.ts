import { prisma } from '../../config/prisma.js';
import { SaleStatus } from '@prisma/client';
import { roundUSD, roundKHR } from '../../utils/calculator.js';

export class ReportService {
  static async getDailySummary(businessId: string, storeId?: string, targetDate?: string) {
    const date = targetDate ? new Date(targetDate) : new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const where: any = {
      businessId,
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: { in: [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_REFUNDED] },
    };

    if (storeId) {
      where.storeId = storeId;
    }

    const [sales, payments, itemsCount] = await Promise.all([
      prisma.sale.findMany({
        where,
        select: {
          id: true,
          totalUSD: true,
          totalKHR: true,
          subtotalUSD: true,
          discountAmountUSD: true,
          taxAmountUSD: true,
          status: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          sale: where,
        },
        select: {
          method: true,
          amountUSD: true,
          amountKHR: true,
        },
      }),
      prisma.saleItem.groupBy({
        by: ['productName'],
        where: {
          sale: where,
        },
        _sum: {
          quantity: true,
          totalUSD: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    let totalRevenueUSD = 0;
    let totalRevenueKHR = 0;
    let totalDiscountUSD = 0;
    let totalTaxUSD = 0;

    for (const s of sales) {
      totalRevenueUSD = roundUSD(totalRevenueUSD + Number(s.totalUSD));
      totalRevenueKHR = roundKHR(totalRevenueKHR + Number(s.totalKHR));
      totalDiscountUSD = roundUSD(totalDiscountUSD + Number(s.discountAmountUSD));
      totalTaxUSD = roundUSD(totalTaxUSD + Number(s.taxAmountUSD));
    }

    const orderCount = sales.length;
    const averageOrderValueUSD = orderCount > 0 ? roundUSD(totalRevenueUSD / orderCount) : 0;

    // Payments by method
    const paymentBreakdown: Record<string, { count: number; totalUSD: number; totalKHR: number }> = {};
    for (const p of payments) {
      if (!paymentBreakdown[p.method]) {
        paymentBreakdown[p.method] = { count: 0, totalUSD: 0, totalKHR: 0 };
      }
      paymentBreakdown[p.method].count += 1;
      paymentBreakdown[p.method].totalUSD = roundUSD(paymentBreakdown[p.method].totalUSD + Number(p.amountUSD));
      paymentBreakdown[p.method].totalKHR = roundKHR(paymentBreakdown[p.method].totalKHR + Number(p.amountKHR));
    }

    return {
      date: startOfDay.toISOString().slice(0, 10),
      orderCount,
      totalRevenueUSD,
      totalRevenueKHR,
      totalDiscountUSD,
      totalTaxUSD,
      averageOrderValueUSD,
      paymentBreakdown,
      topProducts: itemsCount.map((i) => ({
        name: i.productName,
        quantitySold: Number(i._sum.quantity || 0),
        totalRevenueUSD: Number(i._sum.totalUSD || 0),
      })),
    };
  }

  static async getAuditLogs(businessId: string, storeId?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = { businessId };
    if (storeId) where.storeId = storeId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, username: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
