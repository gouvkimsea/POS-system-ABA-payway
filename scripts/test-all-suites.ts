/**
 * ==============================================================================
 * Master Automated Test Orchestrator & Comprehensive Quality Dashboard
 * ==============================================================================
 * Executes the entire automated test strategy across all layers:
 *
 * 1. Unit Test Suite (Zod, Math, Cryptography, Tokens, Locks, Hardware Encoders)
 * 2. Database & ACID Isolation Suite (Tenancy, Rollbacks, Ledger, Foreign Keys)
 * 3. End-to-End Business Scenarios (Scenarios 1 through 6)
 * 4. Edge Cases Suite (11 critical edge cases)
 * 5. Responsive UI & Viewport Ergonomics Suite (6 device profiles & WCAG compliance)
 * 6. Auth & RBAC Security Suite
 * 7. POS Core Workflow Suite
 * 8. Transaction Engine & Payment Abstraction Suite
 * 9. Inventory Ledger & Stock Movement Suite
 * 10. Cash Register & Shift Sessions Suite
 * 11. Customer Returns & Refunds API Suite
 * 12. Hardware Device Bridge Suite
 * 13. Offline Synchronization Engine Suite
 * 14. Financial & Inventory Reporting Suite
 * 15. Security Hardening Suite
 * ==============================================================================
 */

import { spawn } from 'child_process';
import path from 'path';

interface SuiteResult {
  name: string;
  category: string;
  script: string;
  durationMs: number;
  passed: boolean;
  exitCode: number;
}

const SUITES = [
  { name: 'Unit Tests Suite', category: 'Unit', script: 'scripts/test-unit-suite.ts' },
  {
    name: 'Database & ACID Isolation',
    category: 'Database',
    script: 'scripts/test-database-suite.ts',
  },
  {
    name: 'End-to-End Business Scenarios (1-6)',
    category: 'E2E',
    script: 'scripts/test-e2e-scenarios.ts',
  },
  {
    name: 'Edge Cases (11 Scenarios)',
    category: 'Edge Cases',
    script: 'scripts/test-edge-cases.ts',
  },
  {
    name: 'Responsive UI & Touch Ergonomics',
    category: 'UI / UX',
    script: 'scripts/test-responsive-ui.ts',
  },
  {
    name: 'Authentication & Session Security',
    category: 'Auth',
    script: 'scripts/test-auth-integration.ts',
  },
  {
    name: 'POS Core Terminal Workflow',
    category: 'POS',
    script: 'scripts/test-pos-integration.ts',
  },
  {
    name: 'Transaction Engine & Multi-Tender',
    category: 'Transactions',
    script: 'scripts/test-transaction-engine.ts',
  },
  {
    name: 'Inventory Ledger & Stock Transfers',
    category: 'Inventory',
    script: 'scripts/test-inventory-integration.ts',
  },
  {
    name: 'Cash Register & Shift Sessions',
    category: 'Register',
    script: 'scripts/test-register-sessions.ts',
  },
  {
    name: 'Customer Returns & Refund Engine',
    category: 'Refunds',
    script: 'scripts/test-http-api-customer-returns.ts',
  },
  {
    name: 'Hardware Bridge & ESC/POS Printers',
    category: 'Hardware',
    script: 'scripts/test-hardware-integration.ts',
  },
  {
    name: 'Offline Synchronization Engine',
    category: 'Sync',
    script: 'scripts/test-offline-sync.ts',
  },
  {
    name: 'Financial & Inventory Reporting',
    category: 'Reporting',
    script: 'scripts/test-reporting-system.ts',
  },
  {
    name: 'Security Hardening & Penetration',
    category: 'Security',
    script: 'scripts/test-security-suite.ts',
  },
  {
    name: 'Complete Settings System Suite',
    category: 'Settings',
    script: 'scripts/test-settings-system.ts',
  },
];

function runScript(scriptPath: string): Promise<{ exitCode: number; durationMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const isWindows = process.platform === 'win32';
    const child = spawn(
      isWindows ? 'cmd.exe' : 'pnpm',
      isWindows ? ['/c', 'pnpm', 'exec', 'tsx', scriptPath] : ['exec', 'tsx', scriptPath],
      {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: '1' },
      },
    );

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        durationMs: Date.now() - start,
      });
    });

    child.on('error', () => {
      resolve({
        exitCode: 1,
        durationMs: Date.now() - start,
      });
    });
  });
}

async function runAllSuites() {
  console.log(
    '╔════════════════════════════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║               ENTERPRISE POS SYSTEM - MASTER AUTOMATED TEST RUNNER                 ║',
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════════════════════╝\n',
  );

  const results: SuiteResult[] = [];
  const overallStart = Date.now();

  for (let i = 0; i < SUITES.length; i++) {
    const s = SUITES[i];
    console.log(`\n▶ [${i + 1}/${SUITES.length}] EXECUTING: ${s.name} (${s.script})...\n`);

    const { exitCode, durationMs } = await runScript(s.script);
    const passed = exitCode === 0;

    results.push({
      name: s.name,
      category: s.category,
      script: s.script,
      durationMs,
      passed,
      exitCode,
    });

    if (passed) {
      console.log(`\n  ✅ ${s.name} PASSED in ${(durationMs / 1000).toFixed(2)}s\n`);
    } else {
      console.error(
        `\n  ❌ ${s.name} FAILED with exit code ${exitCode} in ${(durationMs / 1000).toFixed(2)}s\n`,
      );
    }
  }

  const totalDuration = ((Date.now() - overallStart) / 1000).toFixed(2);
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;

  // Print Executive Summary Table
  console.log(
    '\n╔════════════════════════════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║                          AUTOMATED TESTING DASHBOARD                               ║',
  );
  console.log(
    '╠════════════════════════════════════════════╦══════════════╦═════════════╦══════════╣',
  );
  console.log(
    '║ Test Suite Name                            ║ Category     ║ Duration    ║ Status   ║',
  );
  console.log(
    '╠════════════════════════════════════════════╬══════════════╬═════════════╬══════════╣',
  );

  for (const r of results) {
    const namePad = r.name.padEnd(42);
    const catPad = r.category.padEnd(12);
    const durPad = `${(r.durationMs / 1000).toFixed(2)}s`.padEnd(11);
    const statusStr = r.passed ? '✓ PASSED' : '✗ FAILED';
    const statusPad = statusStr.padEnd(8);
    console.log(`║ ${namePad} ║ ${catPad} ║ ${durPad} ║ ${statusPad} ║`);
  }

  console.log(
    '╚════════════════════════════════════════════╩══════════════╩═════════════╩══════════╝\n',
  );
  console.log(`Total Suites Run:   ${SUITES.length}`);
  console.log(`Suites Passed:      ${totalPassed}`);
  console.log(`Suites Failed:      ${totalFailed}`);
  console.log(`Total Elapsed Time: ${totalDuration}s\n`);

  if (totalFailed > 0) {
    console.error(`💥 CRITICAL: ${totalFailed} test suite(s) failed. Aborting.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL 15 AUTOMATED TEST SUITES PASSED FLAWLESSLY WITH ZERO FAILURES!\n');
  }
}

runAllSuites().catch((err) => {
  console.error('Fatal Master Test Runner Error:', err);
  process.exit(1);
});
