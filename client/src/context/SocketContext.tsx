import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@nannaricher/shared';

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
    }) as TypedSocket;

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      console.log('[Socket] Connected:', newSocket.id);
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

    return () => {
      newSocket.close();
    };
  }, [createSocket]);

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
