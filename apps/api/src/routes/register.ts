import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePermission, isUserAuthorizedForStore } from '../middleware/auth.js';
import { PERMISSIONS } from '@pos/types';
import {
  openRegisterSchema,
  cashMovementSchema,
  closeRegisterSchema,
  registerReportFilterSchema,
} from '@pos/validation';
import { RegisterService, RegisterServiceError } from '../services/register/RegisterService.js';
import { IdempotencyManager } from '../services/transaction/IdempotencyManager.js';
import { prisma } from '../db/index.js';

export const registerRouter: Router = Router();

/**
 * GET /api/register/registers
 * Lists cash registers for the current store or user business
 */
registerRouter.get(
  '/registers',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const storeId = (req.query.storeId as string) || user.storeId;
      const where: any = {};
      if (storeId) {
        where.storeId = storeId;
      } else {
        where.store = { businessId: user.businessId };
      }
      const registers = await prisma.cashRegister.findMany({
        where,
        include: {
          sessions: {
            where: { status: 'OPEN' },
            include: {
              cashier: { select: { id: true, username: true, fullName: true } },
            },
          },
        },
        orderBy: { code: 'asc' },
      });
      res.json({ success: true, data: registers });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/register/open
 * Opens a new cash register shift session
 * Requires permission: register.open
 */
registerRouter.post(
  '/open',
  requireAuth,
  requirePermission(PERMISSIONS.REGISTER_OPEN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const validation = openRegisterSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid open register input',
            details: validation.error.errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Determine store ID from user or register
      let storeId = user.storeId;
      if (!storeId) {
        const reg = await prisma.cashRegister.findUnique({
          where: { id: validation.data.registerId },
        });
        if (reg) storeId = reg.storeId;
      }

      if (!storeId) {
        const defaultStore = await prisma.store.findFirst({
          where: { businessId: user.businessId, isActive: true },
        });
        storeId = defaultStore?.id;
      }

      if (!storeId || !isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized to open a register in this store',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const session = await RegisterService.openSession(
        user.businessId,
        storeId,
        user.userId,
        validation.data,
      );

      res.status(201).json({
        success: true,
        data: session,
        message: `Register session opened successfully for ${session.registerName} (#${session.registerCode})`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      if (err instanceof RegisterServiceError) {
        res.status(err.statusCode).json({
          success: false,
          error: { code: err.code, message: err.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(err);
    }
  },
);

/**
 * GET /api/register/current
 * Retrieves the currently active OPEN register session for the store / terminal
 */
registerRouter.get(
  '/current',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const registerId = (req.query.registerId as string) || undefined;
      let storeId = (req.query.storeId as string) || user.storeId;

      if (!storeId) {
        const defaultStore = await prisma.store.findFirst({
          where: { businessId: user.businessId, isActive: true },
        });
        storeId = defaultStore?.id;
      }

      if (!storeId || !isUserAuthorizedForStore(user, storeId)) {
        res.json({
          success: true,
          data: null,
          message: 'No authorized store associated with user',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const current = await RegisterService.getCurrentSession(storeId, registerId);

      res.json({
        success: true,
        data: current,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/register/cash-movement
 * Records a mid-shift cash drop, cash in, float addition, payout, or store expense
 * Requires permission: cash.manage
 */
registerRouter.post(
  '/cash-movement',
  requireAuth,
  requirePermission(PERMISSIONS.CASH_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const validation = cashMovementSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid cash movement input',
            details: validation.error.errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      let storeId = user.storeId;
      if (!storeId) {
        const defaultStore = await prisma.store.findFirst({
          where: { businessId: user.businessId, isActive: true },
        });
        storeId = defaultStore?.id;
      }

      if (!storeId || !isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized for cash movements in this store',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const idempotencyKey = req.header('idempotency-key') || req.body?.idempotencyKey;
      if (idempotencyKey) {
        const lock = await IdempotencyManager.acquireLock(idempotencyKey);
        if (!lock) {
          res.status(409).json({
            success: false,
            error: {
              code: 'DUPLICATE_IN_FLIGHT',
              message: 'Cash movement is currently processing. Duplicate blocked.',
            },
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const result = await RegisterService.recordCashMovement(
        user.businessId,
        storeId,
        user.userId,
        validation.data as any,
      );

      res.status(201).json({
        success: true,
        data: result,
        message: `Cash movement (${result.movement.type}) recorded successfully.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      if (err instanceof RegisterServiceError) {
        res.status(err.statusCode).json({
          success: false,
          error: { code: err.code, message: err.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(err);
    }
  },
);

/**
 * POST /api/register/close
 * Closes an active register session with cash count reconciliation
 * Requires permission: register.close
 */
registerRouter.post(
  '/close',
  requireAuth,
  requirePermission(PERMISSIONS.REGISTER_CLOSE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const validation = closeRegisterSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0]?.message || 'Invalid close register input',
            details: validation.error.errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      let storeId = user.storeId;
      if (!storeId) {
        const defaultStore = await prisma.store.findFirst({
          where: { businessId: user.businessId, isActive: true },
        });
        storeId = defaultStore?.id;
      }

      if (!storeId || !isUserAuthorizedForStore(user, storeId)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_STORE_ACCESS',
            message: 'You are not authorized to close a register in this store',
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const closedSession = await RegisterService.closeSession(
        user.businessId,
        storeId,
        user.userId,
        validation.data as any,
      );

      res.json({
        success: true,
        data: closedSession,
        message: `Register session closed. Expected: $${closedSession.expectedCashUSD}, Counted: $${closedSession.actualCashUSD}, Diff: $${closedSession.differenceUSD}`,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      if (err instanceof RegisterServiceError) {
        res.status(err.statusCode).json({
          success: false,
          error: { code: err.code, message: err.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(err);
    }
  },
);

/**
 * GET /api/register/sessions
 * List and filter register shift sessions for manager / admin reporting
 * Requires permission: reports.view
 */
registerRouter.get(
  '/sessions',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const validation = registerReportFilterSchema.safeParse(req.query);

      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid filter parameters',
            details: validation.error.errors,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const report = await RegisterService.getSessionReport(
        user.businessId,
        validation.data as any,
      );

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/register/sessions/:id
 * Retrieve comprehensive details and audit trail for a specific session
 * Requires permission: reports.view
 */
registerRouter.get(
  '/sessions/:id',
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const sessionId = String(req.params.id);

      const details = await RegisterService.getSessionDetails(user.businessId, sessionId);

      res.json({
        success: true,
        data: details,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      if (err instanceof RegisterServiceError) {
        res.status(err.statusCode).json({
          success: false,
          error: { code: err.code, message: err.message },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      next(err);
    }
  },
);
