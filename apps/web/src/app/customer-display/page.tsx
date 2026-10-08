'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  QrCode,
  CheckCircle2,
  Clock,
  Sparkles,
  CreditCard,
  Banknote,
  Store,
  Receipt,
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
      <header className="h-20 bg-slate-900/90 border-b border-slate-800 px-6 sm:px-10 flex items-center justify-between shrink-0 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Angkor Fresh Mart
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-700/60 font-semibold uppercase tracking-wider">
                Customer Display
              </span>
            </h1>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Store className="w-3.5 h-3.5 text-slate-500" />
              Monivong Central Branch • Welcome / សូមស្វាគមន៍
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-[11px] text-slate-400 font-medium">Daily Exchange Rate</span>
            <span className="text-sm font-bold text-amber-400 font-mono">1 USD = 4,100 KHR</span>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-xl border border-slate-700 text-slate-200 font-mono text-sm shadow-xs">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>{clock || '12:00:00 PM'}</span>
          </div>
        </div>
      </header>

      {/* Main Dynamic Stage */}
      <main className="flex-1 flex overflow-hidden p-6 sm:p-10">
        {/* State 1: IDLE / WELCOME */}
        {status === 'IDLE' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto animate-in fade-in duration-300">
            <div className="relative mb-8">
              <div className="w-32 h-32 rounded-3xl bg-indigo-600/20 border-2 border-indigo-500/40 flex items-center justify-center shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                <ShoppingBag className="w-16 h-16 text-indigo-400" />
              </div>
              <Sparkles className="w-8 h-8 text-amber-400 absolute -top-2 -right-2 animate-bounce" />
            </div>

            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-4">
              Welcome to Angkor Fresh Mart!
            </h2>
            <p className="text-lg sm:text-xl text-slate-400 max-w-xl mb-10 leading-relaxed font-normal">
              Your cashier will scan your items momentarily. We accept Cash, Cards, and ABA KHQR.
            </p>

            {/* Feature cards banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Instant ABA KHQR</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Pay with any Bakong mobile app</p>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Card Accepted</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Visa, Mastercard & UnionPay</p>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                  <Banknote className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Dual Currency</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Pay in USD ($) or Khmer Riel (៛)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 2: SCANNING / ACTIVE CART */}
        {status === 'SCANNING' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch animate-in fade-in duration-200">
            {/* Left: Last Scanned Item Spotlight (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-xl">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 text-indigo-400 text-xs font-bold border border-indigo-800 mb-6">
                  <Sparkles className="w-3.5 h-3.5" />
                  Item Scanned
                </div>

                {currentItem ? (
                  <div className="space-y-4">
                    <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                      {currentItem.name}
                    </h2>
                    <div className="flex items-center gap-3 text-slate-300 font-mono text-lg">
                      <span className="font-bold text-indigo-400">Qty: {currentItem.quantity}</span>
                      <span>×</span>
                      <span>${currentItem.priceUSD.toFixed(2)}</span>
                    </div>
                    <div className="pt-4 border-t border-slate-800">
                      <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                        Line Total
                      </span>
                      <div className="text-3xl font-black text-emerald-400 font-mono">
                        ${currentItem.totalUSD.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-slate-500 text-center">
                    <p className="text-base font-semibold">Items are being scanned...</p>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-slate-400 text-xs">
                <span>Total Items Scanned:</span>
                <span className="font-bold text-white text-sm bg-slate-800 px-3 py-1 rounded-lg">
                  {cartSummary?.itemsCount || 0}
                </span>
              </div>
            </div>

            {/* Right: Bill & Running Total Summary (7 cols) */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-gradient-to-br from-indigo-950/60 via-slate-900/90 to-slate-900 border border-indigo-900/40 p-8 sm:p-12 rounded-3xl shadow-2xl">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-300 mb-6">
                  Sale Balance Summary
                </h3>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center text-slate-300 text-lg">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold">
                      ${(cartSummary?.subtotalUSD || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 text-lg">
                    <span>VAT / Tax (10%):</span>
                    <span className="font-mono font-bold">
                      ${(cartSummary?.taxUSD || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Huge Grand Total Display */}
              <div className="bg-slate-950/80 border border-indigo-700/50 p-6 sm:p-8 rounded-2xl shadow-inner text-right">
                <span className="text-xs sm:text-sm font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                  AMOUNT DUE (USD)
                </span>
                <div className="text-5xl sm:text-7xl font-black text-white font-mono tracking-tight leading-none">
                  ${(cartSummary?.totalUSD || 0).toFixed(2)}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Khmer Riel (KHR):
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                    {Math.round(cartSummary?.totalKHR || 0).toLocaleString()} ៛
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 3: PAYMENT / ABA KHQR */}
        {status === 'PAYMENT' && paymentPrompt && (
          <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 max-w-5xl mx-auto animate-in zoom-in-95 duration-200">
            {/* Dynamic KHQR Display */}
            {paymentPrompt.qrPayload ? (
              <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full text-slate-900 border-4 border-rose-500">
                <div className="w-full flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-rose-600 flex items-center justify-center text-white font-black text-xs">
                      KH
                    </div>
                    <span className="font-black text-lg text-slate-900">KHQR PAY</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-0.5 rounded">
                    Bakong
                  </span>
                </div>

                {/* QR Canvas / Simulated SVG */}
                <div className="w-64 h-64 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center p-3 relative shadow-inner">
                  <QrCode className="w-56 h-56 text-slate-900" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-rose-500 flex items-center justify-center font-black text-[10px] text-rose-600">
                      ABA
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-4 text-center font-medium">
                  Scan with ABA Mobile or any banking app
                </p>
              </div>
            ) : (
              <div className="w-80 h-80 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-8 text-center">
                <CreditCard className="w-20 h-20 text-indigo-400 mb-4 animate-pulse" />
                <h3 className="text-xl font-bold text-white">Payment Selected</h3>
                <p className="text-sm text-slate-400 mt-1">{paymentPrompt.method}</p>
              </div>
            )}

            {/* Payment Details */}
            <div className="flex-1 max-w-md w-full bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-2xl">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Please Pay Exact Amount
              </span>
              <div className="mt-2 text-4xl sm:text-6xl font-black text-white font-mono">
                ${paymentPrompt.amountUSD.toFixed(2)}
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
                {Math.round(paymentPrompt.amountKHR).toLocaleString()} ៛
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 space-y-3 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span className="font-bold text-white uppercase">{paymentPrompt.method}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Awaiting tender
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* State 4: SALE COMPLETED / THANK YOU */}
        {status === 'COMPLETED' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto animate-in zoom-in-95 duration-200">
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-14 h-14" />
            </div>

            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-2">
              Payment Complete!
            </h2>
            <p className="text-base text-slate-400 mb-8 font-normal">
              Thank you for shopping at Angkor Fresh Mart.
            </p>

            {thankYouNotice && (
              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-xl text-left space-y-3 mb-6">
                <div className="flex justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5" />
                    Receipt No:
                  </span>
                  <span className="font-bold text-white font-mono">
                    {thankYouNotice.receiptNumber}
                  </span>
                </div>

                {thankYouNotice.changeUSD > 0 && (
                  <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                    <span className="text-sm font-semibold text-slate-300">Change Returned:</span>
                    <div className="text-right">
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        ${thankYouNotice.changeUSD.toFixed(2)}
                      </div>
                      {thankYouNotice.changeKHR > 0 && (
                        <div className="text-sm font-bold text-amber-400 font-mono">
                          {Math.round(thankYouNotice.changeKHR).toLocaleString()} ៛
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-slate-500">Screen will reset shortly...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="h-12 bg-slate-950 border-t border-slate-850 px-6 flex items-center justify-between text-xs text-slate-500 shrink-0">
        <span>Angkor Fresh Mart • POS Customer Gateway</span>
        <span>Secure Retail Transaction Platform</span>
      </footer>
    </div>
  );
}
