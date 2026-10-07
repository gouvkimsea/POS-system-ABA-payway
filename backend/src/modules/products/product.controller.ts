import { Response, NextFunction } from 'express';
import { ProductService } from './product.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class ProductController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const storeId = (req.query.storeId as string) || req.user!.storeId || undefined;
      const result = await ProductService.listProducts(businessId, storeId, req.query as any);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async lookupBarcode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const barcode = req.params.barcode as string;
      const storeId = (req.query.storeId as string) || req.user!.storeId || undefined;
      const product = await ProductService.lookupBarcode(businessId, barcode, storeId);

      if (!product) {
        return res.status(404).json({
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: `No product found matching barcode ${barcode}` },
        });
      }

      return res.status(200).json({
        success: true,
        data: product,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async categories(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const categories = await ProductService.listCategories(businessId);
      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const storeId = req.user!.storeId;
      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: { code: 'STORE_REQUIRED', message: 'User must belong to a store to create inventory' },
        });
      }

      const product = await ProductService.createProduct(businessId, storeId, req.body);
      return res.status(201).json({
        success: true,
        data: product,
      });
    } catch (err) {
      return next(err);
    }
  }
}
