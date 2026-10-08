import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePermission, isUserAuthorizedForStore } from '../middleware/auth.js';
import { PERMISSIONS } from '@pos/types';
import { processReturnRefundSchema } from '@pos/validation';
import { ReturnRefundService } from '../services/refund/ReturnRefundService.js';
import { IdempotencyManager } from '../services/transaction/IdempotencyManager.js';
import { prisma } from '../db/index.js';

export const returnsRouter = Router();

/**
 * GET /api/returns/eligibility/:orderId
 * Check order return eligibility and max returnable items/amounts
 */
returnsRouter.get(
  '/eligibility/:orderId',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_REFUND),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const orderId = req.params.orderId as string;

      const order = await prisma.order.findFirst({
        where: { id: orderId, businessId: user.businessId },
      });
      if (!order) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!isUserAuthorizedForStore(user, order.storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized for this store',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const eligibility = await ReturnRefundService.getOrderRefundEligibility(
        user.businessId,
        orderId,
      );

      res.json({
        success: true,
        data: eligibility,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/returns
 * Process a partial or full return and refund transaction
 */
returnsRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_REFUND),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = processReturnRefundSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid return/refund request',
            issues: parsed.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 1. Verify target order belongs to user's business and user is authorized for store
      const order = await prisma.order.findFirst({
        where: { id: parsed.data.orderId, businessId: user.businessId },
      });
      if (!order) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!isUserAuthorizedForStore(user, order.storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized to refund orders from this store',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // 2. Financial Idempotency & Double-Click Protection
      const idempotencyKey = req.header('idempotency-key') || req.body?.idempotencyKey;
      if (idempotencyKey) {
        const lock = await IdempotencyManager.acquireLock(idempotencyKey);
        if (!lock) {
          res.status(409).json({
            success: false,
            error: {
              code: 'DUPLICATE_IN_FLIGHT',
              message: 'Return transaction with this idempotency key is already processing.',
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const result = await ReturnRefundService.processReturnRefund(
        user.businessId,
        user.userId,
        parsed.data,
      );

      res.status(201).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/returns
 * List all processed returns
 */
returnsRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_REFUND),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = typeof req.query.storeId === 'string' ? req.query.storeId : undefined;

      if (storeId && !isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized to view returns for this store',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const orderId = typeof req.query.orderId === 'string' ? req.query.orderId : undefined;
      const customerId =
        typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await ReturnRefundService.getReturnsList(user.businessId, {
        storeId,
        orderId,
        customerId,
        page,
        limit,
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/returns/:id
 * Retrieve details of a specific return
 */
returnsRouter.get(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.SALES_REFUND),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const returnId = req.params.id as string;

      const returnObj = await prisma.return.findFirst({
        where: { id: returnId, businessId: user.businessId },
        select: { storeId: true },
      });

      if (!returnObj) {
        res.status(404).json({
          success: false,
          error: { code: 'RETURN_NOT_FOUND', message: 'Return not found' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!isUserAuthorizedForStore(user, returnObj.storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized to view returns for this store',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const returnRecord = await ReturnRefundService.getReturnById(user.businessId, returnId);

      res.json({
        success: true,
        data: returnRecord,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);
