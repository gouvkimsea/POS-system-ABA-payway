'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../components/AuthGuard';
import { useAuth } from '../../lib/auth-context';
import {
  ReportingDashboardSummary,
  SalesTimeSeriesRow,
  ProductSalesReportRow,
  CategorySalesReportRow,
  CashierSalesReportRow,
  PaymentMethodReportRow,
  InventoryReportRow,
  StockMovementReportRow,
  RefundReportRow,
  RegisterSessionReportRow,
  ProfitEstimateReport,
} from '@pos/types';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  RotateCcw,
  Package,
  Layers,
  Users,
  CreditCard,
  History,
  Archive,
  Calculator,
  Download,
  RefreshCw,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Building2,
  FileSpreadsheet,
  FileText,
  Coins,
  ShieldAlert,
} from 'lucide-react';

export default function ReportsDashboardPage() {
  return (
    <AuthGuard requiredPermission="reports.view">
      <ReportsContent />
    </AuthGuard>
  );
}

type TabType =
  | 'dashboard'
  | 'sales_daily'
  | 'sales_weekly'
  | 'sales_monthly'
  | 'products'
  | 'categories'
  | 'cashiers'
  | 'payments'
  | 'inventory'
  | 'stock_movements'
  | 'refunds'
  | 'registers'
  | 'profit';

interface FilterMeta {
  stores: { id: string; name: string; code: string }[];
  cashiers: { id: string; fullName: string; username: string }[];
  paymentMethods: { id: string; code: string; name: string }[];
}

function ReportsContent() {
  const { token, user } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  // Navigation & View
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Filter States
  const [datePreset, setDatePreset] = useState<
    'today' | 'yesterday' | 'week' | 'month' | 'this_month' | 'all' | 'custom'
  >('today');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(['all']);
  const [showStoreDropdown, setShowStoreDropdown] = useState<boolean>(false);
  const [selectedCashierId, setSelectedCashierId] = useState<string>('all');
  const [selectedPaymentMethodCode, setSelectedPaymentMethodCode] = useState<string>('all');

  // Metadata for filter dropdowns
  const [filterMeta, setFilterMeta] = useState<FilterMeta>({
    stores: [],
    cashiers: [],
    paymentMethods: [],
  });

  // Data States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [exportLoading, setExportLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dashboard Data
  const [dashboardData, setDashboardData] = useState<ReportingDashboardSummary | null>(null);

  // Tab Data States
  const [dailySales, setDailySales] = useState<SalesTimeSeriesRow[]>([]);
  const [weeklySales, setWeeklySales] = useState<SalesTimeSeriesRow[]>([]);
  const [monthlySales, setMonthlySales] = useState<SalesTimeSeriesRow[]>([]);
  const [productSales, setProductSales] = useState<ProductSalesReportRow[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySalesReportRow[]>([]);
  const [cashierSales, setCashierSales] = useState<CashierSalesReportRow[]>([]);
  const [paymentReports, setPaymentReports] = useState<PaymentMethodReportRow[]>([]);
  const [inventoryReports, setInventoryReports] = useState<InventoryReportRow[]>([]);
  const [stockMovementReports, setStockMovementReports] = useState<StockMovementReportRow[]>([]);
  const [refundReports, setRefundReports] = useState<RefundReportRow[]>([]);
  const [registerReports, setRegisterReports] = useState<RegisterSessionReportRow[]>([]);
  const [profitReport, setProfitReport] = useState<ProfitEstimateReport | null>(null);

  // 1. Load Filter Metadata (Stores, Cashiers, Payment Methods)
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch(`${apiUrl}/reports/filters-meta`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setFilterMeta(json.data);
          }
        }
      } catch (err) {
        console.error('Failed to load filter metadata:', err);
      }
    }
    if (token) {
      loadMeta();
    }
  }, [apiUrl, token]);

  // Compute Date Boundaries based on preset
  const dateRange = useMemo(() => {
    const now = new Date();
    if (datePreset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (datePreset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const start = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate(),
        0,
        0,
        0,
        0,
      );
      const end = new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate(),
        23,
        59,
        59,
        999,
      );
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (datePreset === 'week') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    if (datePreset === 'month') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    if (datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    if (datePreset === 'custom' && customStartDate && customEndDate) {
      return {
        start: new Date(customStartDate).toISOString(),
        end: new Date(customEndDate).toISOString(),
      };
    }
    return { start: undefined, end: undefined };
  }, [datePreset, customStartDate, customEndDate]);

  // Build query string helper
  const buildQueryParams = useCallback(
    (extraParams: Record<string, string> = {}) => {
      const params = new URLSearchParams();
      if (dateRange.start) params.set('startDate', dateRange.start);
      // Store Filter: Individual store, multiple stores, or entire business
      if (selectedStoreIds.length > 0 && !selectedStoreIds.includes('all')) {
        if (selectedStoreIds.length === 1) {
          params.set('storeId', selectedStoreIds[0]);
          params.set('storeIds', selectedStoreIds[0]);
        } else {
          params.set('storeIds', selectedStoreIds.join(','));
        }
      }

      if (selectedCashierId !== 'all') params.set('cashierId', selectedCashierId);
      if (selectedPaymentMethodCode !== 'all')
        params.set('paymentMethodCode', selectedPaymentMethodCode);

      Object.entries(extraParams).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      return params.toString();
    },
    [dateRange, selectedStoreIds, selectedCashierId, selectedPaymentMethodCode],
  );

  // 2. Fetch Data from Backend
  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const q = buildQueryParams();

      if (activeTab === 'dashboard') {
        const res = await fetch(`${apiUrl}/reports/dashboard?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setDashboardData(json.data);
      } else if (activeTab === 'sales_daily') {
        const res = await fetch(
          `${apiUrl}/reports/sales?${buildQueryParams({ interval: 'daily' })}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setDailySales(json.data.rows || []);
      } else if (activeTab === 'sales_weekly') {
        const res = await fetch(
          `${apiUrl}/reports/sales?${buildQueryParams({ interval: 'weekly' })}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setWeeklySales(json.data.rows || []);
      } else if (activeTab === 'sales_monthly') {
        const res = await fetch(
          `${apiUrl}/reports/sales?${buildQueryParams({ interval: 'monthly' })}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setMonthlySales(json.data.rows || []);
      } else if (activeTab === 'products') {
        const res = await fetch(`${apiUrl}/reports/products?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setProductSales(json.data.rows || []);
      } else if (activeTab === 'categories') {
        const res = await fetch(`${apiUrl}/reports/categories?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setCategorySales(json.data.rows || []);
      } else if (activeTab === 'cashiers') {
        const res = await fetch(`${apiUrl}/reports/cashiers?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setCashierSales(json.data.rows || []);
      } else if (activeTab === 'payments') {
        const res = await fetch(`${apiUrl}/reports/payments?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setPaymentReports(json.data.rows || []);
      } else if (activeTab === 'inventory') {
        const res = await fetch(`${apiUrl}/reports/inventory?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setInventoryReports(json.data.rows || []);
      } else if (activeTab === 'stock_movements') {
        const res = await fetch(`${apiUrl}/reports/stock-movements?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setStockMovementReports(json.data.rows || []);
      } else if (activeTab === 'refunds') {
        const res = await fetch(`${apiUrl}/reports/refunds?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setRefundReports(json.data.rows || []);
      } else if (activeTab === 'registers') {
        const res = await fetch(`${apiUrl}/reports/registers?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setRegisterReports(json.data.rows || []);
      } else if (activeTab === 'profit') {
        const res = await fetch(`${apiUrl}/reports/profit?${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        setProfitReport(json.data);
      }

      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Report fetch error:', err);
      setError(err.message || 'Failed to fetch report from server');
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, token, activeTab, buildQueryParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Export handler
  const handleExport = async (format: 'csv' | 'excel') => {
    if (!token) return;
    setExportLoading(true);
    try {
      let endpoint = 'products';
      const extra: Record<string, string> = { format };

      if (activeTab === 'dashboard') endpoint = 'products';
      else if (activeTab === 'sales_daily') {
        endpoint = 'sales';
        extra.interval = 'daily';
      } else if (activeTab === 'sales_weekly') {
        endpoint = 'sales';
        extra.interval = 'weekly';
      } else if (activeTab === 'sales_monthly') {
        endpoint = 'sales';
        extra.interval = 'monthly';
      } else if (activeTab === 'products') endpoint = 'products';
      else if (activeTab === 'categories') endpoint = 'categories';
      else if (activeTab === 'cashiers') endpoint = 'cashiers';
      else if (activeTab === 'payments') endpoint = 'payments';
      else if (activeTab === 'inventory') endpoint = 'inventory';
      else if (activeTab === 'stock_movements') endpoint = 'stock-movements';
      else if (activeTab === 'refunds') endpoint = 'refunds';
      else if (activeTab === 'registers') endpoint = 'registers';
      else if (activeTab === 'profit') endpoint = 'profit';

      const q = buildQueryParams(extra);
      const url = `${apiUrl}/reports/${endpoint}?${q}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Export failed with HTTP ${res.status}`);

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `${endpoint}_${activeTab}_${format}_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-600 selection:text-white">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                Sales Reports &amp; Analytics
              </h1>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>{(user as any)?.businessName || 'Angkor Fresh Mart Co., Ltd.'}</span>
              <span>&bull;</span>
              <span className="text-slate-500">
                Refreshed: {lastRefreshed.toLocaleTimeString()}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/pos"
            className="hidden md:flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors items-center gap-1.5"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open POS</span>
          </Link>

          <Link
            href="/inventory"
            className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors items-center gap-1.5"
          >
            <Package className="w-3.5 h-3.5 text-emerald-400" />
            <span>Inventory</span>
          </Link>

          <Link
            href="/reports/register-sessions"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Shift History</span>
          </Link>

          {/* Export Dropdown */}
          <div className="relative group">
            <button
              disabled={exportLoading}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exportLoading ? 'Exporting...' : 'Export'}</span>
              <ChevronDown className="w-3 h-3 text-emerald-100" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1.5 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50">
              <button
                onClick={() => handleExport('csv')}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Refresh Report Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* 2. Global Filter Strip */}
      <section className="bg-slate-900/60 border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Date Presets */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80 overflow-x-auto">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'Last 7 Days' },
                { id: 'month', label: 'Last 30 Days' },
                { id: 'this_month', label: 'This Month' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDatePreset(preset.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  datePreset === preset.id
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if Custom selected */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2" />
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent text-slate-200 border-none outline-hidden px-1 py-0.5 text-xs font-mono"
              />
              <span className="text-slate-600">&rarr;</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent text-slate-200 border-none outline-hidden px-1 py-0.5 text-xs font-mono mr-2"
              />
            </div>
          )}

          {/* Multi-Dimensional Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Multi-Store Scope Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80 text-xs font-semibold text-slate-200 hover:border-slate-700 hover:bg-slate-900 transition shadow-xs"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {selectedStoreIds.includes('all') || selectedStoreIds.length === 0
                    ? 'All Stores'
                    : selectedStoreIds.length === 1
                      ? `${filterMeta.stores.find((s) => s.id === selectedStoreIds[0])?.name || '1 Branch'}`
                      : `${selectedStoreIds.length} Branches`}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-1" />
              </button>

              {showStoreDropdown && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px]">
                    <span className="font-bold text-white uppercase tracking-wider">
                      Stores
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStoreIds(['all']);
                        setShowStoreDropdown(false);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-bold"
                    >
                      All Stores
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    <label
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                        selectedStoreIds.includes('all')
                          ? 'bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/30'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStoreIds.includes('all')}
                        onChange={() => setSelectedStoreIds(['all'])}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                      />
                      <span>All Stores</span>
                    </label>

                    {filterMeta.stores.map((s) => {
                      const isChecked =
                        !selectedStoreIds.includes('all') && selectedStoreIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                            isChecked
                              ? 'bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/30'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              let updated = selectedStoreIds.filter((id) => id !== 'all');
                              if (isChecked) {
                                updated = updated.filter((id) => id !== s.id);
                                if (updated.length === 0) updated = ['all'];
                              } else {
                                updated.push(s.id);
                              }
                              setSelectedStoreIds(updated);
                            }}
                            className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                          />
                          <div className="truncate">
                            <span className="text-white font-medium">{s.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                              ({s.code})
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-2.5 mt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
                    <span>
                      {selectedStoreIds.includes('all')
                        ? 'All branches'
                        : `${selectedStoreIds.length} branch(es)`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowStoreDropdown(false)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cashier Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 text-xs">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCashierId}
                onChange={(e) => setSelectedCashierId(e.target.value)}
                className="bg-transparent text-slate-200 border-none outline-hidden text-xs font-medium cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-slate-200">
                  All Cashiers
                </option>
                {filterMeta.cashiers.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                    {c.fullName} (@{c.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 text-xs">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedPaymentMethodCode}
                onChange={(e) => setSelectedPaymentMethodCode(e.target.value)}
                className="bg-transparent text-slate-200 border-none outline-hidden text-xs font-medium cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-slate-200">
                  All Payments
                </option>
                {filterMeta.paymentMethods.map((p) => (
                  <option key={p.id} value={p.code} className="bg-slate-900 text-slate-200">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Branch Scope Pills */}
        {filterMeta.stores.length > 0 && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/60 overflow-x-auto text-xs scrollbar-none">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" />
              Scope:
            </span>
            <button
              type="button"
              onClick={() => setSelectedStoreIds(['all'])}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition shrink-0 ${
                selectedStoreIds.includes('all') || selectedStoreIds.length === 0
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Entire Business ({filterMeta.stores.length} Stores)
            </button>
            {filterMeta.stores.map((s) => {
              const isChecked =
                !selectedStoreIds.includes('all') && selectedStoreIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (selectedStoreIds.length === 1 && selectedStoreIds[0] === s.id) {
                      setSelectedStoreIds(['all']);
                    } else {
                      setSelectedStoreIds([s.id]);
                    }
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition shrink-0 whitespace-nowrap ${
                    isChecked
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                      : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Horizontal Report Categories Navigation Tabs */}
      <nav className="bg-slate-900 border-b border-slate-800/80 px-4 sm:px-6 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max py-2">
          {(
            [
              { id: 'dashboard', label: 'Overview', icon: BarChart3 },
              { id: 'sales_daily', label: 'Daily Sales', icon: TrendingUp },
              { id: 'sales_weekly', label: 'Weekly Sales', icon: TrendingUp },
              { id: 'sales_monthly', label: 'Monthly Sales', icon: TrendingUp },
              { id: 'products', label: 'Product Sales', icon: Package },
              { id: 'categories', label: 'Category Sales', icon: Layers },
              { id: 'cashiers', label: 'Cashier Performance', icon: Users },
              { id: 'payments', label: 'Payment Methods', icon: CreditCard },
              { id: 'inventory', label: 'Inventory Valuation', icon: Archive },
              { id: 'stock_movements', label: 'Stock Movements', icon: History },
              { id: 'refunds', label: 'Refunds & Returns', icon: RotateCcw },
              { id: 'registers', label: 'Register Reports', icon: Coins },
              { id: 'profit', label: 'Profit & Loss', icon: Calculator, badge: 'P&L' },
            ] as { id: TabType; label: string; icon: any; badge?: string }[]
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`}
                />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider ${
                      isActive ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 4. Main Body */}
      <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 space-y-6 max-w-7xl w-full mx-auto">
        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Error loading report: </span>
              {error}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-lg bg-slate-900 border border-slate-800 animate-pulse"
                />
              ))}
            </div>
            <div className="h-96 rounded-lg bg-slate-900 border border-slate-800 animate-pulse" />
          </div>
        ) : (
          <>
            {/* TAB 1: EXECUTIVE DASHBOARD */}
            {activeTab === 'dashboard' && dashboardData && (
              <div className="space-y-6">
                {/* Top 4 KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Today's Sales */}
                  <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Today&apos;s Sales
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-mono">
                      ${dashboardData.todaySalesUSD.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      {dashboardData.todaySalesKHR.toLocaleString()} ៛ KHR
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Transactions</span>
                      <span className="font-semibold text-white">
                        {dashboardData.todayOrdersCount} orders
                      </span>
                    </div>
                  </div>

                  {/* Period Gross Sales & AOV */}
                  <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Gross Sales (Period)
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-mono">
                      ${dashboardData.grossSalesUSD.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      Net: ${dashboardData.netSalesUSD.toFixed(2)} USD
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Avg Order Value (AOV)</span>
                      <span className="font-semibold text-slate-200 font-mono">
                        ${dashboardData.todayAverageOrderValueUSD.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Refunds & Discounts Deductions */}
                  <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Refunds &amp; Discounts
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400">
                        <RotateCcw className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-rose-400 tracking-tight font-mono">
                      -${dashboardData.refundsUSD.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      Discounts: -${dashboardData.discountsUSD.toFixed(2)} USD
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Taxes Collected</span>
                      <span className="font-semibold text-slate-200 font-mono">
                        ${dashboardData.taxesUSD.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Profit Estimate & Margin */}
                  <div className="p-5 rounded-lg bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        Estimated Profit
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                        <Calculator className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight font-mono">
                      ${dashboardData.profitEstimateUSD.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      COGS: ${dashboardData.costOfGoodsSoldUSD.toFixed(2)} USD
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Profit Margin</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 font-bold border border-emerald-800">
                        {dashboardData.profitMarginPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Middle Grid: Payment Breakdown & Cashier Performance */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Payment Breakdown Card */}
                  <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        <h2 className="text-sm font-bold text-white">Payment Method Breakdown</h2>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {dashboardData.paymentBreakdown.length} methods used
                      </span>
                    </div>

                    <div className="space-y-3">
                      {dashboardData.paymentBreakdown.map((pm) => (
                        <div
                          key={pm.code}
                          className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-200">{pm.name}</span>
                            <div className="flex items-center gap-2 font-mono">
                              <span className="font-bold text-white">
                                ${pm.amountUSD.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400">({pm.count} txns)</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[10px]">
                                {pm.percentage}%
                              </span>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, pm.percentage)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      {dashboardData.paymentBreakdown.length === 0 && (
                        <p className="text-xs text-slate-500 italic text-center py-4">
                          No payments recorded for this period.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Cashier Performance Card */}
                  <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 shadow-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <h2 className="text-sm font-bold text-white">
                          Cashier Performance Leaderboard
                        </h2>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {dashboardData.cashierPerformance.length} staff
                      </span>
                    </div>

                    <div className="space-y-2.5 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800">
                            <th className="pb-2 font-semibold">Cashier</th>
                            <th className="pb-2 font-semibold text-right">Orders</th>
                            <th className="pb-2 font-semibold text-right">Gross Sales</th>
                            <th className="pb-2 font-semibold text-right">Net Sales</th>
                            <th className="pb-2 font-semibold text-right">AOV</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {dashboardData.cashierPerformance.map((c) => (
                            <tr
                              key={c.cashierId}
                              className="hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-2.5 font-sans font-medium text-slate-200">
                                {c.cashierName}
                              </td>
                              <td className="py-2.5 text-right text-slate-300">{c.ordersCount}</td>
                              <td className="py-2.5 text-right text-slate-300">
                                ${c.grossSalesUSD.toFixed(2)}
                              </td>
                              <td className="py-2.5 text-right font-bold text-emerald-400">
                                ${c.netSalesUSD.toFixed(2)}
                              </td>
                              <td className="py-2.5 text-right text-slate-300">
                                ${c.avgOrderValueUSD.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {dashboardData.cashierPerformance.length === 0 && (
                        <p className="text-xs text-slate-500 italic text-center py-4">
                          No cashier data recorded.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Grid: Top Products & Low Stock Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top Products */}
                  <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 shadow-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-emerald-400" />
                        <h2 className="text-sm font-bold text-white">Top Performing Products</h2>
                      </div>
                      <span className="text-xs text-slate-400 font-mono font-semibold">
                        By Revenue
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800">
                            <th className="pb-2 font-semibold">Product</th>
                            <th className="pb-2 font-semibold text-right">Units Sold</th>
                            <th className="pb-2 font-semibold text-right">Revenue</th>
                            <th className="pb-2 font-semibold text-right">Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {dashboardData.topProducts.map((p) => (
                            <tr
                              key={p.productId}
                              className="hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-2.5">
                                <div className="font-medium text-slate-200">{p.productName}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {p.sku} &bull; {p.categoryName}
                                </div>
                              </td>
                              <td className="py-2.5 text-right font-mono text-slate-300">
                                {p.quantitySold}
                              </td>
                              <td className="py-2.5 text-right font-mono font-bold text-white">
                                ${p.revenueUSD.toFixed(2)}
                              </td>
                              <td className="py-2.5 text-right font-mono font-bold text-emerald-400">
                                ${p.profitUSD.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {dashboardData.topProducts.length === 0 && (
                        <p className="text-xs text-slate-500 italic text-center py-4">
                          No product sales in this period.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Low Stock Alerts */}
                  <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 shadow-lg space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <h2 className="text-sm font-bold text-white">Low-Stock Alert Center</h2>
                      </div>
                      <span className="text-xs text-amber-400 font-mono font-semibold">
                        {dashboardData.lowStockProducts.length} Attention Needed
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800">
                            <th className="pb-2 font-semibold">Product</th>
                            <th className="pb-2 font-semibold">Store</th>
                            <th className="pb-2 font-semibold text-right">Current Stock</th>
                            <th className="pb-2 font-semibold text-right">Min Level</th>
                            <th className="pb-2 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {dashboardData.lowStockProducts.map((inv) => (
                            <tr
                              key={`${inv.productId}-${inv.storeName}`}
                              className="hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-2.5 font-sans">
                                <div className="font-medium text-slate-200">{inv.productName}</div>
                                <div className="text-[10px] text-slate-500">{inv.sku}</div>
                              </td>
                              <td className="py-2.5 text-slate-400">{inv.storeName}</td>
                              <td className="py-2.5 text-right font-bold text-amber-400">
                                {inv.currentQuantity} {inv.unit}
                              </td>
                              <td className="py-2.5 text-right text-slate-400">
                                {inv.minStockLevel}
                              </td>
                              <td className="py-2.5 text-center font-sans">
                                {inv.currentQuantity <= 0 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                    OUT OF STOCK
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                    LOW STOCK
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {dashboardData.lowStockProducts.length === 0 && (
                        <div className="p-6 text-center text-slate-400 space-y-1">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                          <p className="text-xs font-semibold text-slate-300">
                            Inventory Levels Healthy
                          </p>
                          <p className="text-[11px] text-slate-500">
                            All inventory items are currently above safety stock thresholds.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2, 3, 4: TIME-SERIES SALES (Daily, Weekly, Monthly) */}
            {(activeTab === 'sales_daily' ||
              activeTab === 'sales_weekly' ||
              activeTab === 'sales_monthly') && (
              <ReportTableContainer
                title={`${
                  activeTab === 'sales_daily'
                    ? 'Daily'
                    : activeTab === 'sales_weekly'
                      ? 'Weekly'
                      : 'Monthly'
                } Sales Performance Analysis`}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExport={handleExport}
              >
                {(() => {
                  const rows =
                    activeTab === 'sales_daily'
                      ? dailySales
                      : activeTab === 'sales_weekly'
                        ? weeklySales
                        : monthlySales;
                  const filtered = rows.filter(
                    (r) =>
                      r.periodLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.periodKey.toLowerCase().includes(searchQuery.toLowerCase()),
                  );

                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                          <th className="p-3 font-semibold">Period</th>
                          <th className="p-3 font-semibold text-right">Orders</th>
                          <th className="p-3 font-semibold text-right">Gross Sales</th>
                          <th className="p-3 font-semibold text-right">Discounts</th>
                          <th className="p-3 font-semibold text-right">Refunds</th>
                          <th className="p-3 font-semibold text-right">Net Sales</th>
                          <th className="p-3 font-semibold text-right">Taxes</th>
                          <th className="p-3 font-semibold text-right">Estimated Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {filtered.map((r) => (
                          <tr key={r.periodKey} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 font-sans font-bold text-slate-200">
                              {r.periodLabel}
                            </td>
                            <td className="p-3 text-right text-slate-300">{r.ordersCount}</td>
                            <td className="p-3 text-right text-slate-300">
                              ${r.grossSalesUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-amber-400">
                              -${r.discountsUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-rose-400">
                              -${r.refundsUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-white">
                              ${r.netSalesUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-slate-400">
                              ${r.taxesUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-400">
                              ${r.profitEstimateUSD.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                              No sales records found matching query.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </ReportTableContainer>
            )}

            {/* TAB 5: PRODUCT SALES */}
            {activeTab === 'products' && (
              <ReportTableContainer
                title="Product Sales & Profit Margin Ledger"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExport={handleExport}
              >
                {(() => {
                  const filtered = productSales.filter(
                    (p) =>
                      p.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.categoryName.toLowerCase().includes(searchQuery.toLowerCase()),
                  );

                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                          <th className="p-3 font-semibold">SKU</th>
                          <th className="p-3 font-semibold">Product Name</th>
                          <th className="p-3 font-semibold">Category</th>
                          <th className="p-3 font-semibold text-right">Units Sold</th>
                          <th className="p-3 font-semibold text-right">Avg Price</th>
                          <th className="p-3 font-semibold text-right">Gross Sales</th>
                          <th className="p-3 font-semibold text-right">Discounts</th>
                          <th className="p-3 font-semibold text-right">Net Sales</th>
                          <th className="p-3 font-semibold text-right">COGS</th>
                          <th className="p-3 font-semibold text-right">Profit</th>
                          <th className="p-3 font-semibold text-right">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {filtered.map((p) => (
                          <tr key={p.productId} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 text-slate-300 font-semibold">{p.sku}</td>
                            <td className="p-3 font-sans font-medium text-slate-200">
                              {p.productName}
                            </td>
                            <td className="p-3 font-sans text-slate-400">{p.categoryName}</td>
                            <td className="p-3 text-right text-slate-200">{p.quantitySold}</td>
                            <td className="p-3 text-right text-slate-400">
                              ${p.unitPriceAvgUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-slate-300">
                              ${p.grossSalesUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-amber-400">
                              -${p.discountsUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-white">
                              ${p.netSalesUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-slate-400">
                              ${p.cogsUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-400">
                              ${p.profitUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                                {p.marginPercent}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={11} className="p-8 text-center text-slate-500 italic">
                              No product sales records found matching query.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </ReportTableContainer>
            )}

            {/* TAB 6: CATEGORY SALES */}
            {activeTab === 'categories' && (
              <ReportTableContainer
                title="Category Sales Performance & Market Share"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExport={handleExport}
              >
                {(() => {
                  const filtered = categorySales.filter((c) =>
                    c.categoryName.toLowerCase().includes(searchQuery.toLowerCase()),
                  );

                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                          <th className="p-3 font-semibold">Category</th>
                          <th className="p-3 font-semibold text-right">Items in Catalog</th>
                          <th className="p-3 font-semibold text-right">Units Sold</th>
                          <th className="p-3 font-semibold text-right">Gross Sales</th>
                          <th className="p-3 font-semibold text-right">Discounts</th>
                          <th className="p-3 font-semibold text-right">Net Sales</th>
                          <th className="p-3 font-semibold text-right">Revenue Share %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {filtered.map((c) => (
                          <tr
                            key={c.categoryId}
                            className="hover:bg-slate-900/40 transition-colors"
                          >
                            <td className="p-3 font-sans font-bold text-slate-200">
                              {c.categoryName}
                            </td>
                            <td className="p-3 text-right text-slate-400">{c.itemsCount}</td>
                            <td className="p-3 text-right text-slate-300">{c.quantitySold}</td>
                            <td className="p-3 text-right text-slate-300">
                              ${c.grossSalesUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-amber-400">
                              -${c.discountsUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-white">
                              ${c.netSalesUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                                {c.revenueSharePercent}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                              No category sales records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </ReportTableContainer>
            )}

            {/* TAB 7: CASHIER SALES */}
            {activeTab === 'cashiers' && (
              <ReportTableContainer
                title="Cashier Sales & Shift Output"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExport={handleExport}
              >
                {(() => {
                  const filtered = cashierSales.filter((c) =>
                    c.cashierName.toLowerCase().includes(searchQuery.toLowerCase()),
                  );

                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                          <th className="p-3 font-semibold">Cashier</th>
                          <th className="p-3 font-semibold text-right">Orders Processed</th>
                          <th className="p-3 font-semibold text-right">Gross Sales</th>
                          <th className="p-3 font-semibold text-right">Discounts</th>
                          <th className="p-3 font-semibold text-right">Refunds Handled</th>
                          <th className="p-3 font-semibold text-right">Net Sales</th>
                          <th className="p-3 font-semibold text-right">Average Ticket</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {filtered.map((c) => (
                          <tr key={c.cashierId} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 font-sans font-bold text-slate-200">
                              {c.cashierName}
                            </td>
                            <td className="p-3 text-right text-slate-300">{c.ordersCount}</td>
                            <td className="p-3 text-right text-slate-300">
                              ${c.grossSalesUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-amber-400">
                              -${c.discountsUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-rose-400">
                              -${c.refundsUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-400">
                              ${c.netSalesUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-300">
                              ${c.avgOrderValueUSD.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                              No cashier sales records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </ReportTableContainer>
            )}

            {/* TAB 8: PAYMENT METHODS */}
            {activeTab === 'payments' && (
              <ReportTableContainer
                title="Tender & Payment Method Breakdown"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExport={handleExport}
              >
                {(() => {
                  const filtered = paymentReports.filter(
                    (p) =>
                      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.code.toLowerCase().includes(searchQuery.toLowerCase()),
                  );

                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                          <th className="p-3 font-semibold">Tender / Payment Method</th>
                          <th className="p-3 font-semibold">Code</th>
                          <th className="p-3 font-semibold text-right">Transactions</th>
                          <th className="p-3 font-semibold text-right">Total (USD)</th>
                          <th className="p-3 font-semibold text-right">Total (KHR)</th>
                          <th className="p-3 font-semibold text-right">Share %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {filtered.map((p) => (
                          <tr
                            key={p.paymentMethodId}
                            className="hover:bg-slate-900/40 transition-colors"
                          >
                            <td className="p-3 font-sans font-bold text-slate-200">{p.name}</td>
                            <td className="p-3 text-slate-400 font-bold">{p.code}</td>
                            <td className="p-3 text-right text-slate-300">{p.transactionsCount}</td>
                            <td className="p-3 text-right font-bold text-emerald-400">
                              ${p.totalUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-slate-400">
                              {p.totalKHR.toLocaleString()} ៛
                            </td>
                            <td className="p-3 text-right">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                                {p.percentage}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                              No payment records found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </ReportTableContainer>
            )}

            {/* TAB 9: INVENTORY REPORT */}
            {activeTab === 'inventory' && (
              <ReportTableContainer
                title="Real-Time Inventory Status & Asset Valuation"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExport={handleExport}
              >
                {(() => {
                  const filtered = inventoryReports.filter(
                    (i) =>
                      i.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      i.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      i.categoryName.toLowerCase().includes(searchQuery.toLowerCase()),
                  );

                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                          <th className="p-3 font-semibold">SKU</th>
                          <th className="p-3 font-semibold">Product Name</th>
                          <th className="p-3 font-semibold">Category</th>
                          <th className="p-3 font-semibold">Store</th>
                          <th className="p-3 font-semibold text-right">Stock On Hand</th>
                          <th className="p-3 font-semibold text-right">Unit Cost</th>
                          <th className="p-3 font-semibold text-right">Selling Price</th>
                          <th className="p-3 font-semibold text-right">Total Cost Value</th>
                          <th className="p-3 font-semibold text-right">Total Retail Value</th>
                          <th className="p-3 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {filtered.map((inv) => (
                          <tr
                            key={`${inv.productId}-${inv.storeName}`}
                            className="hover:bg-slate-900/40 transition-colors"
                          >
                            <td className="p-3 text-slate-300 font-semibold">{inv.sku}</td>
                            <td className="p-3 font-sans font-medium text-slate-200">
                              {inv.productName}
                            </td>
                            <td className="p-3 font-sans text-slate-400">{inv.categoryName}</td>
                            <td className="p-3 font-sans text-slate-400">{inv.storeName}</td>
                            <td className="p-3 text-right font-bold text-white">
                              {inv.currentStock}
                            </td>
                            <td className="p-3 text-right text-slate-400">
                              ${inv.unitCostUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-slate-300">
                              ${inv.sellingPriceUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-300">
                              ${inv.totalCostValueUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-400">
                              ${inv.totalRetailValueUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-center font-sans">
                              {inv.stockStatus === 'OUT_OF_STOCK' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                  OUT OF STOCK
                                </span>
                              ) : inv.stockStatus === 'LOW_STOCK' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                  LOW STOCK
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  IN STOCK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={10} className="p-8 text-center text-slate-500 italic">
                              No inventory items found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </ReportTableContainer>
            )}

            {/* TAB 10: STOCK MOVEMENTS */}
            {activeTab === 'stock_movements' && (
              <ReportTableContainer
                title="Stock Movement & Inventory Audit Trail"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExport={handleExport}
              >
                {(() => {
                  const filtered = stockMovementReports.filter(
                    (m) =>
                      m.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      m.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      m.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (m.referenceId &&
                        m.referenceId.toLowerCase().includes(searchQuery.toLowerCase())),
                  );

                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                          <th className="p-3 font-semibold">Date/Time</th>
                          <th className="p-3 font-semibold">Product</th>
                          <th className="p-3 font-semibold">Type</th>
                          <th className="p-3 font-semibold text-right">Change</th>
                          <th className="p-3 font-semibold text-right">Before</th>
                          <th className="p-3 font-semibold text-right">After</th>
                          <th className="p-3 font-semibold text-right">Unit Cost</th>
                          <th className="p-3 font-semibold">Reference</th>
                          <th className="p-3 font-semibold">Auditor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {filtered.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                              {new Date(m.createdAt).toLocaleString()}
                            </td>
                            <td className="p-3 font-sans">
                              <div className="font-medium text-slate-200">{m.productName}</div>
                              <div className="text-[10px] text-slate-500">{m.sku}</div>
                            </td>
                            <td className="p-3 font-sans">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  m.type === 'SALE'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : m.type === 'REFUND' || m.type === 'RETURN'
                                      ? 'bg-amber-500/10 text-amber-400'
                                      : m.type === 'PURCHASE' || m.type === 'ADJUSTMENT_IN'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-rose-500/10 text-rose-400'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td
                              className={`p-3 text-right font-bold ${
                                m.quantityChange > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                            </td>
                            <td className="p-3 text-right text-slate-400">{m.quantityBefore}</td>
                            <td className="p-3 text-right font-bold text-white">
                              {m.quantityAfter}
                            </td>
                            <td className="p-3 text-right text-slate-400">
                              ${m.unitCostUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-slate-400 font-sans text-[11px]">
                              {m.referenceType} #{m.referenceId?.slice(-6) || 'N/A'}
                            </td>
                            <td className="p-3 font-sans text-slate-300">{m.createdByName}</td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                              No stock movements found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </ReportTableContainer>
            )}

            {/* TAB 11: REFUND REPORT */}
            {activeTab === 'refunds' && (
              <ReportTableContainer
                title="Customer Returns & Order Refunds Ledger"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExport={handleExport}
              >
                {(() => {
                  const filtered = refundReports.filter(
                    (r) =>
                      r.refundNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.cashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (r.customerName &&
                        r.customerName.toLowerCase().includes(searchQuery.toLowerCase())),
                  );

                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                          <th className="p-3 font-semibold">Date/Time</th>
                          <th className="p-3 font-semibold">Refund #</th>
                          <th className="p-3 font-semibold">Order #</th>
                          <th className="p-3 font-semibold">Customer</th>
                          <th className="p-3 font-semibold">Cashier</th>
                          <th className="p-3 font-semibold">Reason</th>
                          <th className="p-3 font-semibold text-right">Amount USD</th>
                          <th className="p-3 font-semibold text-right">Amount KHR</th>
                          <th className="p-3 font-semibold">Payment Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {filtered.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                              {new Date(r.createdAt).toLocaleString()}
                            </td>
                            <td className="p-3 font-bold text-rose-400">{r.refundNumber}</td>
                            <td className="p-3 text-slate-300 font-bold">{r.orderNumber}</td>
                            <td className="p-3 font-sans text-slate-300">
                              {r.customerName || 'Walk-in Customer'}
                            </td>
                            <td className="p-3 font-sans text-slate-300">{r.cashierName}</td>
                            <td className="p-3 font-sans text-slate-400">{r.reason}</td>
                            <td className="p-3 text-right font-bold text-rose-400">
                              -${r.amountUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-slate-400">
                              {r.amountKHR.toLocaleString()} ៛
                            </td>
                            <td className="p-3 font-sans text-slate-300">{r.paymentMethodName}</td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                              No refunds recorded.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </ReportTableContainer>
            )}

            {/* TAB 12: REGISTER SESSIONS */}
            {activeTab === 'registers' && (
              <ReportTableContainer
                title="Cash Register Shift Sessions & Drawer Discrepancies"
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onExport={handleExport}
              >
                {(() => {
                  const filtered = registerReports.filter(
                    (s) =>
                      s.registerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.cashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.storeName.toLowerCase().includes(searchQuery.toLowerCase()),
                  );

                  return (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800 bg-slate-900/60">
                          <th className="p-3 font-semibold">Register</th>
                          <th className="p-3 font-semibold">Cashier</th>
                          <th className="p-3 font-semibold">Opened</th>
                          <th className="p-3 font-semibold">Closed</th>
                          <th className="p-3 font-semibold text-center">Status</th>
                          <th className="p-3 font-semibold text-right">Float</th>
                          <th className="p-3 font-semibold text-right">Expected</th>
                          <th className="p-3 font-semibold text-right">Actual Count</th>
                          <th className="p-3 font-semibold text-right">Difference</th>
                          <th className="p-3 font-semibold text-right">Sales Count</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono">
                        {filtered.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 font-sans">
                              <div className="font-bold text-white">{s.registerCode}</div>
                              <div className="text-[10px] text-slate-500">{s.storeName}</div>
                            </td>
                            <td className="p-3 font-sans font-medium text-slate-300">
                              {s.cashierName}
                            </td>
                            <td className="p-3 text-[11px] text-slate-400">
                              {new Date(s.openedAt).toLocaleTimeString()}
                            </td>
                            <td className="p-3 text-[11px] text-slate-400">
                              {s.closedAt ? new Date(s.closedAt).toLocaleTimeString() : 'Active'}
                            </td>
                            <td className="p-3 text-center font-sans">
                              {s.status === 'OPEN' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  OPEN
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                                  CLOSED
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right text-slate-300">
                              ${s.openingFloatUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-slate-300">
                              ${s.expectedCashUSD.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-bold text-white">
                              {s.actualCashUSD !== null ? `$${s.actualCashUSD.toFixed(2)}` : 'N/A'}
                            </td>
                            <td
                              className={`p-3 text-right font-bold ${
                                s.differenceUSD === null || s.differenceUSD === 0
                                  ? 'text-slate-400'
                                  : s.differenceUSD > 0
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                              }`}
                            >
                              {s.differenceUSD !== null
                                ? `${s.differenceUSD > 0 ? '+' : ''}$${s.differenceUSD.toFixed(2)}`
                                : 'N/A'}
                            </td>
                            <td className="p-3 text-right text-slate-300 font-semibold">
                              {s.totalSalesCount}
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={10} className="p-8 text-center text-slate-500 italic">
                              No register sessions found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  );
                })()}
              </ReportTableContainer>
            )}

            {/* TAB 13: PROFIT & LOSS ESTIMATE */}
            {activeTab === 'profit' && profitReport && (
              <div className="max-w-4xl mx-auto p-6 sm:p-8 rounded-lg bg-slate-900 border border-slate-800 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">
                        Profit &amp; Loss Statement
                      </h2>
                      <p className="text-xs text-slate-400">
                        Calculated from sales transactions and inventory cost of goods sold
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleExport('csv')}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="space-y-3 font-mono text-xs divide-y divide-slate-800/80">
                  <div className="flex items-center justify-between py-2 text-slate-300 font-sans">
                    <span className="font-semibold text-slate-100">Gross Sales</span>
                    <span className="font-mono font-bold text-white text-sm">
                      ${profitReport.grossSalesUSD.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 text-amber-400">
                    <span className="font-sans">Discounts Granted</span>
                    <span>-${profitReport.discountsUSD.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 font-bold text-slate-100 bg-slate-950/40 px-3 rounded-lg">
                    <span className="font-sans">Net Sales</span>
                    <span className="text-sm">${profitReport.netSalesUSD.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 text-slate-400">
                    <span className="font-sans">Cost of Goods Sold (COGS)</span>
                    <span>-${profitReport.cogsUSD.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2.5 font-bold text-emerald-400 bg-emerald-500/10 px-3 rounded-lg border border-emerald-500/20">
                    <span className="font-sans">Gross Profit</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">${profitReport.grossProfitUSD.toFixed(2)}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                        {profitReport.grossProfitMarginPercent}% Margin
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 text-rose-400">
                    <span className="font-sans">Less: Customer Refunds &amp; Returns</span>
                    <span>-${profitReport.refundsUSD.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 text-slate-400">
                    <span className="font-sans">Less: Operating Expenses (Drawer Payouts)</span>
                    <span>-${profitReport.expensesUSD.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 text-slate-400">
                    <span className="font-sans">Taxes Collected (Held for Remittance)</span>
                    <span>${profitReport.taxesCollectedUSD.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between py-3.5 font-bold text-emerald-300 bg-emerald-950/60 px-4 rounded-lg border border-emerald-800/80">
                    <div className="font-sans">
                      <div className="text-sm text-white">Estimated Net Operating Profit</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        After Cost of Goods, Refunds, &amp; In-Store Expenses
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl text-emerald-400 font-mono">
                      ${profitReport.netOperatingProfitUSD.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Reusable Report Table Container with Header, Quick Search, and Direct Export
function ReportTableContainer({
  title,
  searchQuery,
  onSearchChange,
  onExport,
  children,
}: {
  title: string;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onExport: (format: 'csv' | 'excel') => void;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight">{title}</h2>
          <p className="text-[11px] text-slate-400">
            Server-computed ledger with live database filters applied
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick in-page Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in table..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 outline-hidden focus:border-emerald-500 transition-colors w-40 sm:w-56"
            />
          </div>

          {/* Quick Export for active report */}
          <button
            onClick={() => onExport('csv')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={() => onExport('excel')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold"
            title="Download Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800/80">{children}</div>
    </div>
  );
}
