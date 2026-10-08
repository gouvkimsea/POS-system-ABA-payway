/**
 * ==============================================================================
 * Comprehensive Hardware Integration & Device Bridge Test Suite
 * ==============================================================================
 */

import http from 'http';
import { app as bridgeApp } from '../apps/bridge/src/index.js';
import { EscPosEncoder } from '../apps/bridge/src/EscPosEncoder.js';
import { PrinterManager } from '../apps/bridge/src/PrinterManager.js';
import { DrawerManager } from '../apps/bridge/src/DrawerManager.js';
import { CustomerDisplayManager } from '../apps/bridge/src/CustomerDisplayManager.js';
import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';
import { PrintJob, PrintJobData } from '@pos/types';

const BRIDGE_TEST_PORT = 9124;
const API_TEST_PORT = 4124;

let bridgeServer: http.Server;
let apiServer: http.Server;
let adminAuthToken: string = '';

async function startTestServers(): Promise<void> {
  return new Promise((resolve) => {
    bridgeServer = bridgeApp.listen(BRIDGE_TEST_PORT, () => {
      const apiApp = createApp();
      apiServer = apiApp.listen(API_TEST_PORT, () => {
        resolve();
      });
    });
  });
}

async function stopTestServers(): Promise<void> {
  return new Promise((resolve) => {
    bridgeServer.close(() => {
      apiServer.close(() => {
        resolve();
      });
    });
  });
}

async function getAdminToken(): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${API_TEST_PORT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123',
    }),
  });
  const data = await res.json();
  return data.data.tokens.accessToken;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('\n--- [Setup] Starting Test Bridge & API Daemons ---');
  await startTestServers();
  adminAuthToken = await getAdminToken();
  console.log('✓ Bridge daemon listening on port', BRIDGE_TEST_PORT);
  console.log('✓ API daemon listening on port', API_TEST_PORT);

  try {
    // --------------------------------------------------------------------------
    // Test 1: Device Bridge Health & Status
    // --------------------------------------------------------------------------
    console.log('\n--- [Test 1] Local Device Bridge Health & Discovery ---');
    const healthRes = await fetch(`http://127.0.0.1:${BRIDGE_TEST_PORT}/health`);
    assert(healthRes.status === 200, 'Bridge /health returns 200 OK');
    const healthData = await healthRes.json();
    assert(healthData.status === 'ok', 'Bridge status is OK');
    assert(Boolean(healthData.platform), `Bridge detected host platform: ${healthData.platform}`);

    const statusRes = await fetch(`http://127.0.0.1:${BRIDGE_TEST_PORT}/status`);
    assert(statusRes.status === 200, 'Bridge /status returns 200 OK');
    const statusData = await statusRes.json();
    assert(statusData.connected === true, 'Bridge reports connected: true');
    assert(Array.isArray(statusData.discoveredPrinters), 'Discovered printers is an array');
    assert(
      statusData.discoveredPrinters.length > 0,
      `Discovered ${statusData.discoveredPrinters.length} available printer profiles`,
    );

    // --------------------------------------------------------------------------
    // Test 2: ESC/POS Encoder Formatting & Width Calibration (58mm vs 80mm)
    // --------------------------------------------------------------------------
    console.log('\n--- [Test 2] ESC/POS Command Encoder (58mm vs 80mm) ---');
    const encoder58 = new EscPosEncoder('58mm');
    encoder58.text('Hello 58mm');
    encoder58.divider('=');
    const buf58 = encoder58.toBuffer();
    assert(buf58.length > 0, 'Generated valid ESC/POS binary buffer for 58mm');
    assert(
      buf58[0] === 0x1b && buf58[1] === 0x40,
      'Emitted ESC @ initialization sequence (0x1B 0x40)',
    );

    const encoder80 = new EscPosEncoder('80mm');
    encoder80.align('center');
    encoder80.bold(true);
    encoder80.line('STORE HEADER');
    encoder80.bold(false);
    encoder80.twoColumn('Left Column', 'Right Column');
    encoder80.barcode('TEST8840001001');
    encoder80.qrCode('https://pos.angkor-mart.com/test');
    encoder80.pulseDrawer(2);
    encoder80.cut(false);
    const buf80 = encoder80.toBuffer();

    assert(
      buf80.includes(0x1d) && buf80.includes(0x56),
      'Contains GS V paper cut command (0x1D 0x56)',
    );
    assert(
      buf80.includes(0x1b) && buf80.includes(0x70),
      'Contains ESC p cash drawer kick command (0x1B 0x70)',
    );
    assert(
      buf80.includes(0x1d) && buf80.includes(0x6b),
      'Contains GS k CODE128 barcode command (0x1D 0x6B)',
    );
    assert(buf80.length > buf58.length, '80mm buffer accommodates multi-column table layout');

    // --------------------------------------------------------------------------
    // Test 3: Receipt Print, Test Print, and Reprint Execution via Bridge
    // --------------------------------------------------------------------------
    console.log('\n--- [Test 3] Printer Interface (Test Print, Receipt Print, Reprint) ---');
    const samplePrintData: PrintJobData = {
      storeName: 'Angkor Fresh Mart - Monivong Central',
      storeAddress: '#128, Preah Monivong Blvd, Phnom Penh',
      storePhone: '+855 23 888 991',
      receiptNumber: 'RCP-20261007-TEST01',
      orderNumber: 'ORD-20261007-TEST01',
      createdAt: new Date().toISOString(),
      items: [
        { name: 'Angkor Premium Beer 330ml', quantity: 2, unitPriceUSD: 1.1, totalUSD: 2.2 },
        { name: 'Kulene Mineral Water 500ml', quantity: 1, unitPriceUSD: 0.5, totalUSD: 0.5 },
      ],
      subtotalUSD: 2.7,
      taxUSD: 0.27,
      totalUSD: 2.97,
      totalKHR: 12177,
      exchangeRateKHR: 4100,
      payments: [{ method: 'CASH', amountUSD: 2.97, amountKHR: 12177, tenderUSD: 5.0 }],
      changeUSD: 2.03,
      changeKHR: 8323,
      qrPayload: 'https://verify.angkor-mart.com/receipt/RCP-20261007-TEST01',
    };

    // A. Test Print
    const testPrintJob: PrintJob = {
      jobId: 'TEST-JOB-01',
      type: 'TEST',
      printer: {
        driver: 'LOCAL_BRIDGE',
        name: 'POS-80 Thermal Printer',
        paperSize: '80mm',
        autoCut: true,
        autoOpenDrawer: false,
        copies: 1,
      },
      timestamp: new Date().toISOString(),
    };
    const testPrintRes = await fetch(`http://127.0.0.1:${BRIDGE_TEST_PORT}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPrintJob),
    });
    assert(testPrintRes.status === 200, 'POST /print (TEST) returns 200 OK');
    const testPrintResult = await testPrintRes.json();
    assert(testPrintResult.success === true, 'Test print job executed successfully');

    // B. Receipt Print
    const receiptPrintJob: PrintJob = {
      jobId: 'RECEIPT-JOB-01',
      type: 'RECEIPT',
      printer: {
        driver: 'LOCAL_BRIDGE',
        name: 'POS-80 Thermal Printer',
        paperSize: '80mm',
        autoCut: true,
        autoOpenDrawer: true,
        copies: 1,
      },
      data: samplePrintData,
      timestamp: new Date().toISOString(),
    };
    const receiptRes = await fetch(`http://127.0.0.1:${BRIDGE_TEST_PORT}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(receiptPrintJob),
    });
    assert(receiptRes.status === 200, 'POST /print (RECEIPT) returns 200 OK');
    const receiptResult = await receiptRes.json();
    assert(receiptResult.success === true, 'Commercial receipt printed successfully');

    // C. Reprint with duplicate watermark
    const reprintJob: PrintJob = {
      ...receiptPrintJob,
      jobId: 'REPRINT-JOB-01',
      type: 'REPRINT',
    };
    const reprintRes = await fetch(`http://127.0.0.1:${BRIDGE_TEST_PORT}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reprintJob),
    });
    assert(reprintRes.status === 200, 'POST /print (REPRINT) returns 200 OK');
    const reprintResult = await reprintRes.json();
    assert(reprintResult.success === true, 'Duplicate reprint executed successfully');

    // --------------------------------------------------------------------------
    // Test 4: Cash Drawer Kick Signal
    // --------------------------------------------------------------------------
    console.log('\n--- [Test 4] Cash Drawer Kick via Printer & Bridge Relay ---');
    const drawerRes = await fetch(`http://127.0.0.1:${BRIDGE_TEST_PORT}/cash-drawer/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          driver: 'PRINTER_KICK',
          kickPin: 2,
          pulseOnMs: 50,
          autoOpenOnCashPayment: true,
          soundChirp: true,
        },
        printerName: 'POS-80 Thermal Printer',
      }),
    });
    assert(drawerRes.status === 200, 'POST /cash-drawer/open returns 200 OK');
    const drawerResult = await drawerRes.json();
    assert(drawerResult.success === true, 'Cash drawer kick signal emitted successfully');
    assert(drawerResult.method === 'PRINTER_KICK', 'Triggered using PRINTER_KICK driver');

    // --------------------------------------------------------------------------
    // Test 5: Customer Display State Synchronization & VFD Line Display
    // --------------------------------------------------------------------------
    console.log('\n--- [Test 5] Customer Display State & VFD 2x20 Command Generation ---');
    const displayManager = CustomerDisplayManager.getInstance();

    // Verify VFD 2x20 command generation
    const vfdBuffer = displayManager.generateVfdCommand('Total: $12.50', 'Change: $7.50');
    assert(vfdBuffer.length > 0, 'Generated VFD 2x20 serial command stream');
    assert(vfdBuffer.includes(0x0c), 'Includes 0x0C formfeed/clear display code');

    // Test REST state update
    const updateDisplayRes = await fetch(
      `http://127.0.0.1:${BRIDGE_TEST_PORT}/customer-display/state`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAYMENT',
          paymentPrompt: {
            method: 'KHQR / ABA PayWay',
            amountUSD: 2.97,
            amountKHR: 12177,
            qrPayload: 'https://verify.angkor-mart.com/qr/12345',
          },
        }),
      },
    );
    assert(updateDisplayRes.status === 200, 'POST /customer-display/state returns 200 OK');
    const displayState = await updateDisplayRes.json();
    assert(displayState.state.status === 'PAYMENT', 'Customer display updated to PAYMENT state');
    assert(
      displayState.state.paymentPrompt.qrPayload.includes('verify.angkor-mart.com'),
      'Customer display holds active payment QR code',
    );

    // --------------------------------------------------------------------------
    // Test 6: Network Printer Fault Tolerance (Never Crash POS)
    // --------------------------------------------------------------------------
    console.log('\n--- [Test 6] Network Printer Timeout & Fault Tolerance ---');
    const deadNetworkJob: PrintJob = {
      jobId: 'DEAD-NET-JOB',
      type: 'TEST',
      printer: {
        driver: 'NETWORK_TCP',
        name: 'Dead Network Printer',
        paperSize: '80mm',
        networkIp: '192.0.2.1', // Non-routable TEST-NET-1 IP
        networkPort: 9100,
        autoCut: false,
        autoOpenDrawer: false,
        copies: 1,
      },
      timestamp: new Date().toISOString(),
    };
    const deadNetRes = await fetch(`http://127.0.0.1:${BRIDGE_TEST_PORT}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deadNetworkJob),
    });
    assert(
      deadNetRes.status === 200,
      'Dead network printer does NOT crash server (200 OK handled)',
    );
    const deadNetResult = await deadNetRes.json();
    assert(deadNetResult.success === false, 'Safe failure indicated when device is unreachable');
    assert(deadNetResult.fallbackUsed === true, 'Flagged fallbackUsed: true for browser fallback');

    // --------------------------------------------------------------------------
    // Test 7: Device Registration & Hardware Profile Sync API
    // --------------------------------------------------------------------------
    console.log('\n--- [Test 7] Backend Device Management & Hardware Profile Sync ---');
    const store = await prisma.store.findFirst({ select: { id: true } });
    if (!store) throw new Error('No store found in database');

    const regRes = await fetch(`http://127.0.0.1:${API_TEST_PORT}/api/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuthToken}`,
      },
      body: JSON.stringify({
        storeId: store.id,
        name: 'Station 1 - Express Register',
        deviceIdentifier: 'POS-STATION-01',
        deviceType: 'TERMINAL',
        hardwareConfig: {
          printer: {
            driver: 'LOCAL_BRIDGE',
            name: 'EPSON TM-T88VI',
            paperSize: '80mm',
          },
          scanner: {
            mode: 'KEYBOARD_WEDGE',
            interKeyTimeoutMs: 45,
            minBarcodeLength: 4,
          },
        },
      }),
    });
    assert(regRes.status === 201, 'POST /api/devices/register returns 201 Created');
    const regData = await regRes.json();
    assert(
      regData.data.deviceIdentifier === 'POS-STATION-01',
      'Device registered with correct identifier',
    );

    // Update hardware config
    const updateConfigRes = await fetch(
      `http://127.0.0.1:${API_TEST_PORT}/api/devices/POS-STATION-01/hardware-config`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAuthToken}`,
        },
        body: JSON.stringify({
          hardwareConfig: {
            printer: {
              driver: 'LOCAL_BRIDGE',
              name: 'POS-80C Thermal Printer',
              paperSize: '80mm',
              autoCut: true,
            },
          },
        }),
      },
    );
    assert(updateConfigRes.status === 200, 'PUT /api/devices/:id/hardware-config returns 200 OK');
    const updatedDev = await updateConfigRes.json();
    assert(
      updatedDev.data.hardwareConfig.printer.name === 'POS-80C Thermal Printer',
      'Hardware config successfully persisted in PostgreSQL',
    );

    console.log('\n================================================================');
    console.log('🎉 ALL HARDWARE INTEGRATION & DEVICE BRIDGE TESTS PASSED! ✨');
    console.log('================================================================\n');
  } finally {
    await stopTestServers();
  }
}

runTests().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
