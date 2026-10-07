import { Response, NextFunction } from 'express';
import { RegisterService } from './register.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class RegisterController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const storeId = (req.query.storeId as string) || req.user!.storeId;
      if (!storeId) {
        return res.status(400).json({ success: false, error: { message: 'Store ID is required' } });
      }
      const registers = await RegisterService.listRegisters(storeId);
      return res.status(200).json({ success: true, data: registers });
    } catch (err) {
      return next(err);
    }
  }

  static async currentSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const storeId = (req.query.storeId as string) || req.user!.storeId;
      if (!storeId) {
        return res.status(400).json({ success: false, error: { message: 'Store ID is required' } });
      }
      const session = await RegisterService.getCurrentSession(req.user!.userId, storeId);
      return res.status(200).json({ success: true, data: session });
    } catch (err) {
      return next(err);
    }
  }

  static async openSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      if (!storeId) {
        return res.status(400).json({ success: false, error: { message: 'Store ID is required' } });
      }
      const session = await RegisterService.openSession(
        req.user!.userId,
        req.user!.businessId,
        storeId,
        req.body
      );
      return res.status(201).json({ success: true, data: session });
    } catch (err) {
      return next(err);
    }
  }

  static async cashMovement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      if (!storeId) {
        return res.status(400).json({ success: false, error: { message: 'Store ID is required' } });
      }
      const sessionId = req.params.sessionId as string;
      const movement = await RegisterService.recordCashMovement(
        sessionId,
        req.user!.userId,
        req.user!.businessId,
        storeId,
        req.body
      );
      return res.status(201).json({ success: true, data: movement });
    } catch (err) {
      return next(err);
    }
  }

  static async closeSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const storeId = req.user!.storeId;
      if (!storeId) {
        return res.status(400).json({ success: false, error: { message: 'Store ID is required' } });
      }
      const sessionId = req.params.sessionId as string;
      const result = await RegisterService.closeSession(
        sessionId,
        req.user!.userId,
        req.user!.businessId,
        storeId,
        req.body
      );
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }
}
