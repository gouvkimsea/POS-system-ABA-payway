'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  QrCode,
  CheckCircle2,
  Clock,
  CreditCard,
  Store,
  Receipt,
  Coins,
} from 'lucide-react';
import { CustomerDisplayState } from '@pos/types';

const BROADCAST_CHANNEL_NAME = 'pos_customer_display';
const STORAGE_STATE_KEY = 'pos_customer_display_state';

export default function CustomerDisplayPage() {
  const [displayState, setDisplayState] = useState<CustomerDisplayState>({
    status: 'IDLE',
    timestamp: new Date().toISOString(),
  });
  const [clock, setClock] = useState('');

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      setClock(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to BroadcastChannel & LocalStorage events
  useEffect(() => {
    // 1. Initial state from localStorage if available
    try {
      const stored = localStorage.getItem(STORAGE_STATE_KEY);
      if (stored) {
        setDisplayState(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }

    // 2. BroadcastChannel
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.onmessage = (event) => {
          if (event.data) {
            setDisplayState(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error', e);
      }
    }

    // 3. Storage event listener fallback
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_STATE_KEY && e.newValue) {
        try {
          setDisplayState(JSON.parse(e.newValue));
        } catch {
          // Ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Auto-reset completed status after 10s
  useEffect(() => {
    if (displayState.status === 'COMPLETED') {
      const timer = setTimeout(() => {
        setDisplayState({
          status: 'IDLE',
          timestamp: new Date().toISOString(),
        });
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [displayState.status]);

  const { status, cartSummary, currentItem, paymentPrompt, thankYouNotice } = displayState;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 sm:px-10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">Angkor Fresh Mart</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                Customer Display
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Store className="w-3.5 h-3.5 text-slate-500" />
              Monivong Central Branch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-850 rounded-lg border border-slate-800 text-xs">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Rate:</span>
            <span className="font-mono font-bold text-amber-400">1 USD = 4,100 KHR</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-slate-850 rounded-lg border border-slate-800 text-slate-200 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{clock || '12:00:00 PM'}</span>
          </div>
        </div>
      </header>

      {/* Main Stage */}
      <main className="flex-1 flex overflow-hidden p-6 sm:p-10">
        {/* State 1: IDLE / WELCOME */}
        {status === 'IDLE' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6">
              <ShoppingBag className="w-8 h-8 text-indigo-400" />
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
              សូមស្វាគមន៍ / Welcome
            </h2>
            <p className="text-sm text-slate-400 mb-8 max-w-lg leading-relaxed">
              Cash, cards, and ABA KHQR accepted.
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                Cash (USD &amp; KHR)
              </span>
              <span className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                ABA KHQR (Bakong)
              </span>
              <span className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                Credit &amp; Debit Cards
              </span>
            </div>
          </div>
        )}

        {/* State 2: SCANNING / ACTIVE CART */}
        {status === 'SCANNING' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left: Last Scanned Item (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-xl">
              <div>
                <span className="inline-block text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">
                  Last Scanned Item
                </span>

                {currentItem ? (
                  <div className="space-y-4">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                      {currentItem.name}
                    </h2>
                    <div className="flex items-center gap-3 text-slate-300 font-mono text-base">
                      <span className="font-semibold text-indigo-400">
                        Qty: {currentItem.quantity}
                      </span>
                      <span>&times;</span>
                      <span>${currentItem.priceUSD.toFixed(2)}</span>
                    </div>
                    <div className="pt-4 border-t border-slate-800">
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                        Item Subtotal
                      </span>
                      <div className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">
                        ${currentItem.totalUSD.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-slate-500 text-center">
                    <p className="text-sm">Items are being scanned...</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-slate-400 text-xs">
                <span>Total Items in Cart:</span>
                <span className="font-bold text-white text-sm bg-slate-850 px-2.5 py-1 rounded border border-slate-800">
                  {cartSummary?.itemsCount || 0}
                </span>
              </div>
            </div>

            {/* Right: Running Total Summary (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-xl">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Order Summary
                </h3>

                <div className="space-y-3 mb-6 text-slate-300 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold">
                      ${(cartSummary?.subtotalUSD || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Tax (10%):</span>
                    <span className="font-mono font-semibold">
                      ${(cartSummary?.taxUSD || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grand Total Display */}
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl text-right">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest block mb-1">
                  Amount Due (USD)
                </span>
                <div className="text-4xl sm:text-6xl font-bold text-white font-mono tracking-tight leading-none">
                  ${(cartSummary?.totalUSD || 0).toFixed(2)}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Khmer Riel (KHR):</span>
                  <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">
                    {Math.round(cartSummary?.totalKHR || 0).toLocaleString()} &#x17DB;
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 3: PAYMENT / ABA KHQR */}
        {status === 'PAYMENT' && paymentPrompt && (
          <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 max-w-4xl mx-auto">
            {/* Dynamic KHQR Display */}
            {paymentPrompt.qrPayload ? (
              <div className="bg-white p-6 rounded-xl flex flex-col items-center max-w-xs w-full text-slate-900 border border-slate-300">
                <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-rose-600 flex items-center justify-center text-white font-bold text-xs">
                      KH
                    </div>
                    <span className="font-bold text-base text-slate-900">KHQR PAY</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    Bakong
                  </span>
                </div>

                {/* QR Canvas */}
                <div className="w-56 h-56 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center p-3 relative">
                  <QrCode className="w-48 h-48 text-slate-900" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-white border border-rose-500 flex items-center justify-center font-bold text-[9px] text-rose-600">
                      ABA
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-3 text-center">
                  Scan with ABA Mobile or any Bakong banking app
                </p>
              </div>
            ) : (
              <div className="w-72 h-72 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
                <CreditCard className="w-16 h-16 text-indigo-400 mb-4" />
                <h3 className="text-lg font-semibold text-white">Payment Selected</h3>
                <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">
                  {paymentPrompt.method}
                </p>
              </div>
            )}

            {/* Payment Details */}
            <div className="flex-1 max-w-md w-full bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-xl">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Please Pay Exact Amount
              </span>
              <div className="mt-2 text-4xl sm:text-5xl font-bold text-white font-mono">
                ${paymentPrompt.amountUSD.toFixed(2)}
              </div>
              <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                {Math.round(paymentPrompt.amountKHR).toLocaleString()} &#x17DB;
              </div>

              <div className="mt-6 pt-5 border-t border-slate-800 space-y-2.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span className="font-semibold text-white uppercase">
                    {paymentPrompt.method}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-medium">Awaiting payment</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 4: SALE COMPLETED / THANK YOU */}
        {status === 'COMPLETED' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">
              Payment Complete
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Thank you for shopping at Angkor Fresh Mart.
            </p>

            {thankYouNotice && (
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl w-full text-left space-y-2.5 mb-4">
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" />
                    Receipt No:
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {thankYouNotice.receiptNumber}
                  </span>
                </div>

                {thankYouNotice.changeUSD > 0 && (
                  <div className="pt-2.5 border-t border-slate-800 flex justify-between items-baseline">
                    <span className="text-xs text-slate-300">Change Returned:</span>
                    <div className="text-right">
                      <div className="text-xl font-bold text-emerald-400 font-mono">
                        ${thankYouNotice.changeUSD.toFixed(2)}
                      </div>
                      {thankYouNotice.changeKHR > 0 && (
                        <div className="text-xs font-semibold text-amber-400 font-mono">
                          {Math.round(thankYouNotice.changeKHR).toLocaleString()} &#x17DB;
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-slate-500">Ready for next customer</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="h-10 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between text-xs text-slate-500 shrink-0">
        <span>Angkor Fresh Mart &bull; Monivong Central Branch</span>
        <span>Customer Display</span>
      </footer>
    </div>
  );
}
