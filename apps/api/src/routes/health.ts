import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../db/index.js';
import { checkRedisConnection } from '../redis/index.js';
import { SystemHealthCheck } from '@pos/types';
import { CONSTANTS, getEnvConfig } from '@pos/config';

export const healthRouter: Router = Router();
const config = getEnvConfig();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseConnection();
  const redisHealth = await checkRedisConnection();

  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';

  if (dbHealth.status === 'error' || dbHealth.status === 'disconnected') {
    overallStatus = 'error';
  } else if (redisHealth.status === 'in-memory-fallback' || redisHealth.status === 'disconnected') {
    overallStatus = 'degraded';
  }

  const healthData: SystemHealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.NODE_ENV,
    services: {
      database: dbHealth,
      redis: redisHealth,
    },
    version: CONSTANTS.APP_VERSION,
  };

  const statusCode = overallStatus === 'error' ? 503 : 200;
  return res.status(statusCode).json(healthData);
});
