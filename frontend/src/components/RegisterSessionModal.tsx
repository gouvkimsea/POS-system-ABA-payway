'use client';

import React, { useState } from 'react';
import { X, Layers, ArrowDownRight, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { RegisterSession } from '../lib/types';
import { apiRequest } from '../lib/api';

interface RegisterSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: RegisterSession | null;
  onSessionUpdated: () => void;
}

export const RegisterSessionModal: React.FC<RegisterSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  onSessionUpdated,
}) => {
  const [tab, setTab] = useState<'DETAILS' | 'MOVEMENT' | 'CLOSE'>('DETAILS');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Open Form
  const [openFloatUSD, setOpenFloatUSD] = useState<number>(50);
  const [openFloatKHR, setOpenFloatKHR] = useState<number>(200000);

  // Movement Form
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT' | 'PAY_OUT'>('CASH_IN');
  const [movementAmountUSD, setMovementAmountUSD] = useState<number>(0);
  const [movementAmountKHR, setMovementAmountKHR] = useState<number>(0);
  const [movementReason, setMovementReason] = useState<string>('');

  // Close Form
  const [actualUSD, setActualUSD] = useState<number>(session?.expectedCashUSD || 0);
  const [actualKHR, setActualKHR] = useState<number>(session?.expectedCashKHR || 0);
  const [closingNotes, setClosingNotes] = useState<string>('');

  if (!isOpen) return null;

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await apiRequest('/registers/sessions/open', {
      method: 'POST',
      body: JSON.stringify({
        registerId: session?.registerId || 'REG-01',
        openingFloatUSD: openFloatUSD,
        openingFloatKHR: openFloatKHR,
        notes: 'Cashier shift opening',
      }),
    });

    setIsSubmitting(false);
    if (res.success) {
      onSessionUpdated();
      onClose();
    } else {
      setError(res.error?.message || 'Failed to open session');
    }
  };

  const handleCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setIsSubmitting(true);
    setError(null);

    const res = await apiRequest(`/registers/sessions/${session.id}/cash-movement`, {
      method: 'POST',
      body: JSON.stringify({
        type: movementType,
        amountUSD: movementAmountUSD,
        amountKHR: movementAmountKHR,
        reason: movementReason || 'Cash drawer adjustment',
      }),
    });

    setIsSubmitting(false);
    if (res.success) {
      onSessionUpdated();
      setMovementAmountUSD(0);
      setMovementAmountKHR(0);
      setMovementReason('');
      setTab('DETAILS');
    } else {
      setError(res.error?.message || 'Failed to record cash movement');
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setIsSubmitting(true);
    setError(null);

    const res = await apiRequest(`/registers/sessions/${session.id}/close`, {
      method: 'POST',
      body: JSON.stringify({
        actualCashUSD: actualUSD,
        actualCashKHR: actualKHR,
        closingNotes,
      }),
    });

    setIsSubmitting(false);
    if (res.success) {
      onSessionUpdated();
      onClose();
    } else {
      setError(res.error?.message || 'Failed to close register session');
    }
  };

  const diffUSD = actualUSD - (session?.expectedCashUSD || 0);
  const diffKHR = actualKHR - (session?.expectedCashKHR || 0);

  const renderContent = () => {
    if (!session) {
      return (
        <form onSubmit={handleOpenSession} className="space-y-4">
          <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-200">
            <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto mb-1" />
            <h4 className="font-bold text-sm text-amber-900">No Active Register Session</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              Enter your opening drawer float to start ringing sales.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <label className="text-xs font-bold text-slate-700 block mb-1">Opening Float (USD)</label>
              <input
                type="number"
                step="0.01"
                value={openFloatUSD}
                onChange={(e) => setOpenFloatUSD(parseFloat(e.target.value) || 0)}
                className="w-full text-xl font-bold font-mono bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <label className="text-xs font-bold text-slate-700 block mb-1">Opening Float (KHR)</label>
              <input
                type="number"
                step="1000"
                value={openFloatKHR}
                onChange={(e) => setOpenFloatKHR(parseInt(e.target.value, 10) || 0)}
                className="w-full text-xl font-bold font-mono bg-white border border-slate-300 rounded-lg p-2 text-amber-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition shadow-md"
          >
            {isSubmitting ? 'Opening Session...' : 'Open Register Session'}
          </button>
        </form>
      );
    }

    if (tab === 'MOVEMENT') {
      return (
        <form onSubmit={handleCashMovement} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMovementType('CASH_IN')}
              className={`py-2 px-1 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1 ${
                movementType === 'CASH_IN' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Cash In</span>
            </button>
            <button
              type="button"
              onClick={() => setMovementType('CASH_OUT')}
              className={`py-2 px-1 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1 ${
                movementType === 'CASH_OUT' ? 'bg-red-600 text-white border-red-600' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Cash Out</span>
            </button>
            <button
              type="button"
              onClick={() => setMovementType('PAY_OUT')}
              className={`py-2 px-1 rounded-lg border text-xs font-bold transition flex items-center justify-center space-x-1 ${
                movementType === 'PAY_OUT' ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <span>Expense Pay</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Amount USD</label>
              <input
                type="number"
                step="0.01"
                value={movementAmountUSD || ''}
                onChange={(e) => setMovementAmountUSD(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full text-base font-bold font-mono border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Amount KHR</label>
              <input
                type="number"
                step="1000"
                value={movementAmountKHR || ''}
                onChange={(e) => setMovementAmountKHR(parseInt(e.target.value, 10) || 0)}
                placeholder="0"
                className="w-full text-base font-bold font-mono border border-slate-300 rounded-lg p-2 text-amber-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Reason / Note</label>
            <input
              type="text"
              required
              value={movementReason}
              onChange={(e) => setMovementReason(e.target.value)}
              placeholder="e.g. Petty cash replenishment, cleaning supplies"
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || (!movementAmountUSD && !movementAmountKHR)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
          >
            Record Cash Movement
          </button>
        </form>
      );
    }

    if (tab === 'CLOSE') {
      return (
        <form onSubmit={handleCloseSession} className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">End-of-Shift Cash Counting</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Actual USD Counted</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={actualUSD}
                  onChange={(e) => setActualUSD(parseFloat(e.target.value) || 0)}
                  className="w-full text-lg font-bold font-mono border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Actual KHR Counted</label>
                <input
                  type="number"
                  step="100"
                  required
                  value={actualKHR}
                  onChange={(e) => setActualKHR(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-lg font-bold font-mono border border-slate-300 rounded-lg p-2 text-amber-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-100 flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-600">Discrepancy:</span>
              <div className="space-x-2 font-mono font-bold">
                <span className={diffUSD >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {diffUSD >= 0 ? `+$${diffUSD.toFixed(2)}` : `-$${Math.abs(diffUSD).toFixed(2)}`}
                </span>
                <span className={diffKHR >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {diffKHR >= 0 ? `+${diffKHR.toLocaleString()} ៛` : `-${Math.abs(diffKHR).toLocaleString()} ៛`}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Shift Closing Notes</label>
            <textarea
              rows={2}
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Optional notes or explanations for discrepancies..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition shadow-md"
          >
            Confirm & Close Register Session (Z-Report)
          </button>
        </form>
      );
    }

    // Default: DETAILS
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs text-slate-500 font-semibold">Opening Float USD</span>
            <div className="text-xl font-bold font-mono text-slate-900">
              ${session.openingFloatUSD.toFixed(2)}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs text-slate-500 font-semibold font-mono">Opening Float KHR</span>
            <div className="text-xl font-bold font-mono text-amber-700">
              {session.openingFloatKHR.toLocaleString()} ៛
            </div>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
            Expected Cash In Drawer
          </span>
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-black font-mono text-emerald-400">
              ${session.expectedCashUSD.toFixed(2)}
            </span>
            <span className="text-lg font-bold font-mono text-amber-400">
              {session.expectedCashKHR.toLocaleString()} ៛
            </span>
          </div>
          <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
            <span>Completed Sales:</span>
            <span className="font-bold text-white font-mono">{session.totalSalesCount} orders</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-150">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base">Cash Register & Drawer Management</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        {session && (
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
            <button
              onClick={() => setTab('DETAILS')}
              className={`flex-1 py-3 text-center transition ${
                tab === 'DETAILS' ? 'border-b-2 border-blue-600 bg-white text-blue-600' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Session Overview
            </button>
            <button
              onClick={() => setTab('MOVEMENT')}
              className={`flex-1 py-3 text-center transition ${
                tab === 'MOVEMENT' ? 'border-b-2 border-blue-600 bg-white text-blue-600' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Cash In / Out
            </button>
            <button
              onClick={() => setTab('CLOSE')}
              className={`flex-1 py-3 text-center transition ${
                tab === 'CLOSE' ? 'border-b-2 border-red-600 bg-white text-red-600' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Close Shift
            </button>
          </div>
        )}

        {error && (
          <div className="m-4 mb-0 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-4 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
