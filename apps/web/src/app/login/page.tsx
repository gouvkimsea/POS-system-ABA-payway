'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Button } from '@pos/ui';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, pinLogin, isLoading, error, clearError } = useAuth();

  const [authMode, setAuthMode] = useState<'password' | 'pin'>('password');
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin123');
  const [pin, setPin] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // If already authenticated, redirect to home
  useEffect(() => {
    if (user && !isLoading) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!username.trim() || !password) {
      setFormError('Please enter both username and password');
      return;
    }

    const success = await login(username.trim(), password);
    if (success) {
      router.push('/');
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!username.trim() || !pin) {
      setFormError('Please enter your cashier username and PIN code');
      return;
    }

    const success = await pinLogin(username.trim(), pin);
    if (success) {
      router.push('/');
    }
  };

  const handlePinKey = (digit: string) => {
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
    }
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPin('');
  };

  const setDemoCredentials = (u: string, p: string, pinCode: string) => {
    setUsername(u);
    setPassword(p);
    setPin(pinCode);
    setFormError(null);
    clearError();
  };

  const activeError = formError || error;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-xl shadow-md mb-3">
            POS
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Enterprise Point of Sale
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Angkor Fresh Mart • Secure Terminal Authentication
          </p>
        </div>

        <div className="mt-6 bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                clearError();
              }}
              className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                authMode === 'password'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Password Login
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('pin');
                clearError();
              }}
              className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors ${
                authMode === 'pin'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Touch PIN Login
            </button>
          </div>

          {/* Error Banner */}
          {activeError && (
            <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              <span className="font-semibold block mb-0.5">Authentication Error</span>
              {activeError}
            </div>
          )}

          {/* Password Form */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or cashier"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </div>
            </form>
          )}

          {/* PIN Form */}
          {authMode === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cashier Identifier
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="cashier"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  4-Digit Touch PIN Code
                </label>
                <div className="flex justify-center items-center h-12 bg-slate-50 border border-slate-300 rounded-lg text-2xl tracking-widest font-mono text-slate-800">
                  {pin.replace(/./g, '●') || (
                    <span className="text-xs tracking-normal text-slate-400 font-sans">
                      Enter 4-digit PIN
                    </span>
                  )}
                </div>
              </div>

              {/* Touch Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinKey(digit)}
                    className="h-12 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg text-lg font-semibold text-slate-800 transition-colors"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePinClear}
                  className="h-12 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handlePinKey('0')}
                  className="h-12 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg text-lg font-semibold text-slate-800 transition-colors"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="h-12 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 transition-colors"
                >
                  ⌫ Del
                </button>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={isLoading || pin.length < 4}
                >
                  {isLoading ? 'Verifying PIN...' : 'Unlock Terminal'}
                </Button>
              </div>
            </form>
          )}

          {/* Quick Demo Accounts Helper */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Demo Credentials (Click to pre-fill)
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin', 'admin123', '1111')}
                className="p-2 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
              >
                <div className="font-bold text-slate-800">Admin</div>
                <div className="text-[10px] text-slate-500">PIN: 1111</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('manager', 'manager123', '2222')}
                className="p-2 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
              >
                <div className="font-bold text-slate-800">Manager</div>
                <div className="text-[10px] text-slate-500">PIN: 2222</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('cashier', 'cashier123', '1234')}
                className="p-2 border border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors"
              >
                <div className="font-bold text-slate-800">Cashier</div>
                <div className="text-[10px] text-slate-500">PIN: 1234</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
