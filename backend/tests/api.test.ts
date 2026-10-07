import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

const app = createApp();

describe('POS Full-Stack API Integration Tests', () => {
  let adminToken: string;
  let cashierToken: string;
  let storeId: string;
  let businessId: string;
  let sampleProduct: any;
  let sampleRegister: any;

  beforeAll(async () => {
    const business = await prisma.business.findFirst({ where: { code: 'AMR-001' } });
    const store = await prisma.store.findFirst({ where: { code: 'PP-01' } });
    const product = await prisma.product.findFirst({ where: { barcode: '8851959132014' } });
    const register = await prisma.cashRegister.findFirst({ where: { code: 'REG-01' } });

    expect(business).toBeTruthy();
    expect(store).toBeTruthy();
    expect(product).toBeTruthy();
    expect(register).toBeTruthy();

    businessId = business!.id;
    storeId = store!.id;
    sampleProduct = product;
    sampleRegister = register;
  });

  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('pos-api');
  });

  it('POST /api/auth/login should authenticate cashier with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'cashier1', password: 'Cashier123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.username).toBe('cashier1');
    expect(res.body.data.user.role).toBe('CASHIER');

    cashierToken = res.body.data.accessToken;
  });

  it('POST /api/auth/login should authenticate admin with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('ADMIN');

    adminToken = res.body.data.accessToken;
  });

  it('POST /api/auth/pin-login should authenticate cashier via fast touch PIN', async () => {
    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({ storeId, pinCode: '1111' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.fullName).toBe('Vannak Heng (Cashier 1)');
  });

  it('GET /api/auth/me should return logged-in cashier details', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('cashier1');
    expect(res.body.data.business.defaultCurrency).toBe('USD');
  });

  it('GET /api/products should return catalog items with stock for the store', async () => {
    const res = await request(app)
      .get(`/api/products?storeId=${storeId}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items[0]).toHaveProperty('stockQuantity');
    expect(res.body.data.items[0]).toHaveProperty('sellingPriceKHR');
  });

  it('GET /api/products/barcode/:barcode should return product for USB/Bluetooth scanner lookup', async () => {
    const res = await request(app)
      .get(`/api/products/barcode/8851959132014?storeId=${storeId}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Coca-Cola Classic Can 330ml');
    expect(res.body.data.barcode).toBe('8851959132014');
  });

  it('GET /api/registers should list registers and active session', async () => {
    const res = await request(app)
      .get(`/api/registers?storeId=${storeId}`)
      .set('Authorization', `Bearer ${cashierToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/sales should execute a complete checkout transaction with stock decrement', async () => {
    // Check initial stock
    const initialInv = await prisma.inventory.findFirst({
      where: { storeId, productId: sampleProduct.id },
    });
    const initialQty = Number(initialInv!.quantity);

    // Create sale for 2 cans of Coke ($0.65 each = $1.30 subtotal + 10% tax = $1.43 total)
    const salePayload = {
      registerId: sampleRegister.id,
      items: [
        {
          productId: sampleProduct.id,
          quantity: 2,
        },
      ],
      discountType: 'NONE',
      discountValue: 0,
      payments: [
        {
          method: 'CASH',
          amountUSD: 2.00,
          tenderAmountUSD: 2.00,
          tenderAmountKHR: 0,
        },
      ],
      notes: 'Customer paid with $2.00 bill',
    };

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(salePayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.invoiceNumber).toMatch(/^INV-/);
    expect(Number(res.body.data.subtotalUSD)).toBe(1.30);
    expect(Number(res.body.data.totalUSD)).toBe(1.43);
    expect(Number(res.body.data.changeUSD)).toBe(0.57); // 2.00 - 1.43 = 0.57 change!

    // Verify inventory decrement in PostgreSQL
    const updatedInv = await prisma.inventory.findFirst({
      where: { storeId, productId: sampleProduct.id },
    });
    expect(Number(updatedInv!.quantity)).toBe(initialQty - 2);

    // Verify stock movement record created
    const stockMovement = await prisma.stockMovement.findFirst({
      where: { referenceId: res.body.data.id, type: 'SALE' },
    });
    expect(stockMovement).toBeTruthy();
    expect(Number(stockMovement!.quantityChange)).toBe(-2);
  });

  it('POST /api/sales should reject transaction if payment tendered is insufficient', async () => {
    const salePayload = {
      registerId: sampleRegister.id,
      items: [{ productId: sampleProduct.id, quantity: 5 }],
      payments: [
        {
          method: 'CASH',
          amountUSD: 1.00,
          tenderAmountUSD: 1.00, // Only $1 tendered for $3.58 order!
        },
      ],
    };

    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(salePayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_PAYMENT');
  });

  it('POST /api/sync/batch should handle offline transaction sync with idempotency', async () => {
    const offlineSyncId = crypto.randomUUID();

    const batchPayload = {
      deviceId: 'TERM-OFFLINE-01',
      transactions: [
        {
          offlineSyncId,
          registerId: sampleRegister.id,
          items: [{ productId: sampleProduct.id, quantity: 1 }],
          discountType: 'NONE',
          discountValue: 0,
          payments: [
            {
              method: 'CASH',
              amountUSD: 1.00,
              tenderAmountUSD: 1.00,
            },
          ],
        },
      ],
    };

    // First sync should process
    const res1 = await request(app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(batchPayload);

    expect(res1.status).toBe(200);
    expect(res1.body.data.processed).toBe(1);

    // Second sync with same offlineSyncId should be idempotent (ALREADY_EXISTS, zero duplicate billing!)
    const res2 = await request(app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(batchPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.data.alreadyExists).toBe(1);
    expect(res2.body.data.processed).toBe(0);
  });

  it('GET /api/reports/daily-summary should return daily metrics for managers/admins', async () => {
    const res = await request(app)
      .get(`/api/reports/daily-summary?storeId=${storeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalRevenueUSD).toBeGreaterThan(0);
    expect(res.body.data.paymentBreakdown).toHaveProperty('CASH');
  });
});
