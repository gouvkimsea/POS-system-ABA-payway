'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../lib/auth-context';
import { AuthGuard } from '../../../components/AuthGuard';
import { OfflineSyncQueueItem, SyncMonitorStats, SyncQueueRecord } from '@pos/types';
import { OfflineDb } from '../../../lib/offline/OfflineDb';
import { syncManager } from '../../../lib/offline/SyncManager';
import {
  ArrowLeft,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Download,
  Trash2,
  Eye,
  Sliders,
  ShieldAlert,
  Server,
  Layers,
  X,
} from 'lucide-react';

export default function SyncMonitorPage() {
  return (
    <AuthGuard requiredPermission="reports.view">
      <SyncMonitorContent />
    </AuthGuard>
  );
}

function SyncMonitorContent() {
  const { token } = useAuth();

  // State
  const [stats, setStats] = useState<SyncMonitorStats>({
    totalQueued: 0,
    pendingCount: 0,
    syncingCount: 0,
    synchronizedCount: 0,
    conflictCount: 0,
    failedCount: 0,
    isOnline: true,
  });
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);

  // Tab & Data
  const [activeTab, setActiveTab] = useState<
    'all' | 'pending' | 'conflict' | 'synchronized' | 'failed' | 'server_db'
  >('all');
  const [clientQueue, setClientQueue] = useState<OfflineSyncQueueItem[]>([]);
  const [serverRecords, setServerRecords] = useState<SyncQueueRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Modals
  const [selectedItem, setSelectedItem] = useState<OfflineSyncQueueItem | null>(null);
  const [conflictItem, setConflictItem] = useState<OfflineSyncQueueItem | null>(null);
  const [notification, setNotification] = useState<{
    msg: string;
    type: 'info' | 'warn' | 'success';
  } | null>(null);

  const showToast = (msg: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load client IndexedDB queue
  const loadClientQueue = useCallback(async () => {
    try {
      const items = await OfflineDb.getQueueItems();
      setClientQueue(items);
      const queueStats = await OfflineDb.getQueueStats();
      queueStats.isOnline = syncManager.getIsOnline();
      setStats(queueStats);
    } catch (err) {
      console.warn('[SyncMonitor] Error loading queue:', err);
    }
  }, []);

  // Load server-side sync queue from PostgreSQL
  const loadServerRecords = useCallback(async () => {
    if (!token || !syncManager.getIsOnline()) return;
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/sync/monitor`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setServerRecords(data.data.records || []);
        }
      }
    } catch {
      // Ignore network errors in offline state
    }
  }, [token]);

  // Refresh all monitor data
  const refreshAll = useCallback(async () => {
    setIsLoadingData(true);
    await Promise.all([loadClientQueue(), loadServerRecords()]);
    setIsLoadingData(false);
  }, [loadClientQueue, loadServerRecords]);

  // Subscribe to live SyncManager updates
  useEffect(() => {
    setIsSimulatedOffline(syncManager.getSimulatedOffline());
    setIsOnline(syncManager.getIsOnline());
    setIsSyncing(syncManager.getIsSyncing());

    const unsub = syncManager.subscribe((newStats, online, syncing) => {
      setStats(newStats);
      setIsOnline(online);
      setIsSyncing(syncing);
      loadClientQueue();
    });

    refreshAll();
    return () => unsub();
  }, [loadClientQueue, refreshAll]);

  // Actions
  const handleTriggerSync = async () => {
    if (!isOnline) {
      showToast('Cannot sync while offline. Restore connection first.', 'warn');
      return;
    }
    showToast('Starting batch synchronization...', 'info');
    const res = await syncManager.syncPendingTransactions();
    await refreshAll();
    if (res.synced > 0) {
      showToast(`Synchronized ${res.synced} transactions successfully!`, 'success');
    } else if (res.conflicts > 0) {
      showToast(`Detected ${res.conflicts} conflict(s). Review required below.`, 'warn');
    } else if (res.failed > 0) {
      showToast(`${res.failed} transactions failed to sync.`, 'warn');
    } else {
      showToast('All transactions are already synchronized.', 'info');
    }
  };

  const handleRefreshCatalog = async () => {
    if (!isOnline) {
      showToast('Cannot refresh catalog snapshot while offline.', 'warn');
      return;
    }
    showToast('Fetching latest products & prices from server...', 'info');
    const success = await syncManager.refreshCatalog();
    if (success) {
      showToast('Offline catalog successfully cached in IndexedDB!', 'success');
      refreshAll();
    } else {
      showToast('Failed to refresh catalog cache.', 'warn');
    }
  };

  const handleClearSynchronized = async () => {
    const count = await OfflineDb.clearSynchronizedItems();
    showToast(`Cleared ${count} synchronized records from local storage.`, 'success');
    refreshAll();
  };

  const handleToggleOfflineSimulation = () => {
    const next = !isSimulatedOffline;
    setIsSimulatedOffline(next);
    syncManager.setSimulatedOffline(next);
    showToast(
      next
        ? 'Offline Simulation Enabled! Network calls will be redirected to IndexedDB.'
        : 'Offline Simulation Disabled. Connected to live server.',
      next ? 'warn' : 'success',
    );
  };

  const handleResolveConflict = async (
    item: OfflineSyncQueueItem,
    action: 'OVERRIDE_ACCEPT' | 'RETRY' | 'DISCARD',
  ) => {
    showToast(`Resolving conflict with action: ${action}...`, 'info');
    const ok = await syncManager.resolveConflict(item.id, action);
    if (ok) {
      showToast(`Conflict resolution "${action}" completed.`, 'success');
      setConflictItem(null);
      refreshAll();
    } else {
      // Local fallback resolution if server offline
      if (action === 'DISCARD') {
        await OfflineDb.removeQueueItem(item.id);
        showToast('Discarded local conflicting record.', 'success');
      } else if (action === 'RETRY') {
        await OfflineDb.updateQueueItem(item.id, {
          status: 'pending',
          errorMessage: null,
          conflict: null,
        });
        showToast('Re-queued item as PENDING.', 'info');
      }
      setConflictItem(null);
      refreshAll();
    }
  };

  // Filter queue items
  const filteredItems = clientQueue.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return item.status === 'pending' || item.status === 'syncing';
    if (activeTab === 'conflict') return item.status === 'conflict';
    if (activeTab === 'synchronized') return item.status === 'synchronized';
    if (activeTab === 'failed') return item.status === 'failed';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-950/80 px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/pos"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to POS</span>
          </Link>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">
                Offline Synchronization Monitor
              </h1>
              <p className="text-[11px] text-slate-400">
                IndexedDB Local Queue &amp; Server Reconciliation
              </p>
            </div>
          </div>
        </div>

        {/* Right Status & Simulation Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline Simulation Toggle */}
          <button
            onClick={handleToggleOfflineSimulation}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
              isSimulatedOffline
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Force the client to simulate offline network loss"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isSimulatedOffline ? 'Simulating Offline' : 'Simulate Offline'}</span>
          </button>

          {/* Real-time Connection Indicator */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
              isOnline
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                : 'bg-amber-950/80 text-amber-400 border-amber-800'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Online &amp; Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Offline Mode</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Toast Alert */}
      {notification && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
            notification.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-700'
              : notification.type === 'warn'
                ? 'bg-amber-950 text-amber-200 border-amber-700'
                : 'bg-indigo-950 text-indigo-200 border-indigo-700'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : notification.type === 'warn' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <Clock className="w-4 h-4 text-indigo-400" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 space-y-6 max-w-7xl w-full mx-auto overflow-y-auto">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Total Queued */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Total Transactions</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white mt-2">{stats.totalQueued}</div>
            <div className="text-[10px] text-slate-400 mt-1">In local IndexedDB</div>
          </div>

          {/* Card 2: Pending */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Pending Sync</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 mt-2">{stats.pendingCount}</div>
            <div className="text-[10px] text-amber-500/80 mt-1">Awaiting network upload</div>
          </div>

          {/* Card 3: Syncing */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Syncing Now</span>
              <RefreshCw className={`w-4 h-4 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div className="text-2xl font-black text-blue-400 mt-2">
              {isSyncing ? 'In Progress' : stats.syncingCount}
            </div>
            <div className="text-[10px] text-blue-400/80 mt-1">Active data transfer</div>
          </div>

          {/* Card 4: Synchronized */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Synchronized</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-2">
              {stats.synchronizedCount}
            </div>
            <div className="text-[10px] text-emerald-500/80 mt-1">Stored in PostgreSQL</div>
          </div>

          {/* Card 5: Conflicts */}
          <div
            className={`border rounded-xl p-3.5 flex flex-col justify-between ${
              stats.conflictCount > 0
                ? 'bg-rose-950/40 border-rose-700 text-rose-300'
                : 'bg-slate-800/80 border-slate-700/80'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span>Conflicts</span>
              <ShieldAlert
                className={`w-4 h-4 ${stats.conflictCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}
              />
            </div>
            <div
              className={`text-2xl font-black mt-2 ${
                stats.conflictCount > 0 ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {stats.conflictCount}
            </div>
            <div className="text-[10px] text-rose-400/80 mt-1">Requires human review</div>
          </div>

          {/* Card 6: Failed */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Failed / Retry</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-400 mt-2">{stats.failedCount}</div>
            <div className="text-[10px] text-rose-400/80 mt-1">Network/Server rejected</div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerSync}
              disabled={isSyncing || !isOnline}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>

            <button
              onClick={handleRefreshCatalog}
              disabled={!isOnline}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Refresh Catalog Cache</span>
            </button>

            <button
              onClick={handleClearSynchronized}
              disabled={stats.synchronizedCount === 0}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg text-xs font-medium transition-colors border border-slate-700"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Synchronized</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Last catalog cache:</span>
            <span className="font-mono text-slate-300 font-semibold">
              {stats.lastSyncTimestamp
                ? new Date(stats.lastSyncTimestamp).toLocaleTimeString()
                : 'Recent'}
            </span>
            <button
              onClick={refreshAll}
              className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white"
              title="Refresh queue view"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin text-indigo-400' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="border-b border-slate-800 flex items-center justify-between overflow-x-auto">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              All Local Items ({clientQueue.length})
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'pending'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending ({stats.pendingCount + stats.syncingCount})
            </button>

            <button
              onClick={() => setActiveTab('conflict')}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'conflict'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Conflicts</span>
              {stats.conflictCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-slate-900 font-bold text-[10px] flex items-center justify-center">
                  {stats.conflictCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('synchronized')}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'synchronized'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Synchronized ({stats.synchronizedCount})
            </button>

            <button
              onClick={() => setActiveTab('failed')}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'failed'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Failed ({stats.failedCount})
            </button>

            <button
              onClick={() => setActiveTab('server_db')}
              className={`px-3.5 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'server_db'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Server DB Queue ({serverRecords.length})</span>
            </button>
          </div>
        </div>

        {/* Tab Content: Client Queue Table */}
        {activeTab !== 'server_db' && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-xs">
            {filteredItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold">No transactions in this view</p>
                <p className="text-xs text-slate-500">
                  Transactions created while offline will automatically be enqueued here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3">Temp Order #</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Items / Total</th>
                      <th className="px-4 py-3">Cashier</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Server Order</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-mono">
                    {filteredItems.map((item) => {
                      const totalUSD =
                        item.payload.offlineMetadata?.totalUSD ||
                        item.payload.payments.reduce((s, p) => s + p.amountUSD, 0);
                      const totalKHR =
                        item.payload.offlineMetadata?.totalKHR || Math.round(totalUSD * 4100);
                      const itemsCount =
                        item.payload.items.reduce((s, i) => s + i.quantity, 0) ||
                        item.payload.items.length;

                      return (
                        <tr key={item.id} className="hover:bg-slate-750/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-white">
                            <div>{item.offlineOrderNumber}</div>
                            <div className="text-[10px] font-normal text-slate-400 font-mono">
                              {item.clientSyncId.slice(0, 16)}...
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-300">
                            <div>{new Date(item.createdAt).toLocaleDateString()}</div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(item.createdAt).toLocaleTimeString()}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="text-white font-bold">
                              ${totalUSD.toFixed(2)}{' '}
                              <span className="text-[10px] font-normal text-slate-400">
                                ({totalKHR.toLocaleString()} ៛)
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {itemsCount} item{itemsCount > 1 ? 's' : ''}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-300 font-sans">{item.cashierName}</td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                item.status === 'synchronized'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                  : item.status === 'conflict'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-700'
                                    : item.status === 'syncing'
                                      ? 'bg-blue-950 text-blue-300 border border-blue-700'
                                      : item.status === 'failed'
                                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800'
                                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                              }`}
                            >
                              {item.status === 'synchronized' && (
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              )}
                              {item.status === 'conflict' && (
                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                              )}
                              {item.status === 'syncing' && (
                                <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                              )}
                              {item.status === 'pending' && (
                                <Clock className="w-3 h-3 text-amber-400" />
                              )}
                              {item.status === 'failed' && (
                                <XCircle className="w-3 h-3 text-rose-400" />
                              )}
                              <span>{item.status}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3 font-mono text-[11px]">
                            {item.serverOrderNumber ? (
                              <span className="text-emerald-400 font-bold">
                                {item.serverOrderNumber}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.status === 'conflict' && (
                                <button
                                  onClick={() => setConflictItem(item)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-sans font-bold text-[10px] rounded-md transition-colors"
                                >
                                  Resolve
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedItem(item)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                                title="View transaction details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Server PostgreSQL SyncQueue Records */}
        {activeTab === 'server_db' && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow-xs">
            {serverRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Server className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold">No records in server sync queue</p>
                <p className="text-xs text-slate-500">
                  Transactions synced to the backend database appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3">Client Sync ID</th>
                      <th className="px-4 py-3">Received At</th>
                      <th className="px-4 py-3">Device / Terminal</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Order ID / Ref</th>
                      <th className="px-4 py-3">Error / Conflict Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-mono">
                    {serverRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-750/50">
                        <td className="px-4 py-3 font-bold text-white">{rec.clientSyncId}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {new Date(rec.receivedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-300 font-sans">
                          {rec.deviceName || rec.deviceId}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              rec.status === 'PROCESSED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : rec.status === 'CONFLICT'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-indigo-400 font-mono">
                          {rec.orderId || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-[11px] max-w-xs truncate">
                          {rec.errorMessage ||
                            (rec.conflictDetails ? JSON.stringify(rec.conflictDetails) : 'None')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Transaction Details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">
                  Offline Sale #{selectedItem.offlineOrderNumber}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Sync ID: {selectedItem.clientSyncId}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Alert Banner */}
            <div
              className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                selectedItem.status === 'synchronized'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700'
                  : selectedItem.status === 'conflict'
                    ? 'bg-rose-950/60 text-rose-300 border-rose-700'
                    : 'bg-amber-950/60 text-amber-300 border-amber-700'
              }`}
            >
              <span>Current Status:</span>
              <span className="font-bold uppercase">{selectedItem.status}</span>
              {selectedItem.syncedAt && (
                <span className="text-[11px] text-slate-400 font-mono ml-auto">
                  Synced: {new Date(selectedItem.syncedAt).toLocaleString()}
                </span>
              )}
            </div>

            {/* Line items list */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-400 font-mono">Line Items</h4>
              <div className="bg-slate-950 rounded-xl p-3 divide-y divide-slate-800 text-xs font-mono">
                {selectedItem.payload.items.map((item, i) => (
                  <div key={i} className="py-2 flex justify-between items-center">
                    <div>
                      <div className="text-white font-sans font-medium">
                        Product ID: {item.productId}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        Qty: {item.quantity} × ${item.unitPriceUSD || 0}
                      </div>
                    </div>
                    <div className="text-white font-bold">
                      ${((item.unitPriceUSD || 0) * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payments list */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-400 font-mono">
                Payments Tendered
              </h4>
              <div className="bg-slate-950 rounded-xl p-3 divide-y divide-slate-800 text-xs font-mono">
                {selectedItem.payload.payments.map((p, i) => (
                  <div key={i} className="py-2 flex justify-between items-center">
                    <span className="text-slate-300">{p.paymentMethodCode}</span>
                    <span className="text-emerald-400 font-bold">
                      ${p.amountUSD.toFixed(2)} ({(p.amountKHR || 0).toLocaleString()} ៛)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Error message if any */}
            {selectedItem.errorMessage && (
              <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs">
                <span className="font-bold">Error Notice:</span> {selectedItem.errorMessage}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {conflictItem && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-700/80 rounded-xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-6 h-6" />
              <div>
                <h3 className="font-bold text-base text-white">
                  Reconciliation Conflict Inspector
                </h3>
                <p className="text-xs text-rose-300">
                  Never silently overwrites server state. Explicit administrator action required.
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl text-xs space-y-1 text-rose-200">
              <div className="font-bold">Conflict Reason:</div>
              <p>{conflictItem.conflict?.message || conflictItem.errorMessage}</p>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-amber-400 uppercase text-[10px]">
                  Local Offline Sale
                </div>
                <div className="text-white">Order: {conflictItem.offlineOrderNumber}</div>
                <div className="text-slate-300">
                  Total: ${conflictItem.payload.offlineMetadata?.totalUSD?.toFixed(2) || '0.00'}
                </div>
                <div className="text-slate-400 text-[10px]">
                  Items: {conflictItem.payload.items.length} lines
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-indigo-400 uppercase text-[10px]">
                  Current Server State
                </div>
                <div className="text-slate-300">
                  Catalog Version: {conflictItem.conflict?.reason || 'MISMATCH'}
                </div>
                <div className="text-slate-400 text-[10px]">
                  Details: {JSON.stringify(conflictItem.conflict?.details || {})}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => handleResolveConflict(conflictItem, 'OVERRIDE_ACCEPT')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Override &amp; Accept Sale
              </button>
              <button
                onClick={() => handleResolveConflict(conflictItem, 'RETRY')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Retry Synchronization
              </button>
              <button
                onClick={() => handleResolveConflict(conflictItem, 'DISCARD')}
                className="px-3 py-2 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 rounded-lg text-xs font-semibold transition-colors border border-slate-700"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
