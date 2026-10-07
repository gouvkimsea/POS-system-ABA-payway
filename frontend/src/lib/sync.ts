import { db } from './db';
import { apiRequest } from './api';

export async function syncOfflineSales(deviceId: string): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const queue = await db.offlineSalesQueue.toArray();
  if (queue.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const response = await apiRequest('/sync/batch', {
    method: 'POST',
    body: JSON.stringify({
      deviceId,
      transactions: queue,
    }),
  });

  if (response.success && response.data) {
    const { results } = response.data;
    let synced = 0;
    let failed = 0;

    for (const res of results) {
      if (res.status === 'PROCESSED' || res.status === 'ALREADY_EXISTS') {
        await db.offlineSalesQueue.delete(res.offlineSyncId);
        synced++;
      } else {
        failed++;
      }
    }

    return { synced, failed };
  }

  return { synced: 0, failed: queue.length };
}
