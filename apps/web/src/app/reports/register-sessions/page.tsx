'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../../components/AuthGuard';
import { useAuth } from '../../../lib/auth-context';
import { RegisterSessionSummary, RegisterReportSummary, CashMovementRecord } from '@pos/types';
import { ShiftReportModal } from '../../../components/pos/ShiftReportModal';
import {
  Coins,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  RefreshCw,
  Printer,
  X,
  Clock,
  User,
  Receipt,
  FileText,
  AlertTriangle,
  Lock,
  LockOpen,
  Monitor,
  ShoppingBag,
  BarChart3,
} from 'lucide-react';

export default function RegisterReportsPage() {
  return (
    <AuthGuard requiredPermission="reports.view">
      <RegisterReportsContent />
    </AuthGuard>
  );
}

function RegisterReportsContent() {
  const { token } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  // State
  const [sessions, setSessions] = useState<RegisterSessionSummary[]>([]);
  const [summary, setSummary] = useState<RegisterReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>(
    'week',
  );

  // Drilldown Detail Modal
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<{
    session: RegisterSessionSummary;
    movements: CashMovementRecord[];
    orders: any[];
  } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Z-Report Print Modal
  const [printSession, setPrintSession] = useState<RegisterSessionSummary | null>(null);

  // Calculate Date Filters
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    if (datePreset === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (datePreset === 'yesterday') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (datePreset === 'week') {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (datePreset === 'month') {
      start.setMonth(now.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    return { start: undefined, end: undefined };
  }, [datePreset]);

  // Fetch Report Data
  const fetchReportData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      if (dateRange.start) {
        params.append('startDate', dateRange.start);
      }
      if (dateRange.end) {
        params.append('endDate', dateRange.end);
      }

      const res = await fetch(`${apiUrl}/register/sessions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load sessions (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setSessions(json.data.sessions || []);
        setSummary(json.data.summary || null);
      } else {
        throw new Error(json.error?.message || 'Invalid server response');
      }
    } catch (err: any) {
      console.error('[RegisterReports] Error:', err);
      setError(err.message || 'Error fetching register reports');
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, token, statusFilter, dateRange]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Fetch Session Detail for Drilldown
  const handleOpenDetail = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`${apiUrl}/register/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSessionDetail(json.data);
        }
      }
    } catch (err) {
      console.error('[RegisterReports] Failed to fetch session detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Filtered Sessions (by search input)
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      const matchSessionNum = s.id.toLowerCase().includes(q);
      const matchCashier = s.cashierName.toLowerCase().includes(q);
      const matchRegister =
        s.registerCode.toLowerCase().includes(q) || s.registerName.toLowerCase().includes(q);
      const matchStore = s.storeName.toLowerCase().includes(q);
      return matchSessionNum || matchCashier || matchRegister || matchStore;
    });
  }, [sessions, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow hover:bg-indigo-500 transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white leading-none">
                  Cash Register & Shift Reports
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700">
                  Manager Hub
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit cash float, shift sales, drawer movements &amp; cash counts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchReportData()}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50"
              title="Refresh reports data"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/reports"
              className="hidden sm:flex px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold items-center gap-1.5 border border-slate-700 transition-colors shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Full Analytics</span>
            </Link>

            <Link
              href="/pos"
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Go to POS Terminal</span>
              <span className="sm:hidden">POS</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 lg:pb-8 space-y-6">
        {/* KPI Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {/* Total Sessions */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Total Shifts</span>
                <Clock className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {summary.totalSessions}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="text-emerald-600 font-semibold">{summary.openSessions} Open</span>
                <span>&bull;</span>
                <span className="text-slate-500">{summary.closedSessions} Closed</span>
              </div>
            </div>

            {/* Expected Cash in Drawers */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Expected Cash</span>
                <Coins className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-xl font-black text-slate-900 font-mono">
                ${summary.totalExpectedCashUSD.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 font-mono">
                {Math.round(summary.totalExpectedCashUSD * 4100).toLocaleString()} KHR
              </div>
            </div>

            {/* Cash Sales */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Cash Sales</span>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black text-emerald-600 font-mono">
                +${summary.totalCashSalesUSD.toFixed(2)}
              </div>
              <div className="text-[11px] text-emerald-700/80 mt-1 font-mono">
                +{Math.round(summary.totalCashSalesUSD * 4100).toLocaleString()} KHR (
                {summary.totalSalesCount} tx)
              </div>
            </div>

            {/* Cash Additions (In) */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Cash In</span>
                <ArrowDownLeft className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-black text-blue-600 font-mono">
                +${summary.totalCashInUSD.toFixed(2)}
              </div>
              <div className="text-[11px] text-blue-700/80 mt-1 font-mono">
                +{Math.round(summary.totalCashInUSD * 4100).toLocaleString()} KHR
              </div>
            </div>

            {/* Cash Out & Expenses */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Expenses / Out</span>
                <ArrowUpRight className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl font-black text-rose-600 font-mono">
                -${(summary.totalCashOutUSD + summary.totalExpensesUSD).toFixed(2)}
              </div>
              <div className="text-[11px] text-rose-700/80 mt-1 font-mono">
                -$
                {Math.round(
                  (summary.totalCashOutUSD + summary.totalExpensesUSD) * 4100,
                ).toLocaleString()}{' '}
                KHR
              </div>
            </div>

            {/* Net Over / Short Variance */}
            <div
              className={`rounded-xl p-4 border shadow-xs ${
                summary.totalDifferenceUSD === 0
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : summary.totalDifferenceUSD > 0
                    ? 'bg-blue-50/60 border-blue-200'
                    : 'bg-rose-50/60 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Net Variance
                </span>
                <Coins
                  className={`w-4 h-4 ${
                    summary.totalDifferenceUSD === 0
                      ? 'text-emerald-500'
                      : summary.totalDifferenceUSD > 0
                        ? 'text-blue-500'
                        : 'text-rose-500'
                  }`}
                />
              </div>
              <div
                className={`text-xl font-black font-mono ${
                  summary.totalDifferenceUSD === 0
                    ? 'text-emerald-700'
                    : summary.totalDifferenceUSD > 0
                      ? 'text-blue-700'
                      : 'text-rose-700'
                }`}
              >
                {summary.totalDifferenceUSD >= 0 ? '+' : ''}${summary.totalDifferenceUSD.toFixed(2)}
              </div>
              <div
                className={`text-[11px] font-semibold mt-1 ${
                  summary.totalDifferenceUSD === 0
                    ? 'text-emerald-700'
                    : summary.totalDifferenceUSD > 0
                      ? 'text-blue-700'
                      : 'text-rose-700'
                }`}
              >
                {summary.totalDifferenceUSD === 0
                  ? 'Perfect Balanced ($0.00)'
                  : summary.totalDifferenceUSD > 0
                    ? 'Cash Over (Surplus)'
                    : 'Cash Short (Discrepancy)'}
              </div>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by session #, cashier, register, store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Date presets & Status Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Segment */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setStatusFilter('OPEN')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'OPEN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Open Only
              </button>
              <button
                onClick={() => setStatusFilter('CLOSED')}
                className={`px-3 py-1 rounded-md transition-colors ${
                  statusFilter === 'CLOSED'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Closed Only
              </button>
            </div>

            {/* Date Preset Pills */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
              {(['today', 'yesterday', 'week', 'month', 'all'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDatePreset(preset)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                    datePreset === preset
                      ? 'bg-white text-indigo-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset === 'week' ? 'Past 7d' : preset === 'month' ? 'Past 30d' : preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Register Shift Ledger ({filteredSessions.length} sessions)
              </h2>
            </div>
            {isLoading && (
              <span className="text-xs text-indigo-600 flex items-center gap-1.5 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Loading shift records...
              </span>
            )}
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && filteredSessions.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Clock className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No register sessions found</p>
              <p className="text-xs text-slate-400">
                Adjust the date range or status filters above, or open a session from POS.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Session #</th>
                    <th className="py-3 px-4">Register &amp; Store</th>
                    <th className="py-3 px-4">Cashier</th>
                    <th className="py-3 px-4">Opened / Closed</th>
                    <th className="py-3 px-4 text-right">Opening Float</th>
                    <th className="py-3 px-4 text-right">Cash Sales</th>
                    <th className="py-3 px-4 text-right">Cash In / Out</th>
                    <th className="py-3 px-4 text-right">Expenses</th>
                    <th className="py-3 px-4 text-right">Expected Cash</th>
                    <th className="py-3 px-4 text-right">Counted Cash</th>
                    <th className="py-3 px-4 text-right">Difference</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSessions.map((s) => {
                    const diffUSD = s.differenceUSD !== null ? s.differenceUSD : 0;
                    const isBalanced = diffUSD === 0;
                    const isOver = diffUSD > 0;
                    const isClosed = s.status === 'CLOSED';

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Session & Status */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              #{s.id.slice(-6).toUpperCase()}
                            </span>
                            {isClosed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                <Lock className="w-2.5 h-2.5" />
                                Closed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                                <LockOpen className="w-2.5 h-2.5 text-emerald-600" />
                                Active
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Register & Store */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{s.registerCode}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            {s.storeName}
                          </div>
                        </td>

                        {/* Cashier */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{s.cashierName}</span>
                          </div>
                          {s.closedByName && (
                            <div className="text-[10px] text-slate-400">
                              Closed by: {s.closedByName}
                            </div>
                          )}
                        </td>

                        {/* Timing */}
                        <td className="py-3.5 px-4 text-[11px]">
                          <div className="text-slate-800 font-medium">
                            {new Date(s.openedAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-slate-400">
                            {s.closedAt
                              ? `Closed: ${new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : 'Ongoing Shift'}
                          </div>
                        </td>

                        {/* Opening Float */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className="font-semibold text-slate-900">
                            ${s.openingFloatUSD.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {s.openingFloatKHR.toLocaleString()} KHR
                          </div>
                        </td>

                        {/* Cash Sales */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className="font-semibold text-emerald-600">
                            +${s.totalSalesUSD.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-emerald-700/80">
                            +{s.totalSalesKHR.toLocaleString()} KHR ({s.totalSalesCount} tx)
                          </div>
                        </td>

                        {/* Cash In / Out */}
                        <td className="py-3.5 px-4 text-right font-mono text-[11px]">
                          <div className="text-blue-600 font-medium">
                            +${s.cashInUSD.toFixed(2)}
                          </div>
                          <div className="text-rose-600 font-medium">
                            -${s.cashOutUSD.toFixed(2)}
                          </div>
                        </td>

                        {/* Expenses */}
                        <td className="py-3.5 px-4 text-right font-mono text-[11px]">
                          <div className="text-rose-600 font-medium">
                            -${s.expensesUSD.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {s.expensesKHR.toLocaleString()} KHR
                          </div>
                        </td>

                        {/* Expected Cash */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className="font-bold text-slate-900">
                            ${s.expectedCashUSD.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {s.expectedCashKHR.toLocaleString()} KHR
                          </div>
                        </td>

                        {/* Counted Cash */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          {isClosed && s.actualCashUSD !== null ? (
                            <>
                              <div className="font-bold text-slate-900">
                                ${s.actualCashUSD.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {s.actualCashKHR?.toLocaleString()} KHR
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Not closed yet</span>
                          )}
                        </td>

                        {/* Difference (Over / Short) */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          {isClosed && s.differenceUSD !== null ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                isBalanced
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isOver
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {diffUSD >= 0 ? '+' : ''}${diffUSD.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenDetail(s.id)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-medium text-[11px] border border-slate-200 transition-colors"
                              title="Inspect full session audit trail & movements"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => setPrintSession(s)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors"
                              title="Print Z-Report"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Drill-down Detail Modal */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    Session Audit &amp; Reconciliation Detail
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Session #{sessionDetail?.session.id.slice(-6).toUpperCase()} &bull; Register{' '}
                    {sessionDetail?.session.registerCode} &bull; {sessionDetail?.session.storeName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedSessionId(null);
                  setSessionDetail(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isLoadingDetail || !sessionDetail ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="text-xs">
                    Loading shift movements and transaction audit logs...
                  </span>
                </div>
              ) : (
                <>
                  {/* Financial Reconciliation Summary Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Opening Float
                      </span>
                      <div className="text-sm font-bold font-mono text-slate-900">
                        ${sessionDetail.session.openingFloatUSD.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {sessionDetail.session.openingFloatKHR.toLocaleString()} KHR
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Cash Sales ({sessionDetail.session.totalSalesCount})
                      </span>
                      <div className="text-sm font-bold font-mono text-emerald-600">
                        +${sessionDetail.session.totalSalesUSD.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-emerald-700/80">
                        +{sessionDetail.session.totalSalesKHR.toLocaleString()} KHR
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Expected in Drawer
                      </span>
                      <div className="text-sm font-bold font-mono text-slate-900">
                        ${sessionDetail.session.expectedCashUSD.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {sessionDetail.session.expectedCashKHR.toLocaleString()} KHR
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Counted &amp; Diff
                      </span>
                      <div className="text-sm font-bold font-mono text-slate-900">
                        $
                        {sessionDetail.session.actualCashUSD !== null
                          ? sessionDetail.session.actualCashUSD.toFixed(2)
                          : '--'}
                      </div>
                      <div
                        className={`text-[10px] font-bold ${
                          (sessionDetail.session.differenceUSD || 0) === 0
                            ? 'text-emerald-600'
                            : (sessionDetail.session.differenceUSD || 0) > 0
                              ? 'text-blue-600'
                              : 'text-rose-600'
                        }`}
                      >
                        Diff: {(sessionDetail.session.differenceUSD || 0) >= 0 ? '+' : ''}$
                        {(sessionDetail.session.differenceUSD || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Cash Movements Ledger */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        Mid-Shift Cash Movements ({sessionDetail.movements.length})
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        All cash in, removals &amp; expenses logged with audit trails
                      </span>
                    </div>

                    {sessionDetail.movements.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-xs text-slate-400">
                        No manual cash movements (Cash In, Cash Out, Expenses) recorded during this
                        shift.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-xs">
                        {sessionDetail.movements.map((m) => (
                          <div
                            key={m.id}
                            className="p-3 bg-white flex items-center justify-between hover:bg-slate-50/60 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  m.type === 'CASH_IN'
                                    ? 'bg-blue-100 text-blue-700'
                                    : m.type === 'CASH_OUT'
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {m.type === 'CASH_IN' ? (
                                  <ArrowDownLeft className="w-4 h-4" />
                                ) : m.type === 'CASH_OUT' ? (
                                  <ArrowUpRight className="w-4 h-4" />
                                ) : (
                                  <Receipt className="w-4 h-4" />
                                )}
                              </span>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800">
                                    {m.type.replace('_', ' ')}
                                  </span>
                                  {m.referenceNumber && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      Ref: {m.referenceNumber}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600 mt-0.5">{m.reason}</p>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>Cashier: {m.cashierName}</span>
                                  <span>&bull;</span>
                                  <span>
                                    {new Date(m.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                  {m.auditLogId && (
                                    <>
                                      <span>&bull;</span>
                                      <span className="font-mono text-[9px] bg-slate-100 px-1 py-0.5 rounded text-slate-500">
                                        Audit #{m.auditLogId.slice(-8).toUpperCase()}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right font-mono">
                              <div
                                className={`font-bold ${
                                  m.type === 'CASH_IN' ? 'text-blue-600' : 'text-rose-600'
                                }`}
                              >
                                {m.type === 'CASH_IN' ? '+' : '-'}${m.amountUSD.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {m.type === 'CASH_IN' ? '+' : '-'}
                                {m.amountKHR.toLocaleString()} KHR
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cash Count Breakdown (if available) */}
                  {sessionDetail.session.denominationBreakdown && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-indigo-500" />
                        Denomination Count Breakdown
                      </h4>
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.entries(
                          (sessionDetail.session.denominationBreakdown as any).usd || {},
                        ).map(([bill, qty]: [string, any]) =>
                          qty > 0 ? (
                            <div
                              key={bill}
                              className="p-2 bg-white rounded border border-slate-200 flex justify-between"
                            >
                              <span className="text-slate-500">{bill.toUpperCase()}:</span>
                              <span className="font-bold text-slate-900">{qty} pcs</span>
                            </div>
                          ) : null,
                        )}
                        {Object.entries(
                          (sessionDetail.session.denominationBreakdown as any).khr || {},
                        ).map(([bill, qty]: [string, any]) =>
                          qty > 0 ? (
                            <div
                              key={bill}
                              className="p-2 bg-white rounded border border-slate-200 flex justify-between"
                            >
                              <span className="text-slate-500">{bill.toUpperCase()}:</span>
                              <span className="font-bold text-slate-900">{qty} pcs</span>
                            </div>
                          ) : null,
                        )}
                      </div>
                    </div>
                  )}

                  {/* Session Notes */}
                  {sessionDetail.session.closingNotes && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <span className="font-semibold text-slate-700 block mb-1">
                        Closing Reconciliation Note:
                      </span>
                      <p className="text-slate-600 text-[11px] italic">
                        "{sessionDetail.session.closingNotes}"
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => {
                  if (sessionDetail?.session) {
                    setPrintSession(sessionDetail.session);
                  }
                }}
                disabled={!sessionDetail}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Shift Z-Report</span>
              </button>

              <button
                onClick={() => {
                  setSelectedSessionId(null);
                  setSessionDetail(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Z-Report Modal */}
      <ShiftReportModal
        isOpen={!!printSession}
        onClose={() => setPrintSession(null)}
        session={printSession}
      />
    </div>
  );
}
