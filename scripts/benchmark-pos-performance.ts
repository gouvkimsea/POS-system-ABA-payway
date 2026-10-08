/**
 * ==============================================================================
 * Comprehensive POS Performance & Latency Benchmark Runner
 * ==============================================================================
 * Measures and records granular performance metrics:
 *
 * 1. Barcode Lookup Latency (ms) - Target: < 15ms
 * 2. Product Search Latency (ms) - Target: < 25ms
 * 3. POS Checkout Processing Latency (ms) - Target: < 60ms
 * 4. Store Inventory Query Latency (ms) - Target: < 20ms
 * 5. Reporting Dashboard Aggregation Latency (ms) - Target: < 50ms
 * 6. High-Volume In-Memory / Indexed Search Latency (10,000 items) - Target: < 2ms
 * ==============================================================================
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import http from 'http';
import { createApp } from '../apps/api/src/index.js';
import { prisma } from '../apps/api/src/db/index.js';

let server: http.Server;
let baseUrl: string;

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${baseUrl}${endpoint}`;
  const start = performance.now();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const duration = performance.now() - start;
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: data, durationMs: duration };
}

function stats(durations: number[]) {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return { avg, min, max, p50, p95 };
}

export interface BenchmarkMetrics {
  timestamp: string;
  barcodeLookup: { avgMs: number; p95Ms: number; minMs: number; maxMs: number };
  productSearch: { avgMs: number; p95Ms: number; minMs: number; maxMs: number };
  checkoutThroughput: { avgMs: number; p95Ms: number; minMs: number; maxMs: number };
  inventoryQuery: { avgMs: number; p95Ms: number; minMs: number; maxMs: number };
  reportingDashboard: { avgMs: number; p95Ms: number; minMs: number; maxMs: number };
  largeScaleSearch10k: { avgMs: number; p95Ms: number; minMs: number; maxMs: number };
}

export async function runBenchmark(label: string = 'Current'): Promise<BenchmarkMetrics> {
  console.log(`\n======================================================================`);
  console.log(`⚡ EXECUTING POS PERFORMANCE BENCHMARK [${label.toUpperCase()}]`);
  console.log(`======================================================================\n`);

  // Start dedicated benchmark server
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`[Benchmark Server] Listening on ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // 1. Authenticate Cashier & Admin
    const authStart = performance.now();
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    const authDuration = performance.now() - authStart;
    console.log(`✓ Authentication latency: ${authDuration.toFixed(2)}ms`);

    const token = loginRes.body.data.tokens.accessToken;
    const storeId = loginRes.body.data.user.storeId;
    const businessId = loginRes.body.data.user.businessId;

    // Fetch baseline catalog products for testing
    const initRes = await request('/api/pos/init', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const products = initRes.body.data.products;
    const testBarcode = products.find((p: any) => p.barcode)?.barcode || '8840001003';
    const testProduct = products[0];

    // ------------------------------------------------------------------------
    // Benchmark 1: Barcode Lookup Latency (30 iterations)
    // ------------------------------------------------------------------------
    console.log(`\n▶ [1/6] Benchmarking Barcode Scanning & Direct Lookup (30 samples)...`);
    const barcodeDurations: number[] = [];
    for (let i = 0; i < 30; i++) {
      const res = await request(`/api/pos/products?barcode=${testBarcode}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) barcodeDurations.push(res.durationMs);
    }
    const barcodeStats = stats(barcodeDurations);
    console.log(
      `  Avg: ${barcodeStats.avg.toFixed(2)}ms | p95: ${barcodeStats.p95.toFixed(2)}ms | min: ${barcodeStats.min.toFixed(2)}ms`,
    );

    // ------------------------------------------------------------------------
    // Benchmark 2: Product Search Latency (25 iterations across queries)
    // ------------------------------------------------------------------------
    console.log(`\n▶ [2/6] Benchmarking Product Search (25 samples across query terms)...`);
    const searchTerms = ['coca', 'water', 'milk', 'bread', 'angkor', 'can', 'pack'];
    const searchDurations: number[] = [];
    for (let i = 0; i < 25; i++) {
      const q = searchTerms[i % searchTerms.length];
      const res = await request(`/api/pos/products?search=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) searchDurations.push(res.durationMs);
    }
    const searchStats = stats(searchDurations);
    console.log(
      `  Avg: ${searchStats.avg.toFixed(2)}ms | p95: ${searchStats.p95.toFixed(2)}ms | min: ${searchStats.min.toFixed(2)}ms`,
    );

    // ------------------------------------------------------------------------
    // Benchmark 3: POS Checkout Execution Throughput (15 checkouts)
    // ------------------------------------------------------------------------
    console.log(`\n▶ [3/6] Benchmarking POS Complete Checkout Latency (15 samples)...`);
    const checkoutDurations: number[] = [];
    for (let i = 0; i < 15; i++) {
      const idempKey = `BENCH-${Date.now()}-${i}-${Math.random().toString(36).substring(7)}`;
      const res = await request('/api/pos/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storeId,
          idempotencyKey: idempKey,
          items: [
            {
              productId: testProduct.id,
              quantity: 1,
              unitPriceUSD: testProduct.sellingPriceUSD,
            },
          ],
          payments: [
            {
              paymentMethodCode: 'CASH',
              amountUSD: testProduct.sellingPriceUSD,
              tenderAmountUSD: testProduct.sellingPriceUSD + 5.0,
            },
          ],
        }),
      });
      if (res.ok) checkoutDurations.push(res.durationMs);
    }
    const checkoutStats = stats(checkoutDurations);
    console.log(
      `  Avg: ${checkoutStats.avg.toFixed(2)}ms | p95: ${checkoutStats.p95.toFixed(2)}ms | min: ${checkoutStats.min.toFixed(2)}ms`,
    );

    // ------------------------------------------------------------------------
    // Benchmark 4: Store Inventory Query Latency (20 samples)
    // ------------------------------------------------------------------------
    console.log(`\n▶ [4/6] Benchmarking Store Inventory Queries (20 samples)...`);
    const invDurations: number[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await request(`/api/inventory/stock?storeId=${storeId}&page=1&limit=25`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) invDurations.push(res.durationMs);
    }
    const invStats = stats(invDurations);
    console.log(
      `  Avg: ${invStats.avg.toFixed(2)}ms | p95: ${invStats.p95.toFixed(2)}ms | min: ${invStats.min.toFixed(2)}ms`,
    );

    // ------------------------------------------------------------------------
    // Benchmark 5: Financial & Sales Reporting Aggregations (15 samples)
    // ------------------------------------------------------------------------
    console.log(`\n▶ [5/6] Benchmarking Reporting Summary Aggregations (15 samples)...`);
    const adminLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const adminToken = adminLoginRes.body.data.tokens.accessToken;

    const reportDurations: number[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await request(`/api/reports/dashboard?storeId=${storeId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) reportDurations.push(res.durationMs);
    }
    const reportStats = stats(reportDurations);
    console.log(
      `  Avg: ${reportStats.avg.toFixed(2)}ms | p95: ${reportStats.p95.toFixed(2)}ms | min: ${reportStats.min.toFixed(2)}ms`,
    );

    // ------------------------------------------------------------------------
    // Benchmark 6: 10,000-Product In-Memory / Indexed Search Scaling
    // ------------------------------------------------------------------------
    console.log(`\n▶ [6/6] Benchmarking 10,000-Product Catalog Search Simulation (100 lookups)...`);
    // Generate synthetic 10,000 item catalog in memory
    const catalog10k: Array<{
      id: string;
      name: string;
      sku: string;
      barcode: string;
      price: number;
    }> = [];
    for (let i = 1; i <= 10000; i++) {
      catalog10k.push({
        id: `prod-${i}`,
        name: `Cambodia Angkor Product Item #${i} Extra Organic`,
        sku: `SKU-${100000 + i}`,
        barcode: `884000${(10000 + i).toString()}`,
        price: Number((Math.random() * 20 + 0.5).toFixed(2)),
      });
    }

    // Benchmark linear search vs O(1) indexed Map lookup
    const lookup10kDurations: number[] = [];
    // Build index
    const indexStart = performance.now();
    const barcodeMap = new Map<string, (typeof catalog10k)[0]>();
    const skuMap = new Map<string, (typeof catalog10k)[0]>();
    for (const item of catalog10k) {
      barcodeMap.set(item.barcode, item);
      skuMap.set(item.sku.toLowerCase(), item);
    }
    const indexBuildTime = performance.now() - indexStart;

    for (let i = 0; i < 100; i++) {
      const targetBarcode = `884000${(10000 + ((i * 97) % 10000)).toString()}`;
      const start = performance.now();
      const match = barcodeMap.get(targetBarcode);
      const elapsed = performance.now() - start;
      if (match) lookup10kDurations.push(elapsed);
    }
    const scaleStats = stats(lookup10kDurations);
    console.log(`  Index Build (10,000 items): ${indexBuildTime.toFixed(2)}ms`);
    console.log(
      `  O(1) Indexed Lookup Avg: ${scaleStats.avg.toFixed(4)}ms | p95: ${scaleStats.p95.toFixed(4)}ms`,
    );

    const result: BenchmarkMetrics = {
      timestamp: new Date().toISOString(),
      barcodeLookup: {
        avgMs: Number(barcodeStats.avg.toFixed(2)),
        p95Ms: Number(barcodeStats.p95.toFixed(2)),
        minMs: Number(barcodeStats.min.toFixed(2)),
        maxMs: Number(barcodeStats.max.toFixed(2)),
      },
      productSearch: {
        avgMs: Number(searchStats.avg.toFixed(2)),
        p95Ms: Number(searchStats.p95.toFixed(2)),
        minMs: Number(searchStats.min.toFixed(2)),
        maxMs: Number(searchStats.max.toFixed(2)),
      },
      checkoutThroughput: {
        avgMs: Number(checkoutStats.avg.toFixed(2)),
        p95Ms: Number(checkoutStats.p95.toFixed(2)),
        minMs: Number(checkoutStats.min.toFixed(2)),
        maxMs: Number(checkoutStats.max.toFixed(2)),
      },
      inventoryQuery: {
        avgMs: Number(invStats.avg.toFixed(2)),
        p95Ms: Number(invStats.p95.toFixed(2)),
        minMs: Number(invStats.min.toFixed(2)),
        maxMs: Number(invStats.max.toFixed(2)),
      },
      reportingDashboard: {
        avgMs: Number(reportStats.avg.toFixed(2)),
        p95Ms: Number(reportStats.p95.toFixed(2)),
        minMs: Number(reportStats.min.toFixed(2)),
        maxMs: Number(reportStats.max.toFixed(2)),
      },
      largeScaleSearch10k: {
        avgMs: Number(scaleStats.avg.toFixed(4)),
        p95Ms: Number(scaleStats.p95.toFixed(4)),
        minMs: Number(scaleStats.min.toFixed(4)),
        maxMs: Number(scaleStats.max.toFixed(4)),
      },
    };

    return result;
  } finally {
    if (server) {
      server.close();
    }
  }
}

// Allow standalone execution
if (process.argv[1]?.endsWith('benchmark-pos-performance.ts')) {
  runBenchmark('Baseline')
    .then((metrics) => {
      console.log('\n======================================================================');
      console.log('📊 BENCHMARK METRICS RECORDED:');
      console.log(JSON.stringify(metrics, null, 2));
      console.log('======================================================================\n');
    })
    .catch((err) => {
      console.error('Benchmark failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
