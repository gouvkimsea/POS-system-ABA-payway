'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatusBadge, Button } from '@pos/ui';
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
  ChevronRight,
  MonitorCheck,
  HardDrive,
  Database,
  ArrowUpRight,
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
        return 'bg-purple-950/70 text-purple-300 border-purple-800/60';
      case 'MANAGER':
        return 'bg-blue-950/70 text-blue-300 border-blue-800/60';
      case 'CASHIER':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  interface ModuleItem {
    title: string;
    description: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    isPrimary?: boolean;
  }

  interface OperationalSection {
    title: string;
    description: string;
    items: ModuleItem[];
  }

  const operationalSections: OperationalSection[] = [
    {
      title: 'Counter & Register Operations',
      description: 'Point-of-sale terminal execution, drawer sessions, and shift audits',
      items: [
        {
          title: 'POS Terminal',
          description: 'Primary barcode scanning, dual-currency cash & card payments, hold orders',
          href: '/pos',
          icon: ShoppingCart,
          badge: 'Counter Register',
          isPrimary: true,
        },
        {
          title: 'Shift Reconciliations',
          description: 'Cash drawer opening floats, cash drops, and shift closing Z-reports',
          href: '/reports/register-sessions',
          icon: Coins,
          badge: 'Cash Audit',
        },
      ],
    },
    {
      title: 'Merchandise & Inventory',
      description: 'Stock tracking, variant pricing, barcode lookups, and branch logistics',
      items: [
        {
          title: 'Product Catalog & Stock',
          description: 'Catalog management, stock level audits, category mapping, barcodes',
          href: '/inventory',
          icon: Package,
        },
        {
          title: 'Inter-Store Transfers',
          description: 'Transfer shipments, receiving manifests, and audit tracking',
          href: '/inventory/transfers',
          icon: Truck,
        },
      ],
    },
    {
      title: 'Sales Intelligence & CRM',
      description: 'Revenue totals, hourly velocity metrics, and customer profiles',
      items: [
        {
          title: 'Reports & Analytics',
          description: 'Daily revenue, hourly volume, tax summaries, and cashier velocity',
          href: '/reports',
          icon: BarChart3,
        },
        {
          title: 'Customer Directory',
          description: 'Customer profiles, purchase records, and loyalty accounts',
          href: '/customers',
          icon: Users,
        },
      ],
    },
    {
      title: 'System & Peripheral Configuration',
      description: 'Hardware devices, local offline database sync, and store branches',
      items: [
        {
          title: 'Hardware & Peripherals',
          description: 'Thermal receipt printers, cash drawers, barcode wedge, pole display',
          href: '/settings/hardware',
          icon: Cpu,
        },
        {
          title: 'Offline Sync Monitor',
          description: 'IndexedDB local transactions queue and background replication',
          href: '/settings/sync',
          icon: RefreshCw,
        },
        {
          title: 'Store Branches',
          description: 'Branch locations, cash register IDs, and station assignments',
          href: '/settings/stores',
          icon: Building2,
        },
        {
          title: 'System Settings',
          description: 'Dual currency exchange rate (USD/KHR), VAT rate, business identity',
          href: '/settings',
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 pb-24 lg:pb-8">
      {/* Top Header Bar */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-base shrink-0">
            {user?.fullName
              ? user.fullName[0].toUpperCase()
              : user?.username?.[0].toUpperCase() || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-100">
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
              <span className="text-slate-300 font-medium">Angkor Fresh Mart</span>
              <span>&bull;</span>
              <span className="text-slate-400">Monivong Central Branch</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <Link
            href="/pos"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Launch POS Terminal</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 spans): Operational Modules Grouped by Function */}
        <div className="lg:col-span-2 space-y-7">
          {operationalSections.map((section) => (
            <section key={section.title} className="space-y-3">
              <div className="flex items-baseline justify-between border-b border-slate-800 pb-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                    {section.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">{section.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        item.isPrimary
                          ? 'bg-slate-900 border-indigo-500/40 hover:border-indigo-400/80 hover:bg-slate-850'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850/60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-2 rounded-lg border ${
                                item.isPrimary
                                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                              {item.title}
                            </h3>
                          </div>
                          {item.badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/60">
                              {item.badge}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed mb-3">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-slate-200">
                        <span className="font-medium text-slate-400 group-hover:text-indigo-300 transition-colors">
                          Open module
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Right Column (1 span): Operational Context, Connectivity & User Permissions */}
        <div className="space-y-6">
          {/* Store Branch Context */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Store Environment
              </h2>
              <span className="text-[11px] text-slate-400">Monivong Central</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-850/80 rounded-lg border border-slate-800/90 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <Store className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Assigned Store:</span>
                </div>
                <span className="font-semibold text-slate-100">Central Mart #01</span>
              </div>

              <div className="p-3 bg-slate-850/80 rounded-lg border border-slate-800/90 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Exchange Rate:</span>
                </div>
                <span className="font-mono font-bold text-amber-400">1 USD = 4,100 KHR</span>
              </div>

              <div className="p-3 bg-slate-850/80 rounded-lg border border-slate-800/90 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Timezone:</span>
                </div>
                <span className="font-mono text-slate-300">Asia/Phnom_Penh (UTC+7)</span>
              </div>

              <div className="p-3 bg-slate-850/80 rounded-lg border border-slate-800/90 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Access Control:</span>
                </div>
                <span className="text-emerald-400 font-semibold">Active & Enforced</span>
              </div>
            </div>
          </div>

          {/* Backend Services Connection Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  System Health
                </h2>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{apiUrl}/health</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={checkHealth}
                disabled={healthLoading}
                className="text-[11px] h-7 px-2"
              >
                <RefreshCw
                  className={`w-3 h-3 mr-1 ${healthLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>

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
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-slate-850/80 rounded-lg border border-slate-800/90">
                  <div className="flex items-center gap-2 text-slate-300">
                    <MonitorCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-medium">API Service</span>
                  </div>
                  <StatusBadge status={health.status} />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-850/80 rounded-lg border border-slate-800/90">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    <div>
                      <span className="font-medium">PostgreSQL</span>
                      <span className="text-[11px] text-slate-400 block">
                        {health.services.database.latencyMs !== undefined
                          ? `Latency: ${health.services.database.latencyMs}ms`
                          : 'Connected'}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={health.services.database.status} />
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-850/80 rounded-lg border border-slate-800/90">
                  <div className="flex items-center gap-2 text-slate-300">
                    <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                    <div>
                      <span className="font-medium">State & Cache</span>
                      <span className="text-[11px] text-slate-400 block">
                        {health.services.redis.status === 'in-memory-fallback'
                          ? 'In-Memory State Store'
                          : 'Redis Cluster'}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={health.services.redis.status} />
                </div>

                <div className="pt-2 text-[11px] text-slate-500 flex justify-between font-mono">
                  <span>Uptime: {health.uptimeSeconds}s</span>
                  <span>Checked: {lastChecked}</span>
                </div>
              </div>
            )}
          </div>

          {/* User Roles & Permissions Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Assigned Authorizations
              </h2>
              <span className="text-[11px] text-slate-400">
                {user?.permissions?.length || 0} scopes
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {user?.permissions?.map((perm) => (
                <span
                  key={perm}
                  className="inline-flex items-center px-2 py-0.5 rounded bg-slate-850 text-slate-300 font-mono text-[11px] border border-slate-700/80"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="mt-12 pt-6 border-t border-slate-800/80 text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">Angkor Fresh Mart</span>
          <span>&bull;</span>
          <span>Point-of-Sale Workstation</span>
          <span>&bull;</span>
          <span className="font-mono text-amber-400/90">USD / KHR Dual Currency</span>
        </div>
        <div className="text-slate-500 font-mono text-[11px]">
          Build v1.0.0 &bull; Central Branch #01
        </div>
      </footer>
    </main>
  );
}
