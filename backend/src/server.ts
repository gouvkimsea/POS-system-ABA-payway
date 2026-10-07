import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initWebSocketServer } from './websocket/socket.js';
import { prisma } from './config/prisma.js';

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize WebSocket server
  initWebSocketServer(server);

  server.listen(env.PORT, () => {
    logger.info(`🚀 POS Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`📊 Health check available at http://localhost:${env.PORT}/api/health`);
    logger.info(`⚡ WebSocket endpoint at ws://localhost:${env.PORT}/ws`);
  });

  const shutdown = async () => {
    logger.info('Shutting down server...');
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Server cleanly terminated.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
