import { PrismaClient, PaymentMethodType, DiscountType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function hashSecret(secret: string): string {
  return bcrypt.hashSync(secret, 10);
}

async function main() {
  console.log('[Seed] Starting comprehensive POS database seeding...');

  // 1. Demo Business
  const business = await prisma.business.upsert({
    where: { code: 'AFM-01' },
    update: {},
    create: {
      name: 'Angkor Fresh Mart Co., Ltd.',
      code: 'AFM-01',
      taxNumber: 'K001-902148291',
      phone: '+855 23 888 999',
      email: 'contact@angkorfreshmart.com',
      address: '#128, Preah Monivong Blvd, Phnom Penh, Cambodia',
      defaultCurrency: 'USD',
      baseExchangeRate: 4100.0,
      timezone: 'Asia/Phnom_Penh',
      isActive: true,
    },
  });
  console.log(`[Seed] Business created: ${business.name} (${business.code})`);

  // 2. Demo Store
  const store = await prisma.store.upsert({
    where: {
      businessId_code: {
        businessId: business.id,
        code: 'STR-PP-01',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      name: 'Monivong Central Branch',
      code: 'STR-PP-01',
      phone: '+855 23 888 991',
      email: 'monivong@angkorfreshmart.com',
      address: 'Phnom Penh, Cambodia',
      receiptHeader: 'Angkor Fresh Mart - Monivong Central Branch\nTel: +855 23 888 991',
      receiptFooter: 'Thank you for shopping with us!\nPlease come again.',
      isActive: true,
    },
  });
  console.log(`[Seed] Store created: ${store.name} (${store.code})`);

  // 3. Granular Permissions (All 15 permissions)
  const permissionsData = [
    { code: 'products.view', name: 'View Products Catalog', category: 'Products' },
    { code: 'products.create', name: 'Create Products', category: 'Products' },
    { code: 'products.update', name: 'Update Products', category: 'Products' },
    { code: 'products.delete', name: 'Delete Products', category: 'Products' },
    { code: 'inventory.view', name: 'View Stock & Locations', category: 'Inventory' },
    { code: 'inventory.adjust', name: 'Adjust Inventory Quantities', category: 'Inventory' },
    { code: 'sales.create', name: 'Create Sales & Orders', category: 'Sales' },
    { code: 'sales.refund', name: 'Process Order Refunds', category: 'Sales' },
    { code: 'sales.void', name: 'Void Completed Transactions', category: 'Sales' },
    { code: 'reports.view', name: 'View Sales & Financial Reports', category: 'Reports' },
    { code: 'users.manage', name: 'Manage User Accounts & Roles', category: 'Users' },
    { code: 'settings.manage', name: 'Configure System Settings', category: 'Settings' },
    { code: 'register.open', name: 'Open Register Shifts', category: 'Register' },
    { code: 'register.close', name: 'Close Register Shifts', category: 'Register' },
    { code: 'cash.manage', name: 'Manage Drawer Cash Movements', category: 'Cash' },
  ];

  const permissions = await Promise.all(
    permissionsData.map((p) =>
      prisma.permission.upsert({
        where: { code: p.code },
        update: { name: p.name, category: p.category },
        create: p,
      }),
    ),
  );
  const permissionMap = new Map(permissions.map((p) => [p.code, p.id]));

  // 4. Roles
  const adminRole = await prisma.role.upsert({
    where: { businessId_name: { businessId: business.id, name: 'ADMIN' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'ADMIN',
      description: 'Full system and store administrative privileges',
      isSystem: true,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { businessId_name: { businessId: business.id, name: 'MANAGER' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'MANAGER',
      description: 'Store operations, inventory oversight, and reporting',
      isSystem: true,
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { businessId_name: { businessId: business.id, name: 'CASHIER' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'CASHIER',
      description: 'Standard Point of Sale checkout and cash register operations',
      isSystem: true,
    },
  });

  // Assign permissions to roles
  // ADMIN has all permissions
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  // MANAGER permissions
  const managerPermCodes = [
    'products.view',
    'products.create',
    'products.update',
    'inventory.view',
    'inventory.adjust',
    'sales.create',
    'sales.refund',
    'sales.void',
    'reports.view',
    'register.open',
    'register.close',
    'cash.manage',
  ];
  for (const code of managerPermCodes) {
    const permId = permissionMap.get(code);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: managerRole.id, permissionId: permId } },
        update: {},
        create: { roleId: managerRole.id, permissionId: permId },
      });
    }
  }

  // CASHIER permissions
  const cashierPermCodes = [
    'products.view',
    'inventory.view',
    'sales.create',
    'register.open',
    'register.close',
  ];
  for (const code of cashierPermCodes) {
    const permId = permissionMap.get(code);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: cashierRole.id, permissionId: permId } },
        update: {},
        create: { roleId: cashierRole.id, permissionId: permId },
      });
    }
  }

  // 5. Users (Admin, Manager, Cashier)
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: hashSecret('admin123'),
      pinCodeHash: hashSecret('1111'),
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      businessId: business.id,
      username: 'admin',
      email: 'admin@angkorfreshmart.com',
      passwordHash: hashSecret('admin123'),
      pinCodeHash: hashSecret('1111'),
      fullName: 'System Administrator',
      phone: '+855 12 000 001',
      isActive: true,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {
      passwordHash: hashSecret('manager123'),
      pinCodeHash: hashSecret('2222'),
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      businessId: business.id,
      username: 'manager',
      email: 'manager@angkorfreshmart.com',
      passwordHash: hashSecret('manager123'),
      pinCodeHash: hashSecret('2222'),
      fullName: 'Sokha Meng (Store Manager)',
      phone: '+855 12 000 002',
      isActive: true,
    },
  });

  const cashierUser = await prisma.user.upsert({
    where: { username: 'cashier' },
    update: {
      passwordHash: hashSecret('cashier123'),
      pinCodeHash: hashSecret('1234'),
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      businessId: business.id,
      username: 'cashier',
      email: 'cashier@angkorfreshmart.com',
      passwordHash: hashSecret('cashier123'),
      pinCodeHash: hashSecret('1234'),
      fullName: 'Dara Sok (Lead Cashier)',
      phone: '+855 12 000 003',
      isActive: true,
    },
  });

  // Link users to roles
  await prisma.userRole.upsert({
    where: {
      userId_roleId_storeId: {
        userId: adminUser.id,
        roleId: adminRole.id,
        storeId: store.id,
      },
    },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id, storeId: store.id },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_storeId: {
        userId: managerUser.id,
        roleId: managerRole.id,
        storeId: store.id,
      },
    },
    update: {},
    create: { userId: managerUser.id, roleId: managerRole.id, storeId: store.id },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId_storeId: {
        userId: cashierUser.id,
        roleId: cashierRole.id,
        storeId: store.id,
      },
    },
    update: {},
    create: { userId: cashierUser.id, roleId: cashierRole.id, storeId: store.id },
  });
  console.log('[Seed] Users seeded: admin, manager, cashier');

  // 6. Cash Register & Inventory Location
  await prisma.cashRegister.upsert({
    where: { storeId_code: { storeId: store.id, code: 'REG-01' } },
    update: {},
    create: {
      storeId: store.id,
      name: 'Counter 01 Main POS',
      code: 'REG-01',
      isActive: true,
    },
  });

  const location = await prisma.inventoryLocation.upsert({
    where: { storeId_code: { storeId: store.id, code: 'LOC-FLOOR-01' } },
    update: {},
    create: {
      storeId: store.id,
      name: 'Retail Store Sales Floor',
      code: 'LOC-FLOOR-01',
      description: 'Primary merchandise floor display shelves',
      isDefault: true,
    },
  });

  // 7. Payment Methods
  const paymentMethodsData = [
    {
      code: 'CASH',
      name: 'Cash (USD & KHR)',
      type: PaymentMethodType.CASH,
      isDefault: true,
    },
    {
      code: 'KHQR_ABA',
      name: 'ABA KHQR Instant Pay',
      type: PaymentMethodType.DIGITAL_QR,
      isDefault: false,
    },
    {
      code: 'CARD',
      name: 'Visa / Mastercard / UnionPay',
      type: PaymentMethodType.CARD,
      isDefault: false,
    },
    {
      code: 'BANK_TRANSFER',
      name: 'Direct Bank Transfer',
      type: PaymentMethodType.BANK_TRANSFER,
      isDefault: false,
    },
  ];

  for (const pm of paymentMethodsData) {
    await prisma.paymentMethod.upsert({
      where: { businessId_code: { businessId: business.id, code: pm.code } },
      update: {},
      create: {
        businessId: business.id,
        name: pm.name,
        code: pm.code,
        type: pm.type,
        isDefault: pm.isDefault,
        isActive: true,
      },
    });
  }

  // 8. Tax & Discounts
  await prisma.tax.upsert({
    where: { businessId_code: { businessId: business.id, code: 'VAT10' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'Value Added Tax 10%',
      code: 'VAT10',
      rate: 0.1,
      isInclusive: true,
      isActive: true,
    },
  });

  await prisma.discount.upsert({
    where: { id: 'disc-grand-opening' },
    update: {},
    create: {
      id: 'disc-grand-opening',
      businessId: business.id,
      name: 'Grand Opening Discount 10%',
      code: 'OPEN10',
      type: DiscountType.PERCENTAGE,
      value: 10.0,
      isActive: true,
    },
  });

  // 9. Categories
  const categoriesData = [
    { name: 'Beverages & Drinks', code: 'BEV', color: '#3b82f6', icon: 'cup-soda' },
    { name: 'Snacks & Confectionery', code: 'SNK', color: '#f59e0b', icon: 'cookie' },
    { name: 'Dairy & Fresh Produce', code: 'DRY', color: '#10b981', icon: 'milk' },
    { name: 'Personal Care & Household', code: 'HOU', color: '#8b5cf6', icon: 'sparkles' },
  ];

  const categories = await Promise.all(
    categoriesData.map((c, idx) =>
      prisma.category.upsert({
        where: { businessId_name: { businessId: business.id, name: c.name } },
        update: {},
        create: {
          businessId: business.id,
          name: c.name,
          code: c.code,
          color: c.color,
          icon: c.icon,
          sortOrder: idx,
        },
      }),
    ),
  );

  // 10. Brands & Supplier
  const brandAngkor = await prisma.brand.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Angkor Brands' } },
    update: {},
    create: { businessId: business.id, name: 'Angkor Brands' },
  });

  const supplier = await prisma.supplier.upsert({
    where: { id: 'supp-fmcg-01' },
    update: {},
    create: {
      id: 'supp-fmcg-01',
      businessId: business.id,
      name: 'Phnom Penh FMCG Distribution Ltd',
      contactPerson: 'Mr. Vanna Tep',
      phone: '+855 12 555 777',
      email: 'orders@ppfmcg.com',
      address: 'Sen Sok, Phnom Penh',
    },
  });

  // 11. Products & Stock Inventory
  const productsData = [
    {
      name: 'Cambodia Premium Lager Beer 330ml Can',
      sku: 'BEV-CAM-330',
      barcode: '8840001001',
      cost: 0.65,
      sellUSD: 1.0,
      sellKHR: 4100,
      catId: categories[0].id,
      stock: 150,
      unit: 'can',
    },
    {
      name: 'Angkor Beer Can 330ml',
      sku: 'BEV-ANG-330',
      barcode: '8840001002',
      cost: 0.65,
      sellUSD: 1.0,
      sellKHR: 4100,
      catId: categories[0].id,
      stock: 120,
      unit: 'can',
    },
    {
      name: 'Coca-Cola Classic 330ml Can',
      sku: 'BEV-COKE-330',
      barcode: '8840001003',
      cost: 0.4,
      sellUSD: 0.75,
      sellKHR: 3100,
      catId: categories[0].id,
      stock: 200,
      unit: 'can',
    },
    {
      name: 'Kulen Natural Mineral Water 500ml',
      sku: 'BEV-WAT-500',
      barcode: '8840001004',
      cost: 0.25,
      sellUSD: 0.5,
      sellKHR: 2050,
      catId: categories[0].id,
      stock: 300,
      unit: 'bottle',
    },
    {
      name: 'Pringles Sour Cream & Onion 107g',
      sku: 'SNK-PRING-107',
      barcode: '8840002001',
      cost: 1.4,
      sellUSD: 2.2,
      sellKHR: 9000,
      catId: categories[1].id,
      stock: 65,
      unit: 'can',
    },
    {
      name: "Lay's Classic Salted Potato Chips 50g",
      sku: 'SNK-LAYS-50',
      barcode: '8840002002',
      cost: 0.7,
      sellUSD: 1.2,
      sellKHR: 4900,
      catId: categories[1].id,
      stock: 80,
      unit: 'pack',
    },
    {
      name: 'Anchor Salted Pure Butter 227g',
      sku: 'DRY-ANCH-227',
      barcode: '8840003001',
      cost: 2.6,
      sellUSD: 3.8,
      sellKHR: 15600,
      catId: categories[2].id,
      stock: 40,
      unit: 'block',
    },
    {
      name: 'Meiji Fresh Milk 946ml',
      sku: 'DRY-MEIJ-946',
      barcode: '8840003002',
      cost: 2.1,
      sellUSD: 3.1,
      sellKHR: 12700,
      catId: categories[2].id,
      stock: 35,
      unit: 'bottle',
    },
    {
      name: 'Colgate Total 12 Clean Mint Toothpaste 150g',
      sku: 'HOU-COLG-150',
      barcode: '8840004001',
      cost: 1.8,
      sellUSD: 2.8,
      sellKHR: 11500,
      catId: categories[3].id,
      stock: 50,
      unit: 'tube',
    },
    {
      name: 'Dettol Original Antibacterial Soap 100g',
      sku: 'HOU-DETT-100',
      barcode: '8840004002',
      cost: 0.8,
      sellUSD: 1.4,
      sellKHR: 5700,
      catId: categories[3].id,
      stock: 90,
      unit: 'bar',
    },
  ];

  for (const item of productsData) {
    const product = await prisma.product.upsert({
      where: { businessId_sku: { businessId: business.id, sku: item.sku } },
      update: {},
      create: {
        businessId: business.id,
        categoryId: item.catId,
        brandId: brandAngkor.id,
        supplierId: supplier.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        costPriceUSD: item.cost,
        sellingPriceUSD: item.sellUSD,
        sellingPriceKHR: item.sellKHR,
        taxRate: 0.1,
        isTaxInclusive: true,
        trackInventory: true,
        unit: item.unit,
        isActive: true,
      },
    });

    // Populate inventory quantity
    const existingInv = await prisma.inventory.findFirst({
      where: {
        storeId: store.id,
        locationId: location.id,
        productId: product.id,
        variantId: null,
      },
    });

    if (existingInv) {
      await prisma.inventory.update({
        where: { id: existingInv.id },
        data: { quantity: item.stock },
      });
    } else {
      await prisma.inventory.create({
        data: {
          storeId: store.id,
          locationId: location.id,
          productId: product.id,
          variantId: null,
          quantity: item.stock,
          minStockLevel: 10,
        },
      });
    }
  }
  console.log(`[Seed] Products seeded with active inventory: ${productsData.length} items`);

  // 12. Customers
  const customersData = [
    {
      name: 'Sopheap Chan',
      phone: '012888123',
      email: 'sopheap.chan@gmail.com',
      loyaltyPoints: 120,
      creditBalanceUSD: 0.0,
    },
    {
      name: 'Bopha Kem',
      phone: '098777654',
      email: 'bopha.kem@gmail.com',
      loyaltyPoints: 45,
      creditBalanceUSD: 15.0,
    },
    {
      name: 'Vannak Ouk',
      phone: '087666321',
      email: 'vannak.ouk@gmail.com',
      loyaltyPoints: 310,
      creditBalanceUSD: 0.0,
    },
  ];

  for (const cust of customersData) {
    await prisma.customer.upsert({
      where: { id: `cust-${cust.phone}` },
      update: {},
      create: {
        id: `cust-${cust.phone}`,
        businessId: business.id,
        name: cust.name,
        phone: cust.phone,
        email: cust.email,
        loyaltyPoints: cust.loyaltyPoints,
        creditBalanceUSD: cust.creditBalanceUSD,
      },
    });
  }
  console.log(`[Seed] Customers seeded: ${customersData.length} customers`);

  // 13. Audit Log
  await prisma.auditLog.create({
    data: {
      businessId: business.id,
      storeId: store.id,
      userId: adminUser.id,
      action: 'DATABASE_INITIALIZED',
      entityType: 'System',
      details: {
        message: 'Initial real database foundation and seed records established',
        timestamp: new Date().toISOString(),
      },
    },
  });

  console.log('[Seed] Database seeding completed successfully! ✨');
}

main()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
