import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { logger } from '../config/logger.js';

let wss: WebSocketServer | null = null;

export interface WsMessage {
  type: string;
  payload: any;
}

export function initWebSocketServer(server: HttpServer) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    logger.info({ remoteAddress: req.socket.remoteAddress }, '[WebSocket] Client connected');

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        logger.debug({ data }, '[WebSocket] Received client message');
      } catch (err) {
        // ignore parse error
      }
    });

    ws.on('close', () => {
      logger.info('[WebSocket] Client disconnected');
    });

    ws.send(JSON.stringify({ type: 'CONNECTED', payload: { timestamp: new Date().toISOString() } }));
  });

  return wss;
}

export function wsBroadcast(message: WsMessage) {
  if (!wss) return;

  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
