'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import {
  ShoppingCart,
  Package,
  Truck,
  BarChart3,
  Menu,
  X,
  Coins,
  Building2,
  Cpu,
  RefreshCw,
  LogOut,
  Home,
  Sliders,
  Users,
} from 'lucide-react';
import { PwaInstallPrompt } from './PwaInstallPrompt';

interface BottomNavigationProps {
  /** If true, the bottom nav leaves extra space or integrates with POS mobile cart */
  isPosPage?: boolean;
}

export function BottomNavigation({ isPosPage: _isPosPage = false }: BottomNavigationProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState<boolean>(false);

  // Do not render bottom nav on login, customer display, or when unauthenticated
  if (!user || pathname === '/login' || pathname === '/customer-display') {
    return null;
  }

  // Define primary navigation items
  const navItems = [
    {
      label: 'POS',
      href: '/pos',
      icon: ShoppingCart,
      isActive: pathname === '/pos',
    },
    {
      label: 'Inventory',
      href: '/inventory',
      icon: Package,
      isActive: pathname?.startsWith('/inventory') && !pathname?.startsWith('/inventory/transfers'),
    },
    {
      label: 'Transfers',
      href: '/inventory/transfers',
      icon: Truck,
      isActive: pathname === '/inventory/transfers',
    },
    {
      label: 'Reports',
      href: '/reports',
      icon: BarChart3,
      isActive: pathname?.startsWith('/reports'),
    },
  ];

  return (
    <>
      {/* 1. Mobile Bottom Navigation Bar (< 1024px) */}
      <nav
        aria-label="Mobile Navigation Bar"
        className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 z-30 pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="flex items-center justify-around h-14 px-1 max-w-lg mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-colors ${
                  item.isActive
                    ? 'text-emerald-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div
                  className={`p-1 rounded-lg ${
                    item.isActive ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' : ''
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* More Menu Trigger */}
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(true)}
            className="flex-1 flex flex-col items-center justify-center h-full min-h-[48px] py-1 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <div className="p-1 rounded-lg">
              <Menu className="w-4 h-4" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* 2. Slide-up "More" Drawer for Secondary Actions */}
      {isMoreMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/70 flex flex-col justify-end"
          onClick={() => setIsMoreMenuOpen(false)}
        >
          <div
            className="bg-slate-900 border-t border-slate-800 rounded-t-2xl p-5 max-h-[85dvh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white">Menu</h3>
                <p className="text-[11px] text-slate-400">
                  {user?.fullName || 'Cashier'} &bull; {user?.roles?.join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu Links Grid */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Link
                href="/"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-3 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-xs font-medium text-slate-200 hover:bg-slate-750 transition min-h-[44px]"
              >
                <Home className="w-4 h-4 text-emerald-400" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/settings/stores"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-3 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-xs font-medium text-slate-200 hover:bg-slate-750 transition min-h-[44px]"
              >
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>Branches</span>
              </Link>

              <Link
                href="/reports/register-sessions"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-3 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-xs font-medium text-slate-200 hover:bg-slate-750 transition min-h-[44px]"
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Shift Reports</span>
              </Link>

              <Link
                href="/settings/sync"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-3 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-xs font-medium text-slate-200 hover:bg-slate-750 transition min-h-[44px]"
              >
                <RefreshCw className="w-4 h-4 text-slate-400" />
                <span>Offline Sync</span>
              </Link>

              <Link
                href="/settings/hardware"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-3 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-xs font-medium text-slate-200 hover:bg-slate-750 transition min-h-[44px]"
              >
                <Cpu className="w-4 h-4 text-slate-400" />
                <span>Hardware</span>
              </Link>

              <Link
                href="/customers"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-3 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-xs font-medium text-slate-200 hover:bg-slate-750 transition min-h-[44px]"
              >
                <Users className="w-4 h-4 text-slate-400" />
                <span>Customers</span>
              </Link>

              <Link
                href="/settings"
                onClick={() => setIsMoreMenuOpen(false)}
                className="col-span-2 p-3 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center gap-2.5 text-xs font-medium text-slate-200 hover:bg-slate-750 transition min-h-[44px]"
              >
                <Sliders className="w-4 h-4 text-slate-400" />
                <span>Settings</span>
              </Link>
            </div>

            {/* PWA Install Button inside Drawer */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
              <PwaInstallPrompt />
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-800 text-xs font-medium hover:bg-rose-900/50 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
