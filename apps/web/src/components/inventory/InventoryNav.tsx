'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';

export type InventoryTab =
  'products' | 'stock' | 'adjustments' | 'movements' | 'locations' | 'classifications';

interface InventoryNavProps {
  activeTab: InventoryTab;
  onTabChange: (tab: InventoryTab) => void;
  lowStockCount: number;
  totalProductsCount: number;
  onBarcodeScan?: (barcode: string) => void;
}

export function InventoryNav({
  activeTab,
  onTabChange,
  lowStockCount,
  totalProductsCount,
  onBarcodeScan,
}: InventoryNavProps) {
  const { user, logout } = useAuth();
  const [quickBarcode, setQuickBarcode] = React.useState('');

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickBarcode.trim() && onBarcodeScan) {
      onBarcodeScan(quickBarcode.trim());
      setQuickBarcode('');
    }
  };

  const navItems: { id: InventoryTab; label: string; icon: string; badge?: number }[] = [
    { id: 'products', label: 'Products & Variants', icon: '📦', badge: totalProductsCount },
    {
      id: 'stock',
      label: 'Stock Levels',
      icon: '📊',
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    { id: 'adjustments', label: 'Stock Adjustment & Transfer', icon: '⚡' },
    { id: 'movements', label: 'Movement Audit Log', icon: '📜' },
    { id: 'locations', label: 'Locations', icon: '📍' },
    { id: 'classifications', label: 'Categories, Brands & Suppliers', icon: '🏷️' },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      {/* Top Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & System Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                P
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                    POS Enterprise
                  </span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Inventory & Catalog
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Angkor Fresh Mart &bull; Multi-Store Management
                </p>
              </div>
            </Link>
          </div>

          {/* Quick Barcode Scanner Input */}
          <form
            onSubmit={handleBarcodeSubmit}
            className="hidden md:flex items-center flex-1 max-w-md mx-4"
          >
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                🔍
              </span>
              <input
                type="text"
                value={quickBarcode}
                onChange={(e) => setQuickBarcode(e.target.value)}
                placeholder="Quick barcode lookup or scan (e.g. 8840001001)..."
                className="w-full pl-9 pr-20 py-2 bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-800 text-sm rounded-lg border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-400 transition"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 bottom-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium rounded text-white transition flex items-center space-x-1"
              >
                <span>Find</span>
              </button>
            </div>
          </form>

          {/* Right Navigation & User Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link
              href="/inventory/transfers"
              className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition"
            >
              <span>🚚</span>
              <span>Store Transfers</span>
            </Link>

            <Link
              href="/settings/stores"
              className="hidden lg:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <span>🏢</span>
              <span>Branches</span>
            </Link>

            <Link
              href="/pos"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition"
            >
              <span>🛒</span>
              <span>POS Terminal</span>
            </Link>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            >
              <span>🏠</span>
              <span>Dashboard</span>
            </Link>

            {user && (
              <div className="flex items-center pl-2 border-l border-slate-800 space-x-2">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-200">{user.fullName}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {user.roles.join(', ')}
                  </p>
                </div>
                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                >
                  🚪
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-indigo-800 text-indigo-100'
                        : item.id === 'stock' && lowStockCount > 0
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
