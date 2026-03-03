import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { GameState } from '@nannaricher/shared';
import { useSocket } from './SocketContext';

interface GameContextValue {
  gameState: GameState | null;
  roomId: string | null;
  playerId: string | null;
  isLoading: boolean;
  useCard: (cardId: string, targetPlayerId?: string) => void;
  confirmPlan: (planId: string) => void;
}

const GameContext = createContext<GameContextValue>({
  gameState: null,
  roomId: null,
  playerId: null,
  isLoading: true,
  useCard: () => {},
  confirmPlan: () => {},
});

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { socket, isConnected } = useSocket();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('game:state-update', (state: GameState) => {
      setGameState(state);
    });

    socket.on('room:created', ({ roomId: id, playerId: pid }) => {
      setRoomId(id);
      setPlayerId(pid);
    });

    socket.on('room:joined', ({ playerId: pid }) => {
      setPlayerId(pid);
    });

    socket.on('room:error', ({ message }) => {
      console.error('Room error:', message);
    });

    return () => {
      socket.off('game:state-update');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:error');
    };
  }, [socket]);

  // When we receive game state, update roomId from it
  useEffect(() => {
    if (gameState?.roomId) {
      setRoomId(gameState.roomId);
    }
  }, [gameState?.roomId]);

  const useCard = useCallback((cardId: string, targetPlayerId?: string) => {
    if (socket) {
      socket.emit('game:use-card', { cardId, targetPlayerId });
    }
  }, [socket]);

  const confirmPlan = useCallback((planId: string) => {
    if (socket) {
      socket.emit('game:confirm-plan', { planId });
    }
  }, [socket]);

  return (
    <GameContext.Provider value={{
      gameState,
      roomId,
      playerId,
      isLoading: !isConnected,
      useCard,
      confirmPlan,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameState() {
  return useContext(GameContext);
}
