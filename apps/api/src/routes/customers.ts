import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '@pos/types';
import { createCustomerInputSchema, updateCustomerInputSchema } from '@pos/validation';
import { CustomerService } from '../services/customer/CustomerService.js';

export const customerRouter = Router();

/**
 * GET /api/customers
 * List customers with query search, walk-in filter, pagination
 */
customerRouter.get(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const query = typeof req.query.query === 'string' ? req.query.query : undefined;
      const isWalkIn =
        req.query.isWalkIn === 'true' ? true : req.query.isWalkIn === 'false' ? false : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await CustomerService.getCustomers(user.businessId, {
        query,
        isWalkIn,
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
 * GET /api/customers/walk-in
 * Get or initialize the default walk-in customer profile
 */
customerRouter.get(
  '/walk-in',
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const customer = await CustomerService.getWalkInCustomer(user.businessId);

      res.json({
        success: true,
        data: customer,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/customers/:id
 * Retrieve customer details
 */
customerRouter.get(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const customerId = req.params.id as string;
      const customer = await CustomerService.getCustomerById(user.businessId, customerId);

      res.json({
        success: true,
        data: customer,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/customers/:id/history
 * Retrieve full customer purchase history and summary metrics
 */
customerRouter.get(
  '/:id/history',
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const customerId = req.params.id as string;
      const history = await CustomerService.getCustomerHistory(user.businessId, customerId);

      res.json({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * POST /api/customers
 * Create a new customer profile
 */
customerRouter.post(
  '/',
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = createCustomerInputSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid customer input',
            issues: parsed.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const customer = await CustomerService.createCustomer(user.businessId, parsed.data);

      res.status(201).json({
        success: true,
        data: customer,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * PUT /api/customers/:id
 * Update customer profile details
 */
customerRouter.put(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = updateCustomerInputSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid customer update input',
            issues: parsed.error.issues,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const customerId = req.params.id as string;
      const customer = await CustomerService.updateCustomer(
        user.businessId,
        customerId,
        parsed.data,
      );

      res.json({
        success: true,
        data: customer,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/customers/:id
 * Soft delete customer profile
 */
customerRouter.delete(
  '/:id',
  requireAuth,
  requirePermission(PERMISSIONS.CUSTOMERS_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const customerId = req.params.id as string;
      await CustomerService.deleteCustomer(user.businessId, customerId);

      res.json({
        success: true,
        message: 'Customer successfully deleted',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);
