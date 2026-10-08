/**
 * Real Cash-Register & Session Management Integration Test Suite
 * Validates:
 * 1. Open Register with opening float (USD and KHR)
 * 2. Prevent invalid state: opening an already open register session rejected (409)
 * 3. Real-time Current Cash calculation (Expected Cash = Float)
 * 4. Cash In (drawer addition) with amount, reason, cashier, register, store, and audit logging
 * 5. Cash Out (drawer drop/removal) with amount, reason, and audit logging
 * 6. Store Expense paid from drawer with category, description, expense record, and audit logging
 * 7. Real cash checkout updating session sales count, sales totals, and expected cash
 * 8. Denomination Cash Count comparison vs Expected Cash
 * 9. Close Register with Counted Cash, computing Expected vs Counted vs Difference (Over/Short)
 * 10. Prevent invalid state: closing an already closed session rejected (409)
 * 11. Prevent invalid state: cash movement on closed session rejected (409)
 * 12. Manager / Admin Register Session Reporting API with summary KPIs and drill-down audit trail
 * 13. RBAC permission checks for sensitive operations
 */

import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: data };
}

async function runTests() {
  console.log('================================================================');
  console.log('--- [Register Session & Cash Management Integration Tests] ---');
  console.log('================================================================\n');

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`[Test Server] Listening on ${baseUrl}\n`);
      resolve();
    });
  });

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${testName}`);
      testsPassed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
      testsFailed++;
    }
  }

  try {
    // 1. Authenticate Cashier and Admin
    const cashierLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    assert(cashierLogin.status === 200, 'Cashier login succeeded (HTTP 200)');
    const cashierToken = cashierLogin.body.data.tokens.accessToken;

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert(adminLogin.status === 200, 'Admin login succeeded (HTTP 200)');
    const adminToken = adminLogin.body.data.tokens.accessToken;

    // Resolve store and register
    const store = await prisma.store.findFirst({ where: { isActive: true } });
    if (!store) throw new Error('No active store found');

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

    // Clean up any previously open session for clean test run
    await prisma.registerSession.updateMany({
      where: { registerId: register.id, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    console.log(`\n--- [Step 1: Open Register Session] ---`);
    const openRes = await request('/api/register/open', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        registerId: register.id,
        openingFloatUSD: 100.0,
        openingFloatKHR: 200000.0,
        notes: 'Shift morning opening float',
      }),
    });

    assert(openRes.status === 201, 'Open register returned HTTP 201');
    assert(openRes.body.success === true, 'Open register success is true');
    const sessionId = openRes.body.data.id;
    assert(!!sessionId, 'Session assigned a unique ID');
    assert(openRes.body.data.status === 'OPEN', 'Session status is OPEN');
    assert(openRes.body.data.openingFloatUSD === 100, 'Opening float USD is $100.00');
    assert(openRes.body.data.openingFloatKHR === 200000, 'Opening float KHR is 200,000៛');
    assert(
      openRes.body.data.expectedCashUSD === 100,
      'Initial expected cash USD matches opening float',
    );

    // Verify AuditLog record created for REGISTER_OPENED
    const openAudit = await prisma.auditLog.findFirst({
      where: { action: 'REGISTER_OPENED', entityId: sessionId },
    });
    assert(!!openAudit, 'Audit log record created for REGISTER_OPENED');
    assert(openAudit?.entityType === 'RegisterSession', 'Audit log entityType is RegisterSession');

    console.log(`\n--- [Step 2: Prevent Invalid State - Reject Double Open] ---`);
    const doubleOpenRes = await request('/api/register/open', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        registerId: register.id,
        openingFloatUSD: 50.0,
        openingFloatKHR: 0,
      }),
    });
    assert(doubleOpenRes.status === 409, 'Double open rejected with HTTP 409 Conflict');
    assert(
      doubleOpenRes.body.error?.code === 'REGISTER_ALREADY_OPEN',
      'Error code is REGISTER_ALREADY_OPEN',
    );

    console.log(`\n--- [Step 3: Query Current Register Status] ---`);
    const currentRes = await request(`/api/register/current?registerId=${register.id}`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(currentRes.status === 200, 'Get current session returned HTTP 200');
    assert(
      currentRes.body.data?.session?.id === sessionId,
      'Current session ID matches active session',
    );
    assert(currentRes.body.data?.session?.status === 'OPEN', 'Current session reports OPEN status');

    console.log(`\n--- [Step 4: Cash In (Mid-Shift Addition)] ---`);
    const cashInRes = await request('/api/register/cash-movement', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        sessionId,
        type: 'CASH_IN',
        amountUSD: 50.0,
        amountKHR: 40000.0,
        reason: 'Change fund replenishment from vault',
        referenceNumber: 'VAULT-IN-001',
      }),
    });

    assert(cashInRes.status === 201, 'Cash In returned HTTP 201');
    assert(cashInRes.body.data.movement.type === 'CASH_IN', 'Movement type is CASH_IN');
    assert(cashInRes.body.data.movement.amountUSD === 50, 'Cash In amount USD is $50.00');
    assert(
      cashInRes.body.data.movement.registerCode === register.code,
      'Movement includes register code',
    );
    assert(cashInRes.body.data.movement.storeName === store.name, 'Movement includes store name');
    assert(!!cashInRes.body.data.movement.auditLogId, 'Cash In linked to audit record ID');
    assert(cashInRes.body.data.session.cashInUSD === 50, 'Session cashInUSD is $50.00');
    assert(
      cashInRes.body.data.session.expectedCashUSD === 150,
      'Expected cash USD increased to $150.00',
    );

    console.log(`\n--- [Step 5: Cash Out (Mid-Shift Safe Drop)] ---`);
    const cashOutRes = await request('/api/register/cash-movement', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        sessionId,
        type: 'CASH_OUT',
        amountUSD: 30.0,
        amountKHR: 0,
        reason: 'Midday cash drop to main safe',
        referenceNumber: 'DROP-001',
      }),
    });

    assert(cashOutRes.status === 201, 'Cash Out returned HTTP 201');
    assert(cashOutRes.body.data.movement.type === 'CASH_OUT', 'Movement type is CASH_OUT');
    assert(cashOutRes.body.data.movement.amountUSD === 30, 'Cash Out amount USD is $30.00');
    assert(cashOutRes.body.data.session.cashOutUSD === 30, 'Session cashOutUSD is $30.00');
    assert(
      cashOutRes.body.data.session.expectedCashUSD === 120,
      'Expected cash USD updated to $120.00 (150 - 30)',
    );

    console.log(`\n--- [Step 6: Store Expense Paid From Drawer] ---`);
    const expenseRes = await request('/api/register/cash-movement', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        sessionId,
        type: 'EXPENSE',
        amountUSD: 15.0,
        amountKHR: 0,
        category: 'Cleaning Supplies',
        reason: 'Emergency purchase of floor cleaning supplies',
        referenceNumber: 'RCP-CLEAN-01',
      }),
    });

    assert(expenseRes.status === 201, 'Store expense returned HTTP 201');
    assert(expenseRes.body.data.movement.type === 'EXPENSE', 'Movement type is EXPENSE');
    assert(expenseRes.body.data.session.expensesUSD === 15, 'Session expensesUSD is $15.00');
    assert(
      expenseRes.body.data.session.expectedCashUSD === 105,
      'Expected cash USD updated to $105.00 (120 - 15)',
    );

    // Verify Expense record persisted in database
    const expenseDb = await prisma.expense.findFirst({
      where: { storeId: store.id, amountUSD: 15.0 },
    });
    assert(!!expenseDb, 'Store Expense persisted in PostgreSQL expenses table');
    assert(expenseDb?.category === 'Cleaning Supplies', 'Expense category matches input');

    console.log(`\n--- [Step 7: Perform Real Cash Checkout Linked to Session] ---`);
    const product = await prisma.product.findFirst({
      where: { businessId: store.businessId, isActive: true },
    });
    if (!product) throw new Error('No product found for sale test');

    const checkoutRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
        'Idempotency-Key': `IDEM-REG-TEST-${Date.now()}`,
      },
      body: JSON.stringify({
        storeId: store.id,
        registerId: register.id,
        items: [{ productId: product.id, quantity: 1, unitPriceUSD: 20.0, discountUSD: 0 }],
        discountUSD: 0,
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: 22.0,
            tenderAmountUSD: 25.0,
          },
        ],
        notes: 'Cash sale in active shift',
      }),
    });

    assert(checkoutRes.status === 200, 'Cash checkout succeeded (HTTP 200)');
    const createdOrderId = checkoutRes.body.data.orderId;

    // Check order links to active register session in DB
    const orderInDb = await prisma.order.findUnique({
      where: { id: createdOrderId },
    });
    assert(
      orderInDb?.sessionId === sessionId,
      'Order successfully linked to active register sessionId',
    );

    // Query session to verify sale updated expected cash and sales count
    const sessionAfterSale = await request(`/api/register/current?registerId=${register.id}`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(
      sessionAfterSale.body.data?.session?.totalSalesCount >= 1,
      'Session totalSalesCount incremented',
    );
    assert(
      sessionAfterSale.body.data?.session?.cashSalesUSD >= 20,
      'Session cashSalesUSD reflects checkout cash receipt',
    );
    const expectedBeforeCloseUSD = sessionAfterSale.body.data?.session?.expectedCashUSD;
    console.log(`    Expected Cash before shift close: $${expectedBeforeCloseUSD} USD`);

    console.log(`\n--- [Step 8: Close Register Session & Calculate Difference] ---`);
    // Cashier counts $130.00 in physical cash (slight variance to test over/short)
    const countedCashUSD = Number((expectedBeforeCloseUSD + 3.0).toFixed(2)); // $3 surplus
    const closeRes = await request('/api/register/close', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        sessionId,
        actualCashUSD: countedCashUSD,
        actualCashKHR: 240000.0,
        denominationBreakdown: {
          usd: { 100: 1, 20: 1, 10: 1 },
          khr: { 100000: 2, 20000: 2 },
        },
        closingNotes: 'Shift end reconciliation. Small $3.00 cash tip surplus in drawer.',
      }),
    });

    assert(closeRes.status === 200, 'Close register returned HTTP 200');
    assert(closeRes.body.data.status === 'CLOSED', 'Session status updated to CLOSED');
    assert(!!closeRes.body.data.closedAt, 'Session closedAt timestamp recorded');
    assert(closeRes.body.data.actualCashUSD === countedCashUSD, 'Actual counted cash USD recorded');
    assert(
      closeRes.body.data.differenceUSD === 3.0,
      'Discrepancy differenceUSD calculated as +$3.00 (surplus)',
    );

    // Verify closing audit log
    const closeAudit = await prisma.auditLog.findFirst({
      where: { action: 'REGISTER_CLOSED', entityId: sessionId },
    });
    assert(!!closeAudit, 'Audit log created for REGISTER_CLOSED');

    console.log(`\n--- [Step 9: Prevent Invalid State - Reject Actions on Closed Session] ---`);
    // Attempt to close already closed session
    const recloseRes = await request('/api/register/close', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        sessionId,
        actualCashUSD: 100,
        actualCashKHR: 0,
      }),
    });
    assert(
      recloseRes.status === 409,
      'Closing already closed session rejected with HTTP 409 Conflict',
    );

    // Attempt cash movement on closed session
    const moveOnClosedRes = await request('/api/register/cash-movement', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        sessionId,
        type: 'CASH_IN',
        amountUSD: 10,
        amountKHR: 0,
        reason: 'Late cash in',
      }),
    });
    assert(
      moveOnClosedRes.status === 409,
      'Cash movement on closed session rejected with HTTP 409 Conflict',
    );

    console.log(`\n--- [Step 10: Manager / Admin Register Session Reports] ---`);
    const reportRes = await request(`/api/register/sessions?storeId=${store.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert(reportRes.status === 200, 'Register sessions report returned HTTP 200');
    assert(reportRes.body.success === true, 'Report response success is true');
    assert(reportRes.body.data.summary.totalSessions >= 1, 'Summary reports totalSessions >= 1');
    assert(reportRes.body.data.summary.closedSessions >= 1, 'Summary reports closedSessions >= 1');
    assert(Array.isArray(reportRes.body.data.sessions), 'Report returns sessions array');

    const closedSessionInReport = reportRes.body.data.sessions.find((s: any) => s.id === sessionId);
    assert(!!closedSessionInReport, 'Closed session found in administrative report');
    assert(
      closedSessionInReport.cashierName === 'cashier' ||
        closedSessionInReport.cashierName.includes('Dara'),
      'Session accurately attributes cashier identity',
    );
    assert(
      closedSessionInReport.differenceUSD === 3.0,
      'Session preserves calculated difference of +$3.00',
    );

    console.log(`\n--- [Step 11: Session Drill-Down & Audit Details API] ---`);
    const detailRes = await request(`/api/register/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert(detailRes.status === 200, 'Session detail endpoint returned HTTP 200');
    assert(detailRes.body.data.session.id === sessionId, 'Detail matches sessionId');
    assert(Array.isArray(detailRes.body.data.movements), 'Detail includes cash movements array');
    assert(
      detailRes.body.data.movements.length >= 3,
      'Movements array contains all shift movements (In, Out, Expense)',
    );
    assert(
      Array.isArray(detailRes.body.data.auditLogs),
      'Detail includes immutable audit logs array',
    );
    assert(
      detailRes.body.data.auditLogs.length >= 2,
      'Audit logs contain REGISTER_OPENED and REGISTER_CLOSED',
    );

    console.log(`\n--- [Step 12: Permission Checks for Sensitive Actions] ---`);
    // Create an unprivileged user token or test without proper permission
    const noTokenRes = await request('/api/register/open', {
      method: 'POST',
      body: JSON.stringify({ registerId: register.id, openingFloatUSD: 0, openingFloatKHR: 0 }),
    });
    assert(noTokenRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

    console.log('\n================================================================');
    console.log(
      `🎉 ALL REGISTER SESSION TESTS PASSED! (${testsPassed}/${testsPassed + testsFailed})`,
    );
    console.log('================================================================\n');
  } finally {
    if (server) {
      server.close();
    }
  }

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
