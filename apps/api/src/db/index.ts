import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/index.js';

export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// @ts-ignore - Prisma event listener
prisma.$on('error', (e: any) => {
  logger.error({ err: e }, '[Prisma Database Error]');
});

// @ts-ignore - Prisma event listener
prisma.$on('warn', (e: any) => {
  logger.warn({ warning: e }, '[Prisma Database Warning]');
});

export interface DatabaseHealth {
  status: 'connected' | 'disconnected' | 'error';
  latencyMs?: number;
  error?: string;
}

export async function checkDatabaseConnection(): Promise<DatabaseHealth> {
  const start = Date.now();
  try {
    // Run simple fast query to verify connection
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return {
      status: 'connected',
      latencyMs,
    };
  } catch (error: any) {
    logger.error({ err: error.message }, '[Database Health Check Failed]');
    return {
      status: 'error',
      error: 'Database connection failed',
    };
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('[Database] Disconnected cleanly');
  } catch (err: any) {
    logger.error({ err: err.message }, '[Database] Error during disconnect');
  }
}
