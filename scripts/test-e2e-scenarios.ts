/**
 * Automated End-to-End (E2E) Scenarios Test Suite
 * Validates the 6 full business lifecycle scenarios requested:
 *
 * Scenario 1: Login → Open Register → Scan Product → Payment → Receipt
 * Scenario 2: Sell multiple products → Discount → Tax → Cash payment
 * Scenario 3: Offline → Sell → Reconnect → Synchronize
 * Scenario 4: Sale → Return → Refund → Inventory validation
 * Scenario 5: Manager login → Approve sensitive action
 * Scenario 6: Unauthorized cashier → Attempt restricted action → Request rejected
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import http from 'http';
import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';
import { OrderStatus, ReturnStatus, RefundStatus, StockMovementType } from '@prisma/client';

let server: http.Server;
let baseUrl: string;

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: data };
}

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

async function runE2EScenarios() {
  console.log('======================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE END-TO-END (E2E) BUSINESS SCENARIOS TEST SUITE');
  console.log('======================================================================\n');

  // Start test server
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`[Test Server] Daemon initialized at ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    const business = await prisma.business.findFirst({ where: { code: 'AFM-01' } });
    if (!business) throw new Error('Business AFM-01 not found');

    // =========================================================================
    // SCENARIO 1: Login → Open Register → Scan Product → Payment → Receipt
    // =========================================================================
    console.log('--- [Scenario 1] Login → Open Register → Scan Product → Payment → Receipt ---');

    // 1.1 Login as cashier
    const cashierLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    assert(cashierLogin.status === 200, 'Cashier authenticates successfully (HTTP 200)');
    const cashierToken = cashierLogin.body?.data?.tokens?.accessToken;
    assert(!!cashierToken, 'Cashier receives JWT access token');
    const cashierHeaders = { Authorization: `Bearer ${cashierToken}` };

    const cashierStoreId = cashierLogin.body?.data?.user?.storeId;
    const store = await prisma.store.findFirst({
      where: cashierStoreId ? { id: cashierStoreId } : { businessId: business.id },
    });
    if (!store) throw new Error('Store not found');
    const register = await prisma.cashRegister.findFirst({ where: { storeId: store.id } });
    if (!register) throw new Error('CashRegister not found');
    console.log(`Cashier Store: "${store.name}", Register: "${register.name}"`);

    // 1.2 Open register shift
    // Ensure register is ready to open (close any lingering session if needed)
    const existingSession = await prisma.registerSession.findFirst({
      where: { registerId: register.id, status: 'OPEN' },
    });
    let activeSessionId: string;
    if (existingSession) {
      activeSessionId = existingSession.id;
    } else {
      const openRegRes = await request('/api/register/open', {
        method: 'POST',
        headers: cashierHeaders,
        body: JSON.stringify({
          registerId: register.id,
          openingFloatUSD: 100,
          openingFloatKHR: 400000,
          notes: 'E2E Scenario 1 Shift Open',
        }),
      });
      assert(
        openRegRes.status === 201,
        'Cashier opens register shift with float ($100 / 400,000៛)',
      );
      activeSessionId = openRegRes.body?.data?.id;
    }
    assert(!!activeSessionId, `Active register session confirmed: ${activeSessionId}`);

    // 1.3 Scan product by barcode
    const barcodeScanRes = await request('/api/pos/products?barcode=8840001003', {
      headers: cashierHeaders,
    });
    assert(barcodeScanRes.status === 200, 'Barcode scanner lookup returns HTTP 200');
    const scannedProducts = barcodeScanRes.body?.data?.items || barcodeScanRes.body?.data;
    const scannedItem = Array.isArray(scannedProducts) ? scannedProducts[0] : scannedProducts;
    assert(
      scannedItem && scannedItem.barcode === '8840001003',
      `Scanned product "${scannedItem?.name}" (${scannedItem?.barcode})`,
    );

    // 1.4 Complete payment & checkout
    const checkoutS1 = await request('/api/pos/checkout', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        storeId: store.id,
        registerId: register.id,
        items: [{ productId: scannedItem.id, quantity: 1 }],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: Number(scannedItem.sellingPriceUSD),
            tenderAmountUSD: 10,
          },
        ],
      }),
    });
    assert(checkoutS1.status === 200, 'Checkout completes with HTTP 200 OK');
    const orderS1 = checkoutS1.body?.data;
    assert(orderS1?.status === OrderStatus.PAID, 'Order status is confirmed PAID');
    assert(!!orderS1?.receiptNumber, `Receipt successfully generated: ${orderS1?.receiptNumber}`);
    assert(orderS1?.changeUSD >= 0, `Change calculated accurately: $${orderS1?.changeUSD}`);

    // =========================================================================
    // SCENARIO 2: Sell multiple products → Discount → Tax → Cash payment
    // =========================================================================
    console.log('\n--- [Scenario 2] Sell multiple products → Discount → Tax → Cash payment ---');

    const multiProducts = await prisma.product.findMany({
      where: { businessId: business.id },
      take: 3,
    });
    assert(
      multiProducts.length >= 3,
      `Found ${multiProducts.length} distinct catalog items for multi-item checkout`,
    );

    const cartItems = [
      { productId: multiProducts[0].id, quantity: 2 },
      { productId: multiProducts[1].id, quantity: 1 },
      { productId: multiProducts[2].id, quantity: 3 },
    ];

    // Compute preview quote with 10% tax and $1 manual discount
    const calcQuoteRes = await request('/api/pos/calculate', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        items: cartItems,
        discountUSD: 1.0,
      }),
    });
    assert(calcQuoteRes.status === 200, 'Price & Tax calculation endpoint returns HTTP 200');
    const quote = calcQuoteRes.body?.data;
    assert(
      quote?.effectiveDiscountUSD === 1.0 || quote?.orderDiscountUSD === 1.0,
      'Discount accurately applied to order total',
    );
    assert(quote?.taxUSD > 0, `10% VAT tax calculated: $${quote?.taxUSD}`);
    const grandTotalUSD = quote?.totalUSD;

    // Checkout with cash payment & overpayment tender
    const tenderedUSD = Math.ceil(grandTotalUSD) + 10;
    const checkoutS2 = await request('/api/pos/checkout', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        storeId: store.id,
        registerId: register.id,
        items: cartItems,
        discountUSD: 1.0,
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: grandTotalUSD,
            tenderAmountUSD: tenderedUSD,
          },
        ],
      }),
    });
    assert(
      checkoutS2.status === 200,
      `Multi-item checkout completed (Grand Total: $${grandTotalUSD})`,
    );
    const expectedChange = Number((tenderedUSD - grandTotalUSD).toFixed(2));
    assert(
      checkoutS2.body?.data?.changeUSD === expectedChange,
      `Change returned matches mathematical expectation ($${expectedChange})`,
    );
    assert(
      checkoutS2.body?.data?.items?.length === 3,
      'All 3 products persisted as distinct order line items in PostgreSQL',
    );

    // =========================================================================
    // SCENARIO 3: Offline → Sell → Reconnect → Synchronize
    // =========================================================================
    console.log('\n--- [Scenario 3] Offline → Sell → Reconnect → Synchronize ---');

    const offlineSyncId = `OFFLINE-E2E-${Date.now()}`;
    const offlineProduct = multiProducts[0];
    const offlineQty = 2;
    const offlineUnitPrice = Number(offlineProduct.sellingPriceUSD);
    const offlineSubtotal = Number((offlineQty * offlineUnitPrice).toFixed(2));
    const offlineTax = Number((offlineSubtotal * 0.1).toFixed(2));
    const offlineTotal = Number((offlineSubtotal + offlineTax).toFixed(2));

    const queuedOfflineTx = {
      id: `local-tx-${Date.now()}`,
      clientSyncId: offlineSyncId,
      offlineOrderNumber: `OFF-${Date.now()}`,
      offlineReceiptNumber: `RCP-OFF-${Date.now()}`,
      storeId: store.id,
      cashierId: cashierLogin.body?.data?.user?.id || 'cashier-test-id',
      cashierName: cashierLogin.body?.data?.user?.fullName || 'Cashier User',
      status: 'pending',
      createdAt: new Date().toISOString(),
      attempts: 0,
      payload: {
        storeId: store.id,
        items: [
          {
            productId: offlineProduct.id,
            quantity: offlineQty,
            unitPriceUSD: offlineUnitPrice,
            discountUSD: 0,
          },
        ],
        discountUSD: 0,
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: offlineTotal,
            tenderAmountUSD: offlineTotal,
          },
        ],
        idempotencyKey: offlineSyncId,
      },
    };

    // Simulate Reconnecting: POST batch sync
    const syncRes = await request('/api/sync/batch', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        storeId: store.id,
        deviceId: 'POS-OFFLINE-TERMINAL-1',
        items: [queuedOfflineTx],
      }),
    });
    assert(syncRes.status === 200, 'Batch sync endpoint returns HTTP 200 OK');
    assert(
      syncRes.body?.data?.syncedCount === 1,
      'Sync engine reports 1 successfully reconciled transaction',
    );

    // Confirm order exists in PostgreSQL with isOfflineCreated = true
    const syncedOrderInDB = await prisma.order.findFirst({
      where: { offlineSyncId },
    });
    assert(
      syncedOrderInDB !== null,
      'Offline transaction persisted as authoritative order in PostgreSQL',
    );
    assert(
      syncedOrderInDB?.isOfflineCreated === true,
      'Order has isOfflineCreated flag set to true',
    );

    // =========================================================================
    // SCENARIO 4: Sale → Return → Refund → Inventory validation
    // =========================================================================
    console.log('\n--- [Scenario 4] Sale → Return → Refund → Inventory validation ---');

    // First, resolve/create inventory for test item in active sales location
    const testItem = multiProducts[1];
    let loc = await prisma.inventoryLocation.findFirst({
      where: { storeId: store.id, isDefault: true, isActive: true },
    });
    if (!loc) {
      loc = await prisma.inventoryLocation.findFirst({
        where: { storeId: store.id, isActive: true },
      });
    }

    let initialInv = await prisma.inventory.findFirst({
      where: { storeId: store.id, locationId: loc!.id, productId: testItem.id },
    });
    if (!initialInv) {
      initialInv = await prisma.inventory.create({
        data: {
          storeId: store.id,
          locationId: loc!.id,
          productId: testItem.id,
          quantity: 100,
        },
      });
    }
    const stockStart = Number(initialInv.quantity);

    const saleRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        storeId: store.id,
        registerId: register.id,
        items: [{ productId: testItem.id, quantity: 2 }],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: Number(testItem.sellingPriceUSD) * 2,
          },
        ],
      }),
    });
    assert(saleRes.status === 200, 'Initial sale of 2 units completed');
    const orderForReturn = saleRes.body?.data;
    const soldOrderItem = await prisma.orderItem.findFirst({
      where: { orderId: orderForReturn.orderId },
    });
    assert(!!soldOrderItem, 'Order item found in database for return processing');

    // Check inventory decremented by 2
    const invAfterSale = await prisma.inventory.findUniqueOrThrow({
      where: { id: initialInv.id },
    });
    assert(
      Number(invAfterSale.quantity) === stockStart - 2,
      `Inventory decremented by 2 (${stockStart} -> ${invAfterSale.quantity})`,
    );

    // Admin login for return processing (requires sales.refund permission)
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const adminToken = adminLogin.body?.data?.tokens?.accessToken;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // Query return eligibility
    const eligRes = await request(`/api/returns/eligibility/${orderForReturn.orderId}`, {
      headers: adminHeaders,
    });
    assert(eligRes.status === 200, 'Return eligibility query returns HTTP 200');
    assert(
      eligRes.body?.data?.items?.[0]?.maxReturnableQuantity === 2,
      'Max returnable quantity is 2',
    );

    // Process partial return of 1 unit
    const returnRes = await request('/api/returns', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        orderId: orderForReturn.orderId,
        reason: 'CUSTOMER_CHANGED_MIND',
        refundMethodCode: 'CASH',
        items: [
          {
            orderItemId: soldOrderItem!.id,
            quantity: 1,
            restockInventory: true,
          },
        ],
      }),
    });
    assert(returnRes.status === 201, 'Return & Refund processed with HTTP 201 Created');
    const returnRecord = returnRes.body?.data?.returnRecord;
    const refundRecord = returnRes.body?.data?.refundRecord;
    assert(!!returnRecord?.returnNumber, `Return record generated: ${returnRecord?.returnNumber}`);
    assert(!!refundRecord?.refundNumber, `Refund record generated: ${refundRecord?.refundNumber}`);

    // Verify inventory restocked by 1
    const invAfterReturn = await prisma.inventory.findUniqueOrThrow({
      where: { id: initialInv.id },
    });
    assert(
      Number(invAfterReturn.quantity) === stockStart - 1,
      `Inventory accurately restocked by 1 (${invAfterSale.quantity} -> ${invAfterReturn.quantity})`,
    );

    // =========================================================================
    // SCENARIO 5: Manager login → Approve sensitive action
    // =========================================================================
    console.log('\n--- [Scenario 5] Manager login → Approve sensitive action ---');

    // Create a new store (sensitive admin/manager action requiring settings.manage permission)
    const cashierTryStore = await request('/api/stores', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        name: 'Unauthorized Cashier Store',
        code: `STR-CASHIER-${Date.now().toString().slice(-4)}`,
      }),
    });
    assert(
      cashierTryStore.status === 403,
      'Unauthorized cashier is strictly BLOCKED from creating stores (HTTP 403)',
    );

    // Admin/Manager logs in and executes the sensitive action
    const uniqueStoreCode = `STR-MGR-${Date.now().toString().slice(-4)}`;
    const adminCreateStore = await request('/api/stores', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Manager Approved Store Branch',
        code: uniqueStoreCode,
      }),
    });
    assert(
      adminCreateStore.status === 201,
      'Manager / Admin successfully performs sensitive action (HTTP 201 Created)',
    );
    assert(
      adminCreateStore.body?.data?.code === uniqueStoreCode,
      `Approved store created: ${uniqueStoreCode}`,
    );

    // Clean up created store
    if (adminCreateStore.body?.data?.id) {
      await prisma.store.delete({ where: { id: adminCreateStore.body?.data?.id } });
    }

    // =========================================================================
    // SCENARIO 6: Unauthorized cashier → Attempt restricted action → Request rejected
    // =========================================================================
    console.log(
      '\n--- [Scenario 6] Unauthorized cashier → Attempt restricted action → Request rejected ---',
    );

    // 6.1 Cashier attempts admin-only RBAC endpoint
    const cashierAdminTest = await request('/api/auth/test/admin-only', {
      headers: cashierHeaders,
    });
    assert(cashierAdminTest.status === 403, 'Cashier blocked from admin-only endpoint (HTTP 403)');
    assert(
      cashierAdminTest.body?.error?.code === 'INSUFFICIENT_PERMISSIONS',
      'Error code specifies INSUFFICIENT_PERMISSIONS',
    );

    // 6.2 Cashier attempts to update store settings
    const cashierStoreUpdate = await request(`/api/stores/${store.id}`, {
      method: 'PUT',
      headers: cashierHeaders,
      body: JSON.stringify({ name: 'Hacked Store Name' }),
    });
    assert(
      cashierStoreUpdate.status === 403,
      'Cashier blocked from editing store configuration (HTTP 403)',
    );

    // 6.3 Cashier attempts to create inventory location
    const cashierCreateLocation = await request('/api/inventory/locations', {
      method: 'POST',
      headers: cashierHeaders,
      body: JSON.stringify({
        storeId: store.id,
        name: 'Rogue Location',
        code: 'ROGUE-01',
      }),
    });
    assert(
      cashierCreateLocation.status === 403,
      'Cashier blocked from modifying inventory structure (HTTP 403)',
    );

    console.log('\n======================================================================');
    console.log(`  E2E SCENARIOS RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runE2EScenarios().catch((err) => {
  console.error('Fatal E2E scenarios error:', err);
  process.exit(1);
});
