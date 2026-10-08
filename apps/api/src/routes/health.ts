import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../db/index.js';
import { checkRedisConnection } from '../redis/index.js';
import { SystemHealthCheck } from '@pos/types';
import { CONSTANTS, getEnvConfig } from '@pos/config';

export const healthRouter: Router = Router();
const config = getEnvConfig();

/**
 * GET /api/health
 * Comprehensive system health status including database, cache, and system metrics
 */
healthRouter.get('/', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseConnection();
  const redisHealth = await checkRedisConnection();

  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';

  if (dbHealth.status === 'error' || dbHealth.status === 'disconnected') {
    overallStatus = 'error';
  } else if (redisHealth.status === 'in-memory-fallback' || redisHealth.status === 'disconnected') {
    overallStatus = 'degraded';
  }

  const memoryUsage = process.memoryUsage();

  const healthData: SystemHealthCheck & {
    memory?: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
    };
  } = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: config.NODE_ENV,
    services: {
      database: dbHealth,
      redis: redisHealth,
    },
    version: CONSTANTS.APP_VERSION,
    memory: {
      rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
    },
  };

  const statusCode = overallStatus === 'error' ? 503 : 200;
  return res.status(statusCode).json(healthData);
});

/**
 * GET /api/health/live
 * Kubernetes / Docker Liveness probe
 * Verifies that the Node.js process is active and responsive to HTTP requests
 */
healthRouter.get('/live', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

/**
 * GET /api/health/ready
 * Kubernetes / Docker Readiness probe
 * Verifies that the API service is ready to accept user transactions (DB connection required)
 */
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseConnection();
  const isReady = dbHealth.status === 'connected';

  if (!isReady) {
    return res.status(503).json({
      status: 'unavailable',
      error: 'Primary database connection is not ready',
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(200).json({
    status: 'ready',
    database: dbHealth,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/startup
 * Startup probe to confirm initial application bootstrap
 */
healthRouter.get('/startup', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseConnection();
  if (dbHealth.status === 'connected') {
    return res.status(200).json({
      status: 'started',
      version: CONSTANTS.APP_VERSION,
      timestamp: new Date().toISOString(),
    });
  }
  return res.status(503).json({
    status: 'starting',
    timestamp: new Date().toISOString(),
  });
});
