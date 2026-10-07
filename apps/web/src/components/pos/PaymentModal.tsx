'use client';

import React, { useState, useEffect } from 'react';
import { PosCustomer, PosPaymentMethod } from '@pos/types';
import { X, CreditCard, Banknote, QrCode, Check, AlertCircle, Sparkles } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalUSD: number;
  totalKHR: number;
  customer: PosCustomer | null;
  paymentMethods: PosPaymentMethod[];
  onCompleteCheckout: (
    payments: {
      paymentMethodCode: string;
      amountUSD: number;
      amountKHR: number;
      tenderAmountUSD: number;
      tenderAmountKHR: number;
    }[],
  ) => Promise<void>;
  isProcessing: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  totalUSD,
  totalKHR,
  customer,
  paymentMethods,
  onCompleteCheckout,
  isProcessing,
}) => {
  const [selectedMethodCode, setSelectedMethodCode] = useState<string>('CASH');
  const [tenderUSD, setTenderUSD] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Set default tender amount when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedMethodCode('CASH');
      // Suggest nearest bill (e.g. $7.60 -> $10.00)
      const roundedUp = Math.ceil(totalUSD / 5) * 5 || totalUSD;
      setTenderUSD(roundedUp.toFixed(2));
      setError(null);
    }
  }, [isOpen, totalUSD]);

  if (!isOpen) return null;

  const tenderNum = parseFloat(tenderUSD) || 0;
  const changeUSD = Math.max(0, Number((tenderNum - totalUSD).toFixed(2)));
  const changeKHR = Math.round(changeUSD * 4100);
  const isTenderSufficient = tenderNum >= totalUSD;

  const quickPresets = [
    { label: 'Exact', value: totalUSD },
    { label: '$10', value: 10 },
    { label: '$20', value: 20 },
    { label: '$50', value: 50 },
    { label: '$100', value: 100 },
  ];

  const handleCashSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (selectedMethodCode === 'CASH') {
      if (!isTenderSufficient) {
        setError(
          `Tendered amount ($${tenderNum.toFixed(2)}) is less than total due ($${totalUSD.toFixed(2)})`,
        );
        return;
      }

      await onCompleteCheckout([
        {
          paymentMethodCode: 'CASH',
          amountUSD: totalUSD,
          amountKHR: 0,
          tenderAmountUSD: tenderNum,
          tenderAmountKHR: 0,
        },
      ]);
    } else if (selectedMethodCode === 'KHQR_ABA') {
      await onCompleteCheckout([
        {
          paymentMethodCode: 'KHQR_ABA',
          amountUSD: totalUSD,
          amountKHR: totalKHR,
          tenderAmountUSD: totalUSD,
          tenderAmountKHR: totalKHR,
        },
      ]);
    } else {
      await onCompleteCheckout([
        {
          paymentMethodCode: 'CARD',
          amountUSD: totalUSD,
          amountKHR: 0,
          tenderAmountUSD: totalUSD,
          tenderAmountKHR: 0,
        },
      ]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header with Amount Due */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              Amount Due
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black text-white">${totalUSD.toFixed(2)}</span>
              <span className="text-sm font-semibold text-slate-400">
                {totalKHR.toLocaleString()} ៛
              </span>
            </div>
            {customer && (
              <div className="text-[11px] text-indigo-200 mt-1 flex items-center gap-1.5 font-medium">
                <span>
                  Customer: <strong>{customer.name}</strong>
                </span>
                {customer.loyaltyPoints > 0 && (
                  <span className="bg-indigo-800 text-indigo-100 px-1.5 py-0.2 rounded-full font-bold">
                    {customer.loyaltyPoints} pts
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Payment Methods Bar */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex gap-2 shrink-0">
          {(paymentMethods.length > 0
            ? paymentMethods
            : [
                { id: '1', code: 'CASH', name: 'Cash', type: 'CASH', isDefault: true },
                {
                  id: '2',
                  code: 'KHQR_ABA',
                  name: 'ABA KHQR',
                  type: 'DIGITAL_QR',
                  isDefault: false,
                },
                { id: '3', code: 'CARD', name: 'Card', type: 'CARD', isDefault: false },
              ]
          ).map((pm) => (
            <button
              key={pm.code}
              type="button"
              onClick={() => setSelectedMethodCode(pm.code)}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                selectedMethodCode === pm.code
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200 ring-2 ring-indigo-500/10'
                  : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              {pm.code === 'CASH' && <Banknote className="w-4 h-4" />}
              {pm.code === 'KHQR_ABA' && <QrCode className="w-4 h-4 text-cyan-600" />}
              {pm.code === 'CARD' && <CreditCard className="w-4 h-4 text-blue-600" />}
              <span>{pm.name}</span>
            </button>
          ))}
        </div>

        {/* Method Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* CASH MODE */}
          {selectedMethodCode === 'CASH' && (
            <div className="space-y-4">
              {/* Quick Cash Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                  Quick Tender Presets
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setTenderUSD(preset.value.toFixed(2))}
                      className="py-2.5 px-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tendered Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tendered Cash Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-lg">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    autoFocus
                    value={tenderUSD}
                    onChange={(e) => setTenderUSD(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl text-xl font-black text-slate-900 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Real-time Change Output Card */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  isTenderSufficient
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Change Due
                  </span>
                  {isTenderSufficient ? (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Sufficient
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-700">
                      Short by ${(totalUSD - tenderNum).toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black text-emerald-700">
                    ${changeUSD.toFixed(2)}
                  </div>
                  <div className="text-sm font-bold text-emerald-600 font-mono">
                    {changeKHR.toLocaleString()} ៛
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA KHQR MODE */}
          {selectedMethodCode === 'KHQR_ABA' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center font-black text-sm">
                ABA
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900">Scan to Pay with ABA Mobile</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Universal KHQR accepted by all Cambodian banking apps
                </p>
              </div>

              {/* Dynamic QR Box */}
              <div className="p-3 bg-white border-2 border-dashed border-cyan-400 rounded-2xl shadow-sm">
                <div className="w-44 h-44 bg-slate-900 rounded-xl p-3 flex flex-col items-center justify-center text-white text-center">
                  <QrCode className="w-28 h-28 text-white" />
                  <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-300 mt-1">
                    KHQR PAYWAY
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 font-mono">
                Merchant: <span className="font-bold">ANGKOR FRESH MART</span> &bull; $
                {totalUSD.toFixed(2)}
              </div>
            </div>
          )}

          {/* CARD MODE */}
          {selectedMethodCode === 'CARD' && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                <CreditCard className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-800">Card Payment Terminal</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Insert, swipe, or tap contactless card on the connected POS card terminal.
              </p>
              <div className="pt-2 text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-200 text-slate-600">
                Amount to charge:{' '}
                <span className="font-bold text-slate-900">${totalUSD.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Submit Button */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
          >
            Cancel (ESC)
          </button>

          <button
            type="button"
            disabled={isProcessing || (selectedMethodCode === 'CASH' && !isTenderSufficient)}
            onClick={() => handleCashSubmit()}
            className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing Transaction...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Complete Payment (Enter)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
