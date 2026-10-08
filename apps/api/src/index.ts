import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getEnvConfig } from '@pos/config';
import { logger } from './logger/index.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { posRouter } from './routes/pos.js';
import { catalogRouter } from './routes/catalog.js';
import { inventoryRouter } from './routes/inventory.js';
import { devicesRouter } from './routes/devices.js';
import { syncRouter } from './routes/sync.js';
import { registerRouter } from './routes/register.js';
import { customerRouter } from './routes/customers.js';
import { returnsRouter } from './routes/returns.js';
import { reportsRouter } from './routes/reports.js';
import { storesRouter } from './routes/stores.js';
import { transfersRouter } from './routes/transfers.js';
import { settingsRouter } from './routes/settings.js';
import { initRedis } from './redis/index.js';

const config = getEnvConfig();

// Strict Rate Limiting Tiers
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
    timestamp: new Date().toISOString(),
  },
});

export const financialLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 financial submissions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Financial transaction rate limit exceeded. Please slow down.',
    },
    timestamp: new Date().toISOString(),
  },
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'API request limit exceeded. Please wait a moment.',
    },
    timestamp: new Date().toISOString(),
  },
});

export function createApp(): Express {
  const app = express();

  // Trust proxy for rate limiting if behind reverse proxy
  app.set('trust proxy', 1);

  // Initialize infrastructure connections
  initRedis();

  // Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: false, // APIs return JSON; client SPA manages its own CSP
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      xContentTypeOptions: true,
      xFrameOptions: { action: 'deny' },
      xXssProtection: true,
      hidePoweredBy: true,
    }),
  );

  // Hardened Cross-Origin Resource Sharing (CORS)
  const allowedOrigins = new Set(
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      config.CORS_ORIGIN,
    ].filter(Boolean) as string[],
  );

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, native hardware)
        if (!requestOrigin) return callback(null, true);
        if (allowedOrigins.has(requestOrigin)) {
          return callback(null, true);
        }
        // In local development, permit LAN IP access for testing on real tablet devices
        if (
          config.NODE_ENV !== 'production' &&
          /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(
            requestOrigin,
          )
        ) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With'],
    }),
  );

  // Request Body Size Limit to prevent DoS attacks
  app.use(express.json({ limit: '2mb' }));

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

  // Global Rate Limiter across all API endpoints
  app.use('/api', generalLimiter);

  // Sensitive Endpoint Specific Rate Limiters
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/pin-login', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);
  app.use('/api/auth/reset-password', authLimiter);

  app.use('/api/pos/checkout', financialLimiter);
  app.use('/api/pos/orders/:id/payments', financialLimiter);
  app.use('/api/pos/orders/:id/void', financialLimiter);
  app.use('/api/pos/orders/:id/refund', financialLimiter);
  app.use('/api/returns', financialLimiter);
  app.use('/api/register/cash-movement', financialLimiter);

  // Base Routes
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/pos', posRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/transfers', transfersRouter);
  app.use('/api/inventory/transfers', transfersRouter);
  app.use('/api/stores', storesRouter);
  app.use('/api/devices', devicesRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/register', registerRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/returns', returnsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/settings', settingsRouter);

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

  // Central Error Handler with Sanitized Output (No stack traces or DB errors leaked)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof err.statusCode === 'number'
        ? err.statusCode
        : typeof err.status === 'number'
          ? err.status
          : 500;
    const code = err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

    if (status >= 500) {
      // Log full internal details and stack trace to server logger only
      logger.error({ err, stack: err.stack }, '[Unhandled Express Error]');
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected internal server error occurred. Please contact support.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.warn({ code, message: err.message, status }, '[Client Service Error]');
    res.status(status).json({
      success: false,
      error: {
        code,
        message: err.message || 'Request failed',
        details: err.details,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
