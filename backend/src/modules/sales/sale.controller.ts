import { Response, NextFunction } from 'express';
import { SaleService } from './sale.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class SaleController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const storeId = req.user!.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: { code: 'STORE_REQUIRED', message: 'Cashier must be associated with a store' },
        });
      }

      const sale = await SaleService.createSale(
        businessId,
        storeId,
        req.user!.userId,
        req.body
      );

      return res.status(201).json({
        success: true,
        data: sale,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sale = await SaleService.getSaleById(req.params.id as string);
      return res.status(200).json({
        success: true,
        data: sale,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async refund(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const storeId = req.user!.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: { code: 'STORE_REQUIRED', message: 'User must be associated with a store' },
        });
      }

      const refund = await SaleService.refundSale(
        req.params.id as string,
        businessId,
        storeId,
        req.user!.userId,
        req.body
      );

      return res.status(200).json({
        success: true,
        data: refund,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const storeId = (req.query.storeId as string) || req.user!.storeId || undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const sales = await SaleService.listSales(businessId, storeId, page, limit);
      return res.status(200).json({
        success: true,
        data: sales,
      });
    } catch (err) {
      return next(err);
    }
  }
}
