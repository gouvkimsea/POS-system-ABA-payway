import Dexie, { type Table } from 'dexie';
import { Product, Category, OfflineSale } from './types';

export class POSDatabase extends Dexie {
  cachedProducts!: Table<Product, string>;
  cachedCategories!: Table<Category, string>;
  offlineSalesQueue!: Table<OfflineSale, string>;

  constructor() {
    super('SmartPOS_IndexedDB');
    this.version(1).stores({
      cachedProducts: 'id, sku, barcode, category.id, name',
      cachedCategories: 'id, name',
      offlineSalesQueue: 'offlineSyncId, clientCreatedAt',
    });
  }
}

export const db = new POSDatabase();
