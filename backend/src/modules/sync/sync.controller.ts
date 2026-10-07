import { Response, NextFunction } from 'express';
import { SyncService } from './sync.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class SyncController {
  static async batchSync(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const storeId = req.user!.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: { code: 'STORE_REQUIRED', message: 'User must belong to a store to synchronize offline transactions' },
        });
      }

      const result = await SyncService.processBatch(
        businessId,
        storeId,
        req.user!.userId,
        req.body
      );

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  }
}
