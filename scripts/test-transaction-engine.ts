import request from 'supertest';
import { createApp } from '../apps/api/src/index.js';
import { AuthService } from '../apps/api/src/auth/service.js';
import { prisma } from '../apps/api/src/db/index.js';
import { paymentRegistry } from '../apps/api/src/services/payment/PaymentRegistry.js';

let app: any;
let cashierToken: string;
let adminToken: string;
let storeId: string;
let floorLocationId: string;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function setup() {
  console.log('\n--- [Setup] Initializing Transaction Engine Integration Context ---');
  app = createApp();

  const cashierLogin = await AuthService.login('cashier', 'cashier123', '127.0.0.1');
  cashierToken = cashierLogin.tokens.accessToken;

  const adminLogin = await AuthService.login('admin', 'admin123', '127.0.0.1');
  adminToken = adminLogin.tokens.accessToken;

  const store = await prisma.store.findFirst({ where: { code: 'STR-PP-01' } });
  if (!store) throw new Error('Store STR-PP-01 not found');
  storeId = store.id;

  const floorLoc = await prisma.inventoryLocation.findFirst({
    where: { storeId, code: 'LOC-FLOOR-01' },
  });
  if (!floorLoc) throw new Error('Floor location LOC-FLOOR-01 not found');
  floorLocationId = floorLoc.id;

  console.log(`✓ Cashier & Admin tokens initialized. Store: ${store.name}`);
}

/**
 * 1. Test Exact Cash Payment
 */
async function testExactCashPayment() {
  console.log('\n--- [Test 1] Exact Cash Payment ---');

  const product = await prisma.product.findFirst({ where: { sku: 'BEV-WAT-500' } });
  if (!product) throw new Error('Product BEV-WAT-500 not found');

  const unitPrice = Number(product.sellingPriceUSD);
  const qty = 3;
  const expectedTotal = Number((unitPrice * qty).toFixed(2));

  const res = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [{ productId: product.id, quantity: qty }],
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: expectedTotal,
          tenderAmountUSD: expectedTotal,
          tenderAmountKHR: 0,
        },
      ],
      notes: 'Test 1: Exact cash payment',
    });

  assert(res.status === 200, 'POST /api/pos/checkout returns 200 OK');
  const data = res.body.data;
  assert(data.status === 'PAID', 'Order status is PAID');
  assert(Math.abs(data.totalUSD - expectedTotal) < 0.01, `Total USD is exact ($${data.totalUSD})`);
  assert(data.paidUSD === expectedTotal, `Paid USD equals total ($${data.paidUSD})`);
  assert(data.changeUSD === 0, 'Change USD is exactly 0.00');
  assert(data.changeKHR === 0, 'Change KHR is exactly 0');
  assert(!!data.receipt?.receiptNumber, `Receipt created: ${data.receipt.receiptNumber}`);
}

/**
 * 2. Test Overpayment with Change Calculation (USD & KHR)
 */
async function testOverpaymentWithChange() {
  console.log('\n--- [Test 2] Overpayment & Change Calculation (USD & KHR) ---');

  const product = await prisma.product.findFirst({ where: { sku: 'BEV-CAM-330' } });
  if (!product) throw new Error('Product BEV-CAM-330 not found');

  const unitPrice = Number(product.sellingPriceUSD); // $1.20
  const qty = 2;
  const expectedTotal = Number((unitPrice * qty).toFixed(2)); // $2.40
  const tenderUSD = 10.0; // Paid with $10 bill
  const expectedChangeUSD = Number((tenderUSD - expectedTotal).toFixed(2)); // $7.60
  const exchangeRateKHR = 4100;
  const expectedChangeKHR = Math.round(expectedChangeUSD * exchangeRateKHR); // 31,160 KHR

  const res = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [{ productId: product.id, quantity: qty }],
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: expectedTotal,
          tenderAmountUSD: tenderUSD,
          tenderAmountKHR: 0,
        },
      ],
      notes: 'Test 2: $10 bill on $2.40 purchase',
    });

  assert(res.status === 200, 'Checkout returns 200 OK');
  const data = res.body.data;
  assert(data.status === 'PAID', 'Order status is PAID');
  assert(data.changeUSD === expectedChangeUSD, `Change USD calculated correctly ($${data.changeUSD} == $${expectedChangeUSD})`);
  assert(data.changeKHR === expectedChangeKHR, `Change KHR calculated correctly (${data.changeKHR} == ${expectedChangeKHR} KHR)`);
}

/**
 * 3. Test Underpayment Rejection (When Partial Payment is not Allowed)
 */
async function testUnderpaymentRejection() {
  console.log('\n--- [Test 3] Underpayment Validation & Rejection ---');

  const product = await prisma.product.findFirst({ where: { sku: 'BEV-CAM-330' } });
  if (!product) throw new Error('Product BEV-CAM-330 not found');

  const unitPrice = Number(product.sellingPriceUSD);
  const qty = 5; // Total = $6.00
  const total = Number((unitPrice * qty).toFixed(2));
  const underpaidAmount = 2.0; // Customer only tendered $2.00

  const res = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [{ productId: product.id, quantity: qty }],
      allowPartialPayment: false, // Disallowed
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: underpaidAmount,
          tenderAmountUSD: underpaidAmount,
        },
      ],
      notes: 'Test 3: Intentionally underpaid without partial flag',
    });

  assert(res.status === 400, 'Underpayment without partial flag is REJECTED with 400');
  assert(res.body.error.code === 'UNDERPAYMENT_ERROR', 'Error code is UNDERPAYMENT_ERROR');
  assert(res.body.error.details.remainingUSD === Number((total - underpaidAmount).toFixed(2)), 'Error details specify exact remaining balance');
}

/**
 * 4. Test Multiple Items, Line Discounts, and Order-Level Discounts
 */
async function testMultipleItemsAndDiscounts() {
  console.log('\n--- [Test 4] Multiple Items & Multi-Level Discounts ---');

  const p1 = await prisma.product.findFirst({ where: { sku: 'BEV-CAM-330' } });
  const p2 = await prisma.product.findFirst({ where: { sku: 'BEV-WAT-500' } });
  if (!p1 || !p2) throw new Error('Products not found');

  const p1Price = Number(p1.sellingPriceUSD);
  const p2Price = Number(p2.sellingPriceUSD);
  const line1Total = Number((p1Price * 4 - 0.8).toFixed(2));
  const line2Total = Number((p2Price * 6).toFixed(2));
  const expectedSubtotal = Number((line1Total + line2Total).toFixed(2));
  const orderDiscount = 1.0;
  const expectedTotal = Number((expectedSubtotal - orderDiscount).toFixed(2));

  // Server quote preview endpoint test
  const quoteRes = await request(app)
    .post('/api/pos/calculate')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      items: [
        { productId: p1.id, quantity: 4, discountUSD: 0.8 },
        { productId: p2.id, quantity: 6, discountUSD: 0.0 },
      ],
      discountUSD: orderDiscount,
    });

  assert(quoteRes.status === 200, 'POST /api/pos/calculate returns 200 OK');
  const quote = quoteRes.body.data;
  assert(
    Math.abs(quote.subtotalUSD - expectedSubtotal) < 0.01,
    `Subtotal after line discount is $${expectedSubtotal} ($${quote.subtotalUSD})`,
  );
  assert(quote.orderDiscountUSD === orderDiscount, `Order discount applied $${orderDiscount}`);
  assert(
    Math.abs(quote.totalUSD - expectedTotal) < 0.01,
    `Grand total is $${expectedTotal} ($${quote.totalUSD})`,
  );

  // Checkout with calculated quote
  const checkoutRes = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [
        { productId: p1.id, quantity: 4, discountUSD: 0.8 },
        { productId: p2.id, quantity: 6, discountUSD: 0.0 },
      ],
      discountUSD: orderDiscount,
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: expectedTotal,
          tenderAmountUSD: expectedTotal,
        },
      ],
    });

  assert(checkoutRes.status === 200, 'Checkout with discounts returns 200 OK');
  const orderData = checkoutRes.body.data;
  assert(Math.abs(orderData.totalUSD - expectedTotal) < 0.01, `Order total matches server calculation ($${expectedTotal})`);
  assert(orderData.items.length === 2, '2 line items persisted');
  assert(orderData.discountUSD === orderDiscount, 'Order discount recorded in DB');
}

/**
 * 5. Test Partial Payment & Second Payment Workflow
 */
async function testPartialPaymentAndSecondTender() {
  console.log('\n--- [Test 5] Partial Payment & Subsequent Balance Settlement ---');

  const product = await prisma.product.findFirst({ where: { sku: 'BEV-WAT-500' } }); // $0.50
  if (!product) throw new Error('Product not found');

  const qty = 20; // Total = $10.00
  const initialPayment = 4.0; // Pay $4 first

  // Step 5a: Partial Checkout
  const partialRes = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [{ productId: product.id, quantity: qty }],
      allowPartialPayment: true,
      payments: [
        {
          paymentMethodCode: 'CASH',
          amountUSD: initialPayment,
          tenderAmountUSD: initialPayment,
        },
      ],
      notes: 'Test 5: Partial down-payment of $4',
    });

  assert(partialRes.status === 200, 'Partial checkout returns 200 OK');
  const orderData = partialRes.body.data;
  assert(orderData.status === 'PARTIALLY_PAID', 'Order status is PARTIALLY_PAID');
  assert(orderData.paidUSD === 4.0, 'Paid USD is $4.00');
  assert(orderData.remainingUSD === 6.0, 'Remaining USD is $6.00');
  const orderId = orderData.orderId;

  // Step 5b: Settle remaining balance with KHQR payment
  const settleRes = await request(app)
    .post(`/api/pos/orders/${orderId}/payments`)
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      payment: {
        paymentMethodCode: 'KHQR_ABA',
        amountUSD: 6.0,
        tenderAmountUSD: 6.0,
        transactionRef: `KHQR-SETTLE-${Date.now().toString().slice(-6)}`,
      },
    });

  assert(settleRes.status === 200, 'POST /orders/:id/payments returns 200 OK');
  const updatedOrder = settleRes.body.data;
  assert(updatedOrder.status === 'PAID', 'Order status transitioned from PARTIALLY_PAID to PAID');
  assert(updatedOrder.paidUSD === 10.0, 'Total paid USD is $10.00');
  assert(updatedOrder.remainingUSD === 0.0, 'Remaining balance is $0.00');
  assert(updatedOrder.payments.length === 2, '2 distinct payments recorded across CASH and KHQR_ABA');
}

/**
 * 6. Test Failed Payment Handling (No Orphaned Records, Zero Stock Deductions)
 */
async function testFailedPaymentAtomicRollback() {
  console.log('\n--- [Test 6] Failed Payment Handling & Safe Atomic Rollback ---');

  const product = await prisma.product.findFirst({ where: { sku: 'BEV-WAT-500' } });
  if (!product) throw new Error('Product not found');

  // Record stock before attempt
  const invBefore = await prisma.inventory.findFirst({
    where: { storeId, locationId: floorLocationId, productId: product.id },
  });
  const stockBefore = Number(invBefore?.quantity || 0);

  // Attempt checkout with Card that is DECLINED
  const failRes = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [{ productId: product.id, quantity: 5 }],
      payments: [
        {
          paymentMethodCode: 'CARD',
          amountUSD: 2.5,
          transactionRef: 'DECLINED', // Trigger decline
          metadata: { cardStatus: 'DECLINED' },
        },
      ],
      notes: 'Test 6: Card decline simulation',
    });

  assert(failRes.status === 400, 'Declined card returns 400 Bad Request');
  assert(failRes.body.error.code === 'CARD_DECLINED', 'Error code explicitly indicates CARD_DECLINED');

  // Verify stock was NOT decremented
  const invAfter = await prisma.inventory.findFirst({
    where: { storeId, locationId: floorLocationId, productId: product.id },
  });
  const stockAfter = Number(invAfter?.quantity || 0);
  assert(stockAfter === stockBefore, `Stock was safely preserved without decrement (${stockBefore} === ${stockAfter})`);

  // Verify no orphaned order was left behind
  const orderCount = await prisma.order.count({
    where: { notes: { contains: 'Test 6: Card decline simulation' } },
  });
  assert(orderCount === 0, 'No orphaned order records exist in database');
}

/**
 * 7. Test Idempotency & Double-Click Protection
 */
async function testIdempotencyAndDoubleClickProtection() {
  console.log('\n--- [Test 7] Idempotency & Double-Click Protection ---');

  const product = await prisma.product.findFirst({ where: { sku: 'BEV-WAT-500' } });
  if (!product) throw new Error('Product not found');

  const idempotencyKey = `PAY-IDEMP-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const checkoutPayload = {
    storeId,
    idempotencyKey,
    items: [{ productId: product.id, quantity: 2 }],
    payments: [
      {
        paymentMethodCode: 'CASH',
        amountUSD: 1.0,
        tenderAmountUSD: 1.0,
      },
    ],
    notes: 'Test 7: Idempotent checkout',
  };

  // First click: Create order
  const firstRes = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send(checkoutPayload);

  assert(firstRes.status === 200, 'First payment click returns 200 OK');
  const firstOrderId = firstRes.body.data.orderId;
  const firstOrderNumber = firstRes.body.data.orderNumber;

  // Second click: Same payload & same idempotencyKey (simulating user double-clicking payment button)
  const secondRes = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send(checkoutPayload);

  assert(secondRes.status === 200, 'Second payment click returns 200 OK (Idempotent replay)');
  assert(secondRes.body.data.orderId === firstOrderId, 'Returns same order ID rather than creating a duplicate');
  assert(secondRes.body.data.orderNumber === firstOrderNumber, 'Returns identical order number');

  // Verify only 1 order exists in database with this key
  const count = await prisma.order.count({ where: { idempotencyKey } });
  assert(count === 1, 'Exactly 1 order exists in PostgreSQL database');
}

/**
 * 8. Test Configurable Payment Methods via Abstraction Layer
 */
async function testConfigurablePaymentMethods() {
  console.log('\n--- [Test 8] Configurable Payment Methods (Cash, Card, Bank, QR, Other) ---');

  const methodsRes = await request(app)
    .get('/api/pos/payment-methods')
    .set('Authorization', `Bearer ${cashierToken}`);

  assert(methodsRes.status === 200, 'GET /api/pos/payment-methods returns 200 OK');
  const methods = methodsRes.body.data;
  assert(Array.isArray(methods) && methods.length >= 5, `Configured methods returned (${methods.length} methods)`);

  const codes = methods.map((m: any) => m.code);
  assert(codes.includes('CASH'), 'Supports CASH method');
  assert(codes.includes('CARD'), 'Supports CARD method');
  assert(codes.includes('BANK_TRANSFER'), 'Supports BANK_TRANSFER method');
  assert(codes.includes('KHQR_ABA'), 'Supports KHQR_ABA method');
  assert(codes.includes('OTHER'), 'Supports OTHER method');

  // Test checkout using OTHER method (Voucher)
  const product = await prisma.product.findFirst({ where: { sku: 'BEV-WAT-500' } });
  const voucherRes = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [{ productId: product!.id, quantity: 2 }],
      payments: [
        {
          paymentMethodCode: 'OTHER',
          amountUSD: 1.0,
          transactionRef: 'VOUCHER-GIFT-50',
          metadata: { tenderType: 'GIFT_CARD' },
        },
      ],
      notes: 'Test 8: Voucher payment',
    });

  assert(voucherRes.status === 200, 'Voucher payment processed successfully via OtherPaymentProvider');
  assert(voucherRes.body.data.payments[0].paymentMethodCode === 'OTHER', 'Payment recorded with OTHER method code');
}

/**
 * 9. Test Void and Refund Workflows with Inventory Restoration & Audit
 */
async function testVoidAndRefundWorkflows() {
  console.log('\n--- [Test 9] Void & Refund Workflows with Inventory Reversal ---');

  const product = await prisma.product.findFirst({ where: { sku: 'BEV-WAT-500' } });
  if (!product) throw new Error('Product not found');

  const getStock = async () => {
    const inv = await prisma.inventory.findFirst({
      where: { storeId, locationId: floorLocationId, productId: product.id },
    });
    return Number(inv?.quantity || 0);
  };

  const initialStock = await getStock();

  // Create an order of 4 items
  const orderRes = await request(app)
    .post('/api/pos/checkout')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      storeId,
      items: [{ productId: product.id, quantity: 4 }],
      payments: [{ paymentMethodCode: 'CASH', amountUSD: 2.0, tenderAmountUSD: 2.0 }],
      notes: 'Order for void test',
    });

  const orderId = orderRes.body.data.orderId;
  const stockAfterSale = await getStock();
  assert(stockAfterSale === initialStock - 4, `Stock decremented by 4 on sale (${initialStock} -> ${stockAfterSale})`);

  // Void order
  const voidRes = await request(app)
    .post(`/api/pos/orders/${orderId}/void`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ reason: 'Customer changed mind before leaving register' });

  assert(voidRes.status === 200, 'POST /orders/:id/void returns 200 OK');
  assert(voidRes.body.data.status === 'VOIDED', 'Order status is VOIDED');

  // Verify stock restored
  const stockAfterVoid = await getStock();
  assert(stockAfterVoid === initialStock, `Stock completely restored to initial balance on void (${stockAfterSale} -> ${stockAfterVoid})`);

  // Verify audit log
  const audit = await prisma.auditLog.findFirst({
    where: { entityId: orderId, action: 'ORDER_VOIDED' },
  });
  assert(!!audit, 'Audit log recorded for ORDER_VOIDED');
}

async function runAll() {
  try {
    await setup();
    await testExactCashPayment();
    await testOverpaymentWithChange();
    await testUnderpaymentRejection();
    await testMultipleItemsAndDiscounts();
    await testPartialPaymentAndSecondTender();
    await testFailedPaymentAtomicRollback();
    await testIdempotencyAndDoubleClickProtection();
    await testConfigurablePaymentMethods();
    await testVoidAndRefundWorkflows();

    console.log('\n================================================================');
    console.log('🎉 ALL TRANSACTION ENGINE INTEGRATION TESTS PASSED CLEANLY! ✨');
    console.log('================================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TRANSACTION ENGINE TEST SUITE FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAll();
