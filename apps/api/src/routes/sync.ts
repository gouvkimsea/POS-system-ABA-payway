import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePermission, isUserAuthorizedForStore } from '../middleware/auth.js';
import { PERMISSIONS } from '@pos/types';
import { syncBatchRequestSchema, resolveConflictInputSchema } from '@pos/validation';
import { SyncService } from '../services/sync/SyncService.js';
import { SyncStatus } from '@prisma/client';

export const syncRouter: Router = Router();

/**
 * POST /api/sync/batch
 * Process batch of offline transactions from a POS terminal
 */
syncRouter.post(
  '/batch',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_CREATE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const businessId = user.businessId;
      const storeId = req.body.storeId || user.storeId;

      if (!storeId || !isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized for transactions in this store',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const parsed = syncBatchRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid sync batch payload',
            issues: parsed.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await SyncService.processBatch(
        businessId,
        storeId,
        user.userId,
        parsed.data as any,
      );

      res.status(200).json({
        success: result.success,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/sync/catalog-snapshot
 * Returns lightweight snapshot of catalog, taxes, store, and customers for offline caching
 */
syncRouter.get(
  '/catalog-snapshot',
  requireAuth,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const businessId = user.businessId;
      const storeId = (req.query.storeId as string) || user.storeId;

      if (!storeId || !isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized for snapshots in this store',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const snapshot = await SyncService.getCatalogSnapshot(businessId, storeId);

      res.status(200).json({
        success: true,
        data: snapshot,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/sync/monitor
 * Administrator endpoint to view offline queue synchronization status and records
 */
syncRouter.get('/monitor', requireAuth, requirePermission(PERMISSIONS.SETTINGS_MANAGE), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const businessId = user.businessId;
    const storeId = (req.query.storeId as string) || user.storeId || undefined;
    const statusParam = req.query.status as string;

    let statusFilter: SyncStatus | undefined;
    if (statusParam && Object.values(SyncStatus).includes(statusParam as SyncStatus)) {
      statusFilter = statusParam as SyncStatus;
    }

    const data = await SyncService.getMonitorData(businessId, storeId, statusFilter);

    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sync/status
 * Quick connectivity and pending sync health check
 */
syncRouter.get('/status', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const businessId = user.businessId;
    const storeId = (req.query.storeId as string) || user.storeId || undefined;

    const data = await SyncService.getMonitorData(businessId, storeId);

    res.status(200).json({
      success: true,
      data: data.stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sync/resolve-conflict
 * Allows store manager / admin to resolve a conflicting sync item
 */
syncRouter.post(
  '/resolve-conflict',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = resolveConflictInputSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid conflict resolution input',
            issues: parsed.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await SyncService.resolveConflict(
        parsed.data.syncQueueId,
        parsed.data.action,
        user.userId,
        parsed.data.notes,
      );

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/sync/retry/:id
 * Retries a specific failed or conflicting sync item
 */
syncRouter.post(
  '/retry/:id',
  requireAuth,
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const syncQueueId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : (req.params.id as string);

      const result = await SyncService.resolveConflict(
        syncQueueId,
        'RETRY',
        user.userId,
        'Manual retry requested by admin',
      );

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);
