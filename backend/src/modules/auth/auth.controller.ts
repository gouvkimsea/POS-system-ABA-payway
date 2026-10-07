import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async pinLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.pinLogin(req.body);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.getMe(req.user!.userId);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  }
}
