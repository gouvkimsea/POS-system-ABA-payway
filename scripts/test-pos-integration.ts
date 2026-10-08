/**
 * Complete POS Backend Integration Test Suite
 * Tests real database-driven POS operations:
 * - POS terminal initialization with catalog, categories, customers
 * - Product search by keyword, category, and barcode scanner
 * - Quick customer creation from checkout
 * - Hold and Recall sale workflow
 * - Full checkout processing with payment, receipt generation, inventory decrement, and audit logging
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
  console.log('====================================================');
  console.log(' Starting POS API & Database Integration Tests');
  console.log('====================================================\n');

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
      console.log(`✓ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`✗ [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
      testsFailed++;
    }
  }

  try {
    // 1. Authenticate as Cashier
    const cashierLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    assert(cashierLogin.status === 200, 'Cashier authenticates successfully (200 OK)');
    const token = cashierLogin.body?.data?.tokens?.accessToken;
    assert(!!token, 'Cashier receives bearer session token');

    const authHeaders = { Authorization: `Bearer ${token}` };

    // 2. POS Terminal Initialization (/api/pos/init)
    const initRes = await request('/api/pos/init', { headers: authHeaders });
    assert(initRes.status === 200, 'POS init endpoint returns 200 OK');
    const initData = initRes.body?.data;

    assert(!!initData?.store?.name, `Store loaded: ${initData?.store?.name}`);
    assert(!!initData?.register?.code, `Register loaded: ${initData?.register?.code}`);
    assert(
      Array.isArray(initData?.categories) && initData.categories.length > 0,
      `Categories loaded (${initData?.categories?.length} categories)`,
    );
    assert(
      Array.isArray(initData?.products) && initData.products.length >= 10,
      `Real products loaded (${initData?.products?.length} products)`,
    );
    assert(
      Array.isArray(initData?.customers) && initData.customers.length > 0,
      `Customers loaded (${initData?.customers?.length} customers)`,
    );
    assert(
      Array.isArray(initData?.paymentMethods) && initData.paymentMethods.length >= 2,
      `Payment methods loaded (${initData?.paymentMethods?.length} methods)`,
    );
    assert(initData?.exchangeRateKHR === 4100, 'Exchange rate defaults to 4,100 KHR per USD');

    // Verify product structure from real database
    const sampleProduct = initData.products[0];
    assert(sampleProduct.costPriceUSD > 0, 'Products include real cost prices');
    assert(sampleProduct.sellingPriceUSD > 0, 'Products include real selling prices (USD)');
    assert(sampleProduct.sellingPriceKHR > 0, 'Products include real selling prices (KHR)');
    assert(
      typeof sampleProduct.stockQuantity === 'number',
      'Products include live store stock quantities',
    );
    assert(!!sampleProduct.imageUrl, 'Products include valid image URLs');

    // 3. Product Search by Name / Keyword
    const searchRes = await request('/api/pos/products?search=Beer', { headers: authHeaders });
    assert(searchRes.status === 200, 'Product search returns 200 OK');
    assert(searchRes.body?.data?.length >= 2, 'Search query "Beer" returns beer products');

    // 4. Barcode Lookup (Scanner Input)
    const barcodeRes = await request('/api/pos/products?barcode=8840001003', {
      headers: authHeaders,
    });
    assert(barcodeRes.status === 200, 'Barcode query returns 200 OK');
    assert(
      barcodeRes.body?.data?.[0]?.name?.includes('Coca-Cola'),
      'Barcode 8840001003 matches Coca-Cola Classic',
    );

    // 5. Customer Search & Quick Creation
    const custSearch = await request('/api/pos/customers?search=Sopheap', { headers: authHeaders });
    assert(custSearch.status === 200, 'Customer search returns 200 OK');
    assert(custSearch.body?.data?.[0]?.name === 'Sopheap Chan', 'Finds customer Sopheap Chan');

    const newCustPhone = `012999${Math.floor(100 + Math.random() * 900)}`;
    const newCustRes = await request('/api/pos/customers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Vannarith Meas',
        phone: newCustPhone,
        email: 'vannarith@gmail.com',
      }),
    });
    assert(newCustRes.status === 201, 'Quick customer creation returns 201 Created');
    assert(newCustRes.body?.data?.phone === newCustPhone, 'New customer phone recorded in DB');
    const createdCustomerId = newCustRes.body?.data?.id;

    // 6. Hold Sale Flow
    const prod1 = initData.products[0];
    const prod2 = initData.products[1];

    const holdPayload = {
      customerId: createdCustomerId,
      notes: 'Customer stepped away to get wallet',
      items: [
        {
          productId: prod1.id,
          productName: prod1.name,
          quantity: 2,
          unitPriceUSD: prod1.sellingPriceUSD,
        },
        {
          productId: prod2.id,
          productName: prod2.name,
          quantity: 1,
          unitPriceUSD: prod2.sellingPriceUSD,
        },
      ],
    };

    const holdRes = await request('/api/pos/hold', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(holdPayload),
    });
    assert(holdRes.status === 200, 'Hold sale returns 200 OK');
    const heldOrderId = holdRes.body?.data?.id;
    assert(!!heldOrderId, 'Hold sale generated order ID');

    // 7. List Held Orders
    const heldList = await request('/api/pos/held-orders', { headers: authHeaders });
    assert(heldList.status === 200, 'Held orders list returns 200 OK');
    const foundHeld = heldList.body?.data?.find((h: any) => h.id === heldOrderId);
    assert(!!foundHeld, 'Held order found in active pending list');
    assert(foundHeld?.itemCount === 2, 'Held order contains 2 items');

    // 8. Recall Held Order
    const recallRes = await request(`/api/pos/held-orders/${heldOrderId}/recall`, {
      method: 'POST',
      headers: authHeaders,
    });
    assert(recallRes.status === 200, 'Recall held order returns 200 OK');
    assert(recallRes.body?.data?.items?.length === 2, 'Recalled items restored for active cart');

    // 9. Process Complete Checkout
    const initialStock = prod1.stockQuantity;

    const expectedTotal = Number((prod1.sellingPriceUSD * 2).toFixed(2));
    const tenderUSD = 20.0;
    const expectedChange = Number((tenderUSD - expectedTotal).toFixed(2));

    const checkoutPayload = {
      customerId: createdCustomerId,
      items: [
        {
          productId: prod1.id,
          quantity: 2,
          unitPriceUSD: prod1.sellingPriceUSD,
          discountUSD: 0,
        },
      ],
      discountUSD: 0,
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: expectedTotal,
          amountKHR: 0,
          tenderAmountUSD: tenderUSD,
          tenderAmountKHR: 0,
        },
      ],
      notes: 'Express checkout via counter 01',
    };

    const checkoutRes = await request('/api/pos/checkout', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(checkoutPayload),
    });

    assert(checkoutRes.status === 200, 'Checkout returns 200 OK');
    const orderData = checkoutRes.body?.data;
    assert(!!orderData?.orderNumber, `Order created: ${orderData?.orderNumber}`);
    assert(!!orderData?.receiptNumber, `Receipt generated: ${orderData?.receiptNumber}`);
    assert(
      Math.abs(Number(orderData?.totalUSD) - expectedTotal) < 0.01,
      `Total matches line items ($${orderData?.totalUSD} == $${expectedTotal})`,
    );
    assert(
      Math.abs(Number(orderData?.changeUSD) - expectedChange) < 0.01,
      `Change calculated correctly ($${orderData?.changeUSD} == $${expectedChange})`,
    );

    // 10. Verify Database State Post-Checkout
    const dbOrder = await prisma.order.findUnique({
      where: { id: orderData.orderId },
      include: { items: true, payments: true, receipt: true },
    });
    assert(
      dbOrder?.status === 'PAID' || dbOrder?.status === 'COMPLETED',
      'Order status is PAID in PostgreSQL',
    );
    assert(dbOrder?.items?.length === 1, 'OrderItem stored in PostgreSQL');
    assert(dbOrder?.payments?.length === 1, 'Payment record stored in PostgreSQL');
    assert(!!dbOrder?.receipt, 'Receipt record stored in PostgreSQL');

    // 11. Verify Inventory Decrement
    const updatedInvs = await prisma.inventory.findMany({
      where: { productId: prod1.id },
    });
    const currentTotalStock = updatedInvs.reduce((acc, i) => acc + Number(i.quantity), 0);
    assert(
      currentTotalStock === initialStock - 2,
      `Total store inventory quantity decremented in DB from ${initialStock} to ${currentTotalStock}`,
    );

    // 12. Verify Stock Movement Audit
    const stockMov = await prisma.stockMovement.findFirst({
      where: { referenceId: orderData.orderId },
    });
    assert(stockMov?.type === 'SALE', 'Stock movement record created with type SALE');
    assert(Number(stockMov?.quantityChange) === -2, 'Stock movement quantity change is -2');

    // 13. Verify Audit Log
    const auditLog = await prisma.auditLog.findFirst({
      where: { entityId: orderData.orderId, action: 'ORDER_COMPLETED' },
    });
    assert(!!auditLog, 'Audit log created for ORDER_COMPLETED');

    console.log('\n====================================================');
    console.log(` Results: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('Fatal test error:', err);
    testsFailed++;
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
    if (testsFailed > 0) {
      process.exit(1);
    }
  }
}

runTests();
