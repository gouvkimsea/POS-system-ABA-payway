'use client';

import React from 'react';
import {
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Lock,
  Layers,
  Camera,
  Coins,
  Store as StoreIcon,
} from 'lucide-react';
import { CashierUser, RegisterSession, Currency } from '../lib/types';

interface HeaderProps {
  user: CashierUser | null;
  session: RegisterSession | null;
  isOnline: boolean;
  currency: Currency;
  onToggleCurrency: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenSessionModal: () => void;
  onOpenLockScreen: () => void;
  onOpenCameraScanner: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  session,
  isOnline,
  currency,
  onToggleCurrency,
  isMuted,
  onToggleMute,
  onOpenSessionModal,
  onOpenLockScreen,
  onOpenCameraScanner,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const exchangeRate = user?.business.baseExchangeRate || 4100;

  return (
    <header className="h-16 bg-slate-900 text-white px-4 flex items-center justify-between border-b border-slate-800 shadow-md select-none shrink-0">
      {/* Store & Register Branding */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg shadow-inner">
          <StoreIcon className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-base tracking-tight text-white">
              {user?.store?.name || 'SmartPOS Store'}
            </span>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
              {user?.store?.code || 'MAIN'}
            </span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Register: <strong className="text-slate-200">{session?.registerCode || 'REG-01'}</strong></span>
            <span>•</span>
            {session ? (
              <span className="text-emerald-400 flex items-center font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                Session Open
              </span>
            ) : (
              <span className="text-amber-400 flex items-center font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 mr-1"></span>
                Shift Closed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle Status & Rates */}
      <div className="hidden md:flex items-center space-x-3 text-xs">
        <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center space-x-2">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="text-slate-300">Rate:</span>
          <span className="font-semibold text-slate-100 font-mono">$1 = {exchangeRate.toLocaleString()} ៛</span>
        </div>

        <button
          onClick={onToggleCurrency}
          className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 px-3 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 text-slate-200"
          title="Toggle display currency"
        >
          <span>Currency:</span>
          <span className="bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded text-[11px] font-mono">
            {currency}
          </span>
        </button>

        <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
          {isOnline ? (
            <>
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-red-400 font-semibold">Offline Mode</span>
            </>
          )}
        </div>
      </div>

      {/* Right Controls & Cashier info */}
      <div className="flex items-center space-x-2">
        {/* Camera Barcode Trigger */}
        <button
          onClick={onOpenCameraScanner}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center justify-center"
          title="Scan barcode with camera"
        >
          <Camera className="w-5 h-5" />
        </button>

        {/* Register Session / Drawer button */}
        <button
          onClick={onOpenSessionModal}
          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center space-x-1.5 text-xs font-medium"
          title="Register Sessions & Cash Movements (F8)"
        >
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">Register / Drawer</span>
        </button>

        {/* Audio Mute button */}
        <button
          onClick={onToggleMute}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          title={isMuted ? 'Unmute scanner sounds' : 'Mute scanner sounds'}
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-slate-300" />}
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition hidden sm:flex"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>

        {/* Cashier profile & Lock terminal */}
        <div className="h-6 w-px bg-slate-700 mx-1"></div>

        <button
          onClick={onOpenLockScreen}
          className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
          title="Lock POS terminal (F4)"
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs text-white">
            {user?.fullName?.charAt(0) || 'C'}
          </div>
          <div className="text-left hidden lg:block">
            <div className="text-xs font-semibold leading-tight text-white">{user?.fullName || 'Cashier'}</div>
            <div className="text-[10px] text-slate-400 leading-tight uppercase tracking-wider">{user?.role || 'Staff'}</div>
          </div>
          <Lock className="w-3.5 h-3.5 text-slate-400 ml-1" />
        </button>
      </div>
    </header>
  );
};
