'use client';

import React, { useState } from 'react';
import { X, CreditCard, Banknote, QrCode, CheckCircle, Calculator } from 'lucide-react';
import { CartItem } from '../lib/types';
import { playBeep } from '../lib/hardware';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  discountType: 'NONE' | 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  exchangeRateKHR: number;
  onCompleteSale: (saleData: {
    payments: Array<{
      method: 'CASH' | 'CARD' | 'KHQR';
      amountUSD: number;
      amountKHR: number;
      tenderAmountUSD: number;
      tenderAmountKHR: number;
    }>;
    notes?: string;
  }) => Promise<void>;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  discountType,
  discountValue,
  exchangeRateKHR,
  onCompleteSale,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'CARD' | 'KHQR'>('CASH');
  const [tenderUSD, setTenderUSD] = useState<number>(0);
  const [tenderKHR, setTenderKHR] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Recalculate totals
  const subtotalUSD = items.reduce((acc, item) => acc + item.product.sellingPriceUSD * item.quantity, 0);

  let discountUSD = 0;
  if (discountType === 'PERCENTAGE') {
    discountUSD = (subtotalUSD * discountValue) / 100;
  } else if (discountType === 'FIXED_AMOUNT') {
    discountUSD = Math.min(subtotalUSD, discountValue);
  }

  const taxableAmount = Math.max(0, subtotalUSD - discountUSD);
  const taxUSD = taxableAmount * 0.10;
  const totalUSD = Math.round((taxableAmount + taxUSD) * 100) / 100;
  const totalKHR = Math.round((totalUSD * exchangeRateKHR) / 100) * 100;

  // Tender calculations
  const totalTenderInUSD = Math.round((tenderUSD + tenderKHR / exchangeRateKHR) * 100) / 100;
  const isCovered = selectedMethod !== 'CASH' || totalTenderInUSD >= totalUSD - 0.009;

  const changeUSD = Math.max(0, Math.round((totalTenderInUSD - totalUSD) * 100) / 100);
  const changeKHR = Math.round((changeUSD * exchangeRateKHR) / 100) * 100;

  const handleAddUSD = (amount: number) => {
    setTenderUSD((prev) => Math.round((prev + amount) * 100) / 100);
  };

  const handleAddKHR = (amount: number) => {
    setTenderKHR((prev) => prev + amount);
  };

  const handleExactCash = () => {
    setTenderUSD(totalUSD);
    setTenderKHR(0);
  };

  const handleClearTender = () => {
    setTenderUSD(0);
    setTenderKHR(0);
  };

  const handleSubmit = async () => {
    if (!isCovered || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCompleteSale({
        payments: [
          {
            method: selectedMethod,
            amountUSD: totalUSD,
            amountKHR: totalKHR,
            tenderAmountUSD: selectedMethod === 'CASH' ? tenderUSD : totalUSD,
            tenderAmountKHR: selectedMethod === 'CASH' ? tenderKHR : 0,
          },
        ],
      });
      playBeep('success');
      onClose();
    } catch (err) {
      playBeep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base">Payment & Tender</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Total Banner */}
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount Due</span>
              <div className="text-3xl font-black font-mono text-slate-900 leading-tight">
                ${totalUSD.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">In Riels (KHR)</span>
              <div className="text-2xl font-bold font-mono text-amber-600 leading-tight">
                {totalKHR.toLocaleString()} ៛
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setSelectedMethod('CASH');
                  handleExactCash();
                }}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center space-y-1 transition font-bold text-xs ${
                  selectedMethod === 'CASH'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-5 h-5 text-emerald-600" />
                <span>Cash</span>
              </button>

              <button
                onClick={() => setSelectedMethod('KHQR')}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center space-y-1 transition font-bold text-xs ${
                  selectedMethod === 'KHQR'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <QrCode className="w-5 h-5 text-red-600" />
                <span>KHQR / ABA Pay</span>
              </button>

              <button
                onClick={() => setSelectedMethod('CARD')}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center space-y-1 transition font-bold text-xs ${
                  selectedMethod === 'CARD'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <span>Card Terminal</span>
              </button>
            </div>
          </div>

          {/* Cash Tender Keypad */}
          {selectedMethod === 'CASH' && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cash Tendered
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={handleExactCash}
                    className="text-xs bg-slate-200 hover:bg-slate-300 px-2.5 py-1 rounded font-bold text-slate-800 transition"
                  >
                    Exact Amount
                  </button>
                  <button
                    onClick={handleClearTender}
                    className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded font-bold transition"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Tender Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <span className="text-[11px] text-slate-500 font-semibold block">USD Cash</span>
                  <input
                    type="number"
                    step="0.01"
                    value={tenderUSD || ''}
                    onChange={(e) => setTenderUSD(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full text-xl font-mono font-bold bg-transparent text-slate-900 focus:outline-none"
                  />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                  <span className="text-[11px] text-slate-500 font-semibold block">KHR Cash (Riels)</span>
                  <input
                    type="number"
                    step="100"
                    value={tenderKHR || ''}
                    onChange={(e) => setTenderKHR(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full text-xl font-mono font-bold bg-transparent text-amber-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* USD Quick Bills */}
              <div>
                <span className="text-[11px] text-slate-500 font-bold block mb-1.5">USD Denominations</span>
                <div className="grid grid-cols-6 gap-1.5">
                  {[1, 5, 10, 20, 50, 100].map((amt) => (
                    <button
                      key={`usd-${amt}`}
                      onClick={() => handleAddUSD(amt)}
                      className="py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-mono font-bold text-xs transition active:scale-95"
                    >
                      +${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* KHR Quick Bills */}
              <div>
                <span className="text-[11px] text-slate-500 font-bold block mb-1.5">KHR Denominations (Riels)</span>
                <div className="grid grid-cols-6 gap-1.5">
                  {[1000, 5000, 10000, 20000, 50000, 100000].map((amt) => (
                    <button
                      key={`khr-${amt}`}
                      onClick={() => handleAddKHR(amt)}
                      className="py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-mono font-bold text-[11px] transition active:scale-95 truncate"
                    >
                      +{amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Display */}
              <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 font-semibold uppercase">Change Return</span>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    ${changeUSD.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-semibold font-mono">In KHR</span>
                  <div className="text-xl font-bold font-mono text-amber-400">
                    {changeKHR.toLocaleString()} ៛
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedMethod === 'KHQR' && (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center space-y-2">
              <div className="w-36 h-36 bg-white border-2 border-red-500 rounded-xl p-2 flex items-center justify-center shadow-md">
                <QrCode className="w-28 h-28 text-slate-900" />
              </div>
              <p className="font-bold text-sm text-slate-800">Scan KHQR to Pay</p>
              <p className="text-xs text-slate-500 max-w-xs">
                Supports ABA Mobile, Bakong, Wing, ACLEDA, and all KHQR banking apps.
              </p>
            </div>
          )}

          {selectedMethod === 'CARD' && (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
              <CreditCard className="w-12 h-12 text-indigo-600 mx-auto" />
              <p className="font-bold text-sm text-slate-800">Ready for Card Terminal</p>
              <p className="text-xs text-slate-500">Tap, insert chip, or swipe card on external POS terminal.</p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isCovered || isSubmitting}
            className={`flex-2 py-3 rounded-xl font-bold text-white transition flex items-center justify-center space-x-2 ${
              isCovered && !isSubmitting
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md active:scale-[0.98]'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <span>Processing Transaction...</span>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Complete Checkout (${totalUSD.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
