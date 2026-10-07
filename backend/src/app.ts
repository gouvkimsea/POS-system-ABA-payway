import express from 'express';
import cors from 'cors';
import { authRoutes } from './modules/auth/auth.routes.js';
import { productRoutes } from './modules/products/product.routes.js';
import { registerRoutes } from './modules/registers/register.routes.js';
import { saleRoutes } from './modules/sales/sale.routes.js';
import { syncRoutes } from './modules/sync/sync.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'pos-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API Modules
  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/registers', registerRoutes);
  app.use('/api/sales', saleRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/reports', reportRoutes);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
