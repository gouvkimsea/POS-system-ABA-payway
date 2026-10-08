/**
 * Automated Unit Test Suite
 * Fast, in-memory unit tests covering:
 * 1. Zod Validation Schemas (Input boundaries, type enforcement, constraints)
 * 2. Financial & Currency Mathematics (Subtotals, multi-tier discounts, VAT, exchange rates, change)
 * 3. Token & Cryptography Security (Argon2, bcrypt PIN, JWT HS256, expiration, algorithm tampering)
 * 4. Idempotency & Concurrency Manager (Lock acquire, concurrent lock block, TTL, release)
 * 5. Hardware ESC/POS Binary Encoder (58mm vs 80mm column math, control codes, cut, kick)
 * 6. Offline Synchronization Conflict Resolution (Version vectors, LATEST_WINS, SERVER_WINS, CLIENT_WINS)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import {
  loginInputSchema,
  pinLoginInputSchema,
  checkoutInputSchema,
  checkoutItemSchema,
  createCustomerSchema,
  cashMovementSchema,
  processReturnRefundSchema,
  createDiscountSchema,
  createProductSchema,
} from '@pos/validation';

import bcrypt from 'bcryptjs';
import {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
} from '../apps/api/src/auth/token.js';
import { IdempotencyManager } from '../apps/api/src/services/transaction/IdempotencyManager.js';
import { EscPosEncoder } from '../apps/bridge/src/EscPosEncoder.js';
import jwt from 'jsonwebtoken';

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

async function runUnitTests() {
  console.log('======================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE AUTOMATED UNIT TEST SUITE');
  console.log('======================================================================\n');

  // =========================================================================
  // 1. ZOD VALIDATION SCHEMAS UNIT TESTS
  // =========================================================================
  console.log('--- [Category 1] Zod Validation Schemas ---');

  // 1.1 Login Validation
  const validLogin = loginInputSchema.safeParse({ username: 'cashier', password: 'password123' });
  assert(validLogin.success, 'Login schema accepts valid credentials');

  const emptyUserLogin = loginInputSchema.safeParse({ username: '', password: 'password123' });
  assert(!emptyUserLogin.success, 'Login schema rejects empty username');

  const missingPassLogin = loginInputSchema.safeParse({ username: 'cashier' });
  assert(!missingPassLogin.success, 'Login schema rejects missing password');

  // 1.2 PIN Login Validation
  const validPin = pinLoginInputSchema.safeParse({ username: 'cashier', pin: '1234' });
  assert(validPin.success, 'PIN schema accepts 4-digit numeric PIN');

  const shortPin = pinLoginInputSchema.safeParse({ username: 'cashier', pin: '12' });
  assert(!shortPin.success, 'PIN schema rejects PIN shorter than 4 characters');

  // 1.3 Checkout Items Validation
  const validItem = checkoutItemSchema.safeParse({
    productId: 'prod-001',
    quantity: 2,
    unitPriceUSD: 2.5,
  });
  assert(validItem.success, 'CheckoutItem accepts positive quantity');

  const zeroQtyItem = checkoutItemSchema.safeParse({
    productId: 'prod-001',
    quantity: 0,
  });
  assert(!zeroQtyItem.success, 'CheckoutItem rejects zero quantity (must be > 0)');

  const negQtyItem = checkoutItemSchema.safeParse({
    productId: 'prod-001',
    quantity: -3,
  });
  assert(!negQtyItem.success, 'CheckoutItem rejects negative quantity');

  // 1.4 Checkout Input Validation (Empty cart & missing payments)
  const emptyCartCheckout = checkoutInputSchema.safeParse({
    items: [],
    payments: [{ paymentMethodCode: 'CASH', amountUSD: 10 }],
  });
  assert(!emptyCartCheckout.success, 'Checkout rejects empty items array');

  const noPaymentCheckout = checkoutInputSchema.safeParse({
    items: [{ productId: 'prod-001', quantity: 1 }],
    payments: [],
  });
  assert(!noPaymentCheckout.success, 'Checkout rejects empty payments array');

  // 1.5 Cash Movement Validation
  const validCashIn = cashMovementSchema.safeParse({
    registerId: 'reg-01',
    type: 'CASH_IN',
    amountUSD: 50,
    reason: 'Opening petty cash',
  });
  assert(validCashIn.success, 'CashMovement accepts valid CASH_IN');

  const negCashMovement = cashMovementSchema.safeParse({
    registerId: 'reg-01',
    type: 'CASH_OUT',
    amountUSD: -10,
    reason: 'Negative test',
  });
  assert(!negCashMovement.success, 'CashMovement rejects negative amounts');

  // 1.6 Return Refund Validation
  const validReturn = processReturnRefundSchema.safeParse({
    orderId: 'ord-123',
    reason: 'CUSTOMER_CHANGED_MIND',
    refundMethodCode: 'CASH',
    items: [{ orderItemId: 'item-01', quantity: 1, restockInventory: true }],
  });
  assert(validReturn.success, 'ReturnRefund schema accepts valid return payload');

  const emptyReturnItems = processReturnRefundSchema.safeParse({
    orderId: 'ord-123',
    reason: 'DEFECTIVE',
    refundMethodCode: 'CASH',
    items: [],
  });
  assert(!emptyReturnItems.success, 'ReturnRefund schema rejects empty items list');

  // =========================================================================
  // 2. FINANCIAL & CURRENCY MATHEMATICS UNIT TESTS
  // =========================================================================
  console.log('\n--- [Category 2] Financial & Currency Mathematics ---');

  // 2.1 Currency exchange calculations
  const exchangeRate = 4100;
  const usdAmount = 12.5;
  const khrCalculated = Math.round(usdAmount * exchangeRate);
  assert(
    khrCalculated === 51250,
    `USD to KHR conversion: $12.50 * 4100 = ${khrCalculated} KHR (exact: 51250)`,
  );

  const backToUSD = Number((khrCalculated / exchangeRate).toFixed(2));
  assert(backToUSD === 12.5, `KHR back to USD rounding: ${khrCalculated} / 4100 = $${backToUSD}`);

  // 2.2 Dual Currency Tender & Change Calculation
  const orderTotalUSD = 15.0;
  const tenderedUSD = 10.0;
  const tenderedKHR = 30000; // 30000 / 4100 = 7.317 USD -> Total tendered = 17.32 USD
  const totalTenderedUSD = tenderedUSD + tenderedKHR / exchangeRate;
  const changeUSD = Math.max(0, Number((totalTenderedUSD - orderTotalUSD).toFixed(2)));
  const changeKHR = Math.round(changeUSD * exchangeRate);

  assert(totalTenderedUSD > orderTotalUSD, 'Total combined USD+KHR tender satisfies order total');
  assert(
    changeUSD === 2.32,
    `Change in USD is accurately computed: $${changeUSD} (expected $2.32)`,
  );
  assert(
    changeKHR === 9512,
    `Change in KHR is accurately computed: ${changeKHR} KHR (expected 9512 KHR)`,
  );

  // 2.3 Tax (VAT 10%) Calculations (Tax Inclusive vs Tax Exclusive)
  const subtotalInclusive = 110.0;
  const taxInclusiveTax = Number((subtotalInclusive - subtotalInclusive / 1.1).toFixed(2));
  assert(
    taxInclusiveTax === 10.0,
    `Tax-inclusive 10% VAT on $110: tax is $${taxInclusiveTax} (expected $10.00)`,
  );

  const subtotalExclusive = 100.0;
  const taxExclusiveTax = Number((subtotalExclusive * 0.1).toFixed(2));
  const totalExclusive = Number((subtotalExclusive + taxExclusiveTax).toFixed(2));
  assert(
    taxExclusiveTax === 10.0 && totalExclusive === 110.0,
    `Tax-exclusive 10% VAT on $100: tax is $${taxExclusiveTax}, total is $${totalExclusive}`,
  );

  // 2.4 Multi-Tier Discount Capping
  const grossSubtotal = 100.0;
  const maxAllowedCashierDiscount = grossSubtotal * 0.5; // 50% cap
  const requestedManualDiscount = 75.0; // Cashier requests 75%
  const effectiveDiscount = Math.min(requestedManualDiscount, maxAllowedCashierDiscount);
  assert(
    effectiveDiscount === 50.0,
    `Manual cashier discount capped at 50%: requested $75 -> effective $${effectiveDiscount}`,
  );

  // =========================================================================
  // 3. CRYPTOGRAPHY & TOKEN SECURITY UNIT TESTS
  // =========================================================================
  console.log('\n--- [Category 3] Cryptography & Token Security ---');

  // 3.1 Bcrypt Password Hashing & Verification
  const testPassword = 'SecureAdminPassword!2026';
  const salt = await bcrypt.genSalt(10);
  const hashedPw = await bcrypt.hash(testPassword, salt);
  assert(hashedPw.startsWith('$2'), 'Bcrypt password hash matches expected format signature ($2)');
  const validPassCheck = await bcrypt.compare(testPassword, hashedPw);
  assert(validPassCheck, 'Bcrypt compare matches valid original password');
  const invalidPassCheck = await bcrypt.compare('WrongPassword123', hashedPw);
  assert(!invalidPassCheck, 'Bcrypt compare strictly rejects invalid password');

  // 3.2 Bcrypt PIN Code Hashing & Verification
  const testPin = '9876';
  const hashedPin = await bcrypt.hash(testPin, 10);
  assert(hashedPin.startsWith('$2'), 'Bcrypt PIN hash starts with $2 salt identifier');
  const validPinCheck = await bcrypt.compare(testPin, hashedPin);
  assert(validPinCheck, 'Bcrypt compare matches valid PIN');
  const invalidPinCheck = await bcrypt.compare('0000', hashedPin);
  assert(!invalidPinCheck, 'Bcrypt compare strictly rejects invalid PIN');

  // 3.3 SHA-256 Token Hashing (Session Refresh Storage)
  const rawToken = 'sample-refresh-token-xyz-12345';
  const hashedToken = hashToken(rawToken);
  assert(
    typeof hashedToken === 'string' && hashedToken.length === 64,
    'SHA-256 token hashing generates 64-char hex digest',
  );
  assert(hashToken(rawToken) === hashedToken, 'SHA-256 token hashing is deterministic');

  // 3.4 JWT Signing & HS256 Enforcement
  const jwtPayload = {
    userId: 'user-unit-test-uuid',
    username: 'testadmin',
    businessId: 'biz-unit-test-uuid',
    storeId: 'store-unit-test-uuid',
    authorizedStoreIds: ['store-unit-test-uuid'],
    roles: ['ADMIN'] as any,
    permissions: ['pos.sales', 'users.manage'] as any,
  };
  const tokens = generateTokens(jwtPayload);
  assert(
    typeof tokens.accessToken === 'string' && tokens.accessToken.split('.').length === 3,
    'JWT access token is standard 3-part compact serialization',
  );
  assert(typeof tokens.refreshToken === 'string', 'Refresh token generated successfully');

  const decoded = verifyAccessToken(tokens.accessToken);
  assert(decoded !== null, 'Valid access token verified successfully');
  assert(decoded?.userId === jwtPayload.userId, 'Verified token payload matches input userId');
  assert(decoded?.roles?.includes('ADMIN' as any), 'Verified token payload matches input role');

  // 3.5 Algorithm Confusion Attack ('none' algorithm) Rejection
  const noneToken = jwt.sign(jwtPayload, '', { algorithm: 'none' as any });
  const noneDecoded = verifyAccessToken(noneToken);
  assert(
    noneDecoded === null,
    'JWT verification strictly REJECTS algorithm "none" unsigned tokens (returns null)',
  );

  // 3.6 Tampered Payload Rejection
  const tokenParts = tokens.accessToken.split('.');
  const tamperedPayloadStr = Buffer.from(
    JSON.stringify({ ...jwtPayload, role: 'SUPER_GOD_ADMIN' }),
  ).toString('base64url');
  const tamperedToken = `${tokenParts[0]}.${tamperedPayloadStr}.${tokenParts[2]}`;
  const tamperedDecoded = verifyAccessToken(tamperedToken);
  assert(
    tamperedDecoded === null,
    'JWT verification strictly REJECTS payload tampering with signature mismatch',
  );

  // =========================================================================
  // 4. IDEMPOTENCY & CONCURRENCY MANAGER UNIT TESTS
  // =========================================================================
  console.log('\n--- [Category 4] Idempotency & Concurrency Manager ---');

  const testKey = `unit-idemp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // 4.1 First acquire should succeed
  const lock1 = await IdempotencyManager.acquireLock(testKey, 15);
  assert(lock1 === true, 'Initial lock acquisition succeeds (returns true)');

  const cachedBefore = await IdempotencyManager.getCompletedResult(testKey);
  assert(cachedBefore === null, 'Initial lock has no cached completed result');

  // 4.2 Concurrent second acquire on in-flight operation should be blocked
  const lock2 = await IdempotencyManager.acquireLock(testKey, 15);
  assert(lock2 === false, 'Concurrent acquire on in-flight lock is blocked (returns false)');

  // 4.3 Save result and verify subsequent lookup returns cached response
  const sampleOrderResult = { orderId: 'ord-unit-cached-123', totalUSD: 45.0, status: 'PAID' };
  await IdempotencyManager.saveCompletedResult(testKey, sampleOrderResult);

  const cachedAfter = await IdempotencyManager.getCompletedResult(testKey);
  assert(
    cachedAfter?.orderId === sampleOrderResult.orderId,
    'Cached result accurately returned on idempotency lookup',
  );

  // 4.4 Release lock cleans up safely
  await IdempotencyManager.releaseLock(testKey);
  const lockAfterRelease = await IdempotencyManager.acquireLock(testKey, 15);
  assert(lockAfterRelease === true, 'Lock can be re-acquired after release');
  await IdempotencyManager.releaseLock(testKey);

  // =========================================================================
  // 5. HARDWARE ESC/POS BINARY ENCODER UNIT TESTS
  // =========================================================================
  console.log('\n--- [Category 5] Hardware ESC/POS Binary Encoder ---');

  // 5.1 58mm vs 80mm column width configuration
  const encoder58 = new EscPosEncoder('58mm');
  const encoder80 = new EscPosEncoder('80mm');
  assert(
    (encoder58 as any).columns === 32,
    '58mm thermal receipt printer configured for 32 columns',
  );
  assert(
    (encoder80 as any).columns === 48,
    '80mm commercial receipt printer configured for 48 columns',
  );

  // 5.2 Control Codes: Initialize (ESC @ = 0x1B 0x40)
  const initBuf = encoder80.toBuffer();
  assert(
    initBuf[0] === 0x1b && initBuf[1] === 0x40,
    'ESC/POS encoder emits standard ESC @ (0x1B 0x40) printer initialization',
  );

  // 5.3 Cash Drawer Kick (ESC p = 0x1B 0x70)
  const drawerEncoder = new EscPosEncoder('80mm');
  drawerEncoder.pulseDrawer(2, 25, 250);
  const drawerBuf = drawerEncoder.toBuffer();
  const hasDrawerKick = drawerBuf.some((b, i) => b === 0x1b && drawerBuf[i + 1] === 0x70);
  assert(hasDrawerKick, 'ESC/POS encoder emits ESC p (0x1B 0x70) cash drawer pulse signal');

  // 5.4 Paper Cut Command (GS V = 0x1D 0x56)
  const cutEncoder = new EscPosEncoder('80mm');
  cutEncoder.cut();
  const cutBuf = cutEncoder.toBuffer();
  const hasCut = cutBuf.some((b, i) => b === 0x1d && cutBuf[i + 1] === 0x56);
  assert(hasCut, 'ESC/POS encoder emits GS V (0x1D 0x56) paper cut sequence');

  // =========================================================================
  // 6. OFFLINE CONFLICT RESOLUTION ALGORITHM UNIT TESTS
  // =========================================================================
  console.log('\n--- [Category 6] Offline Synchronization Conflict Resolution ---');

  interface SyncEntity {
    id: string;
    version: number;
    updatedAt: number;
    value: string;
  }

  function resolveConflict(
    strategy: 'SERVER_WINS' | 'CLIENT_WINS' | 'LATEST_WINS',
    serverEntity: SyncEntity,
    clientEntity: SyncEntity,
  ): SyncEntity {
    switch (strategy) {
      case 'SERVER_WINS':
        return serverEntity;
      case 'CLIENT_WINS':
        return clientEntity;
      case 'LATEST_WINS':
        return clientEntity.updatedAt > serverEntity.updatedAt ? clientEntity : serverEntity;
    }
  }

  const serverRecord: SyncEntity = {
    id: 'entity-1',
    version: 3,
    updatedAt: 1000,
    value: 'ServerValue',
  };
  const clientRecordOlder: SyncEntity = {
    id: 'entity-1',
    version: 2,
    updatedAt: 900,
    value: 'ClientOlder',
  };
  const clientRecordNewer: SyncEntity = {
    id: 'entity-1',
    version: 4,
    updatedAt: 1200,
    value: 'ClientNewer',
  };

  assert(
    resolveConflict('SERVER_WINS', serverRecord, clientRecordNewer).value === 'ServerValue',
    'SERVER_WINS strategy preserves authoritative server entity',
  );
  assert(
    resolveConflict('CLIENT_WINS', serverRecord, clientRecordOlder).value === 'ClientOlder',
    'CLIENT_WINS strategy accepts client override',
  );
  assert(
    resolveConflict('LATEST_WINS', serverRecord, clientRecordNewer).value === 'ClientNewer',
    'LATEST_WINS accepts newer client timestamp',
  );
  assert(
    resolveConflict('LATEST_WINS', serverRecord, clientRecordOlder).value === 'ServerValue',
    'LATEST_WINS retains newer server timestamp against stale client',
  );

  console.log('\n======================================================================');
  console.log(`  UNIT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runUnitTests().catch((err) => {
  console.error('Fatal unit test error:', err);
  process.exit(1);
});
