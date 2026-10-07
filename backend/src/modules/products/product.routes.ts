import { Router } from 'express';
import { ProductController } from './product.controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateQuery, validateBody } from '../../middleware/validate.js';
import { productQuerySchema, createProductSchema } from './product.schema.js';
import { requireRoles } from '../../middleware/rbac.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);

router.get('/', validateQuery(productQuerySchema), ProductController.list);
router.get('/categories', ProductController.categories);
router.get('/barcode/:barcode', ProductController.lookupBarcode);
router.post('/', requireRoles(Role.ADMIN, Role.MANAGER), validateBody(createProductSchema), ProductController.create);

export const productRoutes = router;
