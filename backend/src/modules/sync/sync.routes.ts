import { Router } from 'express';
import { SyncController } from './sync.controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { batchSyncSchema } from './sync.schema.js';

const router = Router();

router.use(authenticateToken);

router.post('/batch', validateBody(batchSyncSchema), SyncController.batchSync);

export const syncRoutes = router;
