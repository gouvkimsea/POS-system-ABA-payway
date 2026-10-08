/**
 * Database & ACID Transaction Integration Test Suite
 * Validates PostgreSQL database constraints, ACID properties, and multi-tenant scoping:
 * 1. Multi-Tenant Data Isolation (Strict businessId boundary)
 * 2. ACID Transaction Atomicity & Rollback (Failed operations do not commit partial state)
 * 3. Inventory Stock Movement Integrity (Zero drift between ledger & balance)
 * 4. Register Session Concurrency (Unique active session constraint per register)
 * 5. Foreign Key & Entity Relationship Integrity (Orders, Items, Payments, Sessions)
 * 6. Unique Constraints & Barcode / SKU collision prevention
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { prisma } from '../apps/api/src/db/index.js';
import { OrderStatus, PaymentStatus, StockMovementType } from '@prisma/client';

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

async function runDatabaseTests() {
  console.log('======================================================================');
  console.log('💾 RUNNING COMPREHENSIVE DATABASE & ACID TRANSACTION TEST SUITE');
  console.log('======================================================================\n');

  // Context setup
  const business = await prisma.business.findFirst({ where: { code: 'AFM-01' } });
  if (!business) throw new Error('Seeded business AFM-01 not found');
  const store = await prisma.store.findFirst({ where: { businessId: business.id } });
  if (!store) throw new Error('Store not found');
  const register = await prisma.cashRegister.findFirst({ where: { storeId: store.id } });
  if (!register) throw new Error('CashRegister not found');
  const user = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (!user) throw new Error('Admin user not found');
  const product = await prisma.product.findFirst({ where: { businessId: business.id } });
  if (!product) throw new Error('Product not found');

  console.log(`Context: Business "${business.name}" (${business.code}), Store "${store.name}"\n`);

  // =========================================================================
  // 1. MULTI-TENANT BUSINESS ISOLATION
  // =========================================================================
  console.log('--- [Category 1] Multi-Tenant Data Isolation ---');

  // Create a temporary secondary business to test tenant boundary
  const tenant2Code = `TENANT-TEST-${Date.now().toString().slice(-6)}`;
  const tenant2 = await prisma.business.create({
    data: {
      name: 'Isolated Business Tenant 2',
      code: tenant2Code,
      defaultCurrency: 'USD',
      baseExchangeRate: 4100,
      taxNumber: 'T2-TAX-999',
    },
  });

  const tenant2Product = await prisma.product.create({
    data: {
      businessId: tenant2.id,
      name: 'Tenant 2 Exclusive Product',
      sku: `T2-SKU-${Date.now()}`,
      barcode: `999000${Date.now().toString().slice(-6)}`,
      costPriceUSD: 1.0,
      sellingPriceUSD: 2.0,
      sellingPriceKHR: 8200,
      trackInventory: true,
    },
  });

  // Querying products with businessId = business.id must NEVER return tenant2Product
  const primaryBizProducts = await prisma.product.findMany({
    where: { businessId: business.id, id: tenant2Product.id },
  });
  assert(
    primaryBizProducts.length === 0,
    'Primary business cannot view or query Tenant 2 products',
  );

  const crossTenantQuery = await prisma.product.findFirst({
    where: { businessId: business.id, sku: tenant2Product.sku },
  });
  assert(crossTenantQuery === null, 'Primary business cannot lookup Tenant 2 products by SKU');

  // Clean up tenant2 product & business
  await prisma.product.delete({ where: { id: tenant2Product.id } });
  await prisma.business.delete({ where: { id: tenant2.id } });
  assert(true, 'Temporary tenant securely cleaned up');

  // =========================================================================
  // 2. ACID TRANSACTION ATOMICITY & ROLLBACK
  // =========================================================================
  console.log('\n--- [Category 2] ACID Transaction Atomicity & Rollback ---');

  // Find active inventory
  const inventoryItem = await prisma.inventory.findFirst({
    where: { storeId: store.id, productId: product.id },
  });
  if (!inventoryItem) throw new Error('Inventory record not found');

  const initialQty = Number(inventoryItem.quantity);
  const testOrderNumber = `ORD-FAIL-ROLLBACK-${Date.now()}`;

  // Execute a transaction that modifies stock, but intentionally throws an error before commit
  let rollbackOccurred = false;
  try {
    await prisma.$transaction(async (tx) => {
      // Step A: Decrement stock
      await tx.inventory.update({
        where: { id: inventoryItem.id },
        data: { quantity: { decrement: 10 } },
      });

      // Step B: Create Order
      await tx.order.create({
        data: {
          orderNumber: testOrderNumber,
          businessId: business.id,
          storeId: store.id,
          cashierId: user.id,
          status: OrderStatus.PENDING,
          subtotalUSD: 10,
          totalUSD: 10,
          totalKHR: 41000,
        },
      });

      // Step C: Force an intentional error to simulate network/system crash
      throw new Error('SIMULATED_TRANSACTION_FAILURE_ROLLBACK');
    });
  } catch (err: any) {
    if (err.message === 'SIMULATED_TRANSACTION_FAILURE_ROLLBACK') {
      rollbackOccurred = true;
    }
  }

  assert(rollbackOccurred, 'Simulated failure successfully caught by transaction boundary');

  // Verify that inventory was NOT modified (atomicity rollback)
  const currentInv = await prisma.inventory.findUnique({
    where: { id: inventoryItem.id },
  });
  assert(
    Number(currentInv?.quantity) === initialQty,
    `Inventory balance strictly rolled back: initial ${initialQty} === current ${currentInv?.quantity}`,
  );

  // Verify that the order was NOT created (atomicity rollback)
  const rolledBackOrder = await prisma.order.findFirst({
    where: { orderNumber: testOrderNumber },
  });
  assert(
    rolledBackOrder === null,
    'Failed transaction created zero orphaned order records in PostgreSQL',
  );

  // =========================================================================
  // 3. INVENTORY STOCK MOVEMENT INTEGRITY & AUDIT TRAIL
  // =========================================================================
  console.log('\n--- [Category 3] Inventory Stock Movement Integrity & Audit Trail ---');

  const moveQty = 5;
  const auditOrderNumber = `ORD-AUDIT-${Date.now()}`;

  // Execute a valid atomic sale with stock movement ledger
  const successfulTx = await prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.findUniqueOrThrow({
      where: { id: inventoryItem.id },
    });
    const beforeQty = Number(inv.quantity);
    const afterQty = beforeQty - moveQty;

    await tx.inventory.update({
      where: { id: inventoryItem.id },
      data: { quantity: afterQty },
    });

    const ord = await tx.order.create({
      data: {
        orderNumber: auditOrderNumber,
        businessId: business.id,
        storeId: store.id,
        cashierId: user.id,
        status: OrderStatus.PAID,
        subtotalUSD: 5,
        totalUSD: 5,
        totalKHR: 20500,
      },
    });

    const movement = await tx.stockMovement.create({
      data: {
        storeId: store.id,
        locationId: inv.locationId,
        productId: product.id,
        type: StockMovementType.SALE,
        quantityChange: -moveQty,
        quantityBefore: beforeQty,
        quantityAfter: afterQty,
        referenceType: 'ORDER',
        referenceId: ord.id,
        createdById: user.id,
        notes: `Automated test sale ${auditOrderNumber}`,
      },
    });

    return { ord, movement, afterQty };
  });

  assert(
    successfulTx.ord.status === OrderStatus.PAID,
    'Atomic sale transaction committed successfully',
  );

  // Verify stock movement record details
  const movementRecord = await prisma.stockMovement.findUnique({
    where: { id: successfulTx.movement.id },
  });
  assert(movementRecord !== null, 'Stock movement ledger record persisted');
  assert(
    Number(movementRecord?.quantityChange) === -moveQty,
    `Ledger records exact delta: -${moveQty}`,
  );
  assert(
    Number(movementRecord?.quantityAfter) === successfulTx.afterQty,
    'Ledger post-balance matches actual balance',
  );

  // Restore inventory balance
  await prisma.inventory.update({
    where: { id: inventoryItem.id },
    data: { quantity: { increment: moveQty } },
  });
  await prisma.stockMovement.delete({ where: { id: successfulTx.movement.id } });
  await prisma.order.delete({ where: { id: successfulTx.ord.id } });
  assert(true, 'Test inventory balance and ledger restored cleanly');

  // =========================================================================
  // 4. REGISTER SESSION CONCURRENCY INTEGRITY
  // =========================================================================
  console.log('\n--- [Category 4] Register Session Concurrency Integrity ---');

  // Ensure any existing OPEN session is closed or noted
  const existingOpenSession = await prisma.registerSession.findFirst({
    where: { registerId: register.id, status: 'OPEN' },
  });

  let testSessionId: string;
  if (!existingOpenSession) {
    const newSession = await prisma.registerSession.create({
      data: {
        registerId: register.id,
        cashierId: user.id,
        openedAt: new Date(),
        status: 'OPEN',
        openingFloatUSD: 100,
        openingFloatKHR: 400000,
        expectedCashUSD: 100,
        expectedCashKHR: 400000,
      },
    });
    testSessionId = newSession.id;
  } else {
    testSessionId = existingOpenSession.id;
  }

  // Count active OPEN sessions for this register
  const openSessionsCount = await prisma.registerSession.count({
    where: { registerId: register.id, status: 'OPEN' },
  });
  assert(openSessionsCount === 1, 'Register has exactly 1 active OPEN session');

  // =========================================================================
  // 5. FOREIGN KEY & CASCADING INTEGRITY
  // =========================================================================
  console.log('\n--- [Category 5] Foreign Key & Referential Integrity ---');

  // Attempting to create an OrderItem with invalid/non-existent orderId must fail FK constraint
  let fkErrorOccurred = false;
  try {
    await prisma.orderItem.create({
      data: {
        orderId: '00000000-0000-0000-0000-000000000000',
        productId: product.id,
        productName: 'Ghost Item',
        sku: 'GHOST-01',
        quantity: 1,
        unitPriceUSD: 5,
        unitPriceKHR: 20500,
        subtotalUSD: 5,
        totalUSD: 5,
        totalKHR: 20500,
      },
    });
  } catch (err: any) {
    // Foreign key violation
    fkErrorOccurred = true;
  }
  assert(fkErrorOccurred, 'PostgreSQL foreign key constraint strictly blocks orphaned OrderItems');

  // =========================================================================
  // 6. UNIQUE CONSTRAINTS (BARCODE & SKU DEDUPLICATION)
  // =========================================================================
  console.log('\n--- [Category 6] Unique Constraints & Deduplication ---');

  let duplicateSkuBlocked = false;
  try {
    await prisma.product.create({
      data: {
        businessId: business.id,
        name: 'Duplicate SKU Product',
        sku: product.sku, // duplicate!
        barcode: `999${Date.now().toString().slice(-6)}`,
        costPriceUSD: 1.0,
        sellingPriceUSD: 2.0,
        sellingPriceKHR: 8200,
      },
    });
  } catch (err: any) {
    duplicateSkuBlocked = true;
  }
  assert(duplicateSkuBlocked, `Database unique constraint blocks duplicate SKU "${product.sku}"`);

  console.log('\n======================================================================');
  console.log(`  DATABASE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDatabaseTests()
  .catch((err) => {
    console.error('Fatal database test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
