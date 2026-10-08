/**
 * Automated Settings System Test Suite
 * Validates the complete settings lifecycle across Business, Store, POS, Users, Payments, and Localization:
 *
 * 1. Business Settings (name, logo, address, contact, currency, timezone)
 * 2. Store Settings (store name, address, receipt settings, tax settings, inventory settings)
 * 3. POS Settings (receipt size, barcode behavior, sound, keyboard shortcuts, customer display, printer, cash drawer)
 * 4. User & RBAC Settings (users, roles, permissions matrix, store access scoping)
 * 5. Payment Methods Settings (available payment methods, gateway configuration, active/default toggles)
 * 6. Localization Settings (language, currency formatting, date/time formatting)
 * 7. Dynamic API & Persistence Verification (Settings stored in DB and applied dynamically without hardcoding)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';
import http from 'http';

let server: http.Server;
let baseUrl: string;
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

async function request(apiPath: string, options: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${apiPath}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: data };
}

async function runSettingsTestSuite() {
  console.log('======================================================================');
  console.log('⚙️  RUNNING COMPLETE SETTINGS SYSTEM TEST SUITE');
  console.log('======================================================================\n');

  // Launch isolated in-process Express server on ephemeral port
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`[Test Server] Isolated test instance listening on ${baseUrl}\n`);
      resolve();
    });
  });

  // Step 0: Obtain Admin Authentication Token
  console.log('--- Phase 0: Authentication & Session Token Acquisition ---');
  let token = '';
  try {
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    assert(
      loginRes.ok && Boolean(loginRes.body?.data?.tokens?.accessToken),
      'Admin authentication successful for settings access',
    );
    token = loginRes.body?.data?.tokens?.accessToken;
  } catch (err: any) {
    assert(false, 'Admin authentication', err.message);
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Find business & primary store from DB
  const business = await prisma.business.findFirst({ where: { code: 'AFM-01' } });
  if (!business) throw new Error('Seeded business AFM-01 not found');
  const store = await prisma.store.findFirst({ where: { businessId: business.id } });
  if (!store) throw new Error('Primary store not found');

  console.log(
    `\nContext: Business "${business.name}" (${business.id}), Store "${store.name}" (${store.id})\n`,
  );

  // =====================================================================
  // Phase 1: Unified Settings Root Endpoint
  // =====================================================================
  console.log('--- Phase 1: Unified Settings Payload (GET /api/settings) ---');
  try {
    const res = await request('/api/settings', { headers: authHeaders });
    assert(res.ok && res.body?.success, 'GET /api/settings returned 200 OK');
    assert(Boolean(res.body?.data?.business), 'Unified settings contains business configuration');
    assert(Boolean(res.body?.data?.store), 'Unified settings contains store configuration');
    assert(Boolean(res.body?.data?.pos), 'Unified settings contains POS terminal configuration');
    assert(
      Boolean(res.body?.data?.localization),
      'Unified settings contains localization configuration',
    );
    assert(
      Array.isArray(res.body?.data?.paymentMethods),
      'Unified settings contains payment methods array',
    );
    assert(
      Array.isArray(res.body?.data?.storesList) && res.body?.data?.storesList.length > 0,
      'Unified settings contains stores list',
    );
  } catch (err: any) {
    assert(false, 'Unified settings retrieval', err.message);
  }

  // =====================================================================
  // Phase 2: Business Profile Settings
  // =====================================================================
  console.log(
    '\n--- Phase 2: Business Settings (name, logo, address, contact, currency, timezone) ---',
  );
  const originalBusinessName = business.name;
  const updatedBusinessPayload = {
    name: 'Angkor Premier Retail Group',
    logoUrl: 'https://cdn.example.com/branding/angkor-premier-logo.png',
    address: 'Building 100, Norodom Blvd, Sangkat Tonle Bassac, Phnom Penh',
    phone: '+855 23 999 888',
    email: 'operations@angkorpremier.com',
    defaultCurrency: 'USD',
    timezone: 'Asia/Phnom_Penh',
  };

  try {
    const putRes = await request('/api/settings/business', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(updatedBusinessPayload),
    });
    assert(putRes.ok && putRes.body?.success, 'PUT /api/settings/business returned 200 OK');
    assert(
      putRes.body?.data?.name === updatedBusinessPayload.name,
      'Business name updated to "Angkor Premier Retail Group"',
    );
    assert(
      putRes.body?.data?.logoUrl === updatedBusinessPayload.logoUrl,
      'Business logo URL stored dynamically',
    );
    assert(
      putRes.body?.data?.address === updatedBusinessPayload.address,
      'Business physical address updated',
    );
    assert(
      putRes.body?.data?.phone === updatedBusinessPayload.phone,
      'Business contact phone updated',
    );
    assert(
      putRes.body?.data?.email === updatedBusinessPayload.email,
      'Business contact email updated',
    );
    assert(
      putRes.body?.data?.timezone === updatedBusinessPayload.timezone,
      'Business timezone configured to Asia/Phnom_Penh',
    );

    // Database Direct Verification
    const dbBusiness = await prisma.business.findUnique({ where: { id: business.id } });
    assert(
      dbBusiness?.name === updatedBusinessPayload.name,
      'Database reflects updated business name without restart',
    );
    assert(
      dbBusiness?.phone === updatedBusinessPayload.phone,
      'Database reflects updated contact phone',
    );

    // Revert business name to keep test environment clean
    await prisma.business.update({
      where: { id: business.id },
      data: { name: originalBusinessName },
    });
    console.log('  ↳ Cleaned up business name back to original');
  } catch (err: any) {
    assert(false, 'Business settings update', err.message);
  }

  // =====================================================================
  // Phase 3: Store Settings (receipt, tax, inventory)
  // =====================================================================
  console.log('\n--- Phase 3: Store Settings (store name, address, receipt, tax, inventory) ---');
  const storeSettingsPayload = {
    storeName: 'Monivong Flagship Superstore',
    address: '#128 Preah Monivong Blvd, Daun Penh, Phnom Penh',
    phone: '+855 23 888 777',
    receipt: {
      showLogo: true,
      showTaxBreakdown: true,
      showCashierName: true,
      showCustomerInfo: true,
      paperSize: '80mm',
      customHeader: '*** ANGKOR PREMIER FLAGSHIP ***',
      customFooter: 'Thank you for shopping! Exchange valid within 7 days.',
    },
    tax: {
      defaultTaxRate: 10,
      isTaxInclusive: true,
      enableTax: true,
      taxNumber: 'VAT-KH-99281726',
    },
    inventory: {
      allowNegativeStock: false,
      defaultLowStockAlert: 15,
      trackBatches: true,
      enableStockTransfers: true,
    },
  };

  try {
    const putStoreRes = await request(`/api/settings/store/${store.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(storeSettingsPayload),
    });
    assert(
      putStoreRes.ok && putStoreRes.body?.success,
      'PUT /api/settings/store/:storeId returned 200 OK',
    );
    assert(
      putStoreRes.body?.data?.storeName === storeSettingsPayload.storeName,
      'Store name updated dynamically',
    );
    assert(putStoreRes.body?.data?.receipt.showLogo === true, 'Receipt setting: showLogo enabled');
    assert(
      putStoreRes.body?.data?.receipt.showTaxBreakdown === true,
      'Receipt setting: showTaxBreakdown enabled',
    );
    assert(
      putStoreRes.body?.data?.receipt.paperSize === '80mm',
      'Receipt setting: 80mm paper size configured',
    );
    assert(
      putStoreRes.body?.data?.receipt.customHeader === storeSettingsPayload.receipt.customHeader,
      'Receipt setting: custom header text configured',
    );
    assert(
      putStoreRes.body?.data?.tax.defaultTaxRate === 10,
      'Tax setting: 10% VAT rate configured',
    );
    assert(
      putStoreRes.body?.data?.tax.isTaxInclusive === true,
      'Tax setting: Tax inclusive pricing enabled',
    );
    assert(
      putStoreRes.body?.data?.tax.taxNumber === 'VAT-KH-99281726',
      'Tax setting: Official tax registration number saved',
    );
    assert(
      putStoreRes.body?.data?.inventory.allowNegativeStock === false,
      'Inventory setting: Negative stock prohibited',
    );
    assert(
      putStoreRes.body?.data?.inventory.defaultLowStockAlert === 15,
      'Inventory setting: Low stock alert threshold set to 15',
    );

    // Database verification of Store.settings JSON field
    const dbStore = await prisma.store.findUnique({ where: { id: store.id } });
    const dbStoreSettings = dbStore?.settings as any;
    assert(
      dbStoreSettings?.receipt?.paperSize === '80mm',
      'Database JSON reflects receipt paper size 80mm',
    );
    assert(
      dbStoreSettings?.tax?.taxNumber === 'VAT-KH-99281726',
      'Database JSON reflects official tax registration number',
    );
    assert(
      dbStoreSettings?.inventory?.defaultLowStockAlert === 15,
      'Database JSON reflects low stock alert threshold 15',
    );
  } catch (err: any) {
    assert(false, 'Store settings update', err.message);
  }

  // =====================================================================
  // Phase 4: POS Operational Settings
  // =====================================================================
  console.log(
    '\n--- Phase 4: POS Settings (receipt size, barcode, sound, shortcuts, CFD, printer, cash drawer) ---',
  );
  const posSettingsPayload = {
    receiptSize: '80mm',
    barcodeBehavior: {
      autoAddToCart: true,
      beepOnScan: true,
      focusInputByDefault: true,
      minLength: 4,
    },
    sound: {
      enabled: true,
      volume: 0.85,
      playBeep: true,
      playCashDrawer: true,
      playWarning: true,
      playSuccess: true,
    },
    keyboardShortcuts: {
      enabled: true,
      customBindings: {
        search: 'F1',
        barcode: 'F2',
        customer: 'F4',
        hold: 'F6',
        payment: 'F8',
        clear: 'Delete',
      },
    },
    customerDisplay: {
      enabled: true,
      port: 'COM3',
      baudRate: 9600,
      lineLength: 20,
      welcomeMessage: 'Welcome to Angkor Mart',
      idleMessage: 'Next Customer Please',
    },
    printer: {
      enabled: true,
      type: 'usb',
      ip: '192.168.1.200',
      port: 9100,
      charactersPerLine: 48,
      autoCut: true,
    },
    cashDrawer: {
      enabled: true,
      driver: 'printer_kick',
      pulsePin: 2,
      openOnCashSale: true,
    },
  };

  try {
    const putPosRes = await request('/api/settings/pos', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(posSettingsPayload),
    });
    assert(putPosRes.ok && putPosRes.body?.success, 'PUT /api/settings/pos returned 200 OK');
    assert(putPosRes.body?.data?.receiptSize === '80mm', 'POS receipt size set to 80mm');
    assert(
      putPosRes.body?.data?.barcodeBehavior.autoAddToCart === true,
      'POS barcode auto-add configured',
    );
    assert(
      putPosRes.body?.data?.barcodeBehavior.beepOnScan === true,
      'POS barcode beep feedback configured',
    );
    assert(putPosRes.body?.data?.sound.volume === 0.85, 'POS sound volume calibrated to 85%');
    assert(
      putPosRes.body?.data?.keyboardShortcuts.customBindings.payment === 'F8',
      'POS keyboard shortcuts: F8 bound to Payment',
    );
    assert(
      putPosRes.body?.data?.customerDisplay.welcomeMessage === 'Welcome to Angkor Mart',
      'Customer display welcome message configured',
    );
    assert(
      putPosRes.body?.data?.printer.autoCut === true,
      'Thermal printer auto-cut paper configured',
    );
    assert(
      putPosRes.body?.data?.cashDrawer.openOnCashSale === true,
      'Cash drawer auto-kick on cash configured',
    );

    // GET /api/settings/pos verification
    const getPosRes = await request('/api/settings/pos', { headers: authHeaders });
    assert(
      getPosRes.body?.data?.customerDisplay.port === 'COM3',
      'GET /api/settings/pos returns saved CFD port COM3',
    );
  } catch (err: any) {
    assert(false, 'POS settings update', err.message);
  }

  // =====================================================================
  // Phase 5: Localization & Formatting Settings
  // =====================================================================
  console.log(
    '\n--- Phase 5: Localization Settings (language, currency formatting, date/time formatting) ---',
  );
  const localizationPayload = {
    language: 'km',
    defaultCurrency: 'USD',
    currencyFormatting: {
      symbol: '$',
      position: 'prefix',
      decimalPlaces: 2,
      thousandsSeparator: ',',
      decimalSeparator: '.',
    },
    dateTimeFormatting: {
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm:ss',
      timezone: 'Asia/Phnom_Penh',
      use24Hour: true,
    },
  };

  try {
    const putLocRes = await request('/api/settings/localization', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(localizationPayload),
    });
    assert(
      putLocRes.ok && putLocRes.body?.success,
      'PUT /api/settings/localization returned 200 OK',
    );
    assert(putLocRes.body?.data?.language === 'km', 'Language set to Khmer ("km") dynamically');
    assert(
      putLocRes.body?.data?.currencyFormatting.symbol === '$',
      'Currency formatting symbol set to $',
    );
    assert(
      putLocRes.body?.data?.currencyFormatting.decimalPlaces === 2,
      'Currency decimal places calibrated to 2',
    );
    assert(
      putLocRes.body?.data?.dateTimeFormatting.dateFormat === 'YYYY-MM-DD',
      'Date format set to YYYY-MM-DD',
    );
    assert(
      putLocRes.body?.data?.dateTimeFormatting.use24Hour === true,
      'Time format 24-hour clock enabled',
    );

    // GET /api/settings/localization verification
    const getLocRes = await request('/api/settings/localization', { headers: authHeaders });
    assert(
      getLocRes.body?.data?.language === 'km',
      'GET /api/settings/localization returns persisted language',
    );
  } catch (err: any) {
    assert(false, 'Localization settings update', err.message);
  }

  // =====================================================================
  // Phase 6: Payment Methods Configuration
  // =====================================================================
  console.log(
    '\n--- Phase 6: Payment Methods (available methods, gateway config, active toggles) ---',
  );
  let createdPaymentMethodId = '';
  const newMethodPayload = {
    name: 'Wing Bank KHQR',
    code: `WING_QR_${Date.now()}`,
    type: 'DIGITAL_QR',
    isActive: true,
    isDefault: false,
    config: {
      merchantId: 'WING-MERCH-88219',
      terminalId: 'TERM-01',
      autoSettle: true,
      qrTimeoutSeconds: 120,
    },
  };

  try {
    // 1. Create custom payment method
    const postPmRes = await request('/api/settings/payments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(newMethodPayload),
    });
    assert(
      postPmRes.ok && postPmRes.body?.success,
      'POST /api/settings/payments created new payment method',
    );
    assert(
      postPmRes.body?.data?.name === newMethodPayload.name,
      'Payment method name saved correctly',
    );
    assert(
      postPmRes.body?.data?.config.merchantId === 'WING-MERCH-88219',
      'Payment method merchant configuration stored',
    );
    createdPaymentMethodId = postPmRes.body?.data?.id;

    // 2. Toggle payment method status
    const toggleRes = await request(`/api/settings/payments/${createdPaymentMethodId}/toggle`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    assert(
      toggleRes.ok && toggleRes.body?.data?.isActive === false,
      'PATCH /api/settings/payments/:id/toggle disabled payment method',
    );

    const toggleBackRes = await request(`/api/settings/payments/${createdPaymentMethodId}/toggle`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    assert(
      toggleBackRes.ok && toggleBackRes.body?.data?.isActive === true,
      'PATCH /api/settings/payments/:id/toggle re-enabled payment method',
    );

    // 3. Update payment method configuration
    const updatePmRes = await request(`/api/settings/payments/${createdPaymentMethodId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Wing Bank Universal QR',
        config: {
          merchantId: 'WING-MERCH-99999',
          terminalId: 'TERM-VIP',
        },
      }),
    });
    assert(
      updatePmRes.ok && updatePmRes.body?.data?.name === 'Wing Bank Universal QR',
      'PUT /api/settings/payments/:id updated gateway configuration',
    );
  } catch (err: any) {
    assert(false, 'Payment method management', err.message);
  }

  // =====================================================================
  // Phase 7: Users, Roles, Permissions & Store Access (RBAC)
  // =====================================================================
  console.log('\n--- Phase 7: Users & RBAC (users, roles, permissions matrix, store access) ---');
  let createdUserId = '';
  const testUsername = `cashier_test_${Date.now()}`;

  try {
    // 1. Retrieve Roles Matrix
    const rolesRes = await request('/api/settings/roles', { headers: authHeaders });
    const rolesList = rolesRes.body?.data?.roles || [];
    assert(rolesRes.ok && Array.isArray(rolesList), 'GET /api/settings/roles returned roles list');
    const cashierRole = rolesList.find((r: any) => r.name.toLowerCase().includes('cashier'));
    assert(Boolean(cashierRole), 'Cashier role discovered in system roles');

    // 2. Create System User with Role & Store Access
    const createUserPayload = {
      username: testUsername,
      email: `${testUsername}@angkorfresh.com`,
      fullName: 'Sophea Vichea (Test Cashier)',
      phone: '+855 12 345 678',
      password: 'SecurePassword123!',
      roleId: cashierRole ? cashierRole.id : '',
      roleIds: cashierRole ? [cashierRole.id] : [],
      storeIds: [store.id],
      isActive: true,
    };

    const createUserRes = await request('/api/settings/users', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(createUserPayload),
    });
    assert(
      createUserRes.ok && createUserRes.body?.success,
      'POST /api/settings/users created system user',
    );
    assert(createUserRes.body?.data?.username === testUsername, 'User username correctly created');
    assert(
      createUserRes.body?.data?.fullName === createUserPayload.fullName,
      'User full name registered',
    );
    assert(createUserRes.body?.data?.roles?.length > 0, 'User assigned role correctly');
    assert(
      createUserRes.body?.data?.storeAccess?.some((sa: any) => sa.storeId === store.id),
      'User scoped with store access permission',
    );
    createdUserId = createUserRes.body?.data?.id;

    // 3. Update User Information
    const updateUserRes = await request(`/api/settings/users/${createdUserId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        fullName: 'Sophea Vichea (Senior Cashier)',
        phone: '+855 12 999 000',
      }),
    });
    assert(
      updateUserRes.ok && updateUserRes.body?.data?.fullName === 'Sophea Vichea (Senior Cashier)',
      'PUT /api/settings/users/:id updated user profile',
    );

    // 4. Toggle User Active Status
    const toggleUserRes = await request(`/api/settings/users/${createdUserId}/toggle`, {
      method: 'PATCH',
      headers: authHeaders,
    });
    assert(
      toggleUserRes.ok && toggleUserRes.body?.data?.isActive === false,
      'PATCH /api/settings/users/:id/toggle deactivated user',
    );

    // 5. Clean up test user & test payment method
    if (createdUserId) {
      await prisma.userRole.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.delete({ where: { id: createdUserId } });
    }
    if (createdPaymentMethodId) {
      await prisma.paymentMethod.delete({ where: { id: createdPaymentMethodId } });
    }
    console.log('  ↳ Cleaned up temporary test user and test payment method');
  } catch (err: any) {
    assert(false, 'Users & RBAC management', err.message);
  }

  // =====================================================================
  // Phase 8: End-to-End Dynamic Verification
  // =====================================================================
  console.log('\n--- Phase 8: Dynamic Application Integrity ---');
  try {
    const finalCheck = await request('/api/settings', { headers: authHeaders });
    assert(
      finalCheck.body?.data?.store.receipt.paperSize === '80mm',
      'Dynamic verification: POS inherits store receipt 80mm setting without reload',
    );
    assert(
      finalCheck.body?.data?.pos.barcodeBehavior.autoAddToCart === true,
      'Dynamic verification: POS inherits barcode auto-add setting',
    );
    assert(
      finalCheck.body?.data?.localization.currencyFormatting.symbol === '$',
      'Dynamic verification: POS uses configured currency formatting symbol',
    );
  } catch (err: any) {
    assert(false, 'Dynamic integrity check', err.message);
  }

  // Final Summary
  console.log('\n======================================================================');
  console.log(`🏁 SETTINGS SYSTEM SUITE SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (server) {
    await new Promise<void>((res) => server.close(() => res()));
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runSettingsTestSuite()
  .catch((e) => {
    console.error('Fatal error in settings test suite:', e);
    process.exit(1);
  })
  .finally(async () => {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  });
