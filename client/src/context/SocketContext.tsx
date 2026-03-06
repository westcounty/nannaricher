import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@nannaricher/shared';
import { useAuthStore } from '../stores/authStore';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: TypedSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  isConnecting: false,
  connectionError: null,
  reconnect: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const createSocket = useCallback(() => {
    setIsConnecting(true);
    setConnectionError(null);

    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: accessToken ? { token: accessToken } : undefined,
    }) as TypedSocket;

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      console.log('[Socket] Connected:', newSocket.id);

      // Auto-reconnect to room if session data exists (e.g. after page refresh)
      const savedRoomId = sessionStorage.getItem('nannaricher_roomId');
      const savedPlayerId = sessionStorage.getItem('nannaricher_playerId');
      if (savedRoomId && savedPlayerId) {
        console.log('[Socket] Auto-reconnecting to room', savedRoomId);
        newSocket.emit('room:reconnect', { roomId: savedRoomId, playerId: savedPlayerId });
      }
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);

      if (reason === 'io server disconnect') {
        // Server disconnected us, need to reconnect manually
        setConnectionError('Server disconnected. Reconnecting...');
      } else if (reason === 'ping timeout') {
        setConnectionError('Connection timeout. Reconnecting...');
      }
    });

    newSocket.on('connect_error', (error) => {
      setIsConnecting(false);
      setConnectionError(`Connection failed: ${error.message}`);
      console.error('[Socket] Connection error:', error.message);
    });

    newSocket.io.on('reconnect', (attemptNumber: number) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);

      // Re-join room after socket-level reconnect
      const savedRoomId = sessionStorage.getItem('nannaricher_roomId');
      const savedPlayerId = sessionStorage.getItem('nannaricher_playerId');
      if (savedRoomId && savedPlayerId) {
        console.log('[Socket] Re-joining room after reconnect', savedRoomId);
        newSocket.emit('room:reconnect', { roomId: savedRoomId, playerId: savedPlayerId });
      }
    });

    newSocket.io.on('reconnect_error', (error: Error) => {
      console.error('[Socket] Reconnect error:', error.message);
    });

    newSocket.io.on('reconnect_failed', () => {
      console.error('[Socket] Reconnect failed');
      setConnectionError('Failed to reconnect after multiple attempts. Please refresh the page.');
      setIsConnecting(false);
    });

    return newSocket;
  }, []);

  useEffect(() => {
    const newSocket = createSocket();
    setSocket(newSocket);

    // When user switches back to this tab, check connection and re-join if needed
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && newSocket) {
        if (!newSocket.connected) {
          console.log('[Socket] Page visible but disconnected, reconnecting...');
          newSocket.connect();
        } else {
          // Socket is connected but server may have marked us as disconnected
          // Re-emit room:reconnect to re-associate socket with player
          const savedRoomId = sessionStorage.getItem('nannaricher_roomId');
          const savedPlayerId = sessionStorage.getItem('nannaricher_playerId');
          if (savedRoomId && savedPlayerId) {
            console.log('[Socket] Page visible, re-syncing room state');
            newSocket.emit('room:reconnect', { roomId: savedRoomId, playerId: savedPlayerId });
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      newSocket.close();
    };
  }, [createSocket]);

  // Reconnect when auth token changes
  useEffect(() => {
    if (socket) {
      socket.close();
      const newSocket = createSocket();
      setSocket(newSocket);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const reconnect = useCallback(() => {
    if (socket) {
      socket.close();
    }
    const newSocket = createSocket();
    setSocket(newSocket);
  }, [socket, createSocket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, isConnecting, connectionError, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
