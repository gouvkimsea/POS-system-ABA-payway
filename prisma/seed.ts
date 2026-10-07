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
      isActive: true,
    },
  });

  const whLocation = await prisma.inventoryLocation.upsert({
    where: { storeId_code: { storeId: store.id, code: 'LOC-WH-01' } },
    update: {},
    create: {
      storeId: store.id,
      name: 'Central Stockroom & Warehouse',
      code: 'LOC-WH-01',
      description: 'Reserve inventory storage and receiving warehouse',
      isDefault: false,
      isActive: true,
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

  // 10. Brands & Suppliers
  const brandAngkor = await prisma.brand.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Angkor Brands' } },
    update: {},
    create: { businessId: business.id, name: 'Angkor Brands', description: 'Cambodian Local Premium Brands' },
  });

  const brandNestle = await prisma.brand.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Nestle Cambodia' } },
    update: {},
    create: { businessId: business.id, name: 'Nestle Cambodia', description: 'Global Food & Beverage Manufacturer' },
  });

  const brandUnilever = await prisma.brand.upsert({
    where: { businessId_name: { businessId: business.id, name: 'Unilever Cambodia' } },
    update: {},
    create: { businessId: business.id, name: 'Unilever Cambodia', description: 'Consumer Goods & Personal Care' },
  });

  const supplierFMCG = await prisma.supplier.upsert({
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

  const supplierBev = await prisma.supplier.upsert({
    where: { id: 'supp-bev-02' },
    update: {},
    create: {
      id: 'supp-bev-02',
      businessId: business.id,
      name: 'Cambodia Beverage Distribution Co',
      contactPerson: 'Ms. Rachana Keo',
      phone: '+855 23 999 111',
      email: 'supply@cambodiabev.com',
      address: 'Chamkar Mon, Phnom Penh',
    },
  });

  // 11. Products & Stock Inventory
  const productsData = [
    {
      name: 'Cambodia Premium Lager Beer 330ml Can',
      nameKhmer: 'ស្រាបៀរកម្ពុជា កំប៉ុង ៣៣០មីលីលីត្រ',
      sku: 'BEV-CAM-330',
      barcode: '8840001001',
      cost: 0.65,
      sellUSD: 1.0,
      sellKHR: 4100,
      catId: categories[0].id,
      brandId: brandAngkor.id,
      supplierId: supplierBev.id,
      floorStock: 150,
      whStock: 100,
      reorderLevel: 20,
      unit: 'can',
      imageUrl:
        'https://images.unsplash.com/photo-1608270191599-4c60f2526e9a?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Angkor Beer Can 330ml',
      nameKhmer: 'ស្រាបៀរអង្គរ កំប៉ុង ៣៣០មីលីលីត្រ',
      sku: 'BEV-ANG-330',
      barcode: '8840001002',
      cost: 0.65,
      sellUSD: 1.0,
      sellKHR: 4100,
      catId: categories[0].id,
      brandId: brandAngkor.id,
      supplierId: supplierBev.id,
      floorStock: 120,
      whStock: 80,
      reorderLevel: 15,
      unit: 'can',
      imageUrl:
        'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Coca-Cola Classic 330ml Can',
      nameKhmer: 'កូកាកូឡា កំប៉ុង ៣៣០មីលីលីត្រ',
      sku: 'BEV-COKE-330',
      barcode: '8840001003',
      cost: 0.4,
      sellUSD: 0.75,
      sellKHR: 3100,
      catId: categories[0].id,
      brandId: brandNestle.id,
      supplierId: supplierBev.id,
      floorStock: 200,
      whStock: 150,
      reorderLevel: 30,
      unit: 'can',
      imageUrl:
        'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Kulen Natural Mineral Water 500ml',
      nameKhmer: 'ទឹកបរិសុទ្ធធម្មជាតិគូលែន ៥០០មីលីលីត្រ',
      sku: 'BEV-WAT-500',
      barcode: '8840001004',
      cost: 0.25,
      sellUSD: 0.5,
      sellKHR: 2050,
      catId: categories[0].id,
      brandId: brandAngkor.id,
      supplierId: supplierBev.id,
      floorStock: 300,
      whStock: 250,
      reorderLevel: 40,
      unit: 'bottle',
      imageUrl:
        'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Pringles Sour Cream & Onion 107g',
      nameKhmer: 'ដំឡូងបារាំងព្រីងហ្គល រសជាតិខ្ទឹមបារាំង ១០៧ក្រាម',
      sku: 'SNK-PRING-107',
      barcode: '8840002001',
      cost: 1.4,
      sellUSD: 2.2,
      sellKHR: 9000,
      catId: categories[1].id,
      brandId: brandNestle.id,
      supplierId: supplierFMCG.id,
      floorStock: 65,
      whStock: 45,
      reorderLevel: 10,
      unit: 'can',
      imageUrl:
        'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: "Lay's Classic Salted Potato Chips 50g",
      nameKhmer: 'ដំឡូងបារាំងឡេស ប្រៃ ៥០ក្រាម',
      sku: 'SNK-LAYS-50',
      barcode: '8840002002',
      cost: 0.7,
      sellUSD: 1.2,
      sellKHR: 4900,
      catId: categories[1].id,
      brandId: brandNestle.id,
      supplierId: supplierFMCG.id,
      floorStock: 80,
      whStock: 50,
      reorderLevel: 12,
      unit: 'pack',
      imageUrl:
        'https://images.unsplash.com/photo-1527842891421-42eec6e703ea?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Anchor Salted Pure Butter 227g',
      nameKhmer: 'ប័រប្រៃអានខ័រ ២២៧ក្រាម',
      sku: 'DRY-ANCH-227',
      barcode: '8840003001',
      cost: 2.6,
      sellUSD: 3.8,
      sellKHR: 15600,
      catId: categories[2].id,
      brandId: brandAngkor.id,
      supplierId: supplierFMCG.id,
      floorStock: 40,
      whStock: 30,
      reorderLevel: 8,
      unit: 'block',
      imageUrl:
        'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Meiji Fresh Milk 946ml',
      nameKhmer: 'ទឹកដោះគោស្រស់មេជី ៩៤៦មីលីលីត្រ',
      sku: 'DRY-MEIJ-946',
      barcode: '8840003002',
      cost: 2.1,
      sellUSD: 3.1,
      sellKHR: 12700,
      catId: categories[2].id,
      brandId: brandNestle.id,
      supplierId: supplierFMCG.id,
      floorStock: 35,
      whStock: 25,
      reorderLevel: 10,
      unit: 'bottle',
      imageUrl:
        'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Colgate Total 12 Clean Mint Toothpaste 150g',
      nameKhmer: 'ថ្នាំដុសធ្មេញកុលហ្គេត ខូលក្លីន មិន ១៥០ក្រាម',
      sku: 'HOU-COLG-150',
      barcode: '8840004001',
      cost: 1.8,
      sellUSD: 2.8,
      sellKHR: 11500,
      catId: categories[3].id,
      brandId: brandUnilever.id,
      supplierId: supplierFMCG.id,
      floorStock: 50,
      whStock: 40,
      reorderLevel: 10,
      unit: 'tube',
      imageUrl:
        'https://images.unsplash.com/photo-1559591937-e62fb330bc1f?auto=format&fit=crop&w=400&q=80',
    },
    {
      name: 'Dettol Original Antibacterial Soap 100g',
      nameKhmer: 'សាប៊ូដេតថល កម្ចាត់មេរោគ ១០០ក្រាម',
      sku: 'HOU-DETT-100',
      barcode: '8840004002',
      cost: 0.8,
      sellUSD: 1.4,
      sellKHR: 5700,
      catId: categories[3].id,
      brandId: brandUnilever.id,
      supplierId: supplierFMCG.id,
      floorStock: 90,
      whStock: 60,
      reorderLevel: 15,
      unit: 'bar',
      imageUrl:
        'https://images.unsplash.com/photo-1607006314592-d610df1fc08c?auto=format&fit=crop&w=400&q=80',
    },
  ];

  for (const item of productsData) {
    const product = await prisma.product.upsert({
      where: { businessId_sku: { businessId: business.id, sku: item.sku } },
      update: {
        nameKhmer: item.nameKhmer,
        reorderLevel: item.reorderLevel,
        imageUrl: item.imageUrl,
        costPriceUSD: item.cost,
        sellingPriceUSD: item.sellUSD,
        sellingPriceKHR: item.sellKHR,
        brandId: item.brandId,
        supplierId: item.supplierId,
      },
      create: {
        businessId: business.id,
        categoryId: item.catId,
        brandId: item.brandId,
        supplierId: item.supplierId,
        name: item.name,
        nameKhmer: item.nameKhmer,
        sku: item.sku,
        barcode: item.barcode,
        costPriceUSD: item.cost,
        sellingPriceUSD: item.sellUSD,
        sellingPriceKHR: item.sellKHR,
        taxRate: 0.1,
        isTaxInclusive: true,
        trackInventory: true,
        alertLowStock: item.reorderLevel,
        reorderLevel: item.reorderLevel,
        unit: item.unit,
        imageUrl: item.imageUrl,
        isActive: true,
      },
    });

    // Populate inventory quantity for floor location
    const existingFloorInv = await prisma.inventory.findFirst({
      where: {
        storeId: store.id,
        locationId: location.id,
        productId: product.id,
        variantId: null,
      },
    });

    if (existingFloorInv) {
      await prisma.inventory.update({
        where: { id: existingFloorInv.id },
        data: { quantity: item.floorStock, minStockLevel: item.reorderLevel },
      });
    } else {
      await prisma.inventory.create({
        data: {
          storeId: store.id,
          locationId: location.id,
          productId: product.id,
          variantId: null,
          quantity: item.floorStock,
          minStockLevel: item.reorderLevel,
        },
      });

      // Audit movement record
      await prisma.stockMovement.create({
        data: {
          storeId: store.id,
          locationId: location.id,
          productId: product.id,
          type: 'PURCHASE',
          quantityChange: item.floorStock,
          quantityBefore: 0,
          quantityAfter: item.floorStock,
          unitCost: item.cost,
          referenceType: 'PURCHASE_ORDER',
          referenceId: 'PO-INIT-001',
          notes: 'Initial purchase shipment received on sales floor',
          createdById: adminUser.id,
        },
      });
    }

    // Populate inventory for warehouse location
    const existingWhInv = await prisma.inventory.findFirst({
      where: {
        storeId: store.id,
        locationId: whLocation.id,
        productId: product.id,
        variantId: null,
      },
    });

    if (existingWhInv) {
      await prisma.inventory.update({
        where: { id: existingWhInv.id },
        data: { quantity: item.whStock, minStockLevel: item.reorderLevel },
      });
    } else {
      await prisma.inventory.create({
        data: {
          storeId: store.id,
          locationId: whLocation.id,
          productId: product.id,
          variantId: null,
          quantity: item.whStock,
          minStockLevel: item.reorderLevel,
        },
      });

      await prisma.stockMovement.create({
        data: {
          storeId: store.id,
          locationId: whLocation.id,
          productId: product.id,
          type: 'PURCHASE',
          quantityChange: item.whStock,
          quantityBefore: 0,
          quantityAfter: item.whStock,
          unitCost: item.cost,
          referenceType: 'PURCHASE_ORDER',
          referenceId: 'PO-INIT-001',
          notes: 'Initial warehouse reserve shipment received',
          createdById: adminUser.id,
        },
      });
    }
  }

  // 11b. Product with Variants (Apparel / Uniform Polo Shirt)
  const apparelProduct = await prisma.product.upsert({
    where: { businessId_sku: { businessId: business.id, sku: 'APP-POLO-CLASSIC' } },
    update: {
      nameKhmer: 'អាវប៉ូឡូប្រណិត ដៃខ្លី',
      reorderLevel: 5,
    },
    create: {
      businessId: business.id,
      categoryId: categories[3].id,
      brandId: brandAngkor.id,
      supplierId: supplierFMCG.id,
      name: 'Angkor Classic 100% Cotton Polo Shirt',
      nameKhmer: 'អាវប៉ូឡូប្រណិត ដៃខ្លី',
      sku: 'APP-POLO-CLASSIC',
      barcode: '8840009000',
      description: 'Premium combed cotton embroidered staff and retail polo shirt',
      costPriceUSD: 5.5,
      sellingPriceUSD: 12.0,
      sellingPriceKHR: 49200,
      taxRate: 0.1,
      isTaxInclusive: true,
      trackInventory: true,
      alertLowStock: 5,
      reorderLevel: 5,
      unit: 'pcs',
      imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&w=400&q=80',
      isActive: true,
    },
  });

  const variantsData = [
    {
      name: 'Size M / Navy Blue',
      sku: 'POLO-BLU-M',
      barcode: '8840009001',
      size: 'M',
      color: 'Navy Blue',
      model: 'Classic-2026',
      weight: '0.25kg',
      cost: 5.5,
      sellUSD: 12.0,
      sellKHR: 49200,
      floorStock: 25,
      whStock: 15,
    },
    {
      name: 'Size L / Navy Blue',
      sku: 'POLO-BLU-L',
      barcode: '8840009002',
      size: 'L',
      color: 'Navy Blue',
      model: 'Classic-2026',
      weight: '0.28kg',
      cost: 5.5,
      sellUSD: 12.0,
      sellKHR: 49200,
      floorStock: 20,
      whStock: 20,
    },
    {
      name: 'Size M / Pure White',
      sku: 'POLO-WHT-M',
      barcode: '8840009003',
      size: 'M',
      color: 'Pure White',
      model: 'Classic-2026',
      weight: '0.25kg',
      cost: 5.5,
      sellUSD: 12.0,
      sellKHR: 49200,
      floorStock: 18,
      whStock: 12,
    },
    {
      name: 'Size XL / Charcoal Grey',
      sku: 'POLO-GRY-XL',
      barcode: '8840009004',
      size: 'XL',
      color: 'Charcoal Grey',
      model: 'Classic-2026',
      weight: '0.30kg',
      cost: 5.5,
      sellUSD: 12.0,
      sellKHR: 49200,
      floorStock: 15,
      whStock: 10,
    },
  ];

  for (const v of variantsData) {
    const variant = await prisma.productVariant.upsert({
      where: { productId_sku: { productId: apparelProduct.id, sku: v.sku } },
      update: {
        barcode: v.barcode,
        size: v.size,
        color: v.color,
        model: v.model,
        weight: v.weight,
        costPriceUSD: v.cost,
        sellingPriceUSD: v.sellUSD,
        sellingPriceKHR: v.sellKHR,
      },
      create: {
        productId: apparelProduct.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        size: v.size,
        color: v.color,
        model: v.model,
        weight: v.weight,
        costPriceUSD: v.cost,
        sellingPriceUSD: v.sellUSD,
        sellingPriceKHR: v.sellKHR,
        isActive: true,
      },
    });

    const existingFloorVarInv = await prisma.inventory.findFirst({
      where: {
        storeId: store.id,
        locationId: location.id,
        productId: apparelProduct.id,
        variantId: variant.id,
      },
    });

    if (existingFloorVarInv) {
      await prisma.inventory.update({
        where: { id: existingFloorVarInv.id },
        data: { quantity: v.floorStock },
      });
    } else {
      await prisma.inventory.create({
        data: {
          storeId: store.id,
          locationId: location.id,
          productId: apparelProduct.id,
          variantId: variant.id,
          quantity: v.floorStock,
          minStockLevel: 5,
        },
      });

      await prisma.stockMovement.create({
        data: {
          storeId: store.id,
          locationId: location.id,
          productId: apparelProduct.id,
          variantId: variant.id,
          type: 'PURCHASE',
          quantityChange: v.floorStock,
          quantityBefore: 0,
          quantityAfter: v.floorStock,
          unitCost: v.cost,
          referenceType: 'PURCHASE_ORDER',
          referenceId: 'PO-APPAREL-001',
          notes: 'Initial polo apparel batch receipt on sales floor',
          createdById: adminUser.id,
        },
      });
    }

    const existingWhVarInv = await prisma.inventory.findFirst({
      where: {
        storeId: store.id,
        locationId: whLocation.id,
        productId: apparelProduct.id,
        variantId: variant.id,
      },
    });

    if (existingWhVarInv) {
      await prisma.inventory.update({
        where: { id: existingWhVarInv.id },
        data: { quantity: v.whStock },
      });
    } else {
      await prisma.inventory.create({
        data: {
          storeId: store.id,
          locationId: whLocation.id,
          productId: apparelProduct.id,
          variantId: variant.id,
          quantity: v.whStock,
          minStockLevel: 5,
        },
      });

      await prisma.stockMovement.create({
        data: {
          storeId: store.id,
          locationId: whLocation.id,
          productId: apparelProduct.id,
          variantId: variant.id,
          type: 'PURCHASE',
          quantityChange: v.whStock,
          quantityBefore: 0,
          quantityAfter: v.whStock,
          unitCost: v.cost,
          referenceType: 'PURCHASE_ORDER',
          referenceId: 'PO-APPAREL-001',
          notes: 'Initial polo apparel batch receipt in warehouse',
          createdById: adminUser.id,
        },
      });
    }
  }

  console.log(`[Seed] Products & Variants seeded with multi-location stock & audit movements`);

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
