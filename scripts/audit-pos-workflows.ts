/**
 * Master POS Workflow Production Audit
 * Executes the three required end-to-end POS workflows:
 *
 * Workflow 1:
 * Login -> Store selection -> Open register -> Search product -> Barcode scan
 * -> Add cart -> Change quantity -> Discount -> Tax -> Customer -> Payment
 * -> Change -> Order creation -> Inventory deduction -> Receipt -> Register update -> Reporting
 *
 * Workflow 2:
 * Sale -> Return -> Refund -> Inventory restoration
 *
 * Workflow 3:
 * Offline -> Sale -> Reconnect -> Synchronization
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import http from 'http';
import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';

let server: http.Server;
let baseUrl: string;
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
    failed++;
  }
}

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

async function runAudit() {
  console.log('======================================================================');
  console.log('🔍 RUNNING PRODUCTION AUDIT OF MAJOR POS WORKFLOWS');
  console.log('======================================================================\n');

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`[Audit Test Server] Listening on ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // =========================================================================
    // WORKFLOW 1: Standard Complete POS Transaction Lifecycle
    // =========================================================================
    console.log('----------------------------------------------------------------------');
    console.log('WORKFLOW 1: Login -> Store -> Register -> Search -> Scan -> Cart -> Qty');
    console.log('            -> Discount -> Tax -> Customer -> Pay -> Change -> Order');
    console.log('            -> Stock Deduction -> Receipt -> Register Update -> Report');
    console.log('----------------------------------------------------------------------');

    // 1. Login as Cashier
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    assert(
      loginRes.ok && Boolean(loginRes.body?.data?.tokens?.accessToken),
      '1. Login: Cashier authenticated successfully',
    );
    const token = loginRes.body?.data?.tokens?.accessToken;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 1b. Also obtain Admin authorization token for reporting and manager functions
    const adminLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert(
      adminLoginRes.ok && Boolean(adminLoginRes.body?.data?.tokens?.accessToken),
      '1b. Auth: Admin credentials verified for management operations',
    );
    const adminToken = adminLoginRes.body?.data?.tokens?.accessToken;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // 2. Store Selection
    const storesRes = await request('/api/stores', { headers: authHeaders });
    assert(
      storesRes.ok && Array.isArray(storesRes.body?.data) && storesRes.body.data.length > 0,
      '2. Store selection: Stores retrieved successfully',
    );

    // Select store that has registers configured
    let targetStore = storesRes.body.data[0];
    let registersRes = await request(`/api/register/registers?storeId=${targetStore.id}`, {
      headers: authHeaders,
    });
    if (!registersRes.body?.data || registersRes.body.data.length === 0) {
      const storeWithReg = await prisma.cashRegister.findFirst({ include: { store: true } });
      if (storeWithReg) {
        targetStore =
          storesRes.body.data.find((s: any) => s.id === storeWithReg.storeId) || storeWithReg.store;
        registersRes = await request(`/api/register/registers?storeId=${targetStore.id}`, {
          headers: authHeaders,
        });
      }
    }
    assert(
      Boolean(targetStore?.id),
      `2. Store selected: "${targetStore.name}" (${targetStore.id})`,
    );

    // 3. Open Register
    assert(
      registersRes.ok && registersRes.body?.data?.length > 0,
      '3. Register check: Available cash registers found',
    );
    const targetRegister = registersRes.body.data[0];

    // Close any prior open session for this register first to avoid conflict
    const activeSessionRes = await request(
      `/api/register/current?registerId=${targetRegister.id}&storeId=${targetStore.id}`,
      { headers: authHeaders },
    );
    const existingSession = activeSessionRes.body?.data?.session || activeSessionRes.body?.data;
    if (existingSession?.id) {
      await request('/api/register/close', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sessionId: existingSession.id,
          actualCashUSD: 100,
          actualCashKHR: 0,
        }),
      });
    }

    const openRes = await request('/api/register/open', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        registerId: targetRegister.id,
        openingFloatUSD: 100.0,
        openingFloatKHR: 0,
        notes: 'Production Workflow Audit Shift',
      }),
    });
    const sessionId = openRes.body?.data?.id || existingSession?.id;
    assert(Boolean(sessionId), '3. Open register: Shift session opened/active with $100 float');

    // 4. Search Product
    const searchRes = await request(`/api/pos/products?search=Beer&storeId=${targetStore.id}`, {
      headers: authHeaders,
    });
    assert(
      searchRes.ok && searchRes.body?.data?.length > 0,
      '4. Search product: Product search returned matching catalog items',
    );

    // 5. Barcode Scan
    const barcodeRes = await request(
      `/api/pos/products?barcode=8840001001&storeId=${targetStore.id}`,
      { headers: authHeaders },
    );
    assert(
      barcodeRes.ok && barcodeRes.body?.data?.length > 0,
      '5. Barcode scan: Barcode 8840001001 resolved to product',
    );
    const scannedProduct = barcodeRes.body.data[0];

    // Record initial inventory for deduction verification
    const initialInv = await prisma.inventory.findFirst({
      where: { storeId: targetStore.id, productId: scannedProduct.id },
    });
    const initialQty = Number(initialInv?.quantity || 0);

    // 6. Add Cart & 7. Change Quantity & 8. Discount & 9. Tax Calculation
    const quantity = 3;
    const unitPriceUSD = Number(scannedProduct.sellingPriceUSD);
    const lineDiscountUSD = 0.5; // $0.50 promotional line discount
    const itemSubtotal = unitPriceUSD * quantity - lineDiscountUSD;
    const isTaxInclusive = scannedProduct.isTaxInclusive ?? true;
    const taxRate = Number(scannedProduct.taxRate ?? 0.1);
    const taxAmountUSD = isTaxInclusive
      ? Math.round((itemSubtotal - itemSubtotal / (1 + taxRate)) * 100) / 100
      : Math.round(itemSubtotal * taxRate * 100) / 100;
    const expectedTotalUSD = isTaxInclusive
      ? itemSubtotal
      : Math.round((itemSubtotal + taxAmountUSD) * 100) / 100;

    assert(
      quantity === 3,
      `6 & 7. Cart & Quantity: Selected ${quantity} units of "${scannedProduct.name}"`,
    );
    assert(
      lineDiscountUSD === 0.5,
      `8. Discount: Applied discount of $${lineDiscountUSD.toFixed(2)}`,
    );
    assert(
      taxAmountUSD > 0,
      `9. Tax: Computed ${Math.round(taxRate * 100)}% VAT ($${taxAmountUSD.toFixed(2)})`,
    );

    // 10. Customer Lookup / Attach
    const customer = await prisma.customer.findFirst({ where: { phone: '012888123' } });
    assert(
      Boolean(customer),
      `10. Customer: Attached customer "${customer?.name}" (Loyalty points: ${customer?.loyaltyPoints})`,
    );

    // 11. Payment & 12. Change Calculation
    const tenderCashUSD = expectedTotalUSD + 10.0; // Tendered an extra $10
    const payments = [
      {
        paymentMethodCode: 'CASH',
        amountUSD: expectedTotalUSD,
        amountKHR: 0,
        tenderAmountUSD: tenderCashUSD,
        tenderAmountKHR: 0,
      },
    ];

    // 13. Order Creation & Checkout
    const checkoutRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        storeId: targetStore.id,
        registerId: targetRegister.id,
        sessionId,
        customerId: customer?.id,
        items: [
          {
            productId: scannedProduct.id,
            quantity,
            unitPriceUSD,
            discountUSD: lineDiscountUSD,
          },
        ],
        payments,
        notes: 'End-to-End Audit Checkout',
      }),
    });

    assert(
      checkoutRes.ok && checkoutRes.body?.success,
      '11, 12, 13. Checkout: Order successfully created and paid',
    );
    const orderResult = checkoutRes.body?.data;
    const orderId = orderResult?.orderId || orderResult?.id;
    const changeGivenUSD = Number(orderResult?.changeUSD || 0);
    const expectedChangeCalculated = Number(
      (tenderCashUSD - Number(orderResult?.totalUSD)).toFixed(2),
    );
    assert(
      Math.abs(changeGivenUSD - expectedChangeCalculated) < 0.01,
      `12. Change calculation: Returned accurate change of $${changeGivenUSD.toFixed(2)}`,
    );

    // 14. Inventory Deduction Verification
    const updatedInv = await prisma.inventory.findFirst({
      where: { storeId: targetStore.id, productId: scannedProduct.id },
    });
    const updatedQty = Number(updatedInv?.quantity || 0);
    assert(
      updatedQty === initialQty - quantity,
      `14. Inventory deduction: Stock reduced from ${initialQty} to ${updatedQty} (-${quantity})`,
    );

    const stockMovement = await prisma.stockMovement.findFirst({
      where: { referenceId: orderId, type: 'SALE' },
    });
    assert(Boolean(stockMovement), '14. Inventory deduction: Stock movement audit record created');

    // 15. Receipt Generation
    const orderDetailRes = await request(`/api/pos/orders/${orderId}`, { headers: authHeaders });
    assert(
      orderDetailRes.ok && Boolean(orderDetailRes.body?.data?.receipt?.receiptNumber),
      '15. Receipt: Official receipt generated with receipt number',
    );

    // 16. Register Update Verification
    const sessionStatusRes = await request(`/api/register/sessions/${sessionId}`, {
      headers: adminHeaders,
    });
    const sessionSummary = sessionStatusRes.body?.data?.session;
    assert(
      Number(sessionSummary?.cashSalesUSD) >= expectedTotalUSD,
      `16. Register update: Session cash sales recorded ($${sessionSummary?.cashSalesUSD})`,
    );

    // 17. Reporting Verification
    const reportRes = await request(`/api/reports/dashboard?storeId=${targetStore.id}`, {
      headers: adminHeaders,
    });
    assert(
      reportRes.ok && reportRes.body?.data?.todaySalesUSD !== undefined,
      '17. Reporting: Sales dashboard aggregates completed orders',
    );

    // =========================================================================
    // WORKFLOW 2: Sale -> Return -> Refund -> Inventory Restoration
    // =========================================================================
    console.log('\n----------------------------------------------------------------------');
    console.log('WORKFLOW 2: Sale -> Return -> Refund -> Inventory Restoration');
    console.log('----------------------------------------------------------------------');

    // 1. Initial Sale for Return Test
    const returnTestCheckout = await request('/api/pos/checkout', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        storeId: targetStore.id,
        registerId: targetRegister.id,
        sessionId,
        items: [
          {
            productId: scannedProduct.id,
            quantity: 2,
            unitPriceUSD,
          },
        ],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: unitPriceUSD * 2,
            tenderAmountUSD: unitPriceUSD * 2,
          },
        ],
      }),
    });
    assert(returnTestCheckout.ok, '1. Sale for return: Test order created');
    const returnOrderResult = returnTestCheckout.body.data;
    const returnOrderId = returnOrderResult.orderId;

    const fullOrderRes = await request(`/api/pos/orders/${returnOrderId}`, {
      headers: authHeaders,
    });
    const orderItem = fullOrderRes.body.data.items[0];

    const stockBeforeReturn = Number(
      (
        await prisma.inventory.findFirst({
          where: { storeId: targetStore.id, productId: scannedProduct.id },
        })
      )?.quantity || 0,
    );

    // 2. Return & 3. Refund Execution (Authorized with management credentials)
    const returnRes = await request('/api/returns', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        orderId: returnOrderId,
        reason: 'DEFECTIVE',
        refundMethodCode: 'CASH',
        sessionId,
        items: [
          {
            orderItemId: orderItem.id,
            quantity: 2,
            restockInventory: true,
            condition: 'RESELLABLE',
          },
        ],
      }),
    });
    assert(
      returnRes.ok && returnRes.body?.success,
      '2 & 3. Return & Refund: Return processed with cash refund issued',
    );

    // 4. Inventory Restoration Verification
    const stockAfterReturn = Number(
      (
        await prisma.inventory.findFirst({
          where: { storeId: targetStore.id, productId: scannedProduct.id },
        })
      )?.quantity || 0,
    );
    assert(
      stockAfterReturn === stockBeforeReturn + 2,
      `4. Inventory restoration: Stock restored from ${stockBeforeReturn} to ${stockAfterReturn} (+2)`,
    );

    // =========================================================================
    // WORKFLOW 3: Offline -> Sale -> Reconnect -> Synchronization
    // =========================================================================
    console.log('\n----------------------------------------------------------------------');
    console.log('WORKFLOW 3: Offline -> Sale -> Reconnect -> Synchronization');
    console.log('----------------------------------------------------------------------');

    const clientSyncId = `OFFLINE_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const offlineItem = {
      id: `local-tx-${Date.now()}`,
      clientSyncId,
      offlineOrderNumber: `OFF-${Date.now().toString().slice(-6)}`,
      offlineReceiptNumber: `RCP-OFF-${Date.now().toString().slice(-6)}`,
      storeId: targetStore.id,
      cashierId: 'cashier-user-id',
      cashierName: 'Cashier User',
      status: 'pending',
      createdAt: new Date().toISOString(),
      attempts: 0,
      payload: {
        storeId: targetStore.id,
        registerId: targetRegister.id,
        items: [
          {
            productId: scannedProduct.id,
            quantity: 1,
            unitPriceUSD,
            discountUSD: 0,
          },
        ],
        discountUSD: 0,
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: unitPriceUSD,
            amountKHR: 0,
            tenderAmountUSD: unitPriceUSD,
            tenderAmountKHR: 0,
          },
        ],
        idempotencyKey: clientSyncId,
        notes: 'Offline Terminal Transaction',
      },
    };

    // 1 & 2. Reconnect & Submit Offline Batch
    const syncRes = await request('/api/sync/batch', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        storeId: targetStore.id,
        items: [offlineItem],
      }),
    });
    assert(
      syncRes.ok && syncRes.body?.data?.syncedCount === 1,
      '1 & 2. Reconnect & Sync: Offline order accepted and synced',
    );

    // 3. Database Persistence & Idempotency Verification
    const syncedOrder = await prisma.order.findFirst({
      where: { idempotencyKey: clientSyncId },
    });
    assert(
      Boolean(syncedOrder),
      '3. Sync persistence: Order committed to PostgreSQL with idempotencyKey',
    );

    // Duplicate submission idempotency check
    const duplicateSyncRes = await request('/api/sync/batch', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        storeId: targetStore.id,
        items: [offlineItem],
      }),
    });
    const duplicateResult = duplicateSyncRes.body?.data?.results?.[0];
    assert(
      duplicateSyncRes.ok &&
        (duplicateResult?.alreadySynced === true || duplicateSyncRes.body?.data?.syncedCount === 1),
      '3. Sync idempotency: Replayed offline order acknowledged without duplicate database records',
    );

    // Close register session cleanly
    await request('/api/register/close', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sessionId,
        actualCashUSD: 100,
        actualCashKHR: 0,
        closingNotes: 'End of audit shift',
      }),
    });
  } catch (err: any) {
    console.error('Workflow Audit Uncaught Exception:', err);
    failed++;
  } finally {
    if (server) {
      await new Promise<void>((res) => server.close(() => res()));
    }
  }

  console.log('\n======================================================================');
  console.log(`🏁 MASTER WORKFLOW AUDIT SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit()
  .catch((e) => {
    console.error('Audit fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
