import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getEnvConfig } from '@pos/config';
import { logger } from './logger/index.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { posRouter } from './routes/pos.js';
import { catalogRouter } from './routes/catalog.js';
import { inventoryRouter } from './routes/inventory.js';
import { initRedis } from './redis/index.js';

const config = getEnvConfig();

export function createApp(): Express {
  const app = express();

  // Initialize infrastructure connections
  initRedis();

  // Security & Cross-Origin
  app.use(
    cors({
      origin: config.CORS_ORIGIN || '*',
      credentials: true,
    }),
  );

  app.use(express.json());

  // Structured HTTP Request Logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(
        {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs: duration,
        },
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
      );
    });
    next();
  });

  // Base Routes
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/pos', posRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/inventory', inventoryRouter);

  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      name: 'Point of Sale Enterprise API',
      status: 'active',
      documentation: '/docs',
      health: '/api/health',
      version: '1.0.0',
    });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route was not found',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Central Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, '[Unhandled Express Error]');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected server error occurred',
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
