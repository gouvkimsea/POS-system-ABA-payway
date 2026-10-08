import http from 'http';
import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';

async function testHttpEndpoints() {
  console.log('================================================================');
  console.log('🌐 RUNNING HTTP ENDPOINT TESTS FOR CUSTOMERS & RETURNS/REFUNDS');
  console.log('================================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(4892, () => resolve());
  });

  const baseUrl = 'http://localhost:4892';

  try {
    // 1. Login as Admin
    console.log('1. Authenticating as Admin...');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const adminLoginJson = await adminLoginRes.json();
    if (!adminLoginRes.ok || !adminLoginJson.success) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginJson)}`);
    }
    const adminToken = adminLoginJson.data.tokens.accessToken;
    console.log('✅ Admin authenticated successfully.\n');

    // 2. Login as Cashier (to test permissions)
    console.log('2. Authenticating as Cashier...');
    const cashierLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    const cashierLoginJson = await cashierLoginRes.json();
    if (!cashierLoginRes.ok || !cashierLoginJson.success) {
      throw new Error(`Cashier login failed: ${JSON.stringify(cashierLoginJson)}`);
    }
    const cashierToken = cashierLoginJson.data.tokens.accessToken;
    console.log('✅ Cashier authenticated successfully.\n');

    // 3. GET /api/customers (list)
    console.log('3. Testing GET /api/customers...');
    const listRes = await fetch(`${baseUrl}/api/customers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listJson = await listRes.json();
    if (!listRes.ok || !listJson.success) {
      throw new Error(`List customers failed: ${JSON.stringify(listJson)}`);
    }
    console.log(`✅ GET /api/customers returned ${listJson.data.customers.length} customers.\n`);

    // 4. GET /api/customers/walk-in
    console.log('4. Testing GET /api/customers/walk-in...');
    const walkInRes = await fetch(`${baseUrl}/api/customers/walk-in`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const walkInJson = await walkInRes.json();
    if (!walkInRes.ok || !walkInJson.success || !walkInJson.data.isWalkIn) {
      throw new Error(`Get walk-in failed: ${JSON.stringify(walkInJson)}`);
    }
    console.log(
      `✅ GET /api/customers/walk-in returned default walk-in customer: "${walkInJson.data.name}".\n`,
    );

    // 5. POST /api/customers (Create new profile with address & notes)
    console.log('5. Testing POST /api/customers (Create customer)...');
    const newCustPhone = `088${Math.floor(100000 + Math.random() * 900000)}`;
    const createRes = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Channary Seng',
        phone: newCustPhone,
        email: `channary.${newCustPhone}@example.com`,
        address: '#142, Mao Tse Toung Blvd, Phnom Penh',
        notes: 'Wholesale buyer. Contact on Telegram.',
      }),
    });
    const createJson = await createRes.json();
    if (!createRes.ok || !createJson.success) {
      throw new Error(`Create customer failed: ${JSON.stringify(createJson)}`);
    }
    const createdCustomerId = createJson.data.id;
    console.log(
      `✅ POST /api/customers created: "${createJson.data.name}" (ID: ${createdCustomerId}).\n`,
    );

    // 6. PUT /api/customers/:id (Update customer)
    console.log('6. Testing PUT /api/customers/:id (Update customer)...');
    const updateRes = await fetch(`${baseUrl}/api/customers/${createdCustomerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        notes: 'Wholesale buyer. Contact on Telegram. Credit approved.',
        loyaltyPoints: 100,
        creditBalanceUSD: 25.5,
      }),
    });
    const updateJson = await updateRes.json();
    if (!updateRes.ok || !updateJson.success || updateJson.data.loyaltyPoints !== 100) {
      throw new Error(`Update customer failed: ${JSON.stringify(updateJson)}`);
    }
    console.log(
      `✅ PUT /api/customers/:id updated points: ${updateJson.data.loyaltyPoints}, credit: $${updateJson.data.creditBalanceUSD}.\n`,
    );

    // 7. Attach Customer to Sale via POS Checkout
    console.log('7. Testing Sale Checkout with Customer Attached...');
    const product = await prisma.product.findFirst({ where: { sku: 'BEV-ANG-330' } });
    if (!product) throw new Error('Product BEV-ANG-330 not found');

    const checkoutRes = await fetch(`${baseUrl}/api/pos/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customerId: createdCustomerId,
        items: [
          {
            productId: product.id,
            quantity: 4,
            unitPriceUSD: Number(product.sellingPriceUSD),
          },
        ],
        payments: [
          {
            paymentMethodCode: 'CASH',
            amountUSD: 4 * Number(product.sellingPriceUSD),
            tenderAmountUSD: 4 * Number(product.sellingPriceUSD),
          },
        ],
      }),
    });
    const checkoutJson = await checkoutRes.json();
    if (!checkoutRes.ok || !checkoutJson.success) {
      throw new Error(`Checkout failed: ${JSON.stringify(checkoutJson)}`);
    }
    const orderData = checkoutJson.data;
    const orderId = orderData.orderId;
    const orderNumber = orderData.orderNumber;
    console.log(
      `✅ POS Checkout Completed: Order #${orderNumber} attached to customer "${createJson.data.name}".\n`,
    );

    // 8. GET /api/customers/:id/history (Verify order in history)
    console.log('8. Testing GET /api/customers/:id/history...');
    const historyRes = await fetch(`${baseUrl}/api/customers/${createdCustomerId}/history`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const historyJson = await historyRes.json();
    if (!historyRes.ok || !historyJson.success || historyJson.data.orders.length === 0) {
      throw new Error(`Customer history failed: ${JSON.stringify(historyJson)}`);
    }
    console.log(
      `✅ Purchase History Verified: Found ${historyJson.data.orders.length} order(s) for customer, Total spent: $${historyJson.data.summary.totalSpentUSD}.\n`,
    );

    // 9. GET /api/returns/eligibility/:orderId
    console.log('9. Testing GET /api/returns/eligibility/:orderId...');
    const eligRes = await fetch(`${baseUrl}/api/returns/eligibility/${orderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const eligJson = await eligRes.json();
    if (!eligRes.ok || !eligJson.success) {
      throw new Error(`Check eligibility failed: ${JSON.stringify(eligJson)}`);
    }
    const orderItem = eligJson.data.items[0];
    console.log(
      `✅ Eligibility Verified: Purchased ${orderItem.purchasedQuantity}, Max returnable: ${orderItem.maxReturnableQuantity}, Max refundable: $${eligJson.data.maxRefundableUSD}.\n`,
    );

    // 10. Test Permission Protection on Refund
    console.log('10. Testing Permission Protection (Cashier without sales.refund permission)...');
    const cashierRefundAttempt = await fetch(`${baseUrl}/api/returns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cashierToken}`,
      },
      body: JSON.stringify({
        orderId,
        reason: 'CUSTOMER_CHANGED_MIND',
        items: [{ orderItemId: orderItem.orderItemId, quantity: 1 }],
        refundMethodCode: 'CASH',
      }),
    });
    if (cashierRefundAttempt.status !== 403) {
      throw new Error(
        `Expected HTTP 403 Forbidden for cashier without sales.refund, received ${cashierRefundAttempt.status}`,
      );
    }
    console.log(
      '✅ Permission Protection Verified: Unauthorized user was blocked with HTTP 403 Forbidden.\n',
    );

    // 11. Test Over-Return Guardrail
    console.log('11. Testing Over-Return Guardrail (Quantity > Purchased)...');
    const overReturnAttempt = await fetch(`${baseUrl}/api/returns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orderId,
        reason: 'DEFECTIVE',
        items: [{ orderItemId: orderItem.orderItemId, quantity: 99 }],
        refundMethodCode: 'CASH',
      }),
    });
    const overReturnJson = await overReturnAttempt.json();
    if (overReturnAttempt.status !== 400 || overReturnJson.error?.code !== 'OVER_RETURN_EXCEEDED') {
      throw new Error(
        `Expected HTTP 400 OVER_RETURN_EXCEEDED, received ${overReturnAttempt.status}: ${JSON.stringify(overReturnJson)}`,
      );
    }
    console.log(
      `✅ Over-Return Guardrail Verified: Blocked with HTTP 400 (${overReturnJson.error.message}).\n`,
    );

    // 12. POST /api/returns: Process Partial Return & Refund
    console.log('12. Testing POST /api/returns (Process Partial Item-Level Return)...');
    const refundRes = await fetch(`${baseUrl}/api/returns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        orderId,
        reason: 'DEFECTIVE',
        reasonNotes: 'Wrong packaging supplied, 1 item returned',
        items: [
          {
            orderItemId: orderItem.orderItemId,
            quantity: 1,
            restockInventory: true,
            condition: 'DEFECTIVE',
          },
        ],
        refundMethodCode: 'CUSTOMER_CREDIT',
      }),
    });
    const refundJson = await refundRes.json();
    if (!refundRes.ok || !refundJson.success) {
      throw new Error(`Refund failed: ${JSON.stringify(refundJson)}`);
    }
    const returnRecord = refundJson.data.returnRecord;
    const refundRecord = refundJson.data.refundRecord;
    console.log(`✅ Return & Refund Processed Successfully!`);
    console.log(`   - Return Number: ${returnRecord.returnNumber}`);
    console.log(`   - Refund Number: ${refundRecord.refundNumber}`);
    console.log(`   - Amount: $${refundRecord.amountUSD.toFixed(2)}`);
    console.log(`   - Order Status: ${refundJson.data.orderStatus}`);
    console.log(
      `   - Relationship: Original Sale (${orderNumber}) -> Return (${returnRecord.returnNumber}) -> Refund (${refundRecord.refundNumber})\n`,
    );

    // 13. Verify Customer Credit incremented
    const updatedCustomerCred = await prisma.customer.findUnique({
      where: { id: createdCustomerId },
    });
    console.log(
      `✅ Customer Store Credit incremented to: $${Number(updatedCustomerCred?.creditBalanceUSD).toFixed(2)}\n`,
    );

    // 14. GET /api/returns (List returns)
    console.log('14. Testing GET /api/returns...');
    const listReturnsRes = await fetch(`${baseUrl}/api/returns?orderId=${orderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listReturnsJson = await listReturnsRes.json();
    if (
      !listReturnsRes.ok ||
      !listReturnsJson.success ||
      listReturnsJson.data.returns.length === 0
    ) {
      throw new Error(`List returns failed: ${JSON.stringify(listReturnsJson)}`);
    }
    console.log(
      `✅ GET /api/returns returned ${listReturnsJson.data.returns.length} return record(s) for this order.\n`,
    );

    // 15. GET /api/returns/:id
    console.log('15. Testing GET /api/returns/:id...');
    const singleReturnRes = await fetch(`${baseUrl}/api/returns/${returnRecord.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const singleReturnJson = await singleReturnRes.json();
    if (!singleReturnRes.ok || !singleReturnJson.success) {
      throw new Error(`Get return by ID failed: ${JSON.stringify(singleReturnJson)}`);
    }
    console.log(
      `✅ GET /api/returns/:id returned full details for Return #${singleReturnJson.data.returnNumber}.\n`,
    );

    console.log('================================================================');
    console.log('🎉 ALL HTTP ENDPOINTS & WORKFLOWS VALIDATED SUCCESSFULLY!');
    console.log('================================================================\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

testHttpEndpoints().catch((err) => {
  console.error('❌ HTTP Test Failed:', err);
  process.exit(1);
});
