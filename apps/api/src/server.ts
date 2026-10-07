import { createApp } from './index.js';
import { getEnvConfig } from '@pos/config';
import { logger } from './logger/index.js';
import { disconnectDatabase } from './db/index.js';
import { disconnectRedis } from './redis/index.js';

const config = getEnvConfig();
const app = createApp();

const port = config.API_PORT || config.PORT || 4000;

const server = app.listen(port, () => {
  logger.info(`=======================================================`);
  logger.info(` Enterprise POS API Service Started`);
  logger.info(` URL: http://localhost:${port}`);
  logger.info(` Healthcheck: http://localhost:${port}/api/health`);
  logger.info(` Environment: ${config.NODE_ENV}`);
  logger.info(` Default Timezone: ${config.DEFAULT_TIMEZONE}`);
  logger.info(` Default Currency: ${config.DEFAULT_CURRENCY}`);
  logger.info(`=======================================================`);
});

// Graceful termination handling
async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await disconnectDatabase();
    await disconnectRedis();
    logger.info('Clean shutdown completed.');
    process.exit(0);
  });

  // Force exit if hanging
  setTimeout(() => {
    logger.error('Shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
