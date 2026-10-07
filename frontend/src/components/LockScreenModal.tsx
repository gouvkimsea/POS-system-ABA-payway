'use client';

import React, { useState } from 'react';
import { Lock, Delete, ArrowRight, Store } from 'lucide-react';
import { apiRequest, setStoredToken } from '../lib/api';
import { CashierUser } from '../lib/types';
import { playBeep } from '../lib/hardware';

interface LockScreenModalProps {
  isOpen: boolean;
  onUnlock: (user: CashierUser) => void;
  currentUser: CashierUser | null;
}

export const LockScreenModal: React.FC<LockScreenModalProps> = ({
  isOpen,
  onUnlock,
  currentUser,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || isLoading) return;

    setIsLoading(true);
    setError(null);

    const storeId = currentUser?.store?.id;
    if (!storeId) {
      setError('No store associated with terminal');
      setIsLoading(false);
      return;
    }

    const res = await apiRequest('/auth/pin-login', {
      method: 'POST',
      body: JSON.stringify({
        storeId,
        pinCode: pin,
      }),
    });

    setIsLoading(false);

    if (res.success && res.data) {
      setStoredToken(res.data.accessToken);
      playBeep('success');
      setPin('');
      onUnlock(res.data.user);
    } else {
      playBeep('error');
      setError(res.error?.message || 'Invalid Cashier PIN');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Branding */}
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-4 shadow-xl">
          <Store className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">
          {currentUser?.store?.name || 'SmartPOS Terminal'}
        </h2>
        <p className="text-xs text-slate-400 mb-6 flex items-center">
          <Lock className="w-3.5 h-3.5 mr-1" />
          Terminal Locked — Enter Cashier PIN
        </p>

        {/* PIN Indicators */}
        <div className="flex space-x-3 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-full transition-all duration-150 ${
                pin.length > idx ? 'bg-blue-500 scale-110 shadow-sm' : 'bg-slate-800 border border-slate-700'
              }`}
            ></div>
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-xs font-semibold mb-4 text-center animate-shake">
            {error}
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleKeyPress(digit)}
              className="h-16 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-blue-600 active:text-white border border-slate-800 text-white font-bold text-2xl transition flex items-center justify-center shadow-md active:scale-95"
            >
              {digit}
            </button>
          ))}

          <button
            onClick={handleClear}
            className="h-16 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-sm font-bold transition flex items-center justify-center"
          >
            Clear
          </button>

          <button
            onClick={() => handleKeyPress('0')}
            className="h-16 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-blue-600 active:text-white border border-slate-800 text-white font-bold text-2xl transition flex items-center justify-center shadow-md active:scale-95"
          >
            0
          </button>

          <button
            onClick={handleDelete}
            className="h-16 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Unlock Button */}
        <button
          onClick={handleSubmit}
          disabled={pin.length < 4 || isLoading}
          className={`w-full py-4 rounded-xl font-bold text-sm transition flex items-center justify-center space-x-2 shadow-lg ${
            pin.length >= 4 && !isLoading
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-98'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <span>Verifying PIN...</span>
          ) : (
            <>
              <span>Unlock POS</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
