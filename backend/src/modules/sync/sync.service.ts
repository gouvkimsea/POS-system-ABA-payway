import { prisma } from '../../config/prisma.js';
import { BatchSyncInput } from './sync.schema.js';
import { SaleService } from '../sales/sale.service.js';
import { SyncStatus } from '@prisma/client';

export class SyncService {
  static async processBatch(
    businessId: string,
    storeId: string,
    userId: string,
    input: BatchSyncInput
  ) {
    const results: Array<{
      offlineSyncId: string;
      status: 'PROCESSED' | 'ALREADY_EXISTS' | 'FAILED';
      saleId?: string;
      invoiceNumber?: string;
      error?: string;
    }> = [];

    for (const tx of input.transactions) {
      try {
        // Record in offline sync queue log
        const queueEntry = await prisma.offlineSyncQueue.upsert({
          where: { clientSyncId: tx.offlineSyncId },
          update: {},
          create: {
            clientSyncId: tx.offlineSyncId,
            storeId,
            deviceId: input.deviceId,
            payload: tx as any,
            status: SyncStatus.PENDING,
          },
        });

        // Check if already processed
        const existingSale = await prisma.sale.findUnique({
          where: { offlineSyncId: tx.offlineSyncId },
        });

        if (existingSale) {
          results.push({
            offlineSyncId: tx.offlineSyncId,
            status: 'ALREADY_EXISTS',
            saleId: existingSale.id,
            invoiceNumber: existingSale.invoiceNumber,
          });
          continue;
        }

        // Process sale
        const createdSale = await SaleService.createSale(
          businessId,
          storeId,
          userId,
          tx
        );

        await prisma.offlineSyncQueue.update({
          where: { id: queueEntry.id },
          data: {
            status: SyncStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        results.push({
          offlineSyncId: tx.offlineSyncId,
          status: 'PROCESSED',
          saleId: createdSale?.id,
          invoiceNumber: createdSale?.invoiceNumber,
        });
      } catch (err: any) {
        results.push({
          offlineSyncId: tx.offlineSyncId,
          status: 'FAILED',
          error: err.message || 'Error processing transaction',
        });
      }
    }

    // Update Device sync timestamp
    await prisma.device.upsert({
      where: { deviceIdentifier: input.deviceId },
      update: { lastSyncAt: new Date() },
      create: {
        storeId,
        deviceIdentifier: input.deviceId,
        name: `Terminal ${input.deviceId}`,
        lastSyncAt: new Date(),
      },
    }).catch(() => null);

    return {
      total: input.transactions.length,
      processed: results.filter((r) => r.status === 'PROCESSED').length,
      alreadyExists: results.filter((r) => r.status === 'ALREADY_EXISTS').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      results,
    };
  }
}
