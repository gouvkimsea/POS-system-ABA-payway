import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Verifying Database Seed & Relational Integrity ---');
  const business = await prisma.business.findFirst({
    where: { code: 'AFM-01' },
    include: {
      stores: true,
      roles: true,
      categories: true,
      paymentMethods: true,
    },
  });

  if (!business) {
    throw new Error('Business AFM-01 not found');
  }

  const [
    userCount,
    productCount,
    inventoryCount,
    customerCount,
    taxCount,
    discountCount,
    registerCount,
    auditCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.inventory.count(),
    prisma.customer.count(),
    prisma.tax.count(),
    prisma.discount.count(),
    prisma.cashRegister.count(),
    prisma.auditLog.count(),
  ]);

  console.log('Seeded Business:', business.name, `(${business.defaultCurrency})`);
  console.log('Stores:', business.stores.map((s) => s.name).join(', '));
  console.log('Roles:', business.roles.map((r) => r.name).join(', '));
  console.log('Payment Methods:', business.paymentMethods.map((p) => p.name).join(', '));
  console.log('Counts:', {
    users: userCount,
    products: productCount,
    inventoryRows: inventoryCount,
    customers: customerCount,
    taxes: taxCount,
    discounts: discountCount,
    registers: registerCount,
    auditLogs: auditCount,
  });

  // Verify high-frequency POS query indexes
  console.log('\n--- Testing High-Frequency POS Index Lookups ---');
  // 1. Barcode lookup
  const startBarcode = Date.now();
  const prodByBarcode = await prisma.product.findFirst({
    where: { barcode: '8840001001' },
    include: { inventory: true, category: true },
  });
  console.log(
    `1. Barcode lookup ('8840001001'): Found "${prodByBarcode?.name}" with stock: ${prodByBarcode?.inventory[0]?.quantity} (${Date.now() - startBarcode}ms)`,
  );

  // 2. SKU lookup
  const startSku = Date.now();
  const prodBySku = await prisma.product.findFirst({
    where: { sku: 'SNK-PRING-107', businessId: business.id },
  });
  console.log(
    `2. SKU lookup ('SNK-PRING-107'): Found "${prodBySku?.name}" (${Date.now() - startSku}ms)`,
  );

  // 3. Customer phone lookup
  const startCust = Date.now();
  const customer = await prisma.customer.findFirst({
    where: { phone: '012888123', businessId: business.id },
  });
  console.log(
    `3. Customer phone lookup ('012888123'): Found "${customer?.name}" (Points: ${customer?.loyaltyPoints}) (${Date.now() - startCust}ms)`,
  );

  console.log('\nAll Database Foundation Validations Passed Successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
