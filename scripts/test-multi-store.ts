/**
 * End-to-End Multi-Store & Inventory Transfer Verification Suite
 * Validates:
 * 1. Store Management: Multiple branches creation & listing
 * 2. Store Settings: Branch-level configs (tax, currency, receipt templates)
 * 3. Store Registers: Independent cash registers per branch
 * 4. Store Users & Permissions: Strict branch authorization (cashier isolated to Store A, denied Store B; admin has all-store access)
 * 5. Store-Specific Products: Branch pricing overrides & availability
 * 6. Inventory Transfers: Complete Store A -> Transfer -> Store B workflow
 *    - Requested quantity & status REQUESTED
 *    - Sent quantity & sender & timestamp & status IN_TRANSIT & Store A stock reduction (TRANSFER_OUT)
 *    - Received quantity & receiver & timestamp & status COMPLETED & Store B stock increment (TRANSFER_IN)
 * 7. Multi-Store Reporting: Individual store, multiple stores, and entire business aggregation
 */

import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';
import http from 'http';
import bcrypt from 'bcryptjs';

let server: http.Server;
let baseUrl: string;
let adminToken: string;
let cashierToken: string;
let businessId: string;
let adminUserId: string;
let cashierUserId: string;

let storeAId: string;
let storeBId: string;
let testProductId: string;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function request(path: string, options: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  const activeToken = token || adminToken;
  if (activeToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json };
  }
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
}

async function runTests() {
  console.log('\n=============================================================');
  console.log('🚀 MULTI-STORE & INVENTORY TRANSFER VERIFICATION SUITE');
  console.log('=============================================================\n');

  // 1. Setup Server & Authentication
  console.log('--- Phase 1: Setup Server & Credentials ---');
  const app = createApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`  ✓ Express test server listening on ${baseUrl}`);
      resolve();
    });
  });

  // Fetch admin user
  const admin = await prisma.user.findFirst({
    where: { username: 'admin' },
    include: { business: true },
  });

  if (!admin) {
    throw new Error('Admin user not found. Please ensure database seed is loaded.');
  }

  businessId = admin.businessId;
  adminUserId = admin.id;

  // Login as admin
  const adminLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  assert(adminLoginRes.status === 200, 'Admin logged in successfully');
  adminToken = adminLoginRes.data.data.tokens.accessToken;

  // 2. Multi-Store Creation
  console.log('\n--- Phase 2: Create Multiple Branches (Stores) ---');
  const timestamp = Date.now().toString().slice(-4);
  const codeA = `TK-${timestamp}`;
  const codeB = `BKK-${timestamp}`;

  const storeARes = await request('/api/stores', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Tuol Kouk Flagship Branch',
      code: codeA,
      phone: '+855 23 888 101',
      address: 'Street 315, Tuol Kouk, Phnom Penh',
      receiptHeader: 'Angkor Fresh Mart - Tuol Kouk Flagship',
      receiptFooter: 'Thank you for shopping at TK Flagship!',
      settings: {
        defaultCurrency: 'USD',
        taxRate: 0.1,
        autoPrintReceipt: true,
      },
    }),
  });
  assert(storeARes.status === 201, `Branch Store A created: ${storeARes.data.data.name}`);
  storeAId = storeARes.data.data.id;

  const storeBRes = await request('/api/stores', {
    method: 'POST',
    body: JSON.stringify({
      name: 'BKK1 Express Branch',
      code: codeB,
      phone: '+855 23 888 202',
      address: 'Street 51, Boeung Keng Kang 1, Phnom Penh',
      receiptHeader: 'Angkor Fresh Mart - BKK1 Express',
      receiptFooter: 'Thank you for visiting BKK1 Express!',
      settings: {
        defaultCurrency: 'USD',
        taxRate: 0.1,
        autoPrintReceipt: true,
      },
    }),
  });
  assert(storeBRes.status === 201, `Branch Store B created: ${storeBRes.data.data.name}`);
  storeBId = storeBRes.data.data.id;

  // 3. Store Settings
  console.log('\n--- Phase 3: Store Settings Management ---');
  const updateSettingsRes = await request(`/api/stores/${storeBId}/settings`, {
    method: 'PUT',
    body: JSON.stringify({
      defaultCurrency: 'USD',
      timezone: 'Asia/Phnom_Penh',
      receiptHeader: 'Angkor Fresh Mart - BKK1 Premium Express',
      receiptFooter: 'Open 24 Hours - Express Service',
      taxRate: 0.08,
      autoPrintReceipt: true,
    }),
  });
  assert(updateSettingsRes.status === 200, 'Store B settings updated successfully');
  assert(updateSettingsRes.data.data.taxRate === 0.08, 'Store B tax rate updated to 8%');

  // 4. Store Registers
  console.log('\n--- Phase 4: Store Registers Management ---');
  const regARes = await request(`/api/stores/${storeAId}/registers`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Counter 02 Register',
      code: `REG-TK-02`,
      isActive: true,
    }),
  });
  assert(regARes.status === 201, `Store A register created: ${regARes.data.data.name}`);

  const getRegistersRes = await request(`/api/stores/${storeAId}/registers`);
  assert(getRegistersRes.status === 200, 'Store A registers fetched successfully');
  assert(getRegistersRes.data.data.length >= 2, 'Store A has at least 2 registers (default + new)');

  // 5. Store Users & Permissions (Branch-level RBAC)
  console.log('\n--- Phase 5: Store Users & Branch Authorization Scoping ---');
  // Create cashier user
  const cashierUsername = `cashier_tk_${timestamp}`;
  const cashierPassword = 'CashierPassword123!';
  const cashierHash = await bcrypt.hash(cashierPassword, 10);

  const cashierUser = await prisma.user.create({
    data: {
      businessId,
      username: cashierUsername,
      fullName: 'Sophea Touch (TK Cashier)',
      email: `${cashierUsername}@angkorfresh.com`,
      passwordHash: cashierHash,
      isActive: true,
    },
  });
  cashierUserId = cashierUser.id;

  // Find CASHIER role
  const cashierRole = await prisma.role.findFirst({
    where: { businessId, name: 'CASHIER' },
  });
  if (!cashierRole) throw new Error('CASHIER role not found');

  // Assign user to Store A ONLY
  const assignRes = await request(`/api/stores/${storeAId}/users`, {
    method: 'POST',
    body: JSON.stringify({
      userId: cashierUserId,
      roleId: cashierRole.id,
    }),
  });
  assert(assignRes.status === 201, 'Cashier assigned specifically to Store A');

  // Login as Cashier
  const cashierLoginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: cashierUsername, password: cashierPassword }),
  });
  assert(cashierLoginRes.status === 200, 'Cashier logged in successfully');
  cashierToken = cashierLoginRes.data.data.tokens.accessToken;
  const authStoreIds = cashierLoginRes.data.data.user.authorizedStoreIds;
  assert(
    Array.isArray(authStoreIds) && authStoreIds.includes(storeAId),
    'Cashier authorizedStoreIds contains Store A',
  );
  assert(!authStoreIds.includes(storeBId), 'Cashier authorizedStoreIds does NOT contain Store B');

  // Verify Cashier CAN access Store A inventory
  const cashierStoreAAccess = await request(`/api/stores/${storeAId}/inventory`, {}, cashierToken);
  assert(cashierStoreAAccess.status === 200, 'Cashier allowed to access Store A inventory');

  // Verify Cashier CANNOT access Store B inventory (403 Forbidden)
  const cashierStoreBAccess = await request(`/api/stores/${storeBId}/inventory`, {}, cashierToken);
  assert(
    cashierStoreBAccess.status === 403,
    'Cashier rejected with 403 Forbidden when accessing unauthorized Store B',
  );

  // Verify Admin CAN access both stores
  const adminStoreAAccess = await request(`/api/stores/${storeAId}/inventory`, {}, adminToken);
  const adminStoreBAccess = await request(`/api/stores/${storeBId}/inventory`, {}, adminToken);
  assert(
    adminStoreAAccess.status === 200 && adminStoreBAccess.status === 200,
    'Administrator can access all stores',
  );

  // 6. Store-Specific Products & Pricing Overrides
  console.log('\n--- Phase 6: Store-Specific Products & Pricing Overrides ---');
  // Find a product
  const product = await prisma.product.findFirst({
    where: { businessId, deletedAt: null },
  });
  if (!product) throw new Error('No product found in catalog');
  testProductId = product.id;

  // Set store-specific pricing for Store B ($12.50 custom price)
  const overrideRes = await request(`/api/stores/${storeBId}/products/${testProductId}`, {
    method: 'PUT',
    body: JSON.stringify({
      isActive: true,
      customPriceUSD: 12.5,
      customPriceKHR: 51250,
      minStockLevel: 15,
    }),
  });
  assert(overrideRes.status === 200, 'Store B product override saved successfully');

  const storeBProductsRes = await request(`/api/stores/${storeBId}/products`);
  const storeBProduct = storeBProductsRes.data.data.find((p: any) => p.id === testProductId);
  assert(storeBProduct != null, 'Product found in Store B branch catalog');
  assert(
    storeBProduct.effectivePriceUSD === 12.5,
    `Store B custom price applied ($12.50 vs base $${product.sellingPriceUSD})`,
  );

  // 7. Inventory Transfers (Store A -> Transfer -> Store B)
  console.log('\n--- Phase 7: Inventory Transfers (Store A -> Store B) ---');
  // Initialize inventory in Store A and Store B
  const locA = await prisma.inventoryLocation.findFirst({ where: { storeId: storeAId } });
  const locB = await prisma.inventoryLocation.findFirst({ where: { storeId: storeBId } });

  const invAId = `inv-a-${timestamp}`;
  const invBId = `inv-b-${timestamp}`;

  await prisma.inventory.create({
    data: {
      id: invAId,
      storeId: storeAId,
      locationId: locA!.id,
      productId: testProductId,
      quantity: 50,
    },
  });

  await prisma.inventory.create({
    data: {
      id: invBId,
      storeId: storeBId,
      locationId: locB!.id,
      productId: testProductId,
      quantity: 10,
    },
  });

  // Step 1: Request Transfer: Store A -> Store B (Quantity: 20)
  const createTransferRes = await request('/api/transfers', {
    method: 'POST',
    body: JSON.stringify({
      sourceStoreId: storeAId,
      targetStoreId: storeBId,
      notes: 'Urgent restocking for weekend promotion',
      items: [
        {
          productId: testProductId,
          requestedQuantity: 20,
          notes: 'Standard carton pack',
        },
      ],
    }),
  });
  assert(
    createTransferRes.status === 201,
    `Transfer created: ${createTransferRes.data.data.transferNumber}`,
  );
  const transferId = createTransferRes.data.data.id;
  assert(createTransferRes.data.data.status === 'REQUESTED', 'Transfer status is REQUESTED');
  assert(
    Number(createTransferRes.data.data.items[0].requestedQuantity) === 20,
    'Requested quantity is 20',
  );

  // Step 2: Send Transfer (Store A Dispatches 20 items -> IN_TRANSIT)
  const sendRes = await request(`/api/transfers/${transferId}/send`, {
    method: 'POST',
    body: JSON.stringify({
      notes: 'Dispatched via Express Van #04',
      items: [
        {
          productId: testProductId,
          sentQuantity: 20,
        },
      ],
    }),
  });
  assert(sendRes.status === 200, 'Transfer dispatched and status is IN_TRANSIT');
  assert(sendRes.data.data.status === 'IN_TRANSIT', 'Status updated to IN_TRANSIT');
  assert(sendRes.data.data.sentBy.fullName != null, 'Sender identity recorded');

  // Verify Store A stock was decremented by 20 (50 - 20 = 30)
  const storeAInvAfterSend = await prisma.inventory.findFirst({
    where: { storeId: storeAId, productId: testProductId },
  });
  console.log('DEBUG storeAInvAfterSend:', storeAInvAfterSend);
  assert(
    Number(storeAInvAfterSend?.quantity) === 30,
    `Store A inventory decremented to 30 (was 50, got ${storeAInvAfterSend?.quantity})`,
  );

  // Verify TRANSFER_OUT stock movement
  const stockMoveOut = await prisma.stockMovement.findFirst({
    where: { referenceId: transferId, type: 'TRANSFER_OUT' },
  });
  assert(stockMoveOut != null, 'TRANSFER_OUT stock movement record generated with audit details');

  // Step 3: Receive Transfer (Store B Confirms Receipt of 20 items -> COMPLETED)
  const receiveRes = await request(`/api/transfers/${transferId}/receive`, {
    method: 'POST',
    body: JSON.stringify({
      notes: 'All 20 items inspected and verified in perfect condition',
      items: [
        {
          productId: testProductId,
          receivedQuantity: 20,
        },
      ],
    }),
  });
  assert(receiveRes.status === 200, 'Transfer confirmed received and status is COMPLETED');
  assert(receiveRes.data.data.status === 'COMPLETED', 'Status updated to COMPLETED');
  assert(receiveRes.data.data.receivedBy.fullName != null, 'Receiver identity recorded');

  // Verify Store B stock was incremented by 20 (10 + 20 = 30)
  const storeBInvAfterReceive = await prisma.inventory.findFirst({
    where: { storeId: storeBId, productId: testProductId },
  });
  assert(
    Number(storeBInvAfterReceive?.quantity) === 30,
    `Store B inventory incremented to 30 (was 10)`,
  );

  // Verify TRANSFER_IN stock movement
  const stockMoveIn = await prisma.stockMovement.findFirst({
    where: { referenceId: transferId, type: 'TRANSFER_IN' },
  });
  assert(stockMoveIn != null, 'TRANSFER_IN stock movement record generated with audit details');

  // Step 4: Verify Transfer Detail API
  const transferDetailRes = await request(`/api/transfers/${transferId}`);
  assert(transferDetailRes.status === 200, 'Transfer detail retrieved successfully');
  const td = transferDetailRes.data.data;
  assert(td.items[0].requestedQuantity === 20, 'Tracked: requested quantity = 20');
  assert(td.items[0].sentQuantity === 20, 'Tracked: sent quantity = 20');
  assert(td.items[0].receivedQuantity === 20, 'Tracked: received quantity = 20');
  assert(td.requestedBy != null, 'Tracked: requester recorded');
  assert(td.sentBy != null, 'Tracked: sender recorded');
  assert(td.receivedBy != null, 'Tracked: receiver recorded');
  assert(
    td.requestedAt != null && td.sentAt != null && td.receivedAt != null,
    'Tracked: complete timestamp audit trail',
  );

  // 8. Multi-Store Reporting
  console.log('\n--- Phase 8: Multi-Store Reporting ---');
  // Seed an order in Store A and an order in Store B
  const orderA = await prisma.order.create({
    data: {
      orderNumber: `ORD-TEST-A-${timestamp}`,
      businessId,
      storeId: storeAId,
      cashierId: adminUserId,
      status: 'COMPLETED',
      subtotalUSD: 100,
      totalUSD: 100,
      totalKHR: 410000,
      paidUSD: 100,
      totalPaidUSD: 100,
    },
  });

  const orderB = await prisma.order.create({
    data: {
      orderNumber: `ORD-TEST-B-${timestamp}`,
      businessId,
      storeId: storeBId,
      cashierId: adminUserId,
      status: 'COMPLETED',
      subtotalUSD: 200,
      totalUSD: 200,
      totalKHR: 820000,
      paidUSD: 200,
      totalPaidUSD: 200,
    },
  });

  // Report 1: Individual Store A
  const reportStoreARes = await request(`/api/reports/dashboard?storeId=${storeAId}`);
  assert(reportStoreARes.status === 200, 'Individual Store A dashboard report retrieved');
  assert(
    reportStoreARes.data.data.grossSalesUSD >= 100,
    `Individual Store A includes Store A orders: $${reportStoreARes.data.data.grossSalesUSD}`,
  );

  // Report 2: Individual Store B
  const reportStoreBRes = await request(`/api/reports/dashboard?storeId=${storeBId}`);
  assert(reportStoreBRes.status === 200, 'Individual Store B dashboard report retrieved');
  assert(
    reportStoreBRes.data.data.grossSalesUSD >= 200,
    `Individual Store B includes Store B orders: $${reportStoreBRes.data.data.grossSalesUSD}`,
  );

  // Report 3: Multiple Stores (Store A + Store B)
  const reportMultiStoreRes = await request(
    `/api/reports/dashboard?storeIds=${storeAId},${storeBId}`,
  );
  assert(
    reportMultiStoreRes.status === 200,
    'Multiple stores (Store A + Store B) dashboard report retrieved',
  );
  const multiSales = reportMultiStoreRes.data.data.grossSalesUSD;
  assert(multiSales >= 300, `Multi-store report aggregated both branches: $${multiSales} >= $300`);

  // Report 4: Entire Business (no storeId filter)
  const reportBusinessRes = await request(`/api/reports/dashboard`);
  assert(reportBusinessRes.status === 200, 'Entire business report retrieved');
  const businessSales = reportBusinessRes.data.data.grossSalesUSD;
  assert(
    businessSales >= multiSales,
    `Entire business report aggregated all business stores: $${businessSales}`,
  );

  console.log('\n=============================================================');
  console.log('🎉 ALL MULTI-STORE & INVENTORY TRANSFER TESTS PASSED (100%)');
  console.log('=============================================================\n');

  // Cleanup server
  server.close();
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  if (server) server.close();
  process.exit(1);
});
