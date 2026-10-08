/**
 * Enterprise Reporting System Verification Suite
 * Validates:
 * 1. Executive Dashboard KPIs from backend
 *    - Today's sales (USD and KHR)
 *    - Transaction count
 *    - Average order value (AOV)
 *    - Gross sales
 *    - Refunds
 *    - Discounts
 *    - Taxes
 *    - Payment method breakdown
 *    - Top products
 *    - Low-stock products
 *    - Cashier performance
 * 2. All 12 Standard Enterprise Reports
 *    - Daily sales time-series
 *    - Weekly sales time-series
 *    - Monthly sales time-series
 *    - Product sales report
 *    - Category sales report
 *    - Cashier performance report
 *    - Payment method breakdown report
 *    - Real-time Inventory valuation report
 *    - Stock movement audit trail report
 *    - Returns & Refunds ledger report
 *    - Register sessions & cash drawer report
 *    - Profit & Loss estimate report
 * 3. Filter Parameters
 *    - Date range filtering
 *    - Store filtering
 *    - Cashier filtering
 *    - Payment method filtering
 * 4. Multi-Format Exports
 *    - CSV export format with UTF-8 BOM
 *    - Excel-compatible export format
 * 5. Strict Database Integrity Check:
 *    - Verifies report totals match actual transaction records in PostgreSQL
 */

import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';
import { ReportingService } from '../apps/api/src/services/report/ReportingService.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
let adminToken: string;
let businessId: string;
let storeId: string;
let cashierId: string;

async function request(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (adminToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, body: data, headers: res.headers };
  } else {
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const text = buffer.toString('utf-8');
    return { status: res.status, ok: res.ok, text, buffer, headers: res.headers };
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('--- [Enterprise Reporting System Complete Verification] ---');
  console.log('================================================================\n');

  // Setup Express server on dynamic port
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as any;
      baseUrl = `http://127.0.0.1:${address.port}`;
      console.log(`[Test Server] Listening on ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // 0. Setup: Authenticate as admin user
    console.log('--- [Step 0: Authentication & Business Context Setup] ---');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123',
      }),
    });

    assert(loginRes.status === 200, 'Admin login succeeded (HTTP 200)');
    assert(!!loginRes.body?.data?.tokens?.accessToken, 'Access token returned');
    adminToken = loginRes.body.data.tokens.accessToken;
    businessId = loginRes.body.data.user.businessId;

    const store = await prisma.store.findFirst({ where: { businessId } });
    assert(!!store, 'Active store found');
    storeId = store!.id;

    const cashier = await prisma.user.findFirst({ where: { businessId, username: 'cashier1' } });
    cashierId = cashier ? cashier.id : loginRes.body.data.user.id;

    // Fetch filters meta
    const metaRes = await request('/api/reports/filters-meta');
    assert(metaRes.status === 200, 'Filters metadata endpoint returned HTTP 200');
    assert(metaRes.body?.data?.stores?.length > 0, 'Metadata contains stores list');
    assert(metaRes.body?.data?.cashiers?.length > 0, 'Metadata contains cashiers list');
    assert(
      metaRes.body?.data?.paymentMethods?.length > 0,
      'Metadata contains payment methods list',
    );

    // 1. Executive Dashboard KPIs
    console.log('\n--- [Step 1: Dashboard Summary KPIs API & Metrics] ---');
    const dashRes = await request('/api/reports/dashboard');
    assert(dashRes.status === 200, 'GET /api/reports/dashboard returned HTTP 200');
    const dash = dashRes.body.data;

    // Verify all 11 required elements
    assert(
      typeof dash.todaySalesUSD === 'number',
      `Today's sales USD present: $${dash.todaySalesUSD}`,
    );
    assert(
      typeof dash.todaySalesKHR === 'number',
      `Today's sales KHR present: ${dash.todaySalesKHR.toLocaleString()}៛`,
    );
    assert(
      typeof dash.todayOrdersCount === 'number',
      `Today's transaction count present: ${dash.todayOrdersCount}`,
    );
    assert(
      typeof dash.todayAverageOrderValueUSD === 'number',
      `Today's AOV present: $${dash.todayAverageOrderValueUSD}`,
    );
    assert(typeof dash.grossSalesUSD === 'number', `Gross sales present: $${dash.grossSalesUSD}`);
    assert(typeof dash.refundsUSD === 'number', `Refunds present: $${dash.refundsUSD}`);
    assert(typeof dash.discountsUSD === 'number', `Discounts present: $${dash.discountsUSD}`);
    assert(typeof dash.taxesUSD === 'number', `Taxes present: $${dash.taxesUSD}`);
    assert(
      Array.isArray(dash.paymentBreakdown),
      `Payment breakdown is array with ${dash.paymentBreakdown.length} methods`,
    );
    assert(
      Array.isArray(dash.topProducts),
      `Top products is array with ${dash.topProducts.length} items`,
    );
    assert(
      Array.isArray(dash.lowStockProducts),
      `Low stock products is array with ${dash.lowStockProducts.length} alerts`,
    );
    assert(
      Array.isArray(dash.cashierPerformance),
      `Cashier performance is array with ${dash.cashierPerformance.length} cashiers`,
    );

    // 2. All 12 Reports Verification
    console.log('\n--- [Step 2: Verification of All 12 Core Enterprise Reports] ---');

    // Report 1: Daily Sales
    const dailyRes = await request('/api/reports/sales?interval=daily');
    assert(dailyRes.status === 200, 'Report 1: Daily sales report returned HTTP 200');
    assert(Array.isArray(dailyRes.body.data.rows), 'Daily sales contains rows array');

    // Report 2: Weekly Sales
    const weeklyRes = await request('/api/reports/sales?interval=weekly');
    assert(weeklyRes.status === 200, 'Report 2: Weekly sales report returned HTTP 200');
    assert(Array.isArray(weeklyRes.body.data.rows), 'Weekly sales contains rows array');

    // Report 3: Monthly Sales
    const monthlyRes = await request('/api/reports/sales?interval=monthly');
    assert(monthlyRes.status === 200, 'Report 3: Monthly sales report returned HTTP 200');
    assert(Array.isArray(monthlyRes.body.data.rows), 'Monthly sales contains rows array');

    // Report 4: Product Sales
    const prodRes = await request('/api/reports/products');
    assert(prodRes.status === 200, 'Report 4: Product sales report returned HTTP 200');
    assert(Array.isArray(prodRes.body.data.rows), 'Product sales contains rows array');

    // Report 5: Category Sales
    const catRes = await request('/api/reports/categories');
    assert(catRes.status === 200, 'Report 5: Category sales report returned HTTP 200');
    assert(Array.isArray(catRes.body.data.rows), 'Category sales contains rows array');

    // Report 6: Cashier Sales
    const cashierRes = await request('/api/reports/cashiers');
    assert(cashierRes.status === 200, 'Report 6: Cashier sales report returned HTTP 200');
    assert(Array.isArray(cashierRes.body.data.rows), 'Cashier sales contains rows array');

    // Report 7: Payment Method Report
    const payRes = await request('/api/reports/payments');
    assert(payRes.status === 200, 'Report 7: Payment method report returned HTTP 200');
    assert(Array.isArray(payRes.body.data.rows), 'Payment methods report contains rows array');

    // Report 8: Inventory Report
    const invRes = await request('/api/reports/inventory');
    assert(invRes.status === 200, 'Report 8: Inventory valuation report returned HTTP 200');
    assert(Array.isArray(invRes.body.data.rows), 'Inventory report contains rows array');
    assert(
      invRes.body.data.rows.length > 0,
      `Inventory rows count: ${invRes.body.data.rows.length}`,
    );

    // Report 9: Stock Movement Report
    const stockMoveRes = await request('/api/reports/stock-movements');
    assert(stockMoveRes.status === 200, 'Report 9: Stock movements report returned HTTP 200');
    assert(Array.isArray(stockMoveRes.body.data.rows), 'Stock movements contains rows array');

    // Report 10: Refund Report
    const refundRes = await request('/api/reports/refunds');
    assert(refundRes.status === 200, 'Report 10: Refunds report returned HTTP 200');
    assert(Array.isArray(refundRes.body.data.rows), 'Refunds report contains rows array');

    // Report 11: Register Report
    const regRes = await request('/api/reports/registers');
    assert(regRes.status === 200, 'Report 11: Register sessions report returned HTTP 200');
    assert(Array.isArray(regRes.body.data.rows), 'Register report contains rows array');

    // Report 12: Profit Estimate Report
    const profitRes = await request('/api/reports/profit');
    assert(profitRes.status === 200, 'Report 12: Profit estimate report returned HTTP 200');
    const profit = profitRes.body.data;
    assert(typeof profit.grossSalesUSD === 'number', 'Profit report includes grossSalesUSD');
    assert(typeof profit.cogsUSD === 'number', 'Profit report includes cogsUSD');
    assert(typeof profit.grossProfitUSD === 'number', 'Profit report includes grossProfitUSD');
    assert(
      typeof profit.netProfitEstimateUSD === 'number',
      'Profit report includes netProfitEstimateUSD',
    );
    assert(
      typeof profit.netOperatingProfitUSD === 'number',
      'Profit report includes netOperatingProfitUSD',
    );

    // 3. Filter Parameters Verification
    console.log('\n--- [Step 3: Verification of Multi-Dimensional Filters] ---');

    // Date filtering
    const dateFilteredRes = await request(
      `/api/reports/dashboard?startDate=2026-01-01T00:00:00.000Z&endDate=2026-12-31T23:59:59.999Z`,
    );
    assert(dateFilteredRes.status === 200, 'Date filtering endpoint returned HTTP 200');

    // Store filtering
    const storeFilteredRes = await request(`/api/reports/dashboard?storeId=${storeId}`);
    assert(storeFilteredRes.status === 200, 'Store filtering endpoint returned HTTP 200');

    // Cashier filtering
    const cashierFilteredRes = await request(`/api/reports/dashboard?cashierId=${cashierId}`);
    assert(cashierFilteredRes.status === 200, 'Cashier filtering endpoint returned HTTP 200');

    // Payment filtering
    const paymentFilteredRes = await request(`/api/reports/dashboard?paymentMethodCode=CASH`);
    assert(paymentFilteredRes.status === 200, 'Payment method code filtering returned HTTP 200');

    // 4. Export Formats (CSV & Excel)
    console.log('\n--- [Step 4: Export Format Support (CSV & Excel with UTF-8 BOM)] ---');

    // CSV Export
    const csvExportRes = await request('/api/reports/products?format=csv');
    assert(csvExportRes.status === 200, 'Product report CSV export returned HTTP 200');
    assert(
      csvExportRes.headers.get('content-type')?.includes('text/csv') || false,
      'CSV Content-Type is text/csv',
    );
    assert(
      csvExportRes.headers.get('content-disposition')?.includes('attachment') || false,
      'Content-Disposition attachment set',
    );
    const hasBom =
      (csvExportRes.buffer &&
        csvExportRes.buffer[0] === 0xef &&
        csvExportRes.buffer[1] === 0xbb &&
        csvExportRes.buffer[2] === 0xbf) ||
      csvExportRes.text?.charCodeAt(0) === 0xfeff;
    assert(hasBom, 'CSV starts with UTF-8 BOM byte order mark');

    // Excel Export
    const excelExportRes = await request('/api/reports/products?format=excel');
    assert(excelExportRes.status === 200, 'Product report Excel export returned HTTP 200');
    const excelHasBom =
      (excelExportRes.buffer &&
        excelExportRes.buffer[0] === 0xef &&
        excelExportRes.buffer[1] === 0xbb &&
        excelExportRes.buffer[2] === 0xbf) ||
      excelExportRes.text?.charCodeAt(0) === 0xfeff;
    assert(excelHasBom, 'Excel export formatted with UTF-8 BOM for Microsoft Excel');

    // Profit report CSV/Excel export
    const profitCsvRes = await request('/api/reports/profit?format=csv');
    assert(profitCsvRes.status === 200, 'Profit report CSV export returned HTTP 200');
    assert(
      profitCsvRes.text?.includes('Gross Sales (USD)') || false,
      'Profit CSV contains formatted metric rows',
    );

    // 5. Strict Database Integrity Check: Report Totals vs Actual Records
    console.log(
      '\n--- [Step 5: Verifying Report Totals Against Actual Database Transaction Records] ---',
    );

    // Fetch actual records from PostgreSQL directly via Prisma
    const [dbOrders, dbRefunds, dbPayments] = await Promise.all([
      prisma.order.findMany({
        where: {
          businessId,
          status: { in: ['COMPLETED', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
        },
        select: {
          id: true,
          totalUSD: true,
          discountAmountUSD: true,
          taxAmountUSD: true,
          refundedAmountUSD: true,
        },
      }),
      prisma.refund.findMany({
        where: { businessId },
        select: { amountUSD: true },
      }),
      prisma.payment.findMany({
        where: {
          order: {
            businessId,
            status: { in: ['COMPLETED', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
          },
          status: 'COMPLETED',
        },
        select: { amountUSD: true },
      }),
    ]);

    const actualDbOrdersCount = dbOrders.length;
    const actualDbGrossSales = dbOrders.reduce((sum, o) => sum + Number(o.totalUSD), 0);
    const actualDbDiscounts = dbOrders.reduce((sum, o) => sum + Number(o.discountAmountUSD), 0);
    const actualDbTaxes = dbOrders.reduce((sum, o) => sum + Number(o.taxAmountUSD), 0);
    const actualDbRefunds = dbRefunds.reduce((sum, r) => sum + Number(r.amountUSD), 0);
    const actualDbPayments = dbPayments.reduce((sum, p) => sum + Number(p.amountUSD), 0);

    const reportSummary = await ReportingService.getDashboardSummary(businessId, {});

    console.log('----------------------------------------------------------------');
    console.log('Metric               | Report Value | Database Ground Truth | Diff');
    console.log('----------------------------------------------------------------');
    console.log(
      `Transaction Count    | ${reportSummary.totalOrdersCount.toString().padEnd(12)} | ${actualDbOrdersCount.toString().padEnd(21)} | ${Math.abs(reportSummary.totalOrdersCount - actualDbOrdersCount)}`,
    );
    console.log(
      `Gross Sales (USD)    | $${reportSummary.grossSalesUSD.toFixed(2).padEnd(11)} | $${actualDbGrossSales.toFixed(2).padEnd(20)} | $${Math.abs(reportSummary.grossSalesUSD - actualDbGrossSales).toFixed(2)}`,
    );
    console.log(
      `Discounts (USD)      | $${reportSummary.discountsUSD.toFixed(2).padEnd(11)} | $${actualDbDiscounts.toFixed(2).padEnd(20)} | $${Math.abs(reportSummary.discountsUSD - actualDbDiscounts).toFixed(2)}`,
    );
    console.log(
      `Taxes (USD)          | $${reportSummary.taxesUSD.toFixed(2).padEnd(11)} | $${actualDbTaxes.toFixed(2).padEnd(20)} | $${Math.abs(reportSummary.taxesUSD - actualDbTaxes).toFixed(2)}`,
    );
    console.log(
      `Refunds (USD)        | $${reportSummary.refundsUSD.toFixed(2).padEnd(11)} | $${actualDbRefunds.toFixed(2).padEnd(20)} | $${Math.abs(reportSummary.refundsUSD - actualDbRefunds).toFixed(2)}`,
    );

    const reportPaymentTotal = reportSummary.paymentBreakdown.reduce(
      (sum, p) => sum + p.amountUSD,
      0,
    );
    console.log(
      `Completed Payments   | $${reportPaymentTotal.toFixed(2).padEnd(11)} | $${actualDbPayments.toFixed(2).padEnd(20)} | $${Math.abs(reportPaymentTotal - actualDbPayments).toFixed(2)}`,
    );
    console.log('----------------------------------------------------------------\n');

    // Strict assertions: exact mathematical parity
    assert(
      reportSummary.totalOrdersCount === actualDbOrdersCount,
      `Report orders count (${reportSummary.totalOrdersCount}) exactly matches DB records (${actualDbOrdersCount})`,
    );

    assert(
      Math.abs(reportSummary.grossSalesUSD - actualDbGrossSales) < 0.05,
      `Report gross sales ($${reportSummary.grossSalesUSD}) matches sum of order records ($${actualDbGrossSales.toFixed(2)})`,
    );

    assert(
      Math.abs(reportSummary.discountsUSD - actualDbDiscounts) < 0.05,
      `Report discounts ($${reportSummary.discountsUSD}) matches sum of discount records ($${actualDbDiscounts.toFixed(2)})`,
    );

    assert(
      Math.abs(reportSummary.taxesUSD - actualDbTaxes) < 0.05,
      `Report taxes ($${reportSummary.taxesUSD}) matches sum of tax records ($${actualDbTaxes.toFixed(2)})`,
    );

    assert(
      Math.abs(reportPaymentTotal - actualDbPayments) < 0.05,
      `Report payments total ($${reportPaymentTotal.toFixed(2)}) matches sum of payment records ($${actualDbPayments.toFixed(2)})`,
    );

    console.log('\n================================================================');
    console.log('🎉 ALL REPORTING SYSTEM VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
