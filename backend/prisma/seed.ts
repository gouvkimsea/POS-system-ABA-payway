import { PrismaClient, Role, SessionStatus, CashMovementType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  // 1. Business
  const business = await prisma.business.upsert({
    where: { code: 'AMR-001' },
    update: {},
    create: {
      name: 'Angkor Mart Retail',
      code: 'AMR-001',
      taxNumber: 'K001-901823412',
      phone: '+855 23 999 888',
      email: 'contact@angkormart.com',
      address: 'No. 128 Norodom Blvd, Phnom Penh, Cambodia',
      defaultCurrency: 'USD',
      baseExchangeRate: 4100.00,
      timezone: 'Asia/Phnom_Penh',
      isActive: true,
    },
  });

  console.log(`[Seed] Business configured: ${business.name} (${business.id})`);

  // 2. Store
  const store = await prisma.store.upsert({
    where: {
      businessId_code: {
        businessId: business.id,
        code: 'PP-01',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      name: 'Flagship Store - Norodom Blvd',
      code: 'PP-01',
      phone: '+855 23 999 888',
      email: 'norodom@angkormart.com',
      address: 'No. 128 Norodom Blvd, Daun Penh, Phnom Penh',
      receiptHeader: "ANGKOR MART RETAIL\nFlagship Norodom Branch\nVAT ID: K001-901823412",
      receiptFooter: "Thank you for shopping with us!\nExchange within 7 days with receipt.\nVisit again soon!",
      isActive: true,
    },
  });

  console.log(`[Seed] Store configured: ${store.name} (${store.id})`);

  // 3. Users with password hashing & PIN hashing
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const managerPasswordHash = await bcrypt.hash('Manager123!', 10);
  const cashierPasswordHash = await bcrypt.hash('Cashier123!', 10);

  const adminPinHash = await bcrypt.hash('1234', 10);
  const managerPinHash = await bcrypt.hash('2222', 10);
  const cashier1PinHash = await bcrypt.hash('1111', 10);
  const cashier2PinHash = await bcrypt.hash('3333', 10);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminPasswordHash, pinCodeHash: adminPinHash },
    create: {
      businessId: business.id,
      storeId: store.id,
      username: 'admin',
      email: 'admin@angkormart.com',
      fullName: 'System Administrator',
      role: Role.ADMIN,
      passwordHash: adminPasswordHash,
      pinCodeHash: adminPinHash,
      permissions: ['*'],
      isActive: true,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { username: 'manager' },
    update: { passwordHash: managerPasswordHash, pinCodeHash: managerPinHash },
    create: {
      businessId: business.id,
      storeId: store.id,
      username: 'manager',
      email: 'manager@angkormart.com',
      fullName: 'Sophea Pich (Store Manager)',
      role: Role.MANAGER,
      passwordHash: managerPasswordHash,
      pinCodeHash: managerPinHash,
      permissions: ['products:*', 'inventory:*', 'reports:*', 'sales:*', 'registers:*'],
      isActive: true,
    },
  });

  const cashier1 = await prisma.user.upsert({
    where: { username: 'cashier1' },
    update: { passwordHash: cashierPasswordHash, pinCodeHash: cashier1PinHash },
    create: {
      businessId: business.id,
      storeId: store.id,
      username: 'cashier1',
      email: 'cashier1@angkormart.com',
      fullName: 'Vannak Heng (Cashier 1)',
      role: Role.CASHIER,
      passwordHash: cashierPasswordHash,
      pinCodeHash: cashier1PinHash,
      permissions: ['pos:checkout', 'pos:refund', 'register:open', 'register:close'],
      isActive: true,
    },
  });

  const cashier2 = await prisma.user.upsert({
    where: { username: 'cashier2' },
    update: { passwordHash: cashierPasswordHash, pinCodeHash: cashier2PinHash },
    create: {
      businessId: business.id,
      storeId: store.id,
      username: 'cashier2',
      email: 'cashier2@angkormart.com',
      fullName: 'Channary Soun (Cashier 2)',
      role: Role.CASHIER,
      passwordHash: cashierPasswordHash,
      pinCodeHash: cashier2PinHash,
      permissions: ['pos:checkout'],
      isActive: true,
    },
  });

  console.log('[Seed] Users seeded: admin, manager, cashier1, cashier2');

  // 4. Cash Registers
  const register1 = await prisma.cashRegister.upsert({
    where: {
      storeId_code: {
        storeId: store.id,
        code: 'REG-01',
      },
    },
    update: {},
    create: {
      storeId: store.id,
      name: 'Counter 01 - Main Checkout',
      code: 'REG-01',
      isActive: true,
    },
  });

  const register2 = await prisma.cashRegister.upsert({
    where: {
      storeId_code: {
        storeId: store.id,
        code: 'REG-02',
      },
    },
    update: {},
    create: {
      storeId: store.id,
      name: 'Counter 02 - Express Checkout',
      code: 'REG-02',
      isActive: true,
    },
  });

  console.log(`[Seed] Registers configured: ${register1.code}, ${register2.code}`);

  // 5. Categories
  const categoriesData = [
    { name: 'Beverages & Drinks', code: 'BEV', color: '#2563eb', icon: 'cup-soda' },
    { name: 'Snacks & Confectionery', code: 'SNK', color: '#d97706', icon: 'cookie' },
    { name: 'Dairy & Fresh Foods', code: 'DRY', color: '#059669', icon: 'milk' },
    { name: 'Household & Personal Care', code: 'HSE', color: '#7c3aed', icon: 'home' },
    { name: 'Bakery & Fresh Bread', code: 'BKY', color: '#ea580c', icon: 'croissant' },
  ];

  const categories: Record<string, any> = {};
  for (const cat of categoriesData) {
    categories[cat.code] = await prisma.category.upsert({
      where: {
        businessId_name: {
          businessId: business.id,
          name: cat.name,
        },
      },
      update: { color: cat.color, icon: cat.icon },
      create: {
        businessId: business.id,
        name: cat.name,
        code: cat.code,
        color: cat.color,
        icon: cat.icon,
        isActive: true,
      },
    });
  }

  // 6. Brands
  const brandsData = ['Coca-Cola', 'Nestle', 'Angkor Brewery', 'Lotte', 'Anchor Dairy'];
  const brands: Record<string, any> = {};
  for (const bName of brandsData) {
    brands[bName] = await prisma.brand.upsert({
      where: {
        businessId_name: {
          businessId: business.id,
          name: bName,
        },
      },
      update: {},
      create: {
        businessId: business.id,
        name: bName,
      },
    });
  }

  // 7. Suppliers
  const supplier1 = await prisma.supplier.create({
    data: {
      businessId: business.id,
      name: 'Phnom Penh Beverage Wholesale',
      contactName: 'Mr. Rithy Ly',
      phone: '+855 12 345 678',
      email: 'rithy@ppbev.com',
      address: 'Street 271, Phnom Penh',
    },
  }).catch(() => null);

  // 8. Products & Inventory
  const productsData = [
    {
      name: 'Coca-Cola Classic Can 330ml',
      sku: 'BEV-COKE-330',
      barcode: '8851959132014',
      costPrice: 0.40,
      sellingPriceUSD: 0.65,
      sellingPriceKHR: 2700,
      categoryCode: 'BEV',
      brandName: 'Coca-Cola',
      unit: 'can',
      stockQty: 150,
    },
    {
      name: 'Angkor Premium Beer Can 330ml',
      sku: 'BEV-ANGKOR-330',
      barcode: '8841122334455',
      costPrice: 0.55,
      sellingPriceUSD: 0.90,
      sellingPriceKHR: 3700,
      categoryCode: 'BEV',
      brandName: 'Angkor Brewery',
      unit: 'can',
      stockQty: 96,
    },
    {
      name: 'Nestle Pure Life Water 500ml',
      sku: 'BEV-WATER-500',
      barcode: '8850124003011',
      costPrice: 0.15,
      sellingPriceUSD: 0.35,
      sellingPriceKHR: 1500,
      categoryCode: 'BEV',
      brandName: 'Nestle',
      unit: 'bottle',
      stockQty: 240,
    },
    {
      name: 'Red Bull Energy Drink 250ml',
      sku: 'BEV-REDBULL-250',
      barcode: '8850228000156',
      costPrice: 0.65,
      sellingPriceUSD: 1.00,
      sellingPriceKHR: 4100,
      categoryCode: 'BEV',
      brandName: 'Nestle',
      unit: 'can',
      stockQty: 120,
    },
    {
      name: "Lay's Classic Potato Chips 50g",
      sku: 'SNK-LAYS-50',
      barcode: '8850718801128',
      costPrice: 0.60,
      sellingPriceUSD: 1.10,
      sellingPriceKHR: 4500,
      categoryCode: 'SNK',
      brandName: 'Lotte',
      unit: 'bag',
      stockQty: 75,
    },
    {
      name: 'Pocky Chocolate Sticks 47g',
      sku: 'SNK-POCKY-CHO',
      barcode: '8851019010123',
      costPrice: 0.70,
      sellingPriceUSD: 1.25,
      sellingPriceKHR: 5100,
      categoryCode: 'SNK',
      brandName: 'Lotte',
      unit: 'box',
      stockQty: 80,
    },
    {
      name: 'Anchor Salted Butter 227g',
      sku: 'DRY-ANCHOR-227',
      barcode: '9415007012345',
      costPrice: 2.80,
      sellingPriceUSD: 3.95,
      sellingPriceKHR: 16200,
      categoryCode: 'DRY',
      brandName: 'Anchor Dairy',
      unit: 'pack',
      stockQty: 30,
    },
    {
      name: 'Colgate Clean Mint Toothpaste 150g',
      sku: 'HSE-COLGATE-150',
      barcode: '8850006321456',
      costPrice: 1.50,
      sellingPriceUSD: 2.40,
      sellingPriceKHR: 9800,
      categoryCode: 'HSE',
      brandName: 'Nestle',
      unit: 'tube',
      stockQty: 45,
    },
    {
      name: 'French Baguette Traditional',
      sku: 'BKY-BAGUETTE-01',
      barcode: '2000000000018',
      costPrice: 0.45,
      sellingPriceUSD: 1.00,
      sellingPriceKHR: 4100,
      categoryCode: 'BKY',
      brandName: 'Lotte',
      unit: 'pcs',
      stockQty: 25,
    },
    {
      name: 'Nescafe 3-in-1 Rich Aroma (25 Sticks)',
      sku: 'BEV-NESCAFE-25',
      barcode: '8850125078901',
      costPrice: 3.20,
      sellingPriceUSD: 4.50,
      sellingPriceKHR: 18500,
      categoryCode: 'BEV',
      brandName: 'Nestle',
      unit: 'bag',
      stockQty: 50,
    },
  ];

  for (const prod of productsData) {
    const product = await prisma.product.upsert({
      where: {
        businessId_sku: {
          businessId: business.id,
          sku: prod.sku,
        },
      },
      update: {
        costPrice: prod.costPrice,
        sellingPriceUSD: prod.sellingPriceUSD,
        sellingPriceKHR: prod.sellingPriceKHR,
        barcode: prod.barcode,
      },
      create: {
        businessId: business.id,
        name: prod.name,
        sku: prod.sku,
        barcode: prod.barcode,
        categoryId: categories[prod.categoryCode]?.id,
        brandId: brands[prod.brandName]?.id,
        costPrice: prod.costPrice,
        sellingPriceUSD: prod.sellingPriceUSD,
        sellingPriceKHR: prod.sellingPriceKHR,
        unit: prod.unit,
        trackInventory: true,
        alertLowStock: 10,
        isActive: true,
      },
    });

    // Seed Store Inventory
    const existingInv = await prisma.inventory.findFirst({
      where: {
        storeId: store.id,
        productId: product.id,
        variantId: null,
      },
    });

    if (existingInv) {
      await prisma.inventory.update({
        where: { id: existingInv.id },
        data: { quantity: prod.stockQty },
      });
    } else {
      await prisma.inventory.create({
        data: {
          storeId: store.id,
          productId: product.id,
          quantity: prod.stockQty,
          minStockLevel: 10,
        },
      });
    }
  }

  console.log(`[Seed] Seeded ${productsData.length} products with stock and barcodes.`);

  // 9. Customers
  const defaultCustomer = await prisma.customer.upsert({
    where: { id: 'cust-walkin' },
    update: {},
    create: {
      id: 'cust-walkin',
      businessId: business.id,
      name: 'Walk-in Retail Customer',
      phone: '000-000-0000',
      loyaltyPoints: 0,
    },
  });

  await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Sokha Meng (VIP)',
      phone: '+855 12 888 777',
      email: 'sokha.meng@gmail.com',
      address: 'BKK1, Phnom Penh',
      loyaltyPoints: 120,
    },
  }).catch(() => null);

  // 10. Open Register Session for Counter 1
  const existingOpenSession = await prisma.registerSession.findFirst({
    where: { registerId: register1.id, status: SessionStatus.OPEN },
  });

  if (!existingOpenSession) {
    const session = await prisma.registerSession.create({
      data: {
        registerId: register1.id,
        cashierId: cashier1.id,
        status: SessionStatus.OPEN,
        openingFloatUSD: 50.00,
        openingFloatKHR: 200000.00,
        expectedCashUSD: 50.00,
        expectedCashKHR: 200000.00,
      },
    });

    await prisma.cashMovement.create({
      data: {
        sessionId: session.id,
        cashierId: cashier1.id,
        type: CashMovementType.FLOAT_ADD,
        amountUSD: 50.00,
        amountKHR: 200000.00,
        reason: 'Opening shift float drawer',
      },
    });

    console.log(`[Seed] Active Register Session created for Counter 01 (Cashier: ${cashier1.fullName})`);
  }

  console.log('[Seed] Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
