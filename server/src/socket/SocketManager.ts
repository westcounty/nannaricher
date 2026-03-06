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
    // Increase ping timeout for mobile/weak networks and tab-switching scenarios
    pingTimeout: 120000,
    pingInterval: 25000,
    // Allow connection recovery after brief disconnections
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    },
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      const result = verifyToken(token);
      if (result) {
        socket.data.userId = result.payload.sub;
        socket.data.authVerified = result.verified;
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
