'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Button } from '@pos/ui';
import { ShoppingBag, Lock, KeyRound, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, pinLogin, isLoading, error, clearError } = useAuth();

  const [authMode, setAuthMode] = useState<'password' | 'pin'>('password');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
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

  const activeError = formError || error;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-bold text-xl mb-3">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Angkor Fresh Mart</h1>
          <p className="mt-1 text-xs text-slate-400">Sign in to POS workstation</p>
        </div>

        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-lg p-6 sm:p-8">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                clearError();
              }}
              className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                authMode === 'password'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Password</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('pin');
                clearError();
              }}
              className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-2 ${
                authMode === 'pin'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Cashier PIN</span>
            </button>
          </div>

          {/* Error Banner */}
          {activeError && (
            <div className="mb-5 p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Sign In Failed</span>
                <span>{activeError}</span>
              </div>
            </div>
          )}

          {/* Password Form */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cashier Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. cashier"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  PIN Code
                </label>
                <div className="flex justify-center items-center h-12 bg-slate-950 border border-slate-800 rounded-lg text-2xl tracking-widest font-mono text-slate-100">
                  {pin.replace(/./g, '●') || (
                    <span className="text-xs tracking-normal text-slate-500 font-sans">
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
                    className="h-12 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/80 rounded-lg text-lg font-semibold text-slate-100 transition-colors"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePinClear}
                  className="h-12 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg text-xs font-semibold text-slate-400 transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handlePinKey('0')}
                  className="h-12 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700/80 rounded-lg text-lg font-semibold text-slate-100 transition-colors"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="h-12 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg text-xs font-semibold text-slate-400 transition-colors"
                >
                  Del
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
                  {isLoading ? 'Verifying PIN...' : 'Sign In with PIN'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
