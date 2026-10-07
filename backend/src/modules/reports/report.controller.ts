import { Response, NextFunction } from 'express';
import { ReportService } from './report.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class ReportController {
  static async dailySummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const storeId = (req.query.storeId as string) || req.user!.storeId || undefined;
      const targetDate = req.query.date as string | undefined;

      const summary = await ReportService.getDailySummary(businessId, storeId, targetDate);
      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async auditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const storeId = (req.query.storeId as string) || req.user!.storeId || undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const logs = await ReportService.getAuditLogs(businessId, storeId, page, limit);
      return res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (err) {
      return next(err);
    }
  }
}
