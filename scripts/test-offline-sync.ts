import request from 'supertest';
import { createApp } from '../apps/api/src/index.js';
import { AuthService } from '../apps/api/src/auth/service.js';
import { prisma } from '../apps/api/src/db/index.js';
import { SyncStatus, StockMovementType } from '@prisma/client';

let app: any;
let cashierToken: string;
let adminToken: string;
let storeId: string;
let businessId: string;
let testProduct: any;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function setup() {
  console.log('\n============================================================');
  console.log('--- [Setup] Initializing Offline Capability Test Suite ---');
  console.log('============================================================');

  app = createApp();

  const cashierLogin = await AuthService.login('cashier', 'cashier123', '127.0.0.1');
  cashierToken = cashierLogin.tokens.accessToken;

  const adminLogin = await AuthService.login('admin', 'admin123', '127.0.0.1');
  adminToken = adminLogin.tokens.accessToken;

  const store = await prisma.store.findFirst({ where: { code: 'STR-PP-01' } });
  if (!store) throw new Error('Store STR-PP-01 not found');
  storeId = store.id;
  businessId = store.businessId;

  testProduct = await prisma.product.findFirst({
    where: { businessId, sku: 'BEV-WAT-500' },
  });
  if (!testProduct) throw new Error('Test product BEV-WAT-500 not found');

  console.log(`✓ Context initialized: Store "${store.name}", Product "${testProduct.name}"`);
}

/**
 * 1. Test Catalog Snapshot API for Offline Seeding
 */
async function testCatalogSnapshot() {
  console.log('\n--- [Test 1] Catalog Snapshot for Offline Caching ---');

  const res = await request(app)
    .get('/api/sync/catalog-snapshot')
    .set('Authorization', `Bearer ${cashierToken}`)
    .query({ storeId });

  assert(res.status === 200, 'Catalog snapshot returned HTTP 200');
  assert(res.body.success === true, 'Response success is true');
  const snapshot = res.body.data;

  assert(Boolean(snapshot.store && snapshot.store.id === storeId), 'Snapshot contains store info');
  assert(
    Array.isArray(snapshot.products) && snapshot.products.length > 0,
    'Snapshot contains active products',
  );
  assert(
    Array.isArray(snapshot.categories) && snapshot.categories.length > 0,
    'Snapshot contains categories',
  );
  assert(Array.isArray(snapshot.customers), 'Snapshot contains customer list');
  assert(
    snapshot.taxConfig && snapshot.taxConfig.vatRate === 0.1,
    'Snapshot contains tax configuration (10% VAT)',
  );
  assert(typeof snapshot.store.baseExchangeRate === 'number', 'Snapshot contains baseExchangeRate');

  console.log(
    `  ✓ Cached catalog snapshot verified (${snapshot.products.length} products, ${snapshot.categories.length} categories)`,
  );
}

/**
 * 2. Test Batch Offline Transaction Synchronization & Inventory Reconciliation
 */
async function testOfflineBatchSync() {
  console.log('\n--- [Test 2] Batch Offline Transaction Synchronization ---');

  const clientSyncId = `TEST-OFF-SYNC-${Date.now()}-A`;
  const tempOrderNum = `OFF-ORD-20261007-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const tempReceiptNum = `OFF-RCP-20261007-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Get current inventory at default location before offline sync
  const defaultLoc =
    (await prisma.inventoryLocation.findFirst({ where: { storeId, isDefault: true } })) ||
    (await prisma.inventoryLocation.findFirst({ where: { storeId } }));

  const initialInv = await prisma.inventory.findFirst({
    where: { storeId, locationId: defaultLoc?.id, productId: testProduct.id },
  });
  const initialQty = initialInv ? Number(initialInv.quantity) : 0;

  const offlineItem = {
    id: `local-tx-1`,
    clientSyncId,
    offlineOrderNumber: tempOrderNum,
    offlineReceiptNumber: tempReceiptNum,
    storeId,
    cashierId: 'cashier-test-id',
    cashierName: 'Sokha Cashier',
    status: 'pending',
    createdAt: new Date().toISOString(),
    attempts: 0,
    payload: {
      storeId,
      items: [
        {
          productId: testProduct.id,
          quantity: 2,
          unitPriceUSD: 0.5,
          discountUSD: 0,
        },
      ],
      discountUSD: 0,
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: 1.1, // $1.00 subtotal + $0.10 tax = $1.10
          amountKHR: 0,
          tenderAmountUSD: 2.0,
          tenderAmountKHR: 0,
        },
      ],
      idempotencyKey: clientSyncId,
      notes: 'Completed in Offline Mode at Register 01',
      offlineMetadata: {
        deviceIdentifier: 'POS-DEV-TEST-01',
        subtotalUSD: 1.0,
        totalUSD: 1.1,
        totalKHR: 4510,
        itemsDetail: [
          {
            productId: testProduct.id,
            productName: testProduct.name,
            sku: testProduct.sku,
            quantity: 2,
            unitPriceUSD: 0.5,
            discountUSD: 0,
          },
        ],
      },
    },
  };

  const res = await request(app)
    .post('/api/sync/batch')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      deviceIdentifier: 'POS-DEV-TEST-01',
      items: [offlineItem],
    });

  assert(res.status === 200, 'Sync batch returned HTTP 200');
  assert(res.body.success === true, 'Sync batch succeeded');
  const batchResult = res.body.data;
  assert(batchResult.syncedCount === 1, 'syncedCount is 1');
  assert(batchResult.conflictCount === 0, 'conflictCount is 0');
  assert(batchResult.failedCount === 0, 'failedCount is 0');

  const firstItemResult = batchResult.results[0];
  assert(firstItemResult.clientSyncId === clientSyncId, 'clientSyncId matches');
  assert(firstItemResult.status === 'synchronized', 'Status transitioned to synchronized');
  assert(Boolean(firstItemResult.serverOrderId), 'Assigned server order ID');
  assert(Boolean(firstItemResult.serverOrderNumber), 'Assigned server order number');
  assert(firstItemResult.inventoryReconciled === true, 'Inventory reconciled flag is true');

  // Verify in PostgreSQL database
  const dbOrder = await prisma.order.findUnique({
    where: { id: firstItemResult.serverOrderId },
    include: { items: true, payments: true, receipt: true },
  });

  assert(Boolean(dbOrder), 'Order persisted in PostgreSQL database');
  assert(dbOrder?.isOfflineCreated === true, 'isOfflineCreated flag is TRUE in DB');
  assert(dbOrder?.offlineSyncId === clientSyncId, 'offlineSyncId matches in DB');
  assert(Number(dbOrder?.totalUSD) === 1.1, 'Total USD in DB is exactly $1.10');
  assert(dbOrder?.items.length === 1, 'OrderItem created in DB');

  // Verify SyncQueue table record
  const syncQueueRecord = await prisma.syncQueue.findUnique({
    where: { clientSyncId },
  });
  assert(Boolean(syncQueueRecord), 'SyncQueue record created in DB');
  assert(syncQueueRecord?.status === SyncStatus.PROCESSED, 'SyncQueue status is PROCESSED');
  assert(syncQueueRecord?.orderId === dbOrder?.id, 'SyncQueue links to created Order');

  // Verify inventory decrement
  const updatedInv = await prisma.inventory.findFirst({
    where: { storeId, locationId: defaultLoc?.id, productId: testProduct.id },
  });
  const updatedQty = updatedInv ? Number(updatedInv.quantity) : 0;
  assert(
    updatedQty === initialQty - 2,
    `Inventory decremented by 2 (from ${initialQty} to ${updatedQty})`,
  );

  // Verify stock movement record
  const stockMove = await prisma.stockMovement.findFirst({
    where: { referenceId: dbOrder?.id, type: StockMovementType.SALE },
  });
  assert(Boolean(stockMove), 'Stock movement record created with SALE type');
  assert(
    stockMove?.notes?.includes('Offline sync reconciliation') === true,
    'Stock movement notes state offline sync reconciliation',
  );

  console.log(
    `  ✓ Offline transaction synced to #${dbOrder?.orderNumber} with full stock reconciliation`,
  );
  return { clientSyncId, serverOrderId: firstItemResult.serverOrderId };
}

/**
 * 3. Test Duplicate Order Prevention & Idempotency
 */
async function testDuplicatePrevention(syncedInfo: {
  clientSyncId: string;
  serverOrderId: string;
}) {
  console.log('\n--- [Test 3] Duplicate Order Prevention (Idempotency) ---');

  const defaultLoc =
    (await prisma.inventoryLocation.findFirst({ where: { storeId, isDefault: true } })) ||
    (await prisma.inventoryLocation.findFirst({ where: { storeId } }));

  const initialOrdersCount = await prisma.order.count({
    where: { offlineSyncId: syncedInfo.clientSyncId },
  });
  assert(initialOrdersCount === 1, 'Exactly 1 order exists prior to re-submission');

  const invBefore = await prisma.inventory.findFirst({
    where: { storeId, locationId: defaultLoc?.id, productId: testProduct.id },
  });
  const qtyBefore = invBefore ? Number(invBefore.quantity) : 0;

  // Re-submit identical batch with same clientSyncId
  const res = await request(app)
    .post('/api/sync/batch')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      deviceIdentifier: 'POS-DEV-TEST-01',
      items: [
        {
          id: 'local-tx-1-duplicate',
          clientSyncId: syncedInfo.clientSyncId,
          offlineOrderNumber: 'OFF-ORD-DUPLICATE',
          offlineReceiptNumber: 'OFF-RCP-DUPLICATE',
          storeId,
          cashierId: 'cashier-test-id',
          cashierName: 'Sokha Cashier',
          status: 'pending',
          createdAt: new Date().toISOString(),
          attempts: 1,
          payload: {
            storeId,
            items: [{ productId: testProduct.id, quantity: 2, unitPriceUSD: 0.5 }],
            payments: [{ paymentMethodCode: 'CASH', amountUSD: 1.1 }],
            idempotencyKey: syncedInfo.clientSyncId,
          },
        },
      ],
    });

  assert(res.status === 200, 'Duplicate re-submission returned HTTP 200');
  const result = res.body.data.results[0];
  assert(result.status === 'synchronized', 'Status returned is synchronized');
  assert(result.alreadySynced === true, 'alreadySynced flag is TRUE');
  assert(result.serverOrderId === syncedInfo.serverOrderId, 'Returns original serverOrderId');

  // Verify DB state did not duplicate
  const ordersCountAfter = await prisma.order.count({
    where: { offlineSyncId: syncedInfo.clientSyncId },
  });
  assert(ordersCountAfter === 1, 'Order count remained exactly 1 (no duplicate order created)');

  const invAfter = await prisma.inventory.findFirst({
    where: { storeId, locationId: defaultLoc?.id, productId: testProduct.id },
  });
  const qtyAfter = invAfter ? Number(invAfter.quantity) : 0;
  assert(qtyAfter === qtyBefore, 'Stock quantity was NOT decremented a second time');

  console.log('  ✓ Duplicate prevention fully verified: idempotent response, zero duplication');
}

/**
 * 4. Test Conflict Handling
 */
async function testConflictDetection() {
  console.log('\n--- [Test 4] Conflict Detection (Invalid / Deleted Product) ---');

  const conflictSyncId = `TEST-CONFLICT-${Date.now()}`;
  const fakeProductId = 'INVALID-PROD-UUID-0000-000000000000';

  const res = await request(app)
    .post('/api/sync/batch')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      deviceIdentifier: 'POS-DEV-TEST-01',
      items: [
        {
          id: 'local-conflict-tx',
          clientSyncId: conflictSyncId,
          offlineOrderNumber: 'OFF-ORD-CONFLICT-01',
          offlineReceiptNumber: 'OFF-RCP-CONFLICT-01',
          storeId,
          cashierId: 'cashier-test-id',
          cashierName: 'Sokha Cashier',
          status: 'pending',
          createdAt: new Date().toISOString(),
          attempts: 0,
          payload: {
            storeId,
            items: [{ productId: fakeProductId, quantity: 1, unitPriceUSD: 5.0 }],
            payments: [{ paymentMethodCode: 'CASH', amountUSD: 5.5 }],
            idempotencyKey: conflictSyncId,
          },
        },
      ],
    });

  assert(res.status === 200, 'Sync batch with conflict returned HTTP 200 (graceful handling)');
  assert(res.body.success === false, 'Batch success is false due to conflict');
  const batchData = res.body.data;
  assert(batchData.conflictCount === 1, 'conflictCount is exactly 1');

  const itemResult = batchData.results[0];
  assert(itemResult.status === 'conflict', 'Item status is CONFLICT');
  assert(Boolean(itemResult.conflict), 'Item returned rich conflict metadata');
  assert(
    itemResult.conflict.reason === 'PRODUCT_NOT_FOUND',
    'Conflict reason is PRODUCT_NOT_FOUND',
  );

  // Verify SyncQueue in database
  const syncQueueRecord = await prisma.syncQueue.findUnique({
    where: { clientSyncId: conflictSyncId },
  });
  assert(Boolean(syncQueueRecord), 'SyncQueue record created for conflict');
  assert(syncQueueRecord?.status === SyncStatus.CONFLICT, 'SyncQueue DB status is CONFLICT');
  assert(Boolean(syncQueueRecord?.conflictDetails), 'SyncQueue DB stores conflictDetails');

  console.log('  ✓ Conflict detected and recorded safely without crashing or corrupting data');
  return syncQueueRecord?.id;
}

/**
 * 5. Test Conflict Resolution API
 */
async function testConflictResolution(syncQueueId: string | undefined) {
  if (!syncQueueId) return;
  console.log('\n--- [Test 5] Administrator Conflict Resolution ---');

  // Test Discard Action
  const res = await request(app)
    .post('/api/sync/resolve-conflict')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      syncQueueId,
      action: 'DISCARD',
      notes: 'Sale cancelled by store manager due to discontinued test item',
    });

  assert(res.status === 200, 'Resolve conflict returned HTTP 200');
  assert(res.body.success === true, 'Resolution success is true');

  const updatedRecord = await prisma.syncQueue.findUnique({
    where: { id: syncQueueId },
  });
  assert(
    updatedRecord?.status === SyncStatus.FAILED,
    'SyncQueue record marked as FAILED upon discard',
  );
  assert(
    updatedRecord?.errorMessage?.includes('Discarded by admin') === true,
    'Error message records admin discard note',
  );

  console.log('  ✓ Administrator conflict resolution (DISCARD) verified');
}

/**
 * 6. Test Admin Synchronization Monitor API
 */
async function testAdminSyncMonitor() {
  console.log('\n--- [Test 6] Admin Synchronization Monitor API ---');

  const res = await request(app)
    .get('/api/sync/monitor')
    .set('Authorization', `Bearer ${adminToken}`)
    .query({ storeId });

  assert(res.status === 200, 'Sync monitor returned HTTP 200');
  assert(res.body.success === true, 'Monitor response success is true');
  const data = res.body.data;

  assert(Boolean(data.stats), 'Response contains stats summary');
  assert(typeof data.stats.totalQueued === 'number', 'totalQueued is a number');
  assert(data.stats.totalQueued > 0, 'totalQueued is greater than zero');
  assert(Array.isArray(data.records), 'records is an array');
  assert(data.records.length > 0, 'records contains sync queue entries');

  const rec = data.records[0];
  assert(Boolean(rec.clientSyncId), 'Record has clientSyncId');
  assert(Boolean(rec.status), 'Record has status');
  assert(Boolean(rec.deviceName), 'Record includes device/terminal name');

  console.log(
    `  ✓ Monitor dashboard data verified (${data.stats.totalQueued} queued, ${data.stats.synchronizedCount} processed)`,
  );
}

/**
 * 7. Test Quick Health / Status API
 */
async function testSyncStatusEndpoint() {
  console.log('\n--- [Test 7] Sync Quick Status Endpoint ---');

  const res = await request(app)
    .get('/api/sync/status')
    .set('Authorization', `Bearer ${cashierToken}`)
    .query({ storeId });

  assert(res.status === 200, 'Sync status returned HTTP 200');
  assert(res.body.success === true, 'Response success is true');
  assert(res.body.data.isOnline === true, 'isOnline is reported as true');

  console.log('  ✓ Quick status endpoint verified');
}

async function run() {
  try {
    await setup();
    await testCatalogSnapshot();
    const syncedInfo = await testOfflineBatchSync();
    await testDuplicatePrevention(syncedInfo);
    const conflictId = await testConflictDetection();
    await testConflictResolution(conflictId);
    await testAdminSyncMonitor();
    await testSyncStatusEndpoint();

    console.log('\n============================================================');
    console.log('🎉 ALL OFFLINE SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! (7/7)');
    console.log('============================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Test Suite Failed:', err.message);
    process.exit(1);
  }
}

run();
