'use client';

import React, { useEffect, useState } from 'react';
import { StatusBadge, Card, Button } from '@pos/ui';
import { SystemHealthCheck } from '@pos/types';
import { useAuth } from '../lib/auth-context';
import { AuthGuard } from '../components/AuthGuard';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

interface TestEndpointResult {
  endpoint: string;
  status: number | null;
  statusText: string;
  message: string;
  isSuccess: boolean | null;
  loading: boolean;
}

function DashboardContent() {
  const { user, token, logout } = useAuth();
  const [health, setHealth] = useState<SystemHealthCheck | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [showAllPermissions, setShowAllPermissions] = useState<boolean>(false);

  // Test endpoints state
  const [testResults, setTestResults] = useState<Record<string, TestEndpointResult>>({
    protected: {
      endpoint: '/api/auth/test/protected',
      status: null,
      statusText: '',
      message: 'Not tested yet',
      isSuccess: null,
      loading: false,
    },
    admin: {
      endpoint: '/api/auth/test/admin-only',
      status: null,
      statusText: '',
      message: 'Not tested yet',
      isSuccess: null,
      loading: false,
    },
    sales: {
      endpoint: '/api/auth/test/sales-only',
      status: null,
      statusText: '',
      message: 'Not tested yet',
      isSuccess: null,
      loading: false,
    },
    inventory: {
      endpoint: '/api/auth/test/inventory-only',
      status: null,
      statusText: '',
      message: 'Not tested yet',
      isSuccess: null,
      loading: false,
    },
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const checkHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch(`${apiUrl}/health`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: SystemHealthCheck = await res.json();
      setHealth(data);
    } catch (err: any) {
      setHealthError(err.message || 'Unable to reach API server');
      setHealth(null);
    } finally {
      setHealthLoading(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const runEndpointTest = async (key: string, path: string) => {
    setTestResults((prev) => ({
      ...prev,
      [key]: { ...prev[key], loading: true, message: 'Testing endpoint...' },
    }));

    try {
      const res = await fetch(`${apiUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await res.json().catch(() => ({}));
      const isSuccess = res.ok;
      const message =
        body.message || body.error?.message || `Status ${res.status}: ${res.statusText}`;

      setTestResults((prev) => ({
        ...prev,
        [key]: {
          endpoint: path,
          status: res.status,
          statusText: res.statusText,
          message,
          isSuccess,
          loading: false,
        },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          endpoint: path,
          status: 0,
          statusText: 'Network Error',
          message: err.message || 'Network request failed',
          isSuccess: false,
          loading: false,
        },
      }));
    }
  };

  const runAllTests = async () => {
    await Promise.all([
      runEndpointTest('protected', '/auth/test/protected'),
      runEndpointTest('admin', '/auth/test/admin-only'),
      runEndpointTest('sales', '/auth/test/sales-only'),
      runEndpointTest('inventory', '/auth/test/inventory-only'),
    ]);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'CASHIER':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 pb-24 lg:pb-8">
      {/* Top Navigation & User Header */}
      <header className="bg-white border border-slate-200 rounded-xl p-5 mb-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {user?.fullName
              ? user.fullName[0].toUpperCase()
              : user?.username?.[0].toUpperCase() || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">
                {user?.fullName || user?.username}
              </h1>
              {user?.roles?.map((role) => (
                <span
                  key={role}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getRoleBadgeColor(
                    role,
                  )}`}
                >
                  {role}
                </span>
              ))}
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Authenticated
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Username:{' '}
              <span className="font-mono text-slate-700 font-medium">@{user?.username}</span>
              {user?.email && (
                <>
                  {' '}
                  &bull; Email: <span className="text-slate-700">{user.email}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
          <a
            href="/reports"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/20 transition-all border border-indigo-400/30"
          >
            <span>📈 Reports &amp; Analytics</span>
          </a>

          <a
            href="/reports/register-sessions"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors border border-slate-700"
          >
            <span>📊 Shift Reports</span>
          </a>

          <a
            href="/settings/stores"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors border border-slate-700"
          >
            <span>🏢 Multi-Branch Stores</span>
          </a>

          <a
            href="/inventory/transfers"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-sky-900/40 hover:bg-sky-800/60 text-sky-200 rounded-lg text-xs font-bold shadow-xs transition-colors border border-sky-700/50"
          >
            <span>🚚 Stock Transfers</span>
          </a>

          <a
            href="/inventory"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <span>📦 Inventory &amp; Catalog</span>
          </a>

          <a
            href="/pos"
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <span>🛒 Open POS &rarr;</span>
          </a>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm('Are you sure you want to log out of your session?')) {
                logout();
              }
            }}
            className="text-rose-600 hover:bg-rose-50 hover:border-rose-300"
          >
            Log Out
          </Button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): RBAC & Guard Testing */}
        <div className="lg:col-span-2 space-y-6">
          {/* Real-time RBAC Guard Enforcement Tester */}
          <Card
            title="Backend Authorization Guard Verification"
            description="Live test proving that endpoints strictly reject unauthorized requests via API middleware guards"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Test each protected API route with your current bearer session token.
              </span>
              <Button variant="secondary" size="sm" onClick={runAllTests}>
                Run All Tests
              </Button>
            </div>

            <div className="space-y-3">
              {/* Test 1: Protected */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      GET /api/auth/test/protected
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                      Any Auth User
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{testResults.protected.message}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {testResults.protected.status !== null && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                        testResults.protected.isSuccess
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {testResults.protected.status}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testResults.protected.loading}
                    onClick={() => runEndpointTest('protected', '/auth/test/protected')}
                  >
                    {testResults.protected.loading ? '...' : 'Test'}
                  </Button>
                </div>
              </div>

              {/* Test 2: Admin Only */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      GET /api/auth/test/admin-only
                    </span>
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                      users.manage
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{testResults.admin.message}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {testResults.admin.status !== null && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                        testResults.admin.isSuccess
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {testResults.admin.status}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testResults.admin.loading}
                    onClick={() => runEndpointTest('admin', '/auth/test/admin-only')}
                  >
                    {testResults.admin.loading ? '...' : 'Test'}
                  </Button>
                </div>
              </div>

              {/* Test 3: Sales Only */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      GET /api/auth/test/sales-only
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                      sales.create
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{testResults.sales.message}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {testResults.sales.status !== null && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                        testResults.sales.isSuccess
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {testResults.sales.status}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testResults.sales.loading}
                    onClick={() => runEndpointTest('sales', '/auth/test/sales-only')}
                  >
                    {testResults.sales.loading ? '...' : 'Test'}
                  </Button>
                </div>
              </div>

              {/* Test 4: Inventory Only */}
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      GET /api/auth/test/inventory-only
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      inventory.adjust
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{testResults.inventory.message}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {testResults.inventory.status !== null && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                        testResults.inventory.isSuccess
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {testResults.inventory.status}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={testResults.inventory.loading}
                    onClick={() => runEndpointTest('inventory', '/auth/test/inventory-only')}
                  >
                    {testResults.inventory.loading ? '...' : 'Test'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <span className="font-bold shrink-0">Security Rule:</span>
              <span>
                Frontend checks control visual rendering, but every state-altering mutation or
                protected route is strictly guarded by backend middleware. Even if client-side code
                is bypassed, the API responds with 403 Forbidden.
              </span>
            </div>
          </Card>

          {/* Granular Permissions Display Card */}
          <Card
            title="Granular Permissions Granted"
            description={`Your account possesses ${user?.permissions?.length || 0} active permissions across the system`}
          >
            <div className="flex flex-wrap gap-1.5">
              {(showAllPermissions ? user?.permissions : user?.permissions?.slice(0, 10))?.map(
                (perm) => (
                  <span
                    key={perm}
                    className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono text-xs border border-slate-200"
                  >
                    &bull; {perm}
                  </span>
                ),
              )}
            </div>

            {user?.permissions && user.permissions.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllPermissions(!showAllPermissions)}
                className="mt-3 text-xs text-indigo-600 font-medium hover:underline focus:outline-none"
              >
                {showAllPermissions
                  ? 'Show fewer permissions'
                  : `+ Show ${user.permissions.length - 10} more permissions`}
              </button>
            )}
          </Card>
        </div>

        {/* Right Column (1 span): System Health & Monorepo Status */}
        <div className="space-y-6">
          {/* Backend & Services Connection Card */}
          <Card title="Full-Stack System Status" description={`API Endpoint: ${apiUrl}/health`}>
            {healthLoading && !health && !healthError && (
              <div className="py-6 text-center text-slate-500 text-xs">
                Connecting to backend services...
              </div>
            )}

            {healthError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                <div className="font-semibold flex items-center gap-2 mb-1">
                  <StatusBadge status="disconnected" label="Offline" />
                  Backend Connection Failed
                </div>
                <p className="text-[11px]">{healthError}</p>
              </div>
            )}

            {health && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md border border-slate-200">
                  <div className="text-xs font-medium text-slate-800">Overall System Health</div>
                  <StatusBadge status={health.status} />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md border border-slate-200">
                  <div>
                    <div className="text-xs font-medium text-slate-800">PostgreSQL Database</div>
                    <div className="text-[11px] text-slate-500">
                      {health.services.database.latencyMs !== undefined
                        ? `Latency: ${health.services.database.latencyMs}ms`
                        : 'Prisma Client Connected'}
                    </div>
                  </div>
                  <StatusBadge status={health.services.database.status} />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-md border border-slate-200">
                  <div>
                    <div className="text-xs font-medium text-slate-800">Redis Cache Layer</div>
                    <div className="text-[11px] text-slate-500">
                      {health.services.redis.status === 'in-memory-fallback'
                        ? 'Local In-Memory Cache Active'
                        : 'Standalone Redis Connected'}
                    </div>
                  </div>
                  <StatusBadge status={health.services.redis.status} />
                </div>

                <div className="pt-2 text-[11px] text-slate-400 flex justify-between">
                  <span>Uptime: {health.uptimeSeconds}s</span>
                  <span>Checked: {lastChecked}</span>
                </div>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
              <Button variant="outline" size="sm" onClick={checkHealth} disabled={healthLoading}>
                {healthLoading ? 'Testing...' : 'Refresh Health'}
              </Button>
            </div>
          </Card>

          {/* Monorepo Architecture Overview Card */}
          <Card title="Monorepo Workspaces" description="Verified package boundaries">
            <ul className="divide-y divide-slate-100 text-xs">
              <li className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-indigo-600">apps/web</span>
                  <p className="text-[11px] text-slate-500">Next.js 14 App Router, AuthContext</p>
                </div>
                <span className="font-medium text-emerald-600">Active</span>
              </li>
              <li className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-indigo-600">apps/api</span>
                  <p className="text-[11px] text-slate-500">Express, JWT, RBAC Middleware</p>
                </div>
                <span className="font-medium text-emerald-600">Active</span>
              </li>
              <li className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-indigo-600">packages/types</span>
                  <p className="text-[11px] text-slate-500">Shared Auth & Permission Contracts</p>
                </div>
                <span className="font-medium text-emerald-600">Linked</span>
              </li>
              <li className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-indigo-600">
                    packages/validation
                  </span>
                  <p className="text-[11px] text-slate-500">Zod Login & PIN Schemas</p>
                </div>
                <span className="font-medium text-emerald-600">Linked</span>
              </li>
              <li className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-indigo-600">prisma/</span>
                  <p className="text-[11px] text-slate-500">PostgreSQL Schema & UserSessions</p>
                </div>
                <span className="font-medium text-emerald-600">Linked</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="mt-8 p-4 bg-slate-100 rounded-lg text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div>
          Localization:{' '}
          <span className="font-semibold text-slate-800">USD & KHR (1 USD = 4,100 KHR)</span> &bull;
          Timezone: <span className="font-semibold text-slate-800">Asia/Phnom_Penh</span>
        </div>
        <div>POS System &bull; Auth & RBAC Security Layer</div>
      </footer>
    </main>
  );
}
