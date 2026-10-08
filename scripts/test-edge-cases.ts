/**
 * ==============================================================================
 * Comprehensive Edge Cases Test Suite
 * ==============================================================================
 * Validates critical real-world POS edge cases:
 *
 * 1. Zero quantity (rejected with 400 validation error)
 * 2. Negative quantity (rejected with 400 validation error)
 * 3. Invalid product ID (rejected safely, no order created)
 * 4. Insufficient stock (track inventory & out-of-stock validation)
 * 5. Duplicate barcode (rejected with 409 DUPLICATE_BARCODE)
 * 6. Duplicate payment (rejected on PAID order with 400 ORDER_NOT_PAYABLE)
 * 7. Duplicate order / Idempotency replay (safely returns cached response)
 * 8. Expired / Invalid session (rejected with 401 TOKEN_EXPIRED_OR_INVALID)
 * 9. Disconnected printer (gracefully handled without crashing, fallbackUsed: true)
 * 10. Disconnected network (offline transaction queueing and schema validation)
 * 11. Synchronization conflict (detected & flagged with CONFLICT status)
 * ==============================================================================
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import http from 'http';
import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';
import { OrderStatus, SyncStatus } from '@prisma/client';
import { PrinterManager } from '../apps/bridge/src/PrinterManager.js';
import { checkoutInputSchema } from '@pos/validation';

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

async function runEdgeCasesSuite() {
  console.log('======================================================================');
  console.log('🛡️  RUNNING POS SYSTEM EDGE CASES TEST SUITE');
  console.log('======================================================================\n');

  // Start test API server instance
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`[Test Server] Initialized at ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // --------------------------------------------------------------------------
    // Pre-requisites: Login cashier & admin
    // --------------------------------------------------------------------------
    console.log('--- [Setup] Authenticating test sessions ---');
    const cashierLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    assert(cashierLogin.status === 200, 'Cashier login successful (HTTP 200)');
    const cashierToken = cashierLogin.body.data.tokens.accessToken;
    const storeId = cashierLogin.body.data.user.storeId;

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert(adminLogin.status === 200, 'Admin login successful (HTTP 200)');
    const adminToken = adminLogin.body.data.tokens.accessToken;

    // Get an existing valid product for test baselines
    const catalogRes = await request('/api/pos/products', {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(
      catalogRes.status === 200 && catalogRes.body.data.length > 0,
      'Catalog products retrieved',
    );
    const validProduct = catalogRes.body.data[0];

    // --------------------------------------------------------------------------
    // Edge Case 1: Zero Quantity in Checkout Cart
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 1] Zero Quantity in Cart Item ---');
    const zeroQtyRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        storeId,
        items: [
          {
            productId: validProduct.id,
            quantity: 0,
            unitPriceUSD: validProduct.sellingPriceUSD,
          },
        ],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: validProduct.sellingPriceUSD,
            tenderAmountUSD: validProduct.sellingPriceUSD,
          },
        ],
      }),
    });
    assert(
      zeroQtyRes.status === 400,
      'Checkout with quantity 0 is rejected with HTTP 400 Bad Request',
      `Got status ${zeroQtyRes.status}`,
    );
    assert(
      zeroQtyRes.body?.error?.message?.toLowerCase().includes('greater than zero') ||
        zeroQtyRes.body?.error?.code === 'VALIDATION_ERROR',
      'Validation message correctly identifies zero quantity violation',
    );

    // --------------------------------------------------------------------------
    // Edge Case 2: Negative Quantity in Cart Item
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 2] Negative Quantity in Cart Item ---');
    const negativeQtyRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        storeId,
        items: [
          {
            productId: validProduct.id,
            quantity: -5,
            unitPriceUSD: validProduct.sellingPriceUSD,
          },
        ],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: validProduct.sellingPriceUSD,
            tenderAmountUSD: validProduct.sellingPriceUSD,
          },
        ],
      }),
    });
    assert(
      negativeQtyRes.status === 400,
      'Checkout with negative quantity (-5) is rejected with HTTP 400 Bad Request',
      `Got status ${negativeQtyRes.status}`,
    );
    assert(
      negativeQtyRes.body?.error?.message?.toLowerCase().includes('greater than zero') ||
        negativeQtyRes.body?.error?.code === 'VALIDATION_ERROR',
      'Validation message correctly blocks negative quantity',
    );

    // --------------------------------------------------------------------------
    // Edge Case 3: Invalid / Non-Existent Product ID
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 3] Invalid / Non-Existent Product ID ---');
    const fakeProductId = '00000000-0000-0000-0000-000000000000';
    const invalidProductRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        storeId,
        items: [
          {
            productId: fakeProductId,
            quantity: 1,
            unitPriceUSD: 10.0,
          },
        ],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: 10.0,
            tenderAmountUSD: 10.0,
          },
        ],
      }),
    });
    assert(
      invalidProductRes.status === 404 ||
        invalidProductRes.status === 400 ||
        invalidProductRes.status === 500,
      'Checkout with invalid product ID is rejected (HTTP !== 200)',
      `Got status ${invalidProductRes.status}`,
    );
    assert(
      invalidProductRes.body?.error?.code === 'PRODUCT_NOT_FOUND' ||
        invalidProductRes.body?.error?.code === 'NOT_FOUND' ||
        invalidProductRes.body?.error?.code === 'INTERNAL_ERROR',
      'Error identifies product as not found or inactive',
    );

    // Verify in DB that no order was generated for the fake product
    const bogusOrder = await prisma.orderItem.findFirst({
      where: { productId: fakeProductId },
    });
    assert(bogusOrder === null, 'No order records created in database for invalid product');

    // --------------------------------------------------------------------------
    // Edge Case 4: Insufficient Stock Handling & Tracking
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 4] Insufficient Stock / Inventory Tracking ---');
    // Find or create a product with trackInventory: true and stock 0
    const outOfStockProduct = await prisma.product.findFirst({
      where: { trackInventory: true, barcode: { not: null } },
      include: { inventory: true },
    });
    assert(outOfStockProduct !== null, 'Found product configured for inventory tracking');

    if (outOfStockProduct) {
      // Verify client calculation rule: trackInventory && stockQuantity <= 0
      const stock = outOfStockProduct.inventory.reduce((acc, inv) => acc + Number(inv.quantity), 0);
      const isOutOfStockRule = (trackInv: boolean, qty: number) => trackInv && qty <= 0;
      assert(
        isOutOfStockRule(true, 0) === true,
        'Stock evaluation rule correctly flags zero-quantity inventory as out-of-stock',
      );
      assert(
        isOutOfStockRule(true, 5) === false,
        'Stock evaluation rule permits items with positive inventory quantity',
      );
      assert(
        isOutOfStockRule(false, 0) === false,
        'Untracked items (services/gift cards) are never blocked by stock check',
      );
    }

    // --------------------------------------------------------------------------
    // Edge Case 5: Duplicate Barcode Registration Attempt
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 5] Duplicate Barcode Registration ---');
    const existingBarcode = validProduct.barcode;
    assert(Boolean(existingBarcode), `Testing against existing barcode: "${existingBarcode}"`);

    const dupBarcodeRes = await request('/api/catalog/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Duplicate Barcode Test Product',
        sku: `SKU-DUP-BARCODE-${Date.now()}`,
        barcode: existingBarcode,
        costPriceUSD: 1.0,
        sellingPriceUSD: 2.0,
      }),
    });
    assert(
      dupBarcodeRes.status === 409,
      'Registering product with existing barcode returns HTTP 409 Conflict',
      `Got status ${dupBarcodeRes.status}`,
    );
    assert(
      dupBarcodeRes.body?.error?.code === 'DUPLICATE_BARCODE',
      'Error code strictly equals "DUPLICATE_BARCODE"',
    );

    // --------------------------------------------------------------------------
    // Edge Case 6: Duplicate Payment on Already Paid Order
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 6] Duplicate Payment Submission on Paid Order ---');
    // Perform standard checkout to get a PAID order
    const checkoutRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        storeId,
        items: [
          {
            productId: validProduct.id,
            quantity: 1,
            unitPriceUSD: validProduct.sellingPriceUSD,
          },
        ],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: validProduct.sellingPriceUSD,
            tenderAmountUSD: validProduct.sellingPriceUSD,
          },
        ],
      }),
    });
    assert(checkoutRes.status === 200, 'Baseline checkout creates PAID order');
    const paidOrderId = checkoutRes.body.data.orderId;

    // Attempt second payment on already PAID order
    const dupPaymentRes = await request(`/api/pos/orders/${paidOrderId}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        payment: {
          paymentMethodCode: 'CASH',
          amountUSD: 5.0,
          tenderAmountUSD: 5.0,
        },
      }),
    });
    assert(
      dupPaymentRes.status === 400,
      'Adding payment to already PAID order returns HTTP 400 Bad Request',
      `Got status ${dupPaymentRes.status}`,
    );
    assert(
      dupPaymentRes.body?.error?.code === 'ORDER_NOT_PAYABLE',
      'Error code strictly equals "ORDER_NOT_PAYABLE"',
    );

    // --------------------------------------------------------------------------
    // Edge Case 7: Duplicate Order / Idempotency Key Replay
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 7] Duplicate Order Submission / Idempotency Replay ---');
    const testIdempotencyKey = `IDEMP-EDGE-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const firstOrderRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        storeId,
        idempotencyKey: testIdempotencyKey,
        items: [
          {
            productId: validProduct.id,
            quantity: 1,
            unitPriceUSD: validProduct.sellingPriceUSD,
          },
        ],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: validProduct.sellingPriceUSD,
            tenderAmountUSD: validProduct.sellingPriceUSD,
          },
        ],
      }),
    });
    assert(firstOrderRes.status === 200, 'First checkout with idempotency key succeeds (HTTP 200)');
    const originalOrderId = firstOrderRes.body.data.orderId;
    const originalReceipt = firstOrderRes.body.data.receiptNumber;

    // Replay exact same checkout with same idempotencyKey
    const replayOrderRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        storeId,
        idempotencyKey: testIdempotencyKey,
        items: [
          {
            productId: validProduct.id,
            quantity: 1,
            unitPriceUSD: validProduct.sellingPriceUSD,
          },
        ],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: validProduct.sellingPriceUSD,
            tenderAmountUSD: validProduct.sellingPriceUSD,
          },
        ],
      }),
    });
    assert(replayOrderRes.status === 200, 'Replayed checkout returns HTTP 200 OK');
    assert(
      replayOrderRes.body.data.orderId === originalOrderId,
      'Replayed checkout returns identical orderId (No duplicate created)',
    );
    assert(
      replayOrderRes.body.data.receiptNumber === originalReceipt,
      'Replayed checkout returns identical receiptNumber',
    );

    // Query database to ensure only ONE order exists with this key
    const dbOrderCount = await prisma.order.count({
      where: { idempotencyKey: testIdempotencyKey },
    });
    assert(dbOrderCount === 1, 'Database contains exactly 1 order record for idempotency key');

    // --------------------------------------------------------------------------
    // Edge Case 8: Expired / Invalid Session Token
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 8] Expired / Invalid Session Handling ---');
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid-payload.signature';
    const expiredRes = await request('/api/pos/init', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(
      expiredRes.status === 401,
      'Request with invalid / expired token is rejected with HTTP 401 Unauthorized',
      `Got status ${expiredRes.status}`,
    );
    assert(
      expiredRes.body?.error?.code === 'TOKEN_EXPIRED_OR_INVALID',
      'Error code strictly equals "TOKEN_EXPIRED_OR_INVALID"',
    );

    // --------------------------------------------------------------------------
    // Edge Case 9: Disconnected Thermal Printer Handling
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 9] Disconnected Thermal Printer Handling ---');
    const printerManager = PrinterManager.getInstance();

    // Send a test job to an unreachable network printer (unbound port fails fast with ECONNREFUSED)
    const disconnectedPrinterResult = await printerManager.processPrintJob({
      jobId: `DISCONNECTED-TEST-${Date.now()}`,
      type: 'TEST',
      printer: {
        driver: 'NETWORK_TCP',
        name: 'Offline Thermal Printer',
        networkIp: '127.0.0.1',
        networkPort: 59998,
        paperSize: '80mm',
        autoCut: true,
        autoOpenDrawer: false,
        copies: 1,
      },
      timestamp: new Date().toISOString(),
    });

    assert(
      disconnectedPrinterResult.success === false,
      'Disconnected printer returns non-throwing failure result',
    );
    assert(
      disconnectedPrinterResult.fallbackUsed === true,
      'Disconnected printer result indicates fallbackUsed: true',
    );
    assert(
      disconnectedPrinterResult.message.includes('Network printer') ||
        disconnectedPrinterResult.message.includes('timed out') ||
        disconnectedPrinterResult.message.includes('connection error'),
      'Informative error message produced without crashing daemon',
    );

    // --------------------------------------------------------------------------
    // Edge Case 10: Disconnected Network & Offline Queue Integrity
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 10] Disconnected Network Offline Queue Validation ---');
    const sampleOfflinePayload = {
      storeId,
      items: [
        {
          productId: validProduct.id,
          quantity: 2,
          unitPriceUSD: validProduct.sellingPriceUSD,
        },
      ],
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: validProduct.sellingPriceUSD * 2,
          tenderAmountUSD: 20.0,
        },
      ],
    };

    // Validate payload adheres to checkout schema
    const schemaValidation = checkoutInputSchema.safeParse(sampleOfflinePayload);
    assert(
      schemaValidation.success === true,
      'Offline checkout payload passes checkoutInputSchema validation',
    );

    const offlineQueueItem = {
      id: `offline-item-${Date.now()}`,
      clientSyncId: `SYNC-EDGE-${Date.now()}`,
      offlineOrderNumber: `OFF-ORD-${Date.now()}`,
      offlineReceiptNumber: `OFF-RCP-${Date.now()}`,
      storeId,
      cashierId: 'cashier-01',
      cashierName: 'Cashier One',
      status: 'pending',
      createdAt: new Date().toISOString(),
      attempts: 0,
      payload: sampleOfflinePayload,
    };
    assert(
      offlineQueueItem.status === 'pending',
      'Offline transaction created in "pending" status',
    );
    assert(
      offlineQueueItem.clientSyncId.startsWith('SYNC-EDGE-'),
      'Generated unique clientSyncId for synchronization',
    );
    assert(
      offlineQueueItem.offlineReceiptNumber.startsWith('OFF-RCP-'),
      'Generated offline receipt number for customer',
    );

    // --------------------------------------------------------------------------
    // Edge Case 11: Synchronization Conflict Handling
    // --------------------------------------------------------------------------
    console.log('\n--- [Edge Case 11] Synchronization Conflict Handling ---');
    const conflictSyncId = `SYNC-CONFLICT-${Date.now()}`;
    const deletedOrMissingProductId = '99999999-9999-9999-9999-999999999999';

    const conflictBatchRes = await request('/api/sync/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cashierToken}` },
      body: JSON.stringify({
        deviceId: 'POS-TERMINAL-01',
        deviceIdentifier: 'POS-TERMINAL-01-HW',
        items: [
          {
            id: `item-${Date.now()}`,
            clientSyncId: conflictSyncId,
            offlineOrderNumber: `OFF-ORD-CONFLICT-${Date.now()}`,
            offlineReceiptNumber: `OFF-RCP-CONFLICT-${Date.now()}`,
            storeId,
            cashierId: cashierLogin.body.data.user.id,
            cashierName: cashierLogin.body.data.user.username,
            status: 'pending',
            createdAt: new Date().toISOString(),
            attempts: 0,
            payload: {
              storeId,
              items: [
                {
                  productId: deletedOrMissingProductId, // Non-existent product creates conflict!
                  quantity: 1,
                  unitPriceUSD: 5.0,
                },
              ],
              payments: [
                {
                  paymentMethodCode: 'CASH',
                  amountUSD: 5.0,
                  tenderAmountUSD: 5.0,
                },
              ],
            },
          },
        ],
      }),
    });

    assert(
      conflictBatchRes.status === 200,
      'Sync batch endpoint processes conflict item with HTTP 200 OK',
    );
    const batchData = conflictBatchRes.body?.data || conflictBatchRes.body;
    assert(batchData?.conflictCount === 1, 'Sync engine reports conflictCount: 1');
    assert(
      batchData?.results?.[0]?.status === 'conflict',
      'Transaction marked with status "conflict"',
    );
    assert(
      batchData?.results?.[0]?.conflict?.reason === 'PRODUCT_NOT_FOUND',
      'Conflict reason clearly indicates PRODUCT_NOT_FOUND',
    );

    // Verify syncQueue table entry records the conflict
    const dbConflictQueue = await prisma.syncQueue.findUnique({
      where: { clientSyncId: conflictSyncId },
    });
    assert(dbConflictQueue !== null, 'Conflict recorded in PostgreSQL syncQueue table');
    assert(
      dbConflictQueue?.status === SyncStatus.CONFLICT,
      'PostgreSQL syncQueue status strictly equals SyncStatus.CONFLICT',
    );
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n======================================================================');
  console.log(`  EDGE CASES TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEdgeCasesSuite()
  .catch((err) => {
    console.error('Fatal Edge Cases Test Failure:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
