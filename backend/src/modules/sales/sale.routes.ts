import { Router } from 'express';
import { SaleController } from './sale.controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { createSaleSchema, refundSaleSchema } from './sale.schema.js';

const router = Router();

router.use(authenticateToken);

router.post('/', validateBody(createSaleSchema), SaleController.create);
router.get('/', SaleController.list);
router.get('/:id', SaleController.getById);
router.post('/:id/refund', validateBody(refundSaleSchema), SaleController.refund);

export const saleRoutes = router;
