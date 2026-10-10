'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { RegisterSessionSummary, CashMovementRecord, DenominationBreakdown } from '@pos/types';
import {
  X,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Calculator,
  Lock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface RegisterManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: RegisterSessionSummary | null;
  movements: CashMovementRecord[];
  onRefresh: () => Promise<void>;
  onRecordCashMovement: (data: {
    type: 'CASH_IN' | 'CASH_OUT' | 'EXPENSE';
    amountUSD: number;
    amountKHR: number;
    reason: string;
    referenceNumber?: string;
    category?: string;
  }) => Promise<void>;
  onCloseRegister: (data: {
    actualCashUSD: number;
    actualCashKHR: number;
    denominationBreakdown?: DenominationBreakdown;
    closingNotes?: string;
  }) => Promise<void>;
}

type ManagementTab = 'overview' | 'cash_in' | 'cash_out' | 'expense' | 'count' | 'close';

// Configured denomination definitions for physical cash counting
const USD_DENOMINATIONS = [
  { key: '100', label: '$100 Bills', multiplier: 100, step: '1' },
  { key: '50', label: '$50 Bills', multiplier: 50, step: '1' },
  { key: '20', label: '$20 Bills', multiplier: 20, step: '1' },
  { key: '10', label: '$10 Bills', multiplier: 10, step: '1' },
  { key: '5', label: '$5 Bills', multiplier: 5, step: '1' },
  { key: '1', label: '$1 Bills', multiplier: 1, step: '1' },
  { key: 'coins', label: 'Coins ($)', multiplier: 1, step: '0.01' },
] as const;

const KHR_DENOMINATIONS = [
  { key: '100000', label: '100,000 ៛', multiplier: 100000 },
  { key: '50000', label: '50,000 ៛', multiplier: 50000 },
  { key: '20000', label: '20,000 ៛', multiplier: 20000 },
  { key: '15000', label: '15,000 ៛', multiplier: 15000 },
  { key: '10000', label: '10,000 ៛', multiplier: 10000 },
  { key: '5000', label: '5,000 ៛', multiplier: 5000 },
  { key: '2000', label: '2,000 ៛', multiplier: 2000 },
  { key: '1000', label: '1,000 ៛', multiplier: 1000 },
  { key: '500', label: '500 ៛', multiplier: 500 },
  { key: '100', label: '100 ៛', multiplier: 100 },
] as const;

const MOVEMENT_CONFIGS = {
  cash_in: {
    type: 'CASH_IN' as const,
    title: 'Record Cash In',
    desc: 'Add change or funds to the drawer.',
    icon: ArrowDownLeft,
    iconColor: 'text-emerald-400',
    btnClass: 'bg-emerald-600 hover:bg-emerald-500',
    btnLabel: 'Record Cash In',
    reasonPlaceholder: 'e.g. Added change from vault',
    refPlaceholder: 'e.g. SLIP-10294 or SAFE-DROP-1',
  },
  cash_out: {
    type: 'CASH_OUT' as const,
    title: 'Record Cash Out',
    desc: 'Remove cash for deposits or safe drops.',
    icon: ArrowUpRight,
    iconColor: 'text-amber-400',
    btnClass: 'bg-amber-600 hover:bg-amber-500',
    btnLabel: 'Record Cash Out',
    reasonPlaceholder: 'e.g. Safe drop',
    refPlaceholder: 'e.g. SLIP-10294 or SAFE-DROP-1',
  },
  expense: {
    type: 'EXPENSE' as const,
    title: 'Store Expense',
    desc: 'Record store expense paid from register cash.',
    icon: Receipt,
    iconColor: 'text-rose-400',
    btnClass: 'bg-rose-600 hover:bg-rose-500',
    btnLabel: 'Record Expense',
    reasonPlaceholder: 'e.g. Purchased floor disinfectant and mops',
    refPlaceholder: 'e.g. RCP-7729',
  },
} as const;

export const RegisterManagementModal: React.FC<RegisterManagementModalProps> = ({
  isOpen,
  onClose,
  session,
  movements,
  onRefresh,
  onRecordCashMovement,
  onCloseRegister,
}) => {
  const [activeTab, setActiveTab] = useState<ManagementTab>('overview');

  // Cash In / Out / Expense Form State
  const [movementUSD, setMovementUSD] = useState<string>('');
  const [movementKHR, setMovementKHR] = useState<string>('');
  const [movementReason, setMovementReason] = useState<string>('');
  const [movementRef, setMovementRef] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<string>('Store Operations');

  // Physical Cash Count Denominations State
  const [usdCounts, setUsdCounts] = useState<Record<string, number>>({
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
    '1': 0,
    coins: 0,
  });

  const [khrCounts, setKhrCounts] = useState<Record<string, number>>({
    '100000': 0,
    '50000': 0,
    '20000': 0,
    '15000': 0,
    '10000': 0,
    '5000': 0,
    '2000': 0,
    '1000': 0,
    '500': 0,
    '100': 0,
  });

  // Close Register State
  const [closeUSD, setCloseUSD] = useState<string>('');
  const [closeKHR, setCloseKHR] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Compute Counted Totals via Declarative Denominations
  const countedUSD = useMemo(() => {
    const total = USD_DENOMINATIONS.reduce(
      (sum, d) => sum + (usdCounts[d.key] || 0) * d.multiplier,
      0,
    );
    return Number(total.toFixed(2));
  }, [usdCounts]);

  const countedKHR = useMemo(() => {
    return KHR_DENOMINATIONS.reduce(
      (sum, d) => sum + (khrCounts[d.key] || 0) * d.multiplier,
      0,
    );
  }, [khrCounts]);

  useEffect(() => {
    if (session) {
      if (!closeUSD) setCloseUSD(session.expectedCashUSD.toFixed(2));
      if (!closeKHR) setCloseKHR(session.expectedCashKHR.toString());
    }
  }, [session, closeUSD, closeKHR]);

  if (!isOpen || !session) return null;

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleCashMovementSubmit = async (type: 'CASH_IN' | 'CASH_OUT' | 'EXPENSE') => {
    setErrorMessage(null);
    const u = parseFloat(movementUSD) || 0;
    const k = parseFloat(movementKHR) || 0;

    if (u <= 0 && k <= 0) {
      setErrorMessage('Please enter an amount greater than zero.');
      return;
    }
    if (!movementReason.trim()) {
      setErrorMessage('Please provide a reason for this cash movement.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onRecordCashMovement({
        type,
        amountUSD: u,
        amountKHR: k,
        reason: movementReason.trim(),
        referenceNumber: movementRef.trim() || undefined,
        category: type === 'EXPENSE' ? expenseCategory : undefined,
      });

      setMovementUSD('');
      setMovementKHR('');
      setMovementReason('');
      setMovementRef('');
      showSuccess(`Cash movement (${type}) recorded successfully.`);
      await onRefresh();
      setActiveTab('overview');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record cash movement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyCountToClose = () => {
    setCloseUSD(countedUSD.toFixed(2));
    setCloseKHR(countedKHR.toString());
    setActiveTab('close');
    showSuccess('Physical cash count applied to shift close inputs.');
  };

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const actUSD = parseFloat(closeUSD) || 0;
    const actKHR = parseFloat(closeKHR) || 0;

    if (actUSD < 0 || actKHR < 0) {
      setErrorMessage('Counted cash amounts cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCloseRegister({
        actualCashUSD: actUSD,
        actualCashKHR: actKHR,
        denominationBreakdown: {
          usd: usdCounts as any,
          khr: khrCounts as any,
        },
        closingNotes: closingNotes.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to close register session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const expectedUSD = session.expectedCashUSD;
  const expectedKHR = session.expectedCashKHR;
  const closeInputUSD = parseFloat(closeUSD) || 0;
  const closeInputKHR = parseFloat(closeKHR) || 0;
  const diffUSD = Number((closeInputUSD - expectedUSD).toFixed(2));
  const diffKHR = closeInputKHR - expectedKHR;

  const tabs = [
    { id: 'overview' as const, label: 'Overview & Cash', icon: DollarSign },
    { id: 'cash_in' as const, label: 'Cash In', icon: ArrowDownLeft },
    { id: 'cash_out' as const, label: 'Cash Out', icon: ArrowUpRight },
    { id: 'expense' as const, label: 'Expenses', icon: Receipt },
    { id: 'count' as const, label: 'Cash Count', icon: Calculator },
    { id: 'close' as const, label: 'Close Register', icon: Lock },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white leading-tight">
                  Register Management
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {session.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {session.registerCode} &bull; {session.storeName} &bull; Cashier:{' '}
                {session.cashierName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 bg-slate-950/40 shrink-0 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setErrorMessage(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                  active
                    ? 'border-emerald-500 text-white bg-slate-800/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-lg bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW & CURRENT CASH */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Expected Cash Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-lg bg-slate-950 border border-slate-800 relative">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Expected Cash (USD)
                  </div>
                  <div className="text-3xl font-bold font-mono text-white mt-1">
                    ${session.expectedCashUSD.toFixed(2)}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Expected cash in drawer
                  </p>
                </div>

                <div className="p-5 rounded-lg bg-slate-950 border border-slate-800 relative">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Expected Cash (KHR)
                  </div>
                  <div className="text-3xl font-bold font-mono text-white mt-1">
                    {session.expectedCashKHR.toLocaleString()} ៛
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Expected Riel in drawer</p>
                </div>
              </div>

              {/* Financial Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Opening Float
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-200 mt-0.5 block">
                    ${session.openingFloatUSD.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {session.openingFloatKHR.toLocaleString()}៛
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                    Cash Sales ({session.totalSalesCount})
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
                    +${session.cashSalesUSD.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    +{session.cashSalesKHR.toLocaleString()}៛
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                    Cash In
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
                    +${session.cashInUSD.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    +{session.cashInKHR.toLocaleString()}៛
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-amber-400 font-bold uppercase block">
                    Cash Out
                  </span>
                  <span className="text-sm font-bold font-mono text-amber-400 mt-0.5 block">
                    -${session.cashOutUSD.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    -{session.cashOutKHR.toLocaleString()}៛
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-rose-400 font-bold uppercase block">
                    Expenses
                  </span>
                  <span className="text-sm font-bold font-mono text-rose-400 mt-0.5 block">
                    -${session.expensesUSD.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    -{session.expensesKHR.toLocaleString()}៛
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-purple-400 font-bold uppercase block">
                    Refunds
                  </span>
                  <span className="text-sm font-bold font-mono text-purple-400 mt-0.5 block">
                    -${session.cashRefundsUSD.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    -{session.cashRefundsKHR.toLocaleString()}៛
                  </span>
                </div>
              </div>

              {/* Recent Mid-Shift Cash Movements Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Recent Cash Movements ({movements.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab('cash_in')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    + Record Movement
                  </button>
                </div>

                {movements.length === 0 ? (
                  <div className="p-6 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                    No cash movements recorded yet.
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-800 overflow-hidden bg-slate-950/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                        <tr>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Reason / Details</th>
                          <th className="py-2.5 px-3">Amount (USD)</th>
                          <th className="py-2.5 px-3">Amount (KHR)</th>
                          <th className="py-2.5 px-3">User</th>
                          <th className="py-2.5 px-3">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {movements.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-900/40">
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  m.type === 'CASH_IN' || m.type === 'FLOAT_ADD'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : m.type === 'EXPENSE'
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-300 max-w-xs truncate">
                              {m.reason}
                              {m.referenceNumber && (
                                <span className="text-[10px] text-slate-500 block">
                                  Ref: {m.referenceNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-200">
                              ${m.amountUSD.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {m.amountKHR > 0 ? `${m.amountKHR.toLocaleString()}៛` : '—'}
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-400">
                              {m.cashierName}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                              {new Date(m.createdAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TABS 2, 3, 4: UNIFIED CASH MOVEMENT FORM (CASH IN / CASH OUT / EXPENSE) */}
          {(activeTab === 'cash_in' || activeTab === 'cash_out' || activeTab === 'expense') && (() => {
            const cfg = MOVEMENT_CONFIGS[activeTab];
            const Icon = cfg.icon;
            const isExpense = activeTab === 'expense';

            return (
              <div className="max-w-md mx-auto space-y-4">
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
                    <span>{cfg.title}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">{cfg.desc}</p>
                </div>

                {isExpense && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Expense Category
                    </label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Store Operations">Store Operations</option>
                      <option value="Cleaning Supplies">Cleaning Supplies</option>
                      <option value="Refreshments">Refreshments &amp; Water</option>
                      <option value="Courier / Delivery">Courier / Delivery</option>
                      <option value="Emergency Maintenance">Emergency Maintenance</option>
                      <option value="Other">Other Miscellaneous</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Amount USD ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={movementUSD}
                    onChange={(e) => setMovementUSD(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Amount KHR (៛)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={movementKHR}
                    onChange={(e) => setMovementKHR(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isExpense ? 'Description / Reason' : 'Reason / Purpose'} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                    placeholder={cfg.reasonPlaceholder}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isExpense ? 'Receipt / Invoice # (Optional)' : 'Reference # (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={movementRef}
                    onChange={(e) => setMovementRef(e.target.value)}
                    placeholder={cfg.refPlaceholder}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleCashMovementSubmit(cfg.type)}
                  disabled={isSubmitting}
                  className={`w-full py-2.5 rounded-lg font-bold text-xs text-white shadow-xs transition-colors disabled:opacity-50 ${cfg.btnClass}`}
                >
                  {isSubmitting ? 'Saving...' : cfg.btnLabel}
                </button>
              </div>
            );
          })()}

          {/* TAB 5: PHYSICAL CASH COUNT (DENOMINATION COUNTER) */}
          {activeTab === 'count' && (
            <div className="space-y-6">
              {/* Header and comparison bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Expected Cash
                  </span>
                  <div className="text-lg font-bold font-mono text-slate-200 mt-0.5">
                    ${expectedUSD.toFixed(2)} &bull; {expectedKHR.toLocaleString()}៛
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">
                    Counted Cash Total
                  </span>
                  <div className="text-lg font-bold font-mono text-emerald-300 mt-0.5">
                    ${countedUSD.toFixed(2)} &bull; {countedKHR.toLocaleString()}៛
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Difference</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-lg font-bold font-mono ${
                        countedUSD - expectedUSD === 0
                          ? 'text-emerald-400'
                          : countedUSD - expectedUSD > 0
                            ? 'text-blue-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {countedUSD - expectedUSD >= 0 ? '+' : ''}$
                      {(countedUSD - expectedUSD).toFixed(2)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        countedUSD - expectedUSD === 0
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : countedUSD - expectedUSD > 0
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {countedUSD - expectedUSD === 0
                        ? 'Exact Match'
                        : countedUSD - expectedUSD > 0
                          ? 'Over'
                          : 'Short'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Denominations Split Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* USD Denominations */}
                <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                    <span>US Dollar Denominations ($)</span>
                    <span className="font-mono text-white">${countedUSD.toFixed(2)}</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    {USD_DENOMINATIONS.map((d) => (
                      <div key={d.key} className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 font-semibold">{d.label}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step={d.step}
                            value={usdCounts[d.key] || ''}
                            onChange={(e) =>
                              setUsdCounts((prev) => ({
                                ...prev,
                                [d.key]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            placeholder="0"
                            className="w-24 px-2.5 py-1 text-right bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KHR Denominations */}
                <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Khmer Riel Denominations (៛)</span>
                    <span className="font-mono text-white">{countedKHR.toLocaleString()} ៛</span>
                  </h4>
                  <div className="space-y-2 text-xs">
                    {KHR_DENOMINATIONS.map((d) => (
                      <div key={d.key} className="flex items-center justify-between gap-3">
                        <span className="text-slate-400 font-semibold">{d.label}</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={khrCounts[d.key] || ''}
                            onChange={(e) =>
                              setKhrCounts((prev) => ({
                                ...prev,
                                [d.key]: parseInt(e.target.value, 10) || 0,
                              }))
                            }
                            placeholder="0"
                            className="w-24 px-2.5 py-1 text-right bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleApplyCountToClose}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Use Counted Total &rarr;
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: CLOSE REGISTER */}
          {activeTab === 'close' && (
            <form
              onSubmit={handleCloseShiftSubmit}
              className="max-w-lg mx-auto space-y-5"
            >
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Close Register</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Count drawer cash, record discrepancies, and close the shift.
                </p>
              </div>

              {/* Comparison Card */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Expected Cash (USD):</span>
                  <span className="font-bold text-slate-200">${expectedUSD.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Counted Cash (USD):</span>
                  <span className="font-bold text-white">${closeInputUSD.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Discrepancy:</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-black text-sm ${
                        diffUSD === 0 && diffKHR === 0
                          ? 'text-emerald-400'
                          : diffUSD >= 0 && diffKHR >= 0
                            ? 'text-blue-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {diffUSD >= 0 ? '+' : ''}${diffUSD.toFixed(2)} ({diffKHR >= 0 ? '+' : ''}
                      {diffKHR.toLocaleString()} ៛)
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        diffUSD === 0
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : diffUSD > 0
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {diffUSD === 0 ? 'Balanced' : diffUSD > 0 ? 'Over' : 'Short'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Counted Cash USD Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Counted Cash (USD) <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('count')}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    Use cash counter
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={closeUSD}
                  onChange={(e) => setCloseUSD(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Counted Cash KHR Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Counted Cash (KHR) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={closeKHR}
                  onChange={(e) => setCloseKHR(e.target.value)}
                  placeholder="0"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-base font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Closing Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Closing Notes
                </label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="e.g. End of shift balance verified with manager. All drops completed."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {isSubmitting ? 'Closing Register...' : 'Close Register'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
