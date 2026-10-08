'use client';

import React, { useState, useEffect } from 'react';
import { PosCustomer, PosPaymentMethod, PaymentMethodConfig } from '@pos/types';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  Check,
  AlertCircle,
  Sparkles,
  Landmark,
  Gift,
} from 'lucide-react';
import { useSettings } from '../../lib/settings-context';

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
      transactionRef?: string;
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
  const { settings, formatCurrency } = useSettings();
  const [selectedMethodCode, setSelectedMethodCode] = useState<string>('CASH');
  const [tenderUSD, setTenderUSD] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default tender amount when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedMethodCode('CASH');
      const roundedUp = Math.ceil(totalUSD / 5) * 5 || totalUSD;
      setTenderUSD(roundedUp.toFixed(2));
      setTransactionRef('');
      setError(null);
      setIsSubmitting(false);
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

  const quickKhrPresets = [
    { label: '10,000៛', value: Number((10000 / 4100).toFixed(2)) },
    { label: '20,000៛', value: Number((20000 / 4100).toFixed(2)) },
    { label: '50,000៛', value: Number((50000 / 4100).toFixed(2)) },
    { label: '100,000៛', value: Number((100000 / 4100).toFixed(2)) },
  ];

  const handleNumpadKey = (key: string) => {
    if (key === 'C') {
      setTenderUSD('');
      return;
    }
    if (key === '.') {
      if (!tenderUSD.includes('.')) {
        setTenderUSD(tenderUSD ? `${tenderUSD}.` : '0.');
      }
      return;
    }
    setTenderUSD((prev) => (prev === '0' ? key : prev + key));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isProcessing || isSubmitting) return; // Prevent double-click race condition

    setError(null);
    setIsSubmitting(true);

    try {
      if (selectedMethodCode === 'CASH') {
        if (!isTenderSufficient) {
          setError(
            `Tendered amount ($${tenderNum.toFixed(2)}) is less than total due ($${totalUSD.toFixed(2)})`,
          );
          setIsSubmitting(false);
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
            transactionRef: transactionRef.trim() || undefined,
          },
        ]);
      } else if (selectedMethodCode === 'BANK_TRANSFER') {
        await onCompleteCheckout([
          {
            paymentMethodCode: 'BANK_TRANSFER',
            amountUSD: totalUSD,
            amountKHR: totalKHR,
            tenderAmountUSD: totalUSD,
            tenderAmountKHR: totalKHR,
            transactionRef: transactionRef.trim() || undefined,
          },
        ]);
      } else if (selectedMethodCode === 'OTHER') {
        await onCompleteCheckout([
          {
            paymentMethodCode: 'OTHER',
            amountUSD: totalUSD,
            amountKHR: 0,
            tenderAmountUSD: totalUSD,
            tenderAmountKHR: 0,
            transactionRef: transactionRef.trim() || undefined,
          },
        ]);
      } else {
        // CARD
        await onCompleteCheckout([
          {
            paymentMethodCode: 'CARD',
            amountUSD: totalUSD,
            amountKHR: 0,
            tenderAmountUSD: totalUSD,
            tenderAmountKHR: 0,
            transactionRef: transactionRef.trim() || undefined,
          },
        ]);
      }
    } catch (err: any) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSettingsMethods = (settings.payments || []).filter(
    (p: PaymentMethodConfig) => p.isActive,
  );
  const methodsList: PosPaymentMethod[] =
    paymentMethods.length > 0
      ? paymentMethods
      : activeSettingsMethods.length > 0
        ? activeSettingsMethods.map((p: PaymentMethodConfig) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            type: p.type as any,
            isDefault: p.isDefault,
          }))
        : [
            { id: '1', code: 'CASH', name: 'Cash', type: 'CASH', isDefault: true },
            { id: '2', code: 'KHQR_ABA', name: 'ABA KHQR', type: 'DIGITAL_QR', isDefault: false },
            { id: '3', code: 'CARD', name: 'Card', type: 'CARD', isDefault: false },
            {
              id: '4',
              code: 'BANK_TRANSFER',
              name: 'Bank Transfer',
              type: 'BANK_TRANSFER',
              isDefault: false,
            },
            { id: '5', code: 'OTHER', name: 'Voucher / Other', type: 'OTHER', isDefault: false },
          ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150">
        {/* Header with Amount Due */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              Amount Due
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-black text-white">
                {formatCurrency(totalUSD, 'USD')}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-400">
                {formatCurrency(totalKHR, 'KHR')}
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
            disabled={isProcessing || isSubmitting}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Payment Methods Bar */}
        <div className="p-2.5 sm:p-3 bg-slate-100 border-b border-slate-200 flex gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
          {methodsList.map((pm) => (
            <button
              key={pm.code}
              type="button"
              onClick={() => {
                setSelectedMethodCode(pm.code);
                setError(null);
              }}
              className={`flex-1 py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[44px] transition-all ${
                selectedMethodCode === pm.code
                  ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200 ring-2 ring-indigo-500/10'
                  : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              {pm.code === 'CASH' && <Banknote className="w-4 h-4 text-emerald-600" />}
              {pm.code === 'KHQR_ABA' && <QrCode className="w-4 h-4 text-cyan-600" />}
              {pm.code === 'CARD' && <CreditCard className="w-4 h-4 text-blue-600" />}
              {pm.code === 'BANK_TRANSFER' && <Landmark className="w-4 h-4 text-purple-600" />}
              {pm.code === 'OTHER' && <Gift className="w-4 h-4 text-amber-600" />}
              <span>{pm.name}</span>
            </button>
          ))}
        </div>

        {/* Method Content */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3.5 touch-scroll">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* CASH MODE */}
          {selectedMethodCode === 'CASH' && (
            <div className="space-y-3.5">
              {/* USD Presets */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  USD Quick Presets
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {quickPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setTenderUSD(preset.value.toFixed(2))}
                      className="min-h-[42px] px-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* KHR Presets */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  KHR Quick Notes (៛)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {quickKhrPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setTenderUSD(preset.value.toFixed(2))}
                      className="min-h-[42px] px-1 bg-indigo-50/50 hover:bg-indigo-100 hover:text-indigo-800 text-indigo-900 border border-indigo-200/80 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Display & Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tendered Cash Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-bold text-lg pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    enterKeyHint="done"
                    value={tenderUSD}
                    onChange={(e) => setTenderUSD(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white rounded-xl text-xl font-black text-slate-900 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* On-Screen Touch Numpad for Touchscreens & Mobile Devices */}
              <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/70">
                <div className="grid grid-cols-3 gap-1.5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '.'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleNumpadKey(key)}
                      className={`h-11 sm:h-12 rounded-xl font-black text-lg transition-all select-none active:scale-95 flex items-center justify-center ${
                        key === 'C'
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          : 'bg-white hover:bg-slate-100 text-slate-900 border border-slate-200/80 shadow-2xs'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

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
                      Short by {formatCurrency(totalUSD - tenderNum, 'USD')}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black text-emerald-700">
                    {formatCurrency(changeUSD, 'USD')}
                  </div>
                  <div className="text-sm font-bold text-emerald-600 font-mono">
                    {formatCurrency(changeKHR, 'KHR')}
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
                {totalUSD.toFixed(2)} ({totalKHR.toLocaleString()} ៛)
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

          {/* BANK TRANSFER MODE */}
          {selectedMethodCode === 'BANK_TRANSFER' && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
                <Landmark className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h4 className="font-bold text-sm text-slate-800">Direct Bank Transfer / Wire</h4>
                <p className="text-xs text-slate-500">
                  Verify customer bank transfer confirmation slip.
                </p>
              </div>
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank Transfer Reference / Slip #
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-99881234"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* VOUCHER / OTHER MODE */}
          {selectedMethodCode === 'OTHER' && (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                <Gift className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h4 className="font-bold text-sm text-slate-800">
                  Voucher / Gift Card / Other Tender
                </h4>
                <p className="text-xs text-slate-500">
                  Apply external voucher, promo coupon, or store gift card.
                </p>
              </div>
              <div className="text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Voucher / Coupon Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. VOUCH-GIFT-50"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Submit Button with Double-Click Protection & Safe Area Padding */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            disabled={isProcessing || isSubmitting}
            onClick={onClose}
            className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold disabled:opacity-50"
          >
            Cancel (ESC)
          </button>

          <button
            type="button"
            disabled={
              isProcessing || isSubmitting || (selectedMethodCode === 'CASH' && !isTenderSufficient)
            }
            onClick={() => handleSubmit()}
            className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isProcessing || isSubmitting ? (
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
