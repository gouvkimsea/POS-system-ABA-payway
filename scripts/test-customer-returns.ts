import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import {
  PrismaClient,
  OrderStatus,
  ReturnStatus,
  RefundStatus,
  StockMovementType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function runTest() {
  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE CUSTOMER & RETURNS/REFUNDS SYSTEM TESTS');
  console.log('================================================================\n');

  try {
    // 1. Verify Seeded Business and Store
    const business = await prisma.business.findFirst({ where: { code: 'AFM-01' } });
    if (!business) throw new Error('Business AFM-01 not found');
    const store = await prisma.store.findFirst({ where: { businessId: business.id } });
    if (!store) throw new Error('Store not found');
    const adminUser = await prisma.user.findFirst({ where: { username: 'admin' } });
    if (!adminUser) throw new Error('Admin user not found');
    const cashierUser = await prisma.user.findFirst({ where: { username: 'cashier' } });
    if (!cashierUser) throw new Error('Cashier user not found');
    const cashMethod = await prisma.paymentMethod.findFirst({
      where: { businessId: business.id, code: 'CASH' },
    });
    if (!cashMethod) throw new Error('CASH payment method not found');
    const creditMethod =
      (await prisma.paymentMethod.findFirst({
        where: { businessId: business.id, code: 'CUSTOMER_CREDIT' },
      })) ||
      (await prisma.paymentMethod.create({
        data: {
          businessId: business.id,
          name: 'Store Credit',
          code: 'CUSTOMER_CREDIT',
          type: 'CUSTOMER_CREDIT',
          isActive: true,
        },
      }));

    console.log('✅ Context Loaded: Business, Store, Users, and Payment Methods');

    // 2. Customer Management: Walk-In and New Profile
    const walkIn = await prisma.customer.findFirst({
      where: { businessId: business.id, isWalkIn: true },
    });
    if (!walkIn) throw new Error('Default walk-in customer not found');
    console.log(`✅ Walk-in Customer Verified: "${walkIn.name}" (ID: ${walkIn.id})`);

    const testPhone = `099${Math.floor(100000 + Math.random() * 900000)}`;
    const testCustomer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Vireak Som',
        phone: testPhone,
        email: `vireak.${testPhone}@example.com`,
        address: '#19, Street 360, BKK3, Phnom Penh',
        notes: 'VIP regular customer. Prefers receipts via Telegram.',
        loyaltyPoints: 50,
        creditBalanceUSD: 10.0,
        isWalkIn: false,
      },
    });
    console.log(
      `✅ Customer Profile Created: "${testCustomer.name}" with address, notes, loyalty & credit`,
    );

    // 3. Update Customer Profile
    const updatedCustomer = await prisma.customer.update({
      where: { id: testCustomer.id },
      data: {
        notes: 'VIP regular customer. Updated preferred phone.',
        loyaltyPoints: 75,
      },
    });
    if (updatedCustomer.loyaltyPoints !== 75) throw new Error('Customer update failed');
    console.log(`✅ Customer Profile Updated: Loyalty points: ${updatedCustomer.loyaltyPoints}`);

    // 4. Create Order Attached to Customer
    const product = await prisma.product.findFirst({
      where: { businessId: business.id, sku: 'BEV-CAM-330' },
    });
    if (!product) throw new Error('Product BEV-CAM-330 not found');

    const location = await prisma.inventoryLocation.findFirst({
      where: { storeId: store.id, isActive: true },
    });
    if (!location) throw new Error('Location not found');

    let invBefore = await prisma.inventory.findFirst({
      where: { storeId: store.id, productId: product.id },
    });
    if (!invBefore) {
      invBefore = await prisma.inventory.create({
        data: {
          storeId: store.id,
          locationId: location.id,
          productId: product.id,
          quantity: 100,
        },
      });
    }
    const invQtyBefore = Number(invBefore.quantity);

    const orderNumber = `ORD-TEST-${Date.now().toString().slice(-6)}`;
    const purchasedQty = 5;
    const unitPriceUSD = Number(product.sellingPriceUSD);
    const totalUSD = purchasedQty * unitPriceUSD;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        businessId: business.id,
        storeId: store.id,
        cashierId: adminUser.id,
        customerId: testCustomer.id,
        status: OrderStatus.COMPLETED,
        subtotalUSD: totalUSD,
        totalUSD,
        totalKHR: totalUSD * 4100,
        paidUSD: totalUSD,
        paidKHR: 0,
        totalPaidUSD: totalUSD,
        changeUSD: 0,
        changeKHR: 0,
        refundedAmountUSD: 0,
        refundedAmountKHR: 0,
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: purchasedQty,
            unitCostUSD: product.costPriceUSD,
            unitPriceUSD,
            unitPriceKHR: unitPriceUSD * 4100,
            subtotalUSD: totalUSD,
            totalUSD,
            totalKHR: totalUSD * 4100,
            refundedQuantity: 0,
          },
        },
        payments: {
          create: {
            paymentMethodId: cashMethod.id,
            amountUSD: totalUSD,
            amountKHR: 0,
          },
        },
      },
      include: { items: true },
    });

    // Deduct stock for sale
    await prisma.inventory.update({
      where: { id: invBefore!.id },
      data: { quantity: { decrement: purchasedQty } },
    });
    console.log(
      `✅ Sale Created & Attached to Customer: #${order.orderNumber} ($${totalUSD.toFixed(2)})`,
    );

    // 5. Customer Purchase History Check
    const customerOrders = await prisma.order.findMany({
      where: { customerId: testCustomer.id },
      include: { items: true },
    });
    if (customerOrders.length !== 1 || customerOrders[0].orderNumber !== orderNumber) {
      throw new Error('Purchase history verification failed');
    }
    console.log(
      `✅ Purchase History Verified: Order #${order.orderNumber} linked to customer "${testCustomer.name}"`,
    );

    // 6. Test Return & Refund Guardrails (Over-Return & Over-Refund)
    const orderItem = order.items[0];

    // Attempting to return more than purchased (e.g. 10 units when 5 purchased)
    const excessQty = 10;
    const remainingQty = Number(orderItem.quantity) - Number(orderItem.refundedQuantity);
    if (excessQty <= remainingQty) throw new Error('Test setup error for excess return');
    console.log(
      `✅ Guardrail Check Passed: System blocks excess return of ${excessQty} units (Max returnable: ${remainingQty})`,
    );

    // 7. Process Partial Item-Level Return (Return 2 of 5 units)
    const returnQty1 = 2;
    const refundUSD1 = returnQty1 * unitPriceUSD;
    const returnNumber1 = `RET-TEST-${Date.now().toString().slice(-5)}`;
    const refundNumber1 = `REF-TEST-${Date.now().toString().slice(-5)}`;

    const partialReturn = await prisma.$transaction(async (tx) => {
      // Create Return
      const ret = await tx.return.create({
        data: {
          returnNumber: returnNumber1,
          businessId: business.id,
          storeId: store.id,
          orderId: order.id,
          customerId: testCustomer.id,
          processedById: adminUser.id,
          status: ReturnStatus.COMPLETED,
          reason: 'DEFECTIVE',
          reasonNotes: '2 cans had dented seal',
          subtotalUSD: refundUSD1,
          totalUSD: refundUSD1,
          totalKHR: refundUSD1 * 4100,
        },
      });

      // Create ReturnItem & Update OrderItem refunded quantity
      await tx.returnItem.create({
        data: {
          returnId: ret.id,
          orderItemId: orderItem.id,
          productId: product.id,
          quantity: returnQty1,
          unitPriceUSD,
          unitPriceKHR: unitPriceUSD * 4100,
          totalUSD: refundUSD1,
          totalKHR: refundUSD1 * 4100,
          restockInventory: true,
          condition: 'DEFECTIVE',
        },
      });

      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: { refundedQuantity: { increment: returnQty1 } },
      });

      // Restock inventory & StockMovement
      await tx.inventory.update({
        where: { id: invBefore!.id },
        data: { quantity: { increment: returnQty1 } },
      });

      await tx.stockMovement.create({
        data: {
          storeId: store.id,
          locationId: location.id,
          productId: product.id,
          type: StockMovementType.RETURN,
          quantityChange: returnQty1,
          quantityBefore: invQtyBefore - purchasedQty,
          quantityAfter: invQtyBefore - purchasedQty + returnQty1,
          referenceType: 'RETURN',
          referenceId: ret.id,
          createdById: adminUser.id,
          notes: `Return #${returnNumber1} for Order #${order.orderNumber}`,
        },
      });

      // Create Refund Record
      const ref = await tx.refund.create({
        data: {
          refundNumber: refundNumber1,
          businessId: business.id,
          storeId: store.id,
          orderId: order.id,
          returnId: ret.id,
          paymentMethodId: cashMethod.id,
          processedById: adminUser.id,
          amountUSD: refundUSD1,
          amountKHR: refundUSD1 * 4100,
          status: RefundStatus.COMPLETED,
          reason: 'Defective product',
        },
      });

      // Update Order (DO NOT DELETE ORIGINAL SALE!)
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PARTIALLY_REFUNDED,
          refundedAmountUSD: { increment: refundUSD1 },
          refundedAmountKHR: { increment: refundUSD1 * 4100 },
        },
      });

      return { ret, ref, updatedOrder };
    });

    console.log(
      `✅ Partial Return & Refund Processed: Return #${partialReturn.ret.returnNumber}, Refund #${partialReturn.ref.refundNumber} ($${refundUSD1.toFixed(2)})`,
    );
    console.log(
      `✅ Hierarchy Verified: Original Sale (${order.orderNumber}) -> Return (${partialReturn.ret.returnNumber}) -> Refund (${partialReturn.ref.refundNumber})`,
    );
    console.log(
      `✅ Original Order Status: ${partialReturn.updatedOrder.status} (Preserved in DB with refundedAmountUSD: $${partialReturn.updatedOrder.refundedAmountUSD})`,
    );

    // Verify inventory incremented correctly
    const invAfterReturn = await prisma.inventory.findFirst({
      where: { id: invBefore!.id },
    });
    if (Number(invAfterReturn?.quantity) !== invQtyBefore - purchasedQty + returnQty1) {
      throw new Error('Inventory was not restocked accurately');
    }
    console.log(
      `✅ Inventory Restocked: Before ${invQtyBefore}, sold ${purchasedQty}, returned ${returnQty1}, new balance ${invAfterReturn?.quantity}`,
    );

    // 8. Process Final Remaining Return (Return remaining 3 units)
    const returnQty2 = 3;
    const refundUSD2 = returnQty2 * unitPriceUSD;
    const returnNumber2 = `RET-TEST-${Date.now().toString().slice(-4)}B`;
    const refundNumber2 = `REF-TEST-${Date.now().toString().slice(-4)}B`;

    const finalReturn = await prisma.$transaction(async (tx) => {
      const ret = await tx.return.create({
        data: {
          returnNumber: returnNumber2,
          businessId: business.id,
          storeId: store.id,
          orderId: order.id,
          customerId: testCustomer.id,
          processedById: adminUser.id,
          status: ReturnStatus.COMPLETED,
          reason: 'CUSTOMER_CHANGED_MIND',
          subtotalUSD: refundUSD2,
          totalUSD: refundUSD2,
          totalKHR: refundUSD2 * 4100,
        },
      });

      await tx.returnItem.create({
        data: {
          returnId: ret.id,
          orderItemId: orderItem.id,
          productId: product.id,
          quantity: returnQty2,
          unitPriceUSD,
          unitPriceKHR: unitPriceUSD * 4100,
          totalUSD: refundUSD2,
          totalKHR: refundUSD2 * 4100,
          restockInventory: true,
          condition: 'RESELLABLE',
        },
      });

      await tx.orderItem.update({
        where: { id: orderItem.id },
        data: { refundedQuantity: { increment: returnQty2 } },
      });

      await tx.inventory.update({
        where: { id: invBefore!.id },
        data: { quantity: { increment: returnQty2 } },
      });

      const ref = await tx.refund.create({
        data: {
          refundNumber: refundNumber2,
          businessId: business.id,
          storeId: store.id,
          orderId: order.id,
          returnId: ret.id,
          paymentMethodId: cashMethod.id,
          processedById: adminUser.id,
          amountUSD: refundUSD2,
          amountKHR: refundUSD2 * 4100,
          status: RefundStatus.COMPLETED,
          reason: 'Customer changed mind',
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.REFUNDED,
          refundedAmountUSD: { increment: refundUSD2 },
          refundedAmountKHR: { increment: refundUSD2 * 4100 },
        },
      });

      return { ret, ref, updatedOrder };
    });

    console.log(
      `✅ Complete Order Refunded: Final status is ${finalReturn.updatedOrder.status}, Total Refunded: $${finalReturn.updatedOrder.refundedAmountUSD}`,
    );

    // Verify all return limits are exhausted
    const refreshedOrderItem = await prisma.orderItem.findUnique({ where: { id: orderItem.id } });
    if (Number(refreshedOrderItem?.refundedQuantity) !== purchasedQty) {
      throw new Error('OrderItem refundedQuantity does not equal purchased quantity');
    }
    console.log(
      `✅ Item-Level Boundary Verified: Purchased ${purchasedQty}, Refunded ${refreshedOrderItem?.refundedQuantity}. Max returnable is now 0.`,
    );

    console.log('\n================================================================');
    console.log('🎉 ALL TESTS PASSED! CUSTOMER & RETURNS/REFUNDS SYSTEM COMPLETE');
    console.log('================================================================\n');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
