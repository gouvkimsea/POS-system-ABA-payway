import { Router } from 'express';
import { RegisterController } from './register.controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import { openSessionSchema, closeSessionSchema, cashMovementSchema } from './register.schema.js';

const router = Router();

router.use(authenticateToken);

router.get('/', RegisterController.list);
router.get('/current-session', RegisterController.currentSession);
router.post('/sessions/open', validateBody(openSessionSchema), RegisterController.openSession);
router.post('/sessions/:sessionId/cash-movement', validateBody(cashMovementSchema), RegisterController.cashMovement);
router.post('/sessions/:sessionId/close', validateBody(closeSessionSchema), RegisterController.closeSession);

export const registerRoutes = router;
