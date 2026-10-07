/**
 * Integration Test Suite: Complete Product & Inventory Management System
 * Validates Catalog CRUD, Variants, Fast Barcode Lookup, Transactional Adjustments,
 * Movement Records with Mandatory Reasons, Location Transfers, and Inventory Accuracy.
 */

import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';
import { AuthService } from '../apps/api/src/auth/service.js';
import request from 'supertest';

let app: any;
let adminToken: string;
let cashierToken: string;
let storeId: string;
let floorLocationId: string;
let whLocationId: string;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function setup() {
  console.log('\n--- [Setup] Initializing Integration Test Context ---');
  app = createApp();

  const adminLogin = await AuthService.login('admin', 'admin123', '127.0.0.1');
  adminToken = adminLogin.tokens.accessToken;

  const cashierLogin = await AuthService.login('cashier', 'cashier123', '127.0.0.1');
  cashierToken = cashierLogin.tokens.accessToken;

  const store = await prisma.store.findFirst({ where: { code: 'STR-PP-01' } });
  if (!store) throw new Error('Seeded store STR-PP-01 not found');
  storeId = store.id;

  const floorLoc = await prisma.inventoryLocation.findFirst({
    where: { storeId, code: 'LOC-FLOOR-01' },
  });
  const whLoc = await prisma.inventoryLocation.findFirst({
    where: { storeId, code: 'LOC-WH-01' },
  });

  if (!floorLoc || !whLoc) throw new Error('Seeded locations not found');
  floorLocationId = floorLoc.id;
  whLocationId = whLoc.id;

  // Cleanup test products from previous runs if any to guarantee idempotency
  const oldTestProducts = await prisma.product.findMany({
    where: { sku: { startsWith: 'TEST-' } },
    select: { id: true },
  });
  if (oldTestProducts.length > 0) {
    const ids = oldTestProducts.map((p) => p.id);
    await prisma.stockMovement.deleteMany({ where: { productId: { in: ids } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { productId: { in: ids } } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  }

  console.log(`✓ Admin & Cashier authenticated. Store: ${store.name}`);
  console.log(`✓ Floor Location: ${floorLoc.id}, Warehouse Location: ${whLoc.id}`);
}

async function testCatalogAndKhmerSupport() {
  console.log('\n--- [Test 1] Catalog Products & Khmer Name Support ---');

  // List all products
  const listRes = await request(app)
    .get('/api/catalog/products')
    .set('Authorization', `Bearer ${adminToken}`);

  assert(listRes.status === 200, 'GET /api/catalog/products returned 200');
  assert(listRes.body.data.items.length >= 10, 'Products catalog returned at least 10 items');

  const cambodiaBeer = listRes.body.data.items.find((p: any) => p.sku === 'BEV-CAM-330');
  assert(!!cambodiaBeer, 'Found Cambodia Beer in catalog');
  assert(
    cambodiaBeer.nameKhmer === 'ស្រាបៀរកម្ពុជា កំប៉ុង ៣៣០មីលីលីត្រ',
    `Product supports Khmer name: "${cambodiaBeer.nameKhmer}"`,
  );
  assert(cambodiaBeer.reorderLevel === 20, 'Product reorder level correctly loaded');

  // Search by Khmer name
  const khmerSearch = await request(app)
    .get('/api/catalog/products?search=ស្រាបៀរកម្ពុជា')
    .set('Authorization', `Bearer ${adminToken}`);

  assert(khmerSearch.status === 200, 'Search with Khmer Unicode query returned 200');
  assert(khmerSearch.body.data.items.length >= 1, 'Found product by Khmer name search');
  assert(
    khmerSearch.body.data.items[0].sku === 'BEV-CAM-330',
    'Khmer search resolved correct SKU',
  );

  // Filter by Category
  const bevCat = listRes.body.data.items[0].categoryId;
  const catFilter = await request(app)
    .get(`/api/catalog/products?categoryId=${bevCat}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert(catFilter.status === 200, 'Filter by category returned 200');
  assert(catFilter.body.data.items.every((p: any) => p.categoryId === bevCat), 'All items belong to category');
}

async function testFastBarcodeLookup() {
  console.log('\n--- [Test 2] Fast Barcode & SKU Index Lookup ---');

  const startTime = Date.now();
  const res = await request(app)
    .get('/api/catalog/products/barcode/8840001001')
    .set('Authorization', `Bearer ${adminToken}`);
  const duration = Date.now() - startTime;

  assert(res.status === 200, 'Fast barcode query returned 200');
  assert(res.body.data.matchType === 'PRODUCT', 'Lookup resolved as PRODUCT');
  assert(res.body.data.product.sku === 'BEV-CAM-330', 'Resolved SKU matches BEV-CAM-330');
  assert(res.body.data.product.inventory.length > 0, 'Returned per-location inventory');
  assert(duration < 250, `Barcode lookup is ultra-fast (${duration}ms)`);

  // Barcode lookup on Variant
  const varRes = await request(app)
    .get('/api/catalog/products/barcode/8840009001')
    .set('Authorization', `Bearer ${adminToken}`);

  assert(varRes.status === 200, 'Variant barcode lookup returned 200');
  assert(varRes.body.data.matchType === 'VARIANT', 'Lookup resolved as VARIANT');
  assert(varRes.body.data.variant.sku === 'POLO-BLU-M', 'Resolved variant SKU is POLO-BLU-M');
  assert(varRes.body.data.variant.size === 'M', 'Resolved variant size is M');
  assert(varRes.body.data.variant.color === 'Navy Blue', 'Resolved variant color is Navy Blue');
}

async function testProductVariants() {
  console.log('\n--- [Test 3] Product Variants with Size, Color, Weight, Model ---');

  // Create a new product with custom variants
  const createProdRes = await request(app)
    .post('/api/catalog/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Test Gourmet Organic Coffee Beans',
      nameKhmer: 'គ្រាប់កាហ្វេសរីរាង្គពិសេស',
      sku: 'TEST-COF-001',
      barcode: '8840007700',
      costPriceUSD: 4.5,
      sellingPriceUSD: 8.5,
      taxRate: 0.1,
      unit: 'bag',
      reorderLevel: 10,
    });

  assert(createProdRes.status === 201, 'POST /api/catalog/products created product');
  const productId = createProdRes.body.data.id;

  // Create variant with size, color, weight, model
  const createVarRes = await request(app)
    .post(`/api/catalog/products/${productId}/variants`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Dark Roast 500g Bag',
      sku: 'TEST-COF-500G-DRK',
      barcode: '8840007701',
      size: 'Medium Bag',
      color: 'Dark Roast Brown',
      weight: '500g',
      model: 'Arabica-Premium-2026',
      costPriceUSD: 4.5,
      sellingPriceUSD: 8.5,
      initialStock: 30,
      initialLocationId: floorLocationId,
    });

  assert(createVarRes.status === 201, 'POST /variants created variant with size/color/weight/model');
  assert(createVarRes.body.data.weight === '500g', 'Variant weight matches 500g');
  assert(createVarRes.body.data.model === 'Arabica-Premium-2026', 'Variant model recorded correctly');

  // Verify variant listing
  const listVarRes = await request(app)
    .get(`/api/catalog/products/${productId}/variants`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert(listVarRes.status === 200, 'GET /variants returned 200');
  assert(listVarRes.body.data.length === 1, 'Product has 1 registered variant');
  assert(listVarRes.body.data[0].stockQuantity === 30, 'Initial variant stock credited to floor');
}

async function testInventoryAdjustmentReasonRequirement() {
  console.log('\n--- [Test 4] Reason Enforcement & Validation on Adjustments ---');

  const testProduct = await prisma.product.findFirst({ where: { sku: 'BEV-CAM-330' } });
  if (!testProduct) throw new Error('Cambodia beer not found');

  // Attempt adjustment WITHOUT reason
  const badAdjRes = await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId: testProduct.id,
      type: 'ADJUSTMENT_IN',
      quantityChange: 10,
      reason: '', // Invalid empty reason!
    });

  assert(badAdjRes.status === 400, 'Adjustment without reason is REJECTED with 400');
  assert(
    badAdjRes.body.error.message.includes('reason is strictly required'),
    'Validation explicitly cites mandatory reason requirement',
  );

  // Attempt adjustment with non-existent reason or short reason
  const shortAdjRes = await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId: testProduct.id,
      type: 'ADJUSTMENT_IN',
      quantityChange: 10,
      reason: 'ab', // < 3 characters
    });

  assert(shortAdjRes.status === 400, 'Adjustment with sub-length reason is REJECTED with 400');
}

async function testMovementTypesAndAuditLogging() {
  console.log('\n--- [Test 5] Movement Records: Purchase, Return, Damage, Expired ---');

  const testProduct = await prisma.product.findFirst({ where: { sku: 'BEV-CAM-330' } });
  if (!testProduct) throw new Error('Product not found');

  const getStock = async () => {
    const inv = await prisma.inventory.findFirst({
      where: { locationId: floorLocationId, productId: testProduct.id },
    });
    return Number(inv?.quantity || 0);
  };

  const initialStock = await getStock();

  // 1. PURCHASE (+25)
  const purchaseRes = await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId: testProduct.id,
      type: 'PURCHASE',
      quantityChange: 25,
      reason: 'Weekly stock restock delivery PO-2026-99',
    });
  assert(purchaseRes.status === 200, 'PURCHASE adjustment successful');
  assert(purchaseRes.body.data.quantityAfter === initialStock + 25, 'Stock incremented by 25');

  // 2. RETURN (+5)
  const returnRes = await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId: testProduct.id,
      type: 'RETURN',
      quantityChange: 5,
      reason: 'Customer returned unopened pack with receipt',
    });
  assert(returnRes.status === 200, 'RETURN adjustment successful');
  assert(returnRes.body.data.quantityAfter === initialStock + 30, 'Stock incremented by 5');

  // 3. DAMAGE (-4)
  const damageRes = await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId: testProduct.id,
      type: 'DAMAGE',
      quantityChange: 4,
      reason: 'Shelf collapse accident - 4 cans punctured',
    });
  assert(damageRes.status === 200, 'DAMAGE adjustment successful');
  assert(damageRes.body.data.quantityAfter === initialStock + 26, 'Stock decreased by 4 for damage');

  // 4. EXPIRED (-2)
  const expiredRes = await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId: testProduct.id,
      type: 'EXPIRED',
      quantityChange: 2,
      reason: 'Past best-before date rotation audit',
    });
  assert(expiredRes.status === 200, 'EXPIRED adjustment successful');
  assert(expiredRes.body.data.quantityAfter === initialStock + 24, 'Stock decreased by 2 for expiration');

  // 5. Query movement audit logs
  const moveRes = await request(app)
    .get(`/api/inventory/movements?productId=${testProduct.id}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert(moveRes.status === 200, 'GET /api/inventory/movements returned 200');
  const moves = moveRes.body.data.items;
  assert(moves.length >= 4, 'Recorded at least 4 new stock movement entries');

  const typesFound = new Set(moves.map((m: any) => m.type));
  assert(typesFound.has('PURCHASE'), 'Audit log contains PURCHASE type');
  assert(typesFound.has('RETURN'), 'Audit log contains RETURN type');
  assert(typesFound.has('DAMAGE'), 'Audit log contains DAMAGE type');
  assert(typesFound.has('EXPIRED'), 'Audit log contains EXPIRED type');

  assert(moves.every((m: any) => m.notes && m.notes.length >= 3), 'ALL stock movements have non-empty reason notes');
  assert(moves.every((m: any) => m.createdByName), 'ALL stock movements track operator name');
}

async function testLocationTransferTransaction() {
  console.log('\n--- [Test 6] Transactional Location Transfers ---');

  const testProduct = await prisma.product.findFirst({ where: { sku: 'BEV-WAT-500' } });
  if (!testProduct) throw new Error('Water product not found');

  const getStock = async (locId: string) => {
    const inv = await prisma.inventory.findFirst({
      where: { locationId: locId, productId: testProduct.id },
    });
    return Number(inv?.quantity || 0);
  };

  const floorBefore = await getStock(floorLocationId);
  const whBefore = await getStock(whLocationId);

  // Transfer 30 bottles from Warehouse to Floor
  const transferRes = await request(app)
    .post('/api/inventory/transfer')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      fromLocationId: whLocationId,
      toLocationId: floorLocationId,
      productId: testProduct.id,
      quantity: 30,
      reason: 'Restocking floor display coolers for peak evening shift',
    });

  assert(transferRes.status === 200, 'POST /api/inventory/transfer returned 200');

  const floorAfter = await getStock(floorLocationId);
  const whAfter = await getStock(whLocationId);

  assert(whAfter === whBefore - 30, `Warehouse decreased by exactly 30 (${whBefore} -> ${whAfter})`);
  assert(floorAfter === floorBefore + 30, `Floor increased by exactly 30 (${floorBefore} -> ${floorAfter})`);

  // Check audit records for TRANSFER_OUT and TRANSFER_IN
  const moveOut = await prisma.stockMovement.findFirst({
    where: {
      productId: testProduct.id,
      locationId: whLocationId,
      type: 'TRANSFER_OUT',
      notes: { contains: 'Restocking floor display coolers' },
    },
  });
  const moveIn = await prisma.stockMovement.findFirst({
    where: {
      productId: testProduct.id,
      locationId: floorLocationId,
      type: 'TRANSFER_IN',
      notes: { contains: 'Restocking floor display coolers' },
    },
  });

  assert(!!moveOut, 'Recorded TRANSFER_OUT movement in source warehouse');
  assert(!!moveIn, 'Recorded TRANSFER_IN movement in destination sales floor');
  assert(Number(moveOut?.quantityChange) === -30, 'TRANSFER_OUT recorded -30 change');
  assert(Number(moveIn?.quantityChange) === 30, 'TRANSFER_IN recorded +30 change');
}

async function testInventoryAccuracyMultiCycle() {
  console.log('\n--- [Test 7] Inventory Accuracy After Multiple Sales & Adjustments ---');

  // Let's create an isolated test product to mathematically prove exact inventory accuracy
  const newProductRes = await request(app)
    .post('/api/catalog/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Audited Test Energy Drink 250ml',
      nameKhmer: 'ភេសជ្ជៈប៉ូវកម្លាំងសាកល្បង',
      sku: 'TEST-ENRG-250',
      barcode: '8840008888',
      costPriceUSD: 0.5,
      sellingPriceUSD: 1.0,
      taxRate: 0.1,
      unit: 'can',
      reorderLevel: 20,
      initialStock: 100,
      initialLocationId: floorLocationId,
    });

  assert(newProductRes.status === 201, 'Created dedicated audited test product with initial stock 100');
  const productId = newProductRes.body.data.id;

  let expectedBalance = 100;

  // Cycle 1: Purchase restock of 50 cans
  await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId,
      type: 'PURCHASE',
      quantityChange: 50,
      reason: 'Cycle 1: Supplier shipment invoice INV-881',
    });
  expectedBalance += 50; // 150

  // Cycle 2: Checkout sale of 15 cans via POS checkout
  const sale1Res = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [
        {
          productId,
          quantity: 15,
          unitPriceUSD: 1.0,
        },
      ],
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: 16.5,
          amountKHR: 0,
        },
      ],
      notes: 'Customer retail purchase #1',
    });
  assert(sale1Res.status === 200, 'POS checkout sale #1 completed');
  expectedBalance -= 15; // 135

  // Cycle 3: Damage adjustment of 5 cans
  await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId,
      type: 'DAMAGE',
      quantityChange: 5,
      reason: 'Cycle 3: Can dropped by customer in aisle',
    });
  expectedBalance -= 5; // 130

  // Cycle 4: Another POS checkout sale of 20 cans
  const sale2Res = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [
        {
          productId,
          quantity: 20,
          unitPriceUSD: 1.0,
        },
      ],
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: 22.0,
          amountKHR: 0,
        },
      ],
      notes: 'Customer retail purchase #2',
    });
  assert(sale2Res.status === 200, 'POS checkout sale #2 completed');
  expectedBalance -= 20; // 110

  // Cycle 5: Expired disposal of 8 cans
  await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId,
      type: 'EXPIRED',
      quantityChange: 8,
      reason: 'Cycle 5: Damaged seal / quality expiration writeoff',
    });
  expectedBalance -= 8; // 102

  // Cycle 6: Customer return of 2 cans
  await request(app)
    .post('/api/inventory/adjust')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      locationId: floorLocationId,
      productId,
      type: 'RETURN',
      quantityChange: 2,
      reason: 'Cycle 6: Customer returned unopened cans',
    });
  expectedBalance += 2; // 104

  // Verify DB state
  const invRecord = await prisma.inventory.findFirst({
    where: { locationId: floorLocationId, productId },
  });
  const actualBalance = Number(invRecord?.quantity || 0);

  console.log(`  Expected Final Balance: ${expectedBalance}`);
  console.log(`  Actual DB Balance:      ${actualBalance}`);

  assert(actualBalance === expectedBalance, `Mathematical inventory balance is 100% accurate (${actualBalance} === ${expectedBalance})`);

  // Verify all movements match ledger
  const movements = await prisma.stockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: 'asc' },
  });

  const ledgerNet = movements.reduce((acc, m) => acc + Number(m.quantityChange), 0);
  assert(ledgerNet === expectedBalance, `Sum of movement log changes (${ledgerNet}) matches current stock balance (${expectedBalance})`);
}

async function testLowStockAlerts() {
  console.log('\n--- [Test 8] Low-Stock Alerts & Indicator Verification ---');

  const lowStockRes = await request(app)
    .get('/api/inventory/low-stock')
    .set('Authorization', `Bearer ${adminToken}`);

  assert(lowStockRes.status === 200, 'GET /api/inventory/low-stock returned 200');
  assert(Array.isArray(lowStockRes.body.data.items), 'Returned array of low stock items');

  // Query catalog with lowStockOnly filter
  const catLowRes = await request(app)
    .get('/api/catalog/products?lowStockOnly=true')
    .set('Authorization', `Bearer ${adminToken}`);

  assert(catLowRes.status === 200, 'GET /api/catalog/products?lowStockOnly=true returned 200');
  assert(catLowRes.body.data.items.every((p: any) => p.isLowStock), 'Every returned item is marked as low stock');
}

async function runAll() {
  try {
    await setup();
    await testCatalogAndKhmerSupport();
    await testFastBarcodeLookup();
    await testProductVariants();
    await testInventoryAdjustmentReasonRequirement();
    await testMovementTypesAndAuditLogging();
    await testLocationTransferTransaction();
    await testInventoryAccuracyMultiCycle();
    await testLowStockAlerts();

    console.log('\n================================================================');
    console.log('🎉 ALL PRODUCT & INVENTORY INTEGRATION TESTS PASSED CLEANLY! ✨');
    console.log('================================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ INTEGRATION TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAll();
