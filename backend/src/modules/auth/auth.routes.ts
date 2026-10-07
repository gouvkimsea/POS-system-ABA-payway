import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateBody } from '../../middleware/validate.js';
import { loginSchema, pinLoginSchema } from './auth.schema.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = Router();

router.post('/login', validateBody(loginSchema), AuthController.login);
router.post('/pin-login', validateBody(pinLoginSchema), AuthController.pinLogin);
router.get('/me', authenticateToken, AuthController.me);

export const authRoutes = router;
