'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusBadge, Card, Button } from '@pos/ui';
import { SystemHealthCheck } from '@pos/types';
import { useAuth } from '../lib/auth-context';
import { AuthGuard } from '../components/AuthGuard';
import {
  ShoppingCart,
  Package,
  BarChart3,
  Coins,
  Truck,
  Building2,
  Users,
  Settings,
  RefreshCw,
  Cpu,
  LogOut,
  Store,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<SystemHealthCheck | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      case 'MANAGER':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
      case 'CASHIER':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const quickModules = [
    {
      title: 'POS Terminal',
      description: 'Point-of-sale register, barcode scanning, cart & checkout',
      href: '/pos',
      icon: ShoppingCart,
      actionText: 'Open Terminal',
      primary: true,
    },
    {
      title: 'Inventory & Catalog',
      description: 'Product catalog, variant stock levels, barcode lookups',
      href: '/inventory',
      icon: Package,
      actionText: 'Manage Stock',
    },
    {
      title: 'Reports & Analytics',
      description: 'Sales summaries, hourly velocity, cashier performance',
      href: '/reports',
      icon: BarChart3,
      actionText: 'View Reports',
    },
    {
      title: 'Shift Reconciliations',
      description: 'Cash drawer sessions, opening float & closing audits',
      href: '/reports/register-sessions',
      icon: Coins,
      actionText: 'Audit Shifts',
    },
    {
      title: 'Stock Transfers',
      description: 'Inter-store transfer shipments and receiving manifests',
      href: '/inventory/transfers',
      icon: Truck,
      actionText: 'Manage Transfers',
    },
    {
      title: 'Customer Directory',
      description: 'Customer profiles, purchase histories & loyalty records',
      href: '/customers',
      icon: Users,
      actionText: 'View Customers',
    },
    {
      title: 'Store Branches',
      description: 'Branch locations, assigned cash registers and staff',
      href: '/settings/stores',
      icon: Building2,
      actionText: 'Configure Stores',
    },
    {
      title: 'Hardware & Peripherals',
      description: 'Thermal receipt printer, barcode scanner & cash drawer',
      href: '/settings/hardware',
      icon: Cpu,
      actionText: 'Configure Devices',
    },
    {
      title: 'Offline Sync Monitor',
      description: 'IndexedDB offline queue and automatic synchronization',
      href: '/settings/sync',
      icon: RefreshCw,
      actionText: 'Check Sync State',
    },
    {
      title: 'System Settings',
      description: 'Business details, tax rates, currency policy & preferences',
      href: '/settings',
      icon: Settings,
      actionText: 'System Settings',
    },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 pb-24 lg:pb-8">
      {/* Top Header Bar */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
            {user?.fullName
              ? user.fullName[0].toUpperCase()
              : user?.username?.[0].toUpperCase() || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-100">
                {user?.fullName || user?.username}
              </h1>
              {user?.roles?.map((role) => (
                <span
                  key={role}
                  className={`text-xs px-2.5 py-0.5 rounded font-semibold border ${getRoleBadge(
                    role,
                  )}`}
                >
                  {role}
                </span>
              ))}
              <span className="bg-emerald-950/70 text-emerald-300 border border-emerald-800/80 text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Active Session
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>@{user?.username}</span>
              {user?.email && (
                <>
                  <span>&bull;</span>
                  <span>{user.email}</span>
                </>
              )}
              <span>&bull;</span>
              <span className="text-slate-500">Angkor Fresh Mart</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <Link
            href="/pos"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Open POS Terminal</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm('Are you sure you want to log out of your session?')) {
                logout();
              }
            }}
            className="text-rose-400 hover:bg-rose-950/30 hover:border-rose-800"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Retail Operations Modules */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Retail Operations"
            description="Operational modules and daily management functions"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickModules.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`p-4 rounded-xl border transition-colors flex flex-col justify-between ${
                      item.primary
                        ? 'bg-slate-850 border-indigo-500/40 hover:border-indigo-400'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div
                          className={`p-2 rounded-lg ${
                            item.primary
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <h2 className="text-sm font-semibold text-slate-100">{item.title}</h2>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">
                        {item.description}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span
                        className={`font-medium ${
                          item.primary ? 'text-indigo-400' : 'text-slate-400'
                        }`}
                      >
                        {item.actionText}
                      </span>
                      <span className="text-slate-500">&rarr;</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          {/* User Roles & Permissions Info */}
          <Card
            title="Your Permissions"
            description="Permissions assigned to your account"
          >
            <div className="flex flex-wrap gap-1.5">
              {user?.permissions?.map((perm) => (
                <span
                  key={perm}
                  className="inline-flex items-center px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs border border-slate-700"
                >
                  {perm}
                </span>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column (1 span): Operational Context & System Status */}
        <div className="space-y-6">
          {/* Store Branch Context */}
          <Card
            title="Branch & Currency"
            description="Settings for this location"
          >
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-850 rounded-lg border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <Store className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Assigned Store:</span>
                </div>
                <span className="font-semibold text-slate-100">Monivong Central Branch</span>
              </div>

              <div className="p-3 bg-slate-850 rounded-lg border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Exchange Rate:</span>
                </div>
                <span className="font-mono font-bold text-amber-400">1 USD = 4,100 KHR</span>
              </div>

              <div className="p-3 bg-slate-850 rounded-lg border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Timezone:</span>
                </div>
                <span className="font-mono text-slate-300">Asia/Phnom_Penh (UTC+7)</span>
              </div>

              <div className="p-3 bg-slate-850 rounded-lg border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Access Control:</span>
                </div>
                <span className="text-emerald-400 font-semibold">Active</span>
              </div>
            </div>
          </Card>

          {/* Backend Services Connection Status */}
          <Card title="Connection Status" description={`API: ${apiUrl}/health`}>
            {healthLoading && !health && !healthError && (
              <div className="py-6 text-center text-slate-500 text-xs">
                Checking connection to services...
              </div>
            )}

            {healthError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
                <div className="font-semibold flex items-center gap-2 mb-1">
                  <StatusBadge status="disconnected" label="Offline" />
                  Connection Failed
                </div>
                <p className="text-[11px] text-rose-400">{healthError}</p>
              </div>
            )}

            {health && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-slate-850 rounded-md border border-slate-800">
                  <div className="text-xs font-medium text-slate-200">API</div>
                  <StatusBadge status={health.status} />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-850 rounded-md border border-slate-800">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Database</div>
                    <div className="text-[11px] text-slate-400">
                      {health.services.database.latencyMs !== undefined
                        ? `Latency: ${health.services.database.latencyMs}ms`
                        : 'Connected'}
                    </div>
                  </div>
                  <StatusBadge status={health.services.database.status} />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-850 rounded-md border border-slate-800">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Cache</div>
                    <div className="text-[11px] text-slate-400">
                      {health.services.redis.status === 'in-memory-fallback'
                        ? 'Memory Cache'
                        : 'Redis Connected'}
                    </div>
                  </div>
                  <StatusBadge status={health.services.redis.status} />
                </div>

                <div className="pt-2 text-[11px] text-slate-500 flex justify-between">
                  <span>Uptime: {health.uptimeSeconds}s</span>
                  <span>Checked: {lastChecked}</span>
                </div>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-800 flex justify-end">
              <Button variant="outline" size="sm" onClick={checkHealth} disabled={healthLoading}>
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${healthLoading ? 'animate-spin' : ''}`}
                />
                {healthLoading ? 'Checking...' : 'Check Status'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="mt-8 p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div>
          Angkor Fresh Mart &bull; POS System &bull; USD / KHR Dual Currency
        </div>
        <div className="text-slate-500">Dashboard</div>
      </footer>
    </main>
  );
}
