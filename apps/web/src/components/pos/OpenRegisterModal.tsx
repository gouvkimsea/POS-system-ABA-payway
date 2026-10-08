'use client';

import React, { useState } from 'react';
import { LockOpen, DollarSign, AlertCircle, X, Store, Monitor } from 'lucide-react';

interface OpenRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  registerCode?: string;
  registerName?: string;
  storeName?: string;
  cashierName?: string;
  onConfirmOpen: (data: {
    openingFloatUSD: number;
    openingFloatKHR: number;
    notes?: string;
  }) => Promise<void>;
}

export const OpenRegisterModal: React.FC<OpenRegisterModalProps> = ({
  isOpen,
  onClose,
  registerCode = 'REG-01',
  registerName = 'Counter 01 Main POS',
  storeName = 'Monivong Central Branch',
  cashierName = 'Cashier',
  onConfirmOpen,
}) => {
  const [openingUSD, setOpeningUSD] = useState<string>('100.00');
  const [openingKHR, setOpeningKHR] = useState<string>('200000');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const valUSD = parseFloat(openingUSD) || 0;
    const valKHR = parseFloat(openingKHR) || 0;

    if (valUSD < 0 || valKHR < 0) {
      setErrorMessage('Opening cash amounts cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmOpen({
        openingFloatUSD: valUSD,
        openingFloatKHR: valKHR,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to open register session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/60 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <LockOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Open Cash Register</h2>
              <p className="text-xs text-slate-400">
                Enter starting float to begin shift.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Terminal & Cashier Metadata Info Strip */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                  Register
                </span>
                <span className="font-bold text-slate-200">
                  {registerCode} - {registerName}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                  Store / Cashier
                </span>
                <span className="font-bold text-slate-200 truncate block max-w-[160px]">
                  {cashierName} ({storeName})
                </span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Opening Float USD */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Starting Cash (USD)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={openingUSD}
                onChange={(e) => setOpeningUSD(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-semibold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-2 mt-2">
              {['50', '100', '150', '200'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setOpeningUSD(preset + '.00')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition-colors border border-slate-700/60"
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          {/* Opening Float KHR */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Starting Cash (KHR)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                ៛
              </div>
              <input
                type="number"
                step="100"
                min="0"
                inputMode="numeric"
                value={openingKHR}
                onChange={(e) => setOpeningKHR(e.target.value)}
                placeholder="0"
                required
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-semibold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-2 mt-2">
              {[
                { label: '100K', val: '100000' },
                { label: '200K', val: '200000' },
                { label: '400K', val: '400000' },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setOpeningKHR(p.val)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition-colors border border-slate-700/60"
                >
                  {p.label}៛
                </button>
              ))}
            </div>
          </div>

          {/* Shift Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Notes (optional)
            </label>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Verified by manager"
                rows={2}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              <LockOpen className="w-4 h-4" />
              <span>{isSubmitting ? 'Opening...' : 'Open Register'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
