import { z } from 'zod';
import { createSaleSchema } from '../sales/sale.schema.js';

export const batchSyncItemSchema = createSaleSchema.extend({
  offlineSyncId: z.string().uuid('Each offline transaction must have a unique UUID sync key'),
  clientCreatedAt: z.string().datetime().optional(),
});

export const batchSyncSchema = z.object({
  deviceId: z.string().min(1, 'Device identifier is required'),
  transactions: z.array(batchSyncItemSchema).min(1, 'At least one transaction required for batch sync'),
});

export type BatchSyncInput = z.infer<typeof batchSyncSchema>;
