'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  RefreshCw,
  AlertTriangle,
  Coins,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { HardwareStatusBadge } from './HardwareStatusBadge';
import { PwaInstallPrompt } from '../PwaInstallPrompt';
import { syncManager } from '../../lib/offline/SyncManager';
import { SyncMonitorStats, RegisterSessionSummary } from '@pos/types';
import { useSettings } from '../../lib/settings-context';

interface PosHeaderProps {
  user: AuthUser | null;
  storeName?: string;
  registerCode?: string;
  isOnline: boolean;
  heldCount: number;
  currentSession?: RegisterSessionSummary | null;
  onOpenRegisterModal?: () => void;
  onOpenRegisterManagement?: () => void;
  onOpenReturnModal?: () => void;
  onOpenHeldModal: () => void;
  onOpenShortcutsModal: () => void;
  onExitRegister: () => void;
}

export const PosHeader: React.FC<PosHeaderProps> = ({
  user,
  storeName,
  registerCode = 'REG-01',
  isOnline: isOnlineProp,
  heldCount,
  currentSession,
  onOpenRegisterModal,
  onOpenRegisterManagement,
  onOpenReturnModal,
  onOpenHeldModal,
  onOpenShortcutsModal,
  onExitRegister,
}) => {
  const { settings, formatTime } = useSettings();
  const [timeStr, setTimeStr] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [syncStats, setSyncStats] = useState<SyncMonitorStats>({
    totalQueued: 0,
    pendingCount: 0,
    syncingCount: 0,
    synchronizedCount: 0,
    conflictCount: 0,
    failedCount: 0,
    isOnline: true,
  });
  const [effectiveOnline, setEffectiveOnline] = useState<boolean>(isOnlineProp);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const unsub = syncManager.subscribe((stats, online, syncing) => {
      setSyncStats(stats);
      setEffectiveOnline(online);
      setIsSyncing(syncing);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(formatTime(new Date()));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [formatTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleManualSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (effectiveOnline && !isSyncing) {
      syncManager.syncPendingTransactions().catch(() => {});
    }
  };

  const pendingTotal = syncStats.pendingCount + syncStats.failedCount;

  return (
    <header className="h-14 bg-slate-900 text-white flex items-center justify-between px-3 sm:px-4 shrink-0 select-none border-b border-slate-800 z-30">
      {/* Left: Brand, Store & Register Badge */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          {settings.business.logoUrl ? (
            <img
              src={settings.business.logoUrl}
              alt={settings.business.name}
              className="w-8 h-8 rounded-lg object-contain bg-slate-850 border border-slate-800"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              <ShoppingBag className="w-4 h-4" />
            </div>
          )}
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold tracking-tight text-white leading-none">
              {settings.business.name}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
              <StoreIcon className="w-3 h-3 text-slate-400" />
              <span className="truncate max-w-[140px] md:max-w-[200px]">
                {storeName || settings.store.storeName}
              </span>
            </div>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 font-mono text-xs font-bold border border-indigo-700/50">
          {registerCode}
        </span>
      </div>

      {/* Center: Live Clock & Network / Sync Status */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-850 rounded-md text-xs font-mono text-slate-300 border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>{timeStr || '12:00:00 PM'}</span>
        </div>

        {/* Dynamic Online / Offline / Sync Status Pill */}
        <Link
          href="/settings/sync"
          title="Open Sync Monitor & Offline Settings"
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
            syncStats.conflictCount > 0
              ? 'bg-rose-950/80 text-rose-300 border-rose-700'
              : isSyncing
                ? 'bg-blue-950/80 text-blue-300 border-blue-700'
                : effectiveOnline
                  ? pendingTotal > 0
                    ? 'bg-amber-950/70 text-amber-300 border-amber-700/80'
                    : 'bg-emerald-950/70 text-emerald-400 border-emerald-800/80'
                  : 'bg-amber-950/70 text-amber-400 border-amber-800/80'
          }`}
        >
          {syncStats.conflictCount > 0 ? (
            <>
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>{syncStats.conflictCount} Conflict</span>
            </>
          ) : isSyncing ? (
            <>
              <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
              <span>Syncing...</span>
            </>
          ) : effectiveOnline ? (
            pendingTotal > 0 ? (
              <>
                <button
                  onClick={handleManualSync}
                  className="hover:rotate-180 transition-transform"
                  title="Click to sync now"
                >
                  <RefreshCw className="w-3 h-3 text-amber-400" />
                </button>
                <span>{pendingTotal} Queued (Online)</span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">Online</span>
              </>
            )
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span>Offline{pendingTotal > 0 ? ` (${pendingTotal})` : ''}</span>
            </>
          )}
        </Link>
      </div>

      {/* Right: Register, Hardware, Held, Refunds, Shortcuts, Fullscreen, Cashier, Exit */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Register Session Status Button */}
        {currentSession ? (
          <button
            onClick={onOpenRegisterManagement}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900/80 transition-colors"
            title={`Active Register Session #${currentSession.id.slice(-6).toUpperCase()} - Expected: $${currentSession.expectedCashUSD.toFixed(2)} / ${currentSession.expectedCashKHR.toLocaleString()} KHR`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline font-mono font-bold">
              ${currentSession.expectedCashUSD.toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium hidden md:inline">
              Session #{currentSession.id.slice(-6).toUpperCase()}
            </span>
          </button>
        ) : (
          <button
            onClick={onOpenRegisterModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/60 hover:bg-amber-500/30 transition-colors"
            title="Cash register is closed. Click to open register session with opening float."
          >
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Open Register</span>
          </button>
        )}

        {/* Hardware Status Badge & Quick Diagnostics */}
        <HardwareStatusBadge />

        {/* Held Orders Button */}
        <button
          onClick={onOpenHeldModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
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

        {/* Returns & Refunds Trigger */}
        <button
          onClick={onOpenReturnModal}
          className="hidden sm:flex p-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs font-semibold bg-rose-950/40 text-rose-300 border border-rose-800 hover:bg-rose-900/50 transition-colors items-center gap-1.5"
          title="Process Item Returns & Order Refunds"
        >
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span className="hidden md:inline">Refunds</span>
        </button>

        {/* PWA Install Button */}
        <PwaInstallPrompt />

        {/* Shortcuts Helper */}
        <button
          onClick={onOpenShortcutsModal}
          className="hidden lg:flex p-1.5 sm:px-2 sm:py-1 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors items-center gap-1"
          title="Keyboard Shortcuts (F1-F8)"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Shortcuts</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors hidden md:block"
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
          className="p-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs font-medium text-rose-300 hover:text-white hover:bg-rose-950/60 transition-colors flex items-center gap-1.5 border border-rose-800/80"
          title="Exit POS Terminal"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>
    </header>
  );
};
