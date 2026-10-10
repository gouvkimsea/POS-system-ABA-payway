'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';
import {
  Package,
  BarChart2,
  ArrowLeftRight,
  ClipboardList,
  MapPin,
  Tag,
  Search,
  Truck,
  Building2,
  ShoppingCart,
  Home,
  LogOut,
} from 'lucide-react';

export type InventoryTab =
  | 'products'
  | 'stock'
  | 'adjustments'
  | 'movements'
  | 'locations'
  | 'classifications';

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

  const navItems: { id: InventoryTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'products', label: 'Products', icon: Package, badge: totalProductsCount },
    {
      id: 'stock',
      label: 'Stock Levels',
      icon: BarChart2,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    { id: 'adjustments', label: 'Adjustments & Transfers', icon: ArrowLeftRight },
    { id: 'movements', label: 'Stock Movements', icon: ClipboardList },
    { id: 'locations', label: 'Locations', icon: MapPin },
    { id: 'classifications', label: 'Categories & Suppliers', icon: Tag },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30">
      {/* Top Utility Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & System Title */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-base">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base tracking-tight text-white">
                    Inventory
                  </span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Back-Office
                  </span>
                </div>
                <p className="text-xs text-slate-400">Angkor Fresh Mart</p>
              </div>
            </Link>
          </div>

          {/* Quick Barcode Scanner Input */}
          <form
            onSubmit={handleBarcodeSubmit}
            className="hidden md:flex items-center flex-1 max-w-md mx-4"
          >
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={quickBarcode}
                onChange={(e) => setQuickBarcode(e.target.value)}
                placeholder="Scan or enter barcode (e.g. 8840001001)..."
                className="w-full pl-9 pr-16 py-1.5 bg-slate-950 text-sm rounded-lg border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 text-white placeholder-slate-500 transition"
              />
              <button
                type="submit"
                className="absolute right-1 top-1 bottom-1 px-3 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold rounded text-white transition flex items-center"
              >
                Find
              </button>
            </div>
          </form>

          {/* Right Navigation & User Actions */}
          <div className="flex items-center space-x-2">
            <Link
              href="/inventory/transfers"
              className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition"
            >
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <span>Transfers</span>
            </Link>

            <Link
              href="/settings/stores"
              className="hidden lg:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Branches</span>
            </Link>

            <Link
              href="/pos"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>POS</span>
            </Link>

            <Link
              href="/"
              className="hidden sm:inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-medium transition"
            >
              <Home className="w-3.5 h-3.5 text-slate-400" />
              <span>Dashboard</span>
            </Link>

            {user && (
              <div className="flex items-center pl-2 border-l border-slate-800 space-x-2">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium text-slate-200">{user.fullName}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                    {user.roles.join(', ')}
                  </p>
                </div>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none border-t border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isActive
                        ? 'bg-emerald-800 text-emerald-100'
                        : item.id === 'stock' && lowStockCount > 0
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
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
