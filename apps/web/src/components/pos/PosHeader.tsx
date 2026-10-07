'use client';

import React, { useState, useEffect } from 'react';
import { AuthUser } from '@pos/types';
import {
  Clock,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
  HelpCircle,
  PauseCircle,
  LogOut,
  Store as StoreIcon,
  ShoppingBag,
} from 'lucide-react';

interface PosHeaderProps {
  user: AuthUser | null;
  storeName?: string;
  registerCode?: string;
  isOnline: boolean;
  heldCount: number;
  onOpenHeldModal: () => void;
  onOpenShortcutsModal: () => void;
  onExitRegister: () => void;
}

export const PosHeader: React.FC<PosHeaderProps> = ({
  user,
  storeName = 'Monivong Central Branch',
  registerCode = 'REG-01',
  isOnline,
  heldCount,
  onOpenHeldModal,
  onOpenShortcutsModal,
  onExitRegister,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <header className="h-14 bg-slate-900 text-white flex items-center justify-between px-3 sm:px-4 shrink-0 select-none border-b border-slate-800 z-30">
      {/* Left: Brand, Store & Register Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold tracking-tight text-white leading-none">
              Angkor Fresh Mart
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
              <StoreIcon className="w-3 h-3 text-slate-400" />
              <span className="truncate max-w-[140px] md:max-w-[200px]">{storeName}</span>
            </div>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 font-mono text-xs font-bold border border-indigo-700/50">
          {registerCode}
        </span>
      </div>

      {/* Center: Live Clock & Network Status */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 rounded-md text-xs font-mono text-slate-300 border border-slate-700/60">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>{timeStr || '12:00:00 PM'}</span>
        </div>

        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            isOnline
              ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/80'
              : 'bg-amber-950/70 text-amber-400 border-amber-800/80'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span>Offline Cache</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Cashier, Held Orders, Shortcuts, Fullscreen, Lock */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Held Orders Button */}
        <button
          onClick={onOpenHeldModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            heldCount > 0
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="View Held Orders"
        >
          <PauseCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Held</span>
          {heldCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-900 font-bold text-[10px] flex items-center justify-center">
              {heldCount}
            </span>
          )}
        </button>

        {/* Shortcuts Helper */}
        <button
          onClick={onOpenShortcutsModal}
          className="p-1.5 sm:px-2 sm:py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-1"
          title="Keyboard Shortcuts (F1-F8)"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="hidden lg:inline">Shortcuts</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors hidden sm:block"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Cashier Badge */}
        <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-800 text-xs text-right">
          <div>
            <div className="font-semibold text-slate-200 truncate max-w-[120px]">
              {user?.fullName || user?.username || 'Cashier'}
            </div>
            <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">
              {user?.roles?.[0] || 'CASHIER'}
            </div>
          </div>
        </div>

        {/* Exit Register */}
        <button
          onClick={onExitRegister}
          className="p-1.5 sm:px-2 sm:py-1 rounded-md text-xs font-medium text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 transition-colors flex items-center gap-1 border border-rose-900/40"
          title="Exit POS Terminal"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>
    </header>
  );
};
