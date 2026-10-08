import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS, ReportFilterParams } from '@pos/types';
import { reportingFilterSchema } from '@pos/validation';
import { ReportingService } from '../services/report/ReportingService.js';
import { prisma } from '../db/index.js';

export const reportsRouter = Router();

/**
 * 0. GET /api/reports/filters-meta
 * Fetch stores, cashiers, and payment methods for filter dropdowns
 */
reportsRouter.get(
  '/filters-meta',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeWhere: any = { businessId: user.businessId };
      if (!user.roles.includes('ADMIN') && user.authorizedStoreIds) {
        storeWhere.id = { in: user.authorizedStoreIds };
      }

      const [stores, cashiers, paymentMethods] = await Promise.all([
        prisma.store.findMany({
          where: storeWhere,
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        }),
        prisma.user.findMany({
          where: { businessId: user.businessId },
          select: { id: true, fullName: true, username: true },
          orderBy: { fullName: 'asc' },
        }),
        prisma.paymentMethod.findMany({
          where: { businessId: user.businessId, isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ]);

      res.json({
        success: true,
        data: {
          stores,
          cashiers,
          paymentMethods,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Helper to handle CSV/Excel vs JSON response
 */
function sendReportResponse<T extends Record<string, any>>(
  res: Response,
  filenamePrefix: string,
  data: { rows: T[]; [key: string]: any },
  format?: string,
) {
  if (format === 'csv' || format === 'excel') {
    const csvData = ReportingService.formatToCSV(data.rows);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${filenamePrefix}_${dateStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvData);
    return;
  }

  res.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Parse and validate filters from request query
 */
function parseFilters(req: Request): ReportFilterParams {
  const parsed = reportingFilterSchema.safeParse(req.query);
  const rawStoreIds = req.query.storeIds;
  const storeIds =
    typeof rawStoreIds === 'string'
      ? rawStoreIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : Array.isArray(rawStoreIds)
        ? (rawStoreIds as string[])
        : undefined;

  const filters: ReportFilterParams = parsed.success
    ? { ...parsed.data }
    : {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        storeId: req.query.storeId as string | undefined,
        storeIds,
        cashierId: req.query.cashierId as string | undefined,
        paymentMethodId: req.query.paymentMethodId as string | undefined,
        interval: req.query.interval as 'daily' | 'weekly' | 'monthly' | undefined,
        format: req.query.format as 'json' | 'csv' | 'excel' | undefined,
      };

  if (storeIds && !filters.storeIds) {
    filters.storeIds = storeIds;
  }

  // Branch authorization security:
  const user = req.user;
  if (user && !user.roles.includes('ADMIN') && user.authorizedStoreIds) {
    const requested = ReportingService.resolveStoreIds(filters);
    if (requested.length > 0) {
      const unauthorized = requested.some((s) => !user.authorizedStoreIds!.includes(s));
      if (unauthorized) {
        throw {
          statusCode: 403,
          code: 'FORBIDDEN_STORE_ACCESS',
          message: 'You are not authorized to view reports for one or more requested stores.',
        };
      }
    } else {
      // If querying all stores, automatically restrict to authorized stores
      filters.storeIds = user.authorizedStoreIds;
    }
  }

  return filters;
}

/**
 * 1. GET /api/reports/dashboard
 * High-performance summary dashboard KPIs, payment breakdown, top products, low stock, cashier performance
 */
reportsRouter.get(
  '/dashboard',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getDashboardSummary(user.businessId, filters);

      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 2. GET /api/reports/sales
 * Daily, Weekly, or Monthly sales time-series report
 */
reportsRouter.get(
  '/sales',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const interval = (filters.interval || 'daily') as 'daily' | 'weekly' | 'monthly';
      const data = await ReportingService.getTimeSeriesSales(user.businessId, interval, filters);

      sendReportResponse(res, `sales_${interval}_report`, data, filters.format);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 3. GET /api/reports/products
 * Product sales performance, volumes, discounts, net sales, and profit margins
 */
reportsRouter.get(
  '/products',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getProductSales(user.businessId, filters);

      sendReportResponse(res, 'product_sales_report', data, filters.format);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 4. GET /api/reports/categories
 * Category sales report and revenue share percentages
 */
reportsRouter.get(
  '/categories',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getCategorySales(user.businessId, filters);

      sendReportResponse(res, 'category_sales_report', data, filters.format);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 5. GET /api/reports/cashiers
 * Cashier performance and sales report
 */
reportsRouter.get(
  '/cashiers',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getCashierSales(user.businessId, filters);

      sendReportResponse(res, 'cashier_sales_report', data, filters.format);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 6. GET /api/reports/payments
 * Payment method breakdown report
 */
reportsRouter.get(
  '/payments',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getPaymentMethodReport(user.businessId, filters);

      sendReportResponse(res, 'payment_methods_report', data, filters.format);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 7. GET /api/reports/inventory
 * Inventory valuation and stock status report
 */
reportsRouter.get(
  '/inventory',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getInventoryReport(user.businessId, filters);

      sendReportResponse(res, 'inventory_valuation_report', data, filters.format);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 8. GET /api/reports/stock-movements
 * Stock movement audit trail report
 */
reportsRouter.get(
  '/stock-movements',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getStockMovementReport(user.businessId, filters);

      sendReportResponse(res, 'stock_movement_report', data, filters.format);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 9. GET /api/reports/refunds
 * Return & refund transactions report
 */
reportsRouter.get(
  '/refunds',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getRefundReport(user.businessId, filters);

      sendReportResponse(res, 'refunds_returns_report', data, filters.format);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 10. GET /api/reports/registers
 * Register sessions and cash drawer report
 */
reportsRouter.get(
  '/registers',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getRegisterReport(user.businessId, filters);

      sendReportResponse(res, 'register_sessions_report', data, filters.format);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * 11. GET /api/reports/profit
 * Profit & Loss estimate report
 */
reportsRouter.get(
  '/profit',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const filters = parseFilters(req);
      const data = await ReportingService.getProfitEstimate(user.businessId, filters);

      if (filters.format === 'csv' || filters.format === 'excel') {
        const rows = [
          { Metric: 'Gross Sales (USD)', Amount: data.grossSalesUSD },
          { Metric: 'Discounts Granted (USD)', Amount: data.discountsUSD },
          { Metric: 'Net Sales (USD)', Amount: data.netSalesUSD },
          { Metric: 'Cost of Goods Sold (COGS USD)', Amount: data.cogsUSD },
          { Metric: 'Gross Profit (USD)', Amount: data.grossProfitUSD },
          { Metric: 'Gross Profit Margin (%)', Amount: `${data.grossProfitMarginPercent}%` },
          { Metric: 'Refunds Deducted (USD)', Amount: data.refundsUSD },
          { Metric: 'Estimated Net Product Profit (USD)', Amount: data.netProfitEstimateUSD },
          { Metric: 'Net Profit Margin (%)', Amount: `${data.netProfitMarginPercent}%` },
          { Metric: 'Taxes Collected (USD)', Amount: data.taxesCollectedUSD },
          { Metric: 'Cash Drawer Expenses (USD)', Amount: data.expensesUSD },
          { Metric: 'Net Operating Profit (USD)', Amount: data.netOperatingProfitUSD },
        ];
        sendReportResponse(res, 'profit_loss_estimate_report', { rows }, filters.format);
        return;
      }

      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);
