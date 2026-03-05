// server/src/socket/SocketManager.ts — Socket.IO server factory
import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { GameServer, GameSocket } from './types.js';
import { verifyToken } from '../auth/jwt.js';

export type { GameServer, GameSocket };

export function createSocketServer(httpServer: HttpServer): GameServer {
  const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CORS_ORIGIN || true
      : '*',
    credentials: true,
  };

  const io: GameServer = new Server(httpServer, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        socket.data.userId = payload.sub;
      }
    }
    // Allow connection even without token (guest mode for development)
    next();
  });

  return io;
}

/**
 * Wraps a socket event handler with error logging.
 */
export function withErrorBoundary<T extends (...args: any[]) => void>(
  socket: GameSocket,
  eventName: string,
  handler: T,
): T {
  return ((...args: any[]) => {
    try {
      handler(...args);
    } catch (error) {
      console.error(`[${eventName}] Error for socket ${socket.id}:`, error);
      socket.emit('room:error', { message: String(error) });
    }
  }) as T;
}
