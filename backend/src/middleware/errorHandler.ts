import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { Prisma } from '@prisma/client';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled API Error');

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `Unique constraint failed on field(s): ${Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field'}`,
        },
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Requested record was not found in database',
        },
      });
    }
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  });
}
