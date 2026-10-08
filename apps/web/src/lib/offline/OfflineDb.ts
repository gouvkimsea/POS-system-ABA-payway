import {
  PosProduct,
  PosCustomer,
  OfflineSyncQueueItem,
  SyncItemStatus,
  SyncMonitorStats,
  CatalogSnapshot,
  PosInitData,
} from '@pos/types';

const DB_NAME = 'pos_offline_db';
const DB_VERSION = 1;

export class OfflineDb {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize or retrieve the IndexedDB singleton
   */
  public static async getDb(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
      throw new Error('IndexedDB is only accessible in browser environments');
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;

          // 1. Products Store
          if (!db.objectStoreNames.contains('products')) {
            const productStore = db.createObjectStore('products', { keyPath: 'id' });
            productStore.createIndex('barcode', 'barcode', { unique: false });
            productStore.createIndex('sku', 'sku', { unique: false });
            productStore.createIndex('categoryId', 'categoryId', { unique: false });
            productStore.createIndex('name', 'name', { unique: false });
          }

          // 2. Categories Store
          if (!db.objectStoreNames.contains('categories')) {
            db.createObjectStore('categories', { keyPath: 'id' });
          }

          // 3. Customers Store
          if (!db.objectStoreNames.contains('customers')) {
            const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
            customerStore.createIndex('phone', 'phone', { unique: false });
            customerStore.createIndex('name', 'name', { unique: false });
          }

          // 4. Store Configuration & Business Settings
          if (!db.objectStoreNames.contains('store_config')) {
            db.createObjectStore('store_config', { keyPath: 'key' });
          }

          // 5. Offline Transaction Queue
          if (!db.objectStoreNames.contains('offline_queue')) {
            const queueStore = db.createObjectStore('offline_queue', { keyPath: 'id' });
            queueStore.createIndex('clientSyncId', 'clientSyncId', { unique: true });
            queueStore.createIndex('status', 'status', { unique: false });
            queueStore.createIndex('createdAt', 'createdAt', { unique: false });
          }

          // 6. Sync Metadata (timestamps, last catalog sync, etc.)
          if (!db.objectStoreNames.contains('sync_metadata')) {
            db.createObjectStore('sync_metadata', { keyPath: 'key' });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    return this.dbPromise;
  }

  // --------------------------------------------------------------------------
  // CATALOG CACHING
  // --------------------------------------------------------------------------

  /**
   * Save catalog snapshot or initData into IndexedDB
   */
  public static async saveCatalog(data: CatalogSnapshot | PosInitData): Promise<void> {
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        ['products', 'categories', 'customers', 'store_config', 'sync_metadata'],
        'readwrite',
      );

      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();

      // 1. Put Products
      const productStore = tx.objectStore('products');
      productStore.clear();
      for (const p of data.products) {
        productStore.put(p);
      }

      // 2. Put Categories
      const categoryStore = tx.objectStore('categories');
      categoryStore.clear();
      for (const c of data.categories) {
        categoryStore.put(c);
      }

      // 3. Put Customers
      const customerStore = tx.objectStore('customers');
      customerStore.clear();
      for (const cust of data.customers) {
        customerStore.put(cust);
      }

      // 4. Put Store & Business Config & Tax Config
      const configStore = tx.objectStore('store_config');
      configStore.put({ key: 'store', value: data.store });
      configStore.put({ key: 'business', value: data.business });
      if ('taxConfig' in data && (data as any).taxConfig) {
        configStore.put({ key: 'tax_config', value: (data as any).taxConfig });
      } else if ('taxRate' in data) {
        configStore.put({ key: 'tax_config', value: { vatRate: (data as any).taxRate } });
      }

      // 5. Update Metadata
      const metaStore = tx.objectStore('sync_metadata');
      metaStore.put({ key: 'lastCatalogSyncAt', value: new Date().toISOString() });
      metaStore.put({ key: 'productsCount', value: data.products.length });
    });
  }

  /**
   * Get all cached products
   */
  public static async getCachedProducts(): Promise<PosProduct[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Find product by exact barcode or SKU in IndexedDB
   */
  public static async findProductByBarcode(barcodeOrSku: string): Promise<PosProduct | null> {
    const db = await this.getDb();
    const clean = barcodeOrSku.trim().toLowerCase();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const req = store.getAll();

      req.onsuccess = () => {
        const products: PosProduct[] = req.result || [];
        const match = products.find(
          (p) =>
            (p.barcode && p.barcode.toLowerCase() === clean) ||
            p.sku.toLowerCase() === clean ||
            (p.variants &&
              p.variants.some(
                (v: any) =>
                  (v.barcode && v.barcode.toLowerCase() === clean) ||
                  (v.sku && v.sku.toLowerCase() === clean),
              )),
        );
        resolve(match || null);
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Search cached products by text query and category filter
   */
  public static async searchProducts(
    query?: string,
    categoryId?: string | null,
  ): Promise<PosProduct[]> {
    const all = await this.getCachedProducts();
    const cleanQuery = (query || '').trim().toLowerCase();

    return all.filter((p) => {
      const matchesCategory = !categoryId || p.categoryId === categoryId;
      if (!matchesCategory) return false;

      if (!cleanQuery) return true;

      return (
        p.name.toLowerCase().includes(cleanQuery) ||
        p.sku.toLowerCase().includes(cleanQuery) ||
        (p.barcode && p.barcode.toLowerCase().includes(cleanQuery)) ||
        (p.nameKhmer && p.nameKhmer.toLowerCase().includes(cleanQuery))
      );
    });
  }

  /**
   * Decrement stock quantity of a cached product in IndexedDB
   */
  public static async decrementCachedProductStock(
    productId: string,
    quantity: number,
  ): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      const req = store.get(productId);

      req.onsuccess = () => {
        const prod = req.result as PosProduct | undefined;
        if (prod) {
          prod.stockQuantity = Math.max(0, prod.stockQuantity - quantity);
          store.put(prod);
        }
        resolve();
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get cached categories
   */
  public static async getCachedCategories(): Promise<any[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('categories', 'readonly');
      const store = tx.objectStore('categories');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get cached customers
   */
  public static async getCachedCustomers(): Promise<PosCustomer[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('customers', 'readonly');
      const store = tx.objectStore('customers');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get cached store configuration
   */
  public static async getCachedStoreConfig(): Promise<{ store: any; business: any }> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('store_config', 'readonly');
      const store = tx.objectStore('store_config');
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result || [];
        const storeObj = results.find((r) => r.key === 'store')?.value;
        const businessObj = results.find((r) => r.key === 'business')?.value;
        resolve({ store: storeObj, business: businessObj });
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get cached tax configuration
   */
  public static async getCachedTaxConfig(): Promise<{ vatRate: number; taxNumber?: string }> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('store_config', 'readonly');
      const store = tx.objectStore('store_config');
      const req = store.get('tax_config');
      req.onsuccess = () => resolve(req.result ? req.result.value : { vatRate: 0.1 });
      req.onerror = () => reject(req.error);
    });
  }

  // --------------------------------------------------------------------------
  // OFFLINE TRANSACTION QUEUE
  // --------------------------------------------------------------------------

  /**
   * Enqueue a newly created offline sale
   */
  public static async enqueueOfflineTransaction(item: OfflineSyncQueueItem): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readwrite');
      const store = tx.objectStore('offline_queue');
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieve all queued offline transactions (or filter by status)
   */
  public static async getQueueItems(
    statusFilter?: SyncItemStatus,
  ): Promise<OfflineSyncQueueItem[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readonly');
      const store = tx.objectStore('offline_queue');
      const req = store.getAll();

      req.onsuccess = () => {
        let items: OfflineSyncQueueItem[] = req.result || [];
        if (statusFilter) {
          items = items.filter((i) => i.status === statusFilter);
        }
        // Order by createdAt descending
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(items);
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieve a single queue item by ID
   */
  public static async getQueueItemById(id: string): Promise<OfflineSyncQueueItem | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readonly');
      const store = tx.objectStore('offline_queue');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Update queue item status, error message, or conflict details
   */
  public static async updateQueueItem(
    id: string,
    updates: Partial<OfflineSyncQueueItem>,
  ): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readwrite');
      const store = tx.objectStore('offline_queue');
      const req = store.get(id);

      req.onsuccess = () => {
        const item = req.result as OfflineSyncQueueItem | undefined;
        if (item) {
          const merged: OfflineSyncQueueItem = { ...item, ...updates };
          store.put(merged);
        }
        resolve();
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete an item from the offline queue
   */
  public static async removeQueueItem(id: string): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readwrite');
      const store = tx.objectStore('offline_queue');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Clear all successfully synchronized items from IndexedDB
   */
  public static async clearSynchronizedItems(): Promise<number> {
    const items = await this.getQueueItems('synchronized');
    const db = await this.getDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_queue', 'readwrite');
      const store = tx.objectStore('offline_queue');

      for (const item of items) {
        store.delete(item.id);
      }

      tx.oncomplete = () => resolve(items.length);
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get queue statistics for the status monitor and badges
   */
  public static async getQueueStats(): Promise<SyncMonitorStats> {
    const items = await this.getQueueItems();
    const lastSyncMeta = await this.getSyncMetadata('lastQueueSyncAt');

    return {
      totalQueued: items.length,
      pendingCount: items.filter((i) => i.status === 'pending').length,
      syncingCount: items.filter((i) => i.status === 'syncing').length,
      synchronizedCount: items.filter((i) => i.status === 'synchronized').length,
      failedCount: items.filter((i) => i.status === 'failed').length,
      conflictCount: items.filter((i) => i.status === 'conflict').length,
      lastSyncTimestamp: lastSyncMeta || null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    };
  }

  // --------------------------------------------------------------------------
  // METADATA
  // --------------------------------------------------------------------------

  public static async setSyncMetadata(key: string, value: any): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_metadata', 'readwrite');
      const store = tx.objectStore('sync_metadata');
      store.put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public static async getSyncMetadata(key: string): Promise<any> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_metadata', 'readonly');
      const store = tx.objectStore('sync_metadata');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }
}
