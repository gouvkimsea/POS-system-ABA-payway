import { prisma } from '../../db/index.js';
import { Prisma, OrderStatus } from '@prisma/client';
import {
  ReportFilterParams,
  ReportingDashboardSummary,
  SalesTimeSeriesRow,
  ProductSalesReportRow,
  CategorySalesReportRow,
  CashierSalesReportRow,
  PaymentMethodReportRow,
  InventoryReportRow,
  StockMovementReportRow,
  RefundReportRow,
  ProfitEstimateReport,
  ReportDataResponse,
  RegisterSessionReportRow,
} from '@pos/types';

export class ReportingService {
  /**
   * Helper: Resolve store ID list from filters (handles individual store, comma-separated list, array, or all)
   */
  public static resolveStoreIds(filters: ReportFilterParams): string[] {
    const list: string[] = [];
    if (filters.storeIds) {
      if (Array.isArray(filters.storeIds)) {
        list.push(...filters.storeIds);
      } else if (typeof filters.storeIds === 'string') {
        const parts = filters.storeIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        list.push(...parts);
      }
    }
    if (
      filters.storeId &&
      !['ALL', 'all', 'entire-business'].includes(filters.storeId.toLowerCase())
    ) {
      if (!list.includes(filters.storeId)) {
        list.push(filters.storeId);
      }
    }
    return list;
  }

  /**
   * Helper: Build standard date and tenancy filter for Order queries
   */
  private static buildOrderWhere(
    businessId: string,
    filters: ReportFilterParams,
    includeAllStatuses = false,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      businessId,
    };

    if (!includeAllStatuses) {
      where.status = {
        in: [
          OrderStatus.COMPLETED,
          OrderStatus.PAID,
          OrderStatus.PARTIALLY_REFUNDED,
          OrderStatus.REFUNDED,
        ],
      };
    }

    const storeIds = this.resolveStoreIds(filters);
    if (storeIds.length === 1) {
      where.storeId = storeIds[0];
    } else if (storeIds.length > 1) {
      where.storeId = { in: storeIds };
    }

    if (filters.cashierId) {
      where.cashierId = filters.cashierId;
    }

    if (filters.paymentMethodId || filters.paymentMethodCode) {
      where.payments = {
        some: {
          status: 'COMPLETED',
          ...(filters.paymentMethodId && { paymentMethodId: filters.paymentMethodId }),
          ...(filters.paymentMethodCode && { paymentMethod: { code: filters.paymentMethodCode } }),
        },
      };
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    return where;
  }

  /**
   * 1. High-Performance Comprehensive Reporting Dashboard
   */
  public static async getDashboardSummary(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ReportingDashboardSummary> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Filtered Order where clause
    const orderWhere = this.buildOrderWhere(businessId, filters);

    // Today's where clause
    const todayWhere: Prisma.OrderWhereInput = {
      businessId,
      status: {
        in: [
          OrderStatus.COMPLETED,
          OrderStatus.PAID,
          OrderStatus.PARTIALLY_REFUNDED,
          OrderStatus.REFUNDED,
        ],
      },
      createdAt: {
        gte: startOfToday,
        lte: endOfToday,
      },
    };
    const storeIds = this.resolveStoreIds(filters);
    if (storeIds.length === 1) todayWhere.storeId = storeIds[0];
    else if (storeIds.length > 1) todayWhere.storeId = { in: storeIds };
    if (filters.cashierId) todayWhere.cashierId = filters.cashierId;

    // Parallel optimized DB operations
    const [
      filteredOrders,
      todayOrders,
      payments,
      orderItems,
      lowStockRecords,
      refundRecords,
      allPaymentMethods,
    ] = await Promise.all([
      // A. All matching filtered orders
      prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          totalUSD: true,
          totalKHR: true,
          totalPaidUSD: true,
          paidUSD: true,
          discountAmountUSD: true,
          taxAmountUSD: true,
          refundedAmountUSD: true,
          cashierId: true,
          cashier: { select: { fullName: true } },
          createdAt: true,
        },
      }),

      // B. Today's orders
      prisma.order.findMany({
        where: todayWhere,
        select: {
          totalUSD: true,
          totalKHR: true,
          paidUSD: true,
          refundedAmountUSD: true,
        },
      }),

      // C. Payments breakdown
      prisma.payment.findMany({
        where: {
          order: orderWhere,
          status: 'COMPLETED',
          ...(filters.paymentMethodId && { paymentMethodId: filters.paymentMethodId }),
          ...(filters.paymentMethodCode && {
            paymentMethod: { code: filters.paymentMethodCode },
          }),
        },
        include: {
          paymentMethod: { select: { code: true, name: true } },
        },
      }),

      // D. Order items for top products and COGS
      prisma.orderItem.findMany({
        where: {
          order: orderWhere,
        },
        select: {
          productId: true,
          productName: true,
          sku: true,
          quantity: true,
          unitCostUSD: true,
          unitPriceUSD: true,
          totalUSD: true,
          refundedQuantity: true,
          product: {
            select: {
              category: { select: { name: true } },
            },
          },
        },
      }),

      // E. Low stock inventory
      prisma.inventory.findMany({
        where: {
          store: { businessId },
          ...(storeIds.length === 1
            ? { storeId: storeIds[0] }
            : storeIds.length > 1
              ? { storeId: { in: storeIds } }
              : {}),
        },
        include: {
          product: true,
          store: { select: { name: true } },
        },
      }),

      // F. Filtered refunds
      prisma.refund.findMany({
        where: {
          businessId,
          ...(storeIds.length === 1
            ? { storeId: storeIds[0] }
            : storeIds.length > 1
              ? { storeId: { in: storeIds } }
              : {}),
          ...(filters.cashierId && { processedById: filters.cashierId }),
          ...(filters.paymentMethodId && { paymentMethodId: filters.paymentMethodId }),
          ...(filters.paymentMethodCode && { paymentMethod: { code: filters.paymentMethodCode } }),
          ...(filters.startDate && { createdAt: { gte: new Date(filters.startDate) } }),
          ...(filters.endDate && { createdAt: { lte: new Date(filters.endDate) } }),
        },
        select: { amountUSD: true, amountKHR: true },
      }),

      // G. Available payment methods for business
      prisma.paymentMethod.findMany({
        where: { businessId, isActive: true },
        select: { code: true, name: true },
      }),
    ]);

    // 1. Today calculations
    const todayOrdersCount = todayOrders.length;
    const todaySalesUSD = todayOrders.reduce(
      (sum, o) => sum + Math.max(0, Number(o.totalUSD) - Number(o.refundedAmountUSD)),
      0,
    );
    const todaySalesKHR = Math.round(todaySalesUSD * 4100);
    const todayAverageOrderValueUSD =
      todayOrdersCount > 0 ? Math.round((todaySalesUSD / todayOrdersCount) * 100) / 100 : 0;

    // 2. Filtered Period Metrics
    const totalOrdersCount = filteredOrders.length;
    let grossSalesUSD = 0;
    let discountsUSD = 0;
    let taxesUSD = 0;
    let totalPaidUSD = 0;
    let refundedFromOrdersUSD = 0;

    for (const ord of filteredOrders) {
      grossSalesUSD += Number(ord.totalUSD);
      discountsUSD += Number(ord.discountAmountUSD);
      taxesUSD += Number(ord.taxAmountUSD);
      totalPaidUSD += Number(ord.paidUSD);
      refundedFromOrdersUSD += Number(ord.refundedAmountUSD);
    }

    const refundsUSD = Math.max(
      refundedFromOrdersUSD,
      refundRecords.reduce((sum, r) => sum + Number(r.amountUSD), 0),
    );
    const netSalesUSD = Math.max(0, Math.round((grossSalesUSD - refundsUSD) * 100) / 100);

    // 3. COGS & Profit Estimate
    let costOfGoodsSoldUSD = 0;
    const productStatsMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku: string;
        categoryName: string;
        quantitySold: number;
        revenueUSD: number;
        costUSD: number;
      }
    >();

    for (const item of orderItems) {
      const netQty = Math.max(0, Number(item.quantity) - Number(item.refundedQuantity));
      const itemCost = netQty * Number(item.unitCostUSD);
      const itemRevenue = netQty * Number(item.unitPriceUSD);

      costOfGoodsSoldUSD += itemCost;

      const existing = productStatsMap.get(item.productId);
      if (existing) {
        existing.quantitySold += netQty;
        existing.revenueUSD += itemRevenue;
        existing.costUSD += itemCost;
      } else {
        productStatsMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          categoryName: item.product?.category?.name || 'Uncategorized',
          quantitySold: netQty,
          revenueUSD: itemRevenue,
          costUSD: itemCost,
        });
      }
    }

    const profitEstimateUSD = Math.round((netSalesUSD - costOfGoodsSoldUSD) * 100) / 100;
    const profitMarginPercent =
      netSalesUSD > 0 ? Math.round((profitEstimateUSD / netSalesUSD) * 1000) / 10 : 0;

    // 4. Payment Breakdown
    const paymentMap = new Map<
      string,
      { code: string; name: string; amountUSD: number; amountKHR: number; count: number }
    >();
    allPaymentMethods.forEach((pm) => {
      paymentMap.set(pm.code, {
        code: pm.code,
        name: pm.name,
        amountUSD: 0,
        amountKHR: 0,
        count: 0,
      });
    });

    let totalPaymentAmountUSD = 0;
    for (const p of payments) {
      const code = p.paymentMethod.code;
      const amountUSD = Number(p.amountUSD);
      const amountKHR = Number(p.amountKHR);
      totalPaymentAmountUSD += amountUSD;

      const entry = paymentMap.get(code) || {
        code,
        name: p.paymentMethod.name,
        amountUSD: 0,
        amountKHR: 0,
        count: 0,
      };
      entry.amountUSD += amountUSD;
      entry.amountKHR += amountKHR;
      entry.count += 1;
      paymentMap.set(code, entry);
    }

    const paymentBreakdown = Array.from(paymentMap.values())
      .filter((p) => p.count > 0 || p.amountUSD > 0)
      .map((p) => ({
        ...p,
        amountUSD: Math.round(p.amountUSD * 100) / 100,
        percentage:
          totalPaymentAmountUSD > 0
            ? Math.round((p.amountUSD / totalPaymentAmountUSD) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.amountUSD - a.amountUSD);

    // 5. Top Products (Sorted by revenue)
    const topProducts = Array.from(productStatsMap.values())
      .map((p) => ({
        ...p,
        revenueUSD: Math.round(p.revenueUSD * 100) / 100,
        costUSD: Math.round(p.costUSD * 100) / 100,
        profitUSD: Math.round((p.revenueUSD - p.costUSD) * 100) / 100,
      }))
      .sort((a, b) => b.revenueUSD - a.revenueUSD)
      .slice(0, 10);

    // 6. Low Stock Products
    const lowStockProducts = lowStockRecords
      .filter((inv) => Number(inv.quantity) <= Number(inv.minStockLevel))
      .map((inv) => ({
        productId: inv.productId,
        productName: inv.product.name,
        sku: inv.product.sku,
        barcode: inv.product.barcode,
        storeName: inv.store?.name || 'Main Branch',
        currentQuantity: Number(inv.quantity),
        minStockLevel: Number(inv.minStockLevel),
        unit: inv.product.unit,
      }))
      .slice(0, 15);

    // 7. Cashier Performance
    const cashierMap = new Map<
      string,
      {
        cashierId: string;
        cashierName: string;
        ordersCount: number;
        grossSalesUSD: number;
        refundsUSD: number;
      }
    >();

    for (const ord of filteredOrders) {
      const cId = ord.cashierId;
      const cName = ord.cashier?.fullName || 'Cashier';
      const existing = cashierMap.get(cId) || {
        cashierId: cId,
        cashierName: cName,
        ordersCount: 0,
        grossSalesUSD: 0,
        refundsUSD: 0,
      };
      existing.ordersCount += 1;
      existing.grossSalesUSD += Number(ord.totalUSD);
      existing.refundsUSD += Number(ord.refundedAmountUSD);
      cashierMap.set(cId, existing);
    }

    const cashierPerformance = Array.from(cashierMap.values())
      .map((c) => {
        const netSales = Math.max(0, c.grossSalesUSD - c.refundsUSD);
        const aov = c.ordersCount > 0 ? Math.round((netSales / c.ordersCount) * 100) / 100 : 0;
        return {
          ...c,
          grossSalesUSD: Math.round(c.grossSalesUSD * 100) / 100,
          refundsUSD: Math.round(c.refundsUSD * 100) / 100,
          netSalesUSD: Math.round(netSales * 100) / 100,
          avgOrderValueUSD: aov,
        };
      })
      .sort((a, b) => b.netSalesUSD - a.netSalesUSD);

    return {
      todaySalesUSD: Math.round(todaySalesUSD * 100) / 100,
      todaySalesKHR,
      todayOrdersCount,
      todayAverageOrderValueUSD,
      grossSalesUSD: Math.round(grossSalesUSD * 100) / 100,
      refundsUSD: Math.round(refundsUSD * 100) / 100,
      netSalesUSD,
      discountsUSD: Math.round(discountsUSD * 100) / 100,
      taxesUSD: Math.round(taxesUSD * 100) / 100,
      costOfGoodsSoldUSD: Math.round(costOfGoodsSoldUSD * 100) / 100,
      profitEstimateUSD,
      profitMarginPercent,
      totalOrdersCount,
      paymentBreakdown,
      topProducts,
      lowStockProducts,
      cashierPerformance,
    };
  }

  /**
   * 2. Time Series Sales: Daily, Weekly, Monthly
   */
  public static async getTimeSeriesSales(
    businessId: string,
    interval: 'daily' | 'weekly' | 'monthly',
    filters: ReportFilterParams = {},
  ): Promise<ReportDataResponse<SalesTimeSeriesRow>> {
    const where = this.buildOrderWhere(businessId, filters);

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        totalUSD: true,
        discountAmountUSD: true,
        taxAmountUSD: true,
        refundedAmountUSD: true,
        items: {
          select: {
            quantity: true,
            unitCostUSD: true,
            refundedQuantity: true,
          },
        },
      },
    });

    const groupsMap = new Map<string, SalesTimeSeriesRow>();

    for (const ord of orders) {
      const d = ord.createdAt;
      let periodKey = '';
      let periodLabel = '';

      if (interval === 'daily') {
        periodKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
        periodLabel = d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      } else if (interval === 'weekly') {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        periodKey = `W-${startOfWeek.toISOString().slice(0, 10)}`;
        periodLabel = `Week of ${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else {
        periodKey = d.toISOString().slice(0, 7); // YYYY-MM
        periodLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      let cogs = 0;
      for (const item of ord.items) {
        const netQty = Math.max(0, Number(item.quantity) - Number(item.refundedQuantity));
        cogs += netQty * Number(item.unitCostUSD);
      }

      const gross = Number(ord.totalUSD);
      const discount = Number(ord.discountAmountUSD);
      const refund = Number(ord.refundedAmountUSD);
      const net = Math.max(0, gross - refund);
      const tax = Number(ord.taxAmountUSD);
      const profit = net - cogs;

      const existing = groupsMap.get(periodKey) || {
        periodKey,
        periodLabel,
        ordersCount: 0,
        grossSalesUSD: 0,
        discountsUSD: 0,
        refundsUSD: 0,
        netSalesUSD: 0,
        taxesUSD: 0,
        profitEstimateUSD: 0,
      };

      existing.ordersCount += 1;
      existing.grossSalesUSD += gross;
      existing.discountsUSD += discount;
      existing.refundsUSD += refund;
      existing.netSalesUSD += net;
      existing.taxesUSD += tax;
      existing.profitEstimateUSD += profit;

      groupsMap.set(periodKey, existing);
    }

    const rows = Array.from(groupsMap.values()).map((r) => ({
      ...r,
      grossSalesUSD: Math.round(r.grossSalesUSD * 100) / 100,
      discountsUSD: Math.round(r.discountsUSD * 100) / 100,
      refundsUSD: Math.round(r.refundsUSD * 100) / 100,
      netSalesUSD: Math.round(r.netSalesUSD * 100) / 100,
      taxesUSD: Math.round(r.taxesUSD * 100) / 100,
      profitEstimateUSD: Math.round(r.profitEstimateUSD * 100) / 100,
    }));

    return {
      rows,
      totalRows: rows.length,
      filtersApplied: filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 3. Product Sales Report
   */
  public static async getProductSales(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ReportDataResponse<ProductSalesReportRow>> {
    const where = this.buildOrderWhere(businessId, filters);

    const orderItems = await prisma.orderItem.findMany({
      where: { order: where },
      include: {
        product: {
          include: { category: true },
        },
      },
    });

    const map = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku: string;
        categoryName: string;
        quantitySold: number;
        grossSalesUSD: number;
        discountsUSD: number;
        refundsUSD: number;
        cogsUSD: number;
      }
    >();

    for (const item of orderItems) {
      const netQty = Math.max(0, Number(item.quantity) - Number(item.refundedQuantity));
      const gross = Number(item.quantity) * Number(item.unitPriceUSD);
      const discount = Number(item.discountAmountUSD);
      const refund = Number(item.refundedQuantity) * Number(item.unitPriceUSD);
      const cogs = netQty * Number(item.unitCostUSD);

      const existing = map.get(item.productId) || {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        categoryName: item.product?.category?.name || 'Uncategorized',
        quantitySold: 0,
        grossSalesUSD: 0,
        discountsUSD: 0,
        refundsUSD: 0,
        cogsUSD: 0,
      };

      existing.quantitySold += netQty;
      existing.grossSalesUSD += gross;
      existing.discountsUSD += discount;
      existing.refundsUSD += refund;
      existing.cogsUSD += cogs;

      map.set(item.productId, existing);
    }

    const rows: ProductSalesReportRow[] = Array.from(map.values())
      .map((item) => {
        const netSales = Math.max(0, item.grossSalesUSD - item.refundsUSD - item.discountsUSD);
        const profit = netSales - item.cogsUSD;
        const margin = netSales > 0 ? Math.round((profit / netSales) * 1000) / 10 : 0;
        const unitPriceAvg =
          item.quantitySold > 0
            ? Math.round((item.grossSalesUSD / item.quantitySold) * 100) / 100
            : 0;

        return {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          categoryName: item.categoryName,
          quantitySold: Math.round(item.quantitySold * 100) / 100,
          unitPriceAvgUSD: unitPriceAvg,
          grossSalesUSD: Math.round(item.grossSalesUSD * 100) / 100,
          discountsUSD: Math.round(item.discountsUSD * 100) / 100,
          netSalesUSD: Math.round(netSales * 100) / 100,
          cogsUSD: Math.round(item.cogsUSD * 100) / 100,
          profitUSD: Math.round(profit * 100) / 100,
          marginPercent: margin,
        };
      })
      .sort((a, b) => b.netSalesUSD - a.netSalesUSD);

    return {
      rows,
      totalRows: rows.length,
      filtersApplied: filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 4. Category Sales Report
   */
  public static async getCategorySales(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ReportDataResponse<CategorySalesReportRow>> {
    const productReport = await this.getProductSales(businessId, filters);

    const catMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        itemsCount: number;
        quantitySold: number;
        grossSalesUSD: number;
        discountsUSD: number;
        netSalesUSD: number;
      }
    >();

    let grandTotalNet = 0;

    for (const prod of productReport.rows) {
      const catKey = prod.categoryName;
      grandTotalNet += prod.netSalesUSD;

      const existing = catMap.get(catKey) || {
        categoryId: catKey,
        categoryName: prod.categoryName,
        itemsCount: 0,
        quantitySold: 0,
        grossSalesUSD: 0,
        discountsUSD: 0,
        netSalesUSD: 0,
      };

      existing.itemsCount += 1;
      existing.quantitySold += prod.quantitySold;
      existing.grossSalesUSD += prod.grossSalesUSD;
      existing.discountsUSD += prod.discountsUSD;
      existing.netSalesUSD += prod.netSalesUSD;

      catMap.set(catKey, existing);
    }

    const rows: CategorySalesReportRow[] = Array.from(catMap.values())
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        itemsCount: c.itemsCount,
        quantitySold: Math.round(c.quantitySold * 100) / 100,
        grossSalesUSD: Math.round(c.grossSalesUSD * 100) / 100,
        discountsUSD: Math.round(c.discountsUSD * 100) / 100,
        netSalesUSD: Math.round(c.netSalesUSD * 100) / 100,
        revenueSharePercent:
          grandTotalNet > 0 ? Math.round((c.netSalesUSD / grandTotalNet) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.netSalesUSD - a.netSalesUSD);

    return {
      rows,
      totalRows: rows.length,
      filtersApplied: filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 5. Cashier Performance Sales Report
   */
  public static async getCashierSales(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ReportDataResponse<CashierSalesReportRow>> {
    const where = this.buildOrderWhere(businessId, filters);

    const orders = await prisma.order.findMany({
      where,
      select: {
        totalUSD: true,
        discountAmountUSD: true,
        refundedAmountUSD: true,
        cashierId: true,
        cashier: { select: { fullName: true } },
      },
    });

    const map = new Map<
      string,
      {
        cashierId: string;
        cashierName: string;
        ordersCount: number;
        grossSalesUSD: number;
        discountsUSD: number;
        refundsUSD: number;
      }
    >();

    for (const ord of orders) {
      const cId = ord.cashierId;
      const cName = ord.cashier?.fullName || 'Cashier';

      const existing = map.get(cId) || {
        cashierId: cId,
        cashierName: cName,
        ordersCount: 0,
        grossSalesUSD: 0,
        discountsUSD: 0,
        refundsUSD: 0,
      };

      existing.ordersCount += 1;
      existing.grossSalesUSD += Number(ord.totalUSD);
      existing.discountsUSD += Number(ord.discountAmountUSD);
      existing.refundsUSD += Number(ord.refundedAmountUSD);

      map.set(cId, existing);
    }

    const rows: CashierSalesReportRow[] = Array.from(map.values())
      .map((c) => {
        const net = Math.max(0, c.grossSalesUSD - c.refundsUSD);
        const aov = c.ordersCount > 0 ? Math.round((net / c.ordersCount) * 100) / 100 : 0;
        return {
          cashierId: c.cashierId,
          cashierName: c.cashierName,
          ordersCount: c.ordersCount,
          grossSalesUSD: Math.round(c.grossSalesUSD * 100) / 100,
          discountsUSD: Math.round(c.discountsUSD * 100) / 100,
          refundsUSD: Math.round(c.refundsUSD * 100) / 100,
          netSalesUSD: Math.round(net * 100) / 100,
          avgOrderValueUSD: aov,
        };
      })
      .sort((a, b) => b.netSalesUSD - a.netSalesUSD);

    return {
      rows,
      totalRows: rows.length,
      filtersApplied: filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 6. Payment Methods Breakdown Report
   */
  public static async getPaymentMethodReport(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ReportDataResponse<PaymentMethodReportRow>> {
    const orderWhere = this.buildOrderWhere(businessId, filters);

    const payments = await prisma.payment.findMany({
      where: {
        order: orderWhere,
        status: 'COMPLETED',
        ...(filters.paymentMethodId && { paymentMethodId: filters.paymentMethodId }),
        ...(filters.paymentMethodCode && {
          paymentMethod: { code: filters.paymentMethodCode },
        }),
      },
      include: {
        paymentMethod: true,
      },
    });

    const map = new Map<
      string,
      {
        paymentMethodId: string;
        code: string;
        name: string;
        transactionsCount: number;
        totalUSD: number;
        totalKHR: number;
      }
    >();

    let grandTotalUSD = 0;

    for (const p of payments) {
      const pm = p.paymentMethod;
      const amtUSD = Number(p.amountUSD);
      const amtKHR = Number(p.amountKHR);
      grandTotalUSD += amtUSD;

      const existing = map.get(pm.id) || {
        paymentMethodId: pm.id,
        code: pm.code,
        name: pm.name,
        transactionsCount: 0,
        totalUSD: 0,
        totalKHR: 0,
      };

      existing.transactionsCount += 1;
      existing.totalUSD += amtUSD;
      existing.totalKHR += amtKHR;

      map.set(pm.id, existing);
    }

    const rows: PaymentMethodReportRow[] = Array.from(map.values())
      .map((p) => ({
        paymentMethodId: p.paymentMethodId,
        code: p.code,
        name: p.name,
        transactionsCount: p.transactionsCount,
        totalUSD: Math.round(p.totalUSD * 100) / 100,
        totalKHR: p.totalKHR,
        percentage: grandTotalUSD > 0 ? Math.round((p.totalUSD / grandTotalUSD) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.totalUSD - a.totalUSD);

    return {
      rows,
      totalRows: rows.length,
      filtersApplied: filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 7. Real-Time Inventory Status & Asset Valuation Report
   */
  public static async getInventoryReport(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ReportDataResponse<InventoryReportRow>> {
    const storeIds = this.resolveStoreIds(filters);
    const inventory = await prisma.inventory.findMany({
      where: {
        store: {
          businessId,
          ...(storeIds.length === 1
            ? { id: storeIds[0] }
            : storeIds.length > 1
              ? { id: { in: storeIds } }
              : {}),
        },
      },
      include: {
        store: { select: { name: true } },
        location: { select: { name: true } },
        product: {
          include: { category: true },
        },
      },
      orderBy: [{ store: { name: 'asc' } }, { product: { name: 'asc' } }],
    });

    const rows: InventoryReportRow[] = inventory.map((inv) => {
      const currentStock = Number(inv.quantity);
      const reservedStock = Number(inv.reservedQuantity);
      const minStockLevel = Number(inv.minStockLevel);
      const unitCostUSD = Number(inv.product.costPriceUSD);
      const sellingPriceUSD = Number(inv.product.sellingPriceUSD);
      const totalCostValueUSD = Math.round(currentStock * unitCostUSD * 100) / 100;
      const totalRetailValueUSD = Math.round(currentStock * sellingPriceUSD * 100) / 100;

      let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (currentStock <= 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (currentStock <= minStockLevel) {
        stockStatus = 'LOW_STOCK';
      }

      return {
        productId: inv.productId,
        productName: inv.product.name,
        sku: inv.product.sku,
        categoryName: inv.product.category?.name || 'Uncategorized',
        storeName: inv.store.name,
        locationName: inv.location.name,
        currentStock,
        reservedStock,
        minStockLevel,
        unitCostUSD,
        sellingPriceUSD,
        totalCostValueUSD,
        totalRetailValueUSD,
        stockStatus,
      };
    });

    return {
      rows,
      totalRows: rows.length,
      filtersApplied: filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 8. Stock Movement Audit Trail Report
   */
  public static async getStockMovementReport(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ReportDataResponse<StockMovementReportRow>> {
    const storeIds = this.resolveStoreIds(filters);
    const where: Prisma.StockMovementWhereInput = {
      store: {
        businessId,
        ...(storeIds.length === 1
          ? { id: storeIds[0] }
          : storeIds.length > 1
            ? { id: { in: storeIds } }
            : {}),
      },
      ...(filters.cashierId && { createdById: filters.cashierId }),
    };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      take: 200,
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { name: true } },
        location: { select: { name: true } },
        product: { select: { name: true, sku: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    const rows: StockMovementReportRow[] = movements.map((m) => ({
      id: m.id,
      createdAt: m.createdAt.toISOString(),
      storeName: m.store.name,
      locationName: m.location.name,
      productName: m.product.name,
      sku: m.product.sku,
      type: m.type,
      quantityChange: Number(m.quantityChange),
      quantityBefore: Number(m.quantityBefore),
      quantityAfter: Number(m.quantityAfter),
      unitCostUSD: Number(m.unitCost),
      totalMovementCostUSD: Math.round(Number(m.quantityChange) * Number(m.unitCost) * 100) / 100,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      createdByName: m.createdBy.fullName,
      notes: m.notes,
    }));

    return {
      rows,
      totalRows: rows.length,
      filtersApplied: filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 9. Returns & Refunds Ledger Report
   */
  public static async getRefundReport(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ReportDataResponse<RefundReportRow>> {
    const where: Prisma.RefundWhereInput = {
      businessId,
      ...(filters.storeId && { storeId: filters.storeId }),
      ...(filters.cashierId && { processedById: filters.cashierId }),
      ...(filters.paymentMethodId && { paymentMethodId: filters.paymentMethodId }),
      ...(filters.paymentMethodCode && { paymentMethod: { code: filters.paymentMethodCode } }),
    };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    const refunds = await prisma.refund.findMany({
      where,
      take: 200,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            orderNumber: true,
            customer: { select: { name: true } },
          },
        },
        return: {
          include: {
            items: {
              include: { product: { select: { name: true } } },
            },
          },
        },
        paymentMethod: { select: { name: true } },
        processedBy: { select: { fullName: true } },
      },
    });

    const store = await prisma.store.findFirst({ where: { businessId } });

    const rows: RefundReportRow[] = refunds.map((r) => {
      const itemsSummary =
        r.return?.items.map((i) => `${Number(i.quantity)}x ${i.product.name}`).join(', ') || 'N/A';

      return {
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        refundNumber: r.refundNumber,
        returnNumber: r.return?.returnNumber || null,
        orderNumber: r.order.orderNumber,
        customerName: r.order.customer?.name || 'Walk-in Customer',
        cashierName: r.processedBy.fullName,
        storeName: store?.name || 'Main Branch',
        reason: r.reason || r.return?.reason || 'Refund',
        amountUSD: Number(r.amountUSD),
        amountKHR: Number(r.amountKHR),
        paymentMethodName: r.paymentMethod.name,
        itemsSummary,
      };
    });

    return {
      rows,
      totalRows: rows.length,
      filtersApplied: filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 10. Profit & Loss Estimate Report
   */
  public static async getProfitEstimate(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ProfitEstimateReport> {
    const summary = await this.getDashboardSummary(businessId, filters);

    const storeIds = this.resolveStoreIds(filters);
    // Fetch expenses for period
    const expenseWhere: Prisma.ExpenseWhereInput = {
      businessId,
      ...(storeIds.length === 1
        ? { storeId: storeIds[0] }
        : storeIds.length > 1
          ? { storeId: { in: storeIds } }
          : {}),
    };
    if (filters.startDate || filters.endDate) {
      expenseWhere.createdAt = {};
      if (filters.startDate) expenseWhere.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) expenseWhere.createdAt.lte = new Date(filters.endDate);
    }

    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      select: { amountUSD: true },
    });
    const totalExpensesUSD = expenses.reduce((sum, e) => sum + Number(e.amountUSD), 0);

    const grossProfitUSD =
      Math.round((summary.grossSalesUSD - summary.costOfGoodsSoldUSD) * 100) / 100;
    const grossProfitMarginPercent =
      summary.grossSalesUSD > 0
        ? Math.round((grossProfitUSD / summary.grossSalesUSD) * 1000) / 10
        : 0;

    const netProfitEstimateUSD = Math.round(summary.profitEstimateUSD * 100) / 100;
    const netOperatingProfitUSD = Math.round((netProfitEstimateUSD - totalExpensesUSD) * 100) / 100;

    return {
      grossSalesUSD: summary.grossSalesUSD,
      discountsUSD: summary.discountsUSD,
      netSalesUSD: summary.netSalesUSD,
      cogsUSD: summary.costOfGoodsSoldUSD,
      grossProfitUSD,
      grossProfitMarginPercent,
      refundsUSD: summary.refundsUSD,
      netProfitEstimateUSD,
      netProfitMarginPercent: summary.profitMarginPercent,
      taxesCollectedUSD: summary.taxesUSD,
      expensesUSD: Math.round(totalExpensesUSD * 100) / 100,
      netOperatingProfitUSD,
    };
  }

  /**
   * 11. Register Sessions & Cash Drawer Report
   */
  public static async getRegisterReport(
    businessId: string,
    filters: ReportFilterParams = {},
  ): Promise<ReportDataResponse<RegisterSessionReportRow>> {
    const storeIds = this.resolveStoreIds(filters);
    const where: Prisma.RegisterSessionWhereInput = {
      register: {
        store: {
          businessId,
          ...(storeIds.length === 1
            ? { id: storeIds[0] }
            : storeIds.length > 1
              ? { id: { in: storeIds } }
              : {}),
        },
      },
    };

    if (filters.cashierId) {
      where.cashierId = filters.cashierId;
    }

    if (filters.startDate || filters.endDate) {
      where.openedAt = {};
      if (filters.startDate) {
        where.openedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.openedAt.lte = new Date(filters.endDate);
      }
    }

    const sessions = await prisma.registerSession.findMany({
      where,
      include: {
        register: {
          include: {
            store: true,
          },
        },
        cashier: true,
      },
      orderBy: {
        openedAt: 'desc',
      },
      take: 2000,
    });

    let totalOpeningFloatUSD = 0;
    let totalSalesUSD = 0;
    let totalExpectedCashUSD = 0;
    let totalActualCashUSD = 0;
    let totalDifferenceUSD = 0;

    const rows: RegisterSessionReportRow[] = sessions.map((s) => {
      const openFloat = Number(s.openingFloatUSD);
      const salesUSD = Number(s.totalSalesUSD);
      const expectedUSD = Number(s.expectedCashUSD);
      const actualUSD = s.actualCashUSD !== null ? Number(s.actualCashUSD) : null;
      const diffUSD = s.differenceUSD !== null ? Number(s.differenceUSD) : null;

      totalOpeningFloatUSD += openFloat;
      totalSalesUSD += salesUSD;
      totalExpectedCashUSD += expectedUSD;
      if (actualUSD !== null) totalActualCashUSD += actualUSD;
      if (diffUSD !== null) totalDifferenceUSD += diffUSD;

      return {
        id: s.id,
        storeName: s.register.store.name,
        registerName: s.register.name,
        registerCode: s.register.code,
        cashierName: s.cashier.fullName,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt ? s.closedAt.toISOString() : null,
        status: s.status,
        openingFloatUSD: Math.round(openFloat * 100) / 100,
        openingFloatKHR: Math.round(Number(s.openingFloatKHR) * 100) / 100,
        expectedCashUSD: Math.round(expectedUSD * 100) / 100,
        expectedCashKHR: Math.round(Number(s.expectedCashKHR) * 100) / 100,
        actualCashUSD: actualUSD !== null ? Math.round(actualUSD * 100) / 100 : null,
        actualCashKHR:
          s.actualCashKHR !== null ? Math.round(Number(s.actualCashKHR) * 100) / 100 : null,
        differenceUSD: diffUSD !== null ? Math.round(diffUSD * 100) / 100 : null,
        differenceKHR:
          s.differenceKHR !== null ? Math.round(Number(s.differenceKHR) * 100) / 100 : null,
        totalSalesCount: s.totalSalesCount,
        totalSalesUSD: Math.round(salesUSD * 100) / 100,
        totalSalesKHR: Math.round(Number(s.totalSalesKHR) * 100) / 100,
        closingNotes: s.closingNotes,
      };
    });

    return {
      summary: {
        totalSessions: rows.length,
        openSessions: rows.filter((r) => r.status === 'OPEN').length,
        closedSessions: rows.filter((r) => r.status === 'CLOSED').length,
        totalOpeningFloatUSD: Math.round(totalOpeningFloatUSD * 100) / 100,
        totalSalesUSD: Math.round(totalSalesUSD * 100) / 100,
        totalExpectedCashUSD: Math.round(totalExpectedCashUSD * 100) / 100,
        totalActualCashUSD: Math.round(totalActualCashUSD * 100) / 100,
        totalDifferenceUSD: Math.round(totalDifferenceUSD * 100) / 100,
      },
      rows,
      totalRows: rows.length,
      filtersApplied: filters,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 12. Format Rows to CSV (UTF-8 BOM Excel-Compatible)
   */
  public static formatToCSV<T extends Record<string, any>>(rows: T[]): string {
    if (!rows || rows.length === 0) return '\uFEFF';

    const headers = Object.keys(rows[0]);
    const escapeVal = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        str = `"${str.replace(/"/g, '""')}"`;
      } else {
        str = `"${str}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeVal).join(',');
    const dataLines = rows.map((row) => headers.map((h) => escapeVal(row[h])).join(','));

    // UTF-8 BOM (\uFEFF) ensures Excel opens multilingual & UTF-8 formatted CSV correctly
    return `\uFEFF${headerLine}\r\n${dataLines.join('\r\n')}`;
  }
}
