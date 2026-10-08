import { SyncMonitorStats, SyncBatchRequest, SyncBatchResponse, CatalogSnapshot } from '@pos/types';
import { OfflineDb } from './OfflineDb';

export type SyncListener = (stats: SyncMonitorStats, isOnline: boolean, isSyncing: boolean) => void;

export class SyncManager {
  private static instance: SyncManager | null = null;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private simulatedOffline: boolean = false;
  private apiUrl: string = 'http://localhost:4000/api';
  private getToken: (() => string | null) | null = null;
  private listeners: Set<SyncListener> = new Set();
  private heartbeatTimer: any = null;
  private autoSyncTimer: any = null;
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): SyncManager {
    if (!this.instance) {
      this.instance = new SyncManager();
    }
    return this.instance;
  }

  /**
   * Initialize sync manager with API URL, token getter, and network listeners
   */
  public init(apiUrl: string, getToken: () => string | null): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.getToken = getToken;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));

      // Active Heartbeat to detect true internet connectivity every 12 seconds
      this.heartbeatTimer = setInterval(() => this.checkConnectivity(), 12000);

      // Periodic auto-sync check every 20 seconds
      this.autoSyncTimer = setInterval(() => {
        if (this.isOnline && !this.isSyncing && !this.simulatedOffline) {
          this.syncPendingTransactions().catch(() => {});
        }
      }, 20000);

      // Initial connectivity probe
      this.checkConnectivity();
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private async notify(): Promise<void> {
    try {
      const stats = await OfflineDb.getQueueStats();
      stats.isOnline = this.isOnline;
      for (const listener of this.listeners) {
        listener(stats, this.isOnline, this.isSyncing);
      }
    } catch {
      // Ignore if IndexedDB is opening
    }
  }

  public getIsOnline(): boolean {
    return this.isOnline && !this.simulatedOffline;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  public getSimulatedOffline(): boolean {
    return this.simulatedOffline;
  }

  public setSimulatedOffline(simulated: boolean): void {
    this.simulatedOffline = simulated;
    this.handleNetworkChange(
      !simulated && (typeof navigator !== 'undefined' ? navigator.onLine : true),
    );
  }

  private handleNetworkChange(online: boolean): void {
    const effectiveOnline = online && !this.simulatedOffline;
    const wasOffline = !this.isOnline;
    this.isOnline = effectiveOnline;
    this.notify();

    if (effectiveOnline && wasOffline) {
      // Connection restored! Auto-trigger sync
      this.syncPendingTransactions().catch(() => {});
    }
  }

  /**
   * Ping backend health endpoint to detect true network connectivity
   */
  public async checkConnectivity(): Promise<boolean> {
    if (this.simulatedOffline) {
      this.isOnline = false;
      this.notify();
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const effectiveOnline = res.ok;
      if (this.isOnline !== effectiveOnline) {
        this.handleNetworkChange(effectiveOnline);
      }
      return effectiveOnline;
    } catch {
      if (this.isOnline) {
        this.handleNetworkChange(false);
      }
      return false;
    }
  }

  /**
   * Synchronize queued offline transactions with the server
   */
  public async syncPendingTransactions(): Promise<{
    synced: number;
    conflicts: number;
    failed: number;
  }> {
    if (this.isSyncing) return { synced: 0, conflicts: 0, failed: 0 };
    if (!this.getIsOnline()) return { synced: 0, conflicts: 0, failed: 0 };

    const token = this.getToken ? this.getToken() : null;
    if (!token) return { synced: 0, conflicts: 0, failed: 0 };

    const pendingItems = await OfflineDb.getQueueItems('pending');
    const failedItems = await OfflineDb.getQueueItems('failed');
    const itemsToSync = [...pendingItems, ...failedItems];

    if (itemsToSync.length === 0) {
      return { synced: 0, conflicts: 0, failed: 0 };
    }

    this.isSyncing = true;
    this.notify();

    // Mark items as 'syncing' locally
    for (const item of itemsToSync) {
      await OfflineDb.updateQueueItem(item.id, {
        status: 'syncing',
        lastAttemptAt: new Date().toISOString(),
        attempts: (item.attempts || 0) + 1,
      });
    }

    try {
      const batchRequest: SyncBatchRequest = {
        items: itemsToSync,
      };

      const res = await fetch(`${this.apiUrl}/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(batchRequest),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Sync failed with HTTP ${res.status}`);
      }

      const response: { success: boolean; data: SyncBatchResponse } = await res.json();
      const batchData = response.data;

      // Reconcile each result in IndexedDB
      for (const itemResult of batchData.results) {
        const localItem = itemsToSync.find((i) => i.clientSyncId === itemResult.clientSyncId);
        if (!localItem) continue;

        if (itemResult.status === 'synchronized') {
          await OfflineDb.updateQueueItem(localItem.id, {
            status: 'synchronized',
            serverOrderId: itemResult.serverOrderId || null,
            serverOrderNumber: itemResult.serverOrderNumber || null,
            syncedAt: new Date().toISOString(),
            errorMessage: null,
            conflict: null,
          });
        } else if (itemResult.status === 'conflict') {
          await OfflineDb.updateQueueItem(localItem.id, {
            status: 'conflict',
            conflict: itemResult.conflict || {
              reason: 'VALIDATION_FAILED',
              message: itemResult.errorMessage || 'Conflict detected on server',
              occurredAt: new Date().toISOString(),
            },
            errorMessage: itemResult.errorMessage || 'Conflict detected',
          });
        } else {
          await OfflineDb.updateQueueItem(localItem.id, {
            status: 'failed',
            errorMessage: itemResult.errorMessage || 'Server rejected transaction',
          });
        }
      }

      await OfflineDb.setSyncMetadata('lastQueueSyncAt', new Date().toISOString());

      // Refresh catalog snapshot after sync to pull updated stock
      this.refreshCatalog().catch(() => {});

      return {
        synced: batchData.syncedCount,
        conflicts: batchData.conflictCount,
        failed: batchData.failedCount,
      };
    } catch (err: any) {
      // Network drop or server failure: reset items back to failed
      for (const item of itemsToSync) {
        await OfflineDb.updateQueueItem(item.id, {
          status: 'failed',
          errorMessage: err.message || 'Network disconnected during synchronization',
        });
      }
      return { synced: 0, conflicts: 0, failed: itemsToSync.length };
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Refresh catalog cache in IndexedDB from the server
   */
  public async refreshCatalog(): Promise<boolean> {
    if (!this.getIsOnline()) return false;
    const token = this.getToken ? this.getToken() : null;
    if (!token) return false;

    try {
      const res = await fetch(`${this.apiUrl}/sync/catalog-snapshot`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (data.success && data.data) {
        const snapshot: CatalogSnapshot = data.data;
        await OfflineDb.saveCatalog(snapshot);
        this.notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Resolve an individual conflict (OVERRIDE_ACCEPT, RETRY, or DISCARD)
   */
  public async resolveConflict(
    syncQueueId: string,
    action: 'OVERRIDE_ACCEPT' | 'RETRY' | 'DISCARD',
    notes?: string,
  ): Promise<boolean> {
    if (!this.getIsOnline()) return false;
    const token = this.getToken ? this.getToken() : null;
    if (!token) return false;

    try {
      const res = await fetch(`${this.apiUrl}/sync/resolve-conflict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ syncQueueId, action, notes }),
      });

      if (!res.ok) return false;

      // Also update local record
      const localItem = await OfflineDb.getQueueItemById(syncQueueId);
      if (localItem) {
        if (action === 'DISCARD') {
          await OfflineDb.removeQueueItem(syncQueueId);
        } else if (action === 'RETRY') {
          await OfflineDb.updateQueueItem(syncQueueId, {
            status: 'pending',
            errorMessage: null,
            conflict: null,
          });
        }
      }

      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  public destroy(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
    this.listeners.clear();
    this.isInitialized = false;
  }
}

export const syncManager = SyncManager.getInstance();
