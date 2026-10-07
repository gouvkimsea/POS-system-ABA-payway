import { Router } from 'express';
import { ReportController } from './report.controller.js';
import { authenticateToken } from '../../middleware/auth.js';
import { requireRoles } from '../../middleware/rbac.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);
router.use(requireRoles(Role.ADMIN, Role.MANAGER));

router.get('/daily-summary', ReportController.dailySummary);
router.get('/audit-logs', ReportController.auditLogs);

export const reportRoutes = router;
