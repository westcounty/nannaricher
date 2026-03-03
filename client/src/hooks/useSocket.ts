import { useSocket as useSocketContext } from '../context/SocketContext';

/**
 * Hook to access the socket instance and connection status
 * @returns Object containing socket instance, connection status, and any connection error
 */
export function useSocket() {
  const { socket, isConnected, connectionError } = useSocketContext();

  return {
    socket,
    isConnected,
    connectionError,
  };
}
