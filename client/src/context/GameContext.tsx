import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { GameState, PendingAction, Card } from '@nannaricher/shared';
import { useSocket } from './SocketContext';

// Event data structure for modal display
export interface GameEvent {
  title: string;
  description: string;
  effects?: {
    money?: number;
    gpa?: number;
    exploration?: number;
    cards?: { name: string; deckType: string }[];
    status?: string;
  };
}

// Dice result data
export interface DiceResult {
  playerId: string;
  values: number[];
  total: number;
}

interface GameContextValue {
  gameState: GameState | null;
  roomId: string | null;
  playerId: string | null;
  isLoading: boolean;
  // Actions
  rollDice: () => void;
  chooseAction: (actionId: string, choice: string) => void;
  useCard: (cardId: string, targetPlayerId?: string) => void;
  confirmPlan: (planId: string) => void;
  // Event states
  currentEvent: GameEvent | null;
  clearEvent: () => void;
  // Dice states
  diceResult: DiceResult | null;
  clearDiceResult: () => void;
  // Card drawn
  drawnCard: { card: Card; deckType: string } | null;
  clearDrawnCard: () => void;
}

const GameContext = createContext<GameContextValue>({
  gameState: null,
  roomId: null,
  playerId: null,
  isLoading: true,
  rollDice: () => {},
  chooseAction: () => {},
  useCard: () => {},
  confirmPlan: () => {},
  currentEvent: null,
  clearEvent: () => {},
  diceResult: null,
  clearDiceResult: () => {},
  drawnCard: null,
  clearDrawnCard: () => {},
});

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { socket, isConnected } = useSocket();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);
  const [diceResult, setDiceResult] = useState<DiceResult | null>(null);
  const [drawnCard, setDrawnCard] = useState<{ card: Card; deckType: string } | null>(null);

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

    // Dice result event
    socket.on('game:dice-result', (data: DiceResult) => {
      setDiceResult(data);
    });

    // Event trigger event
    socket.on('game:event-trigger', (data: { title: string; description: string; pendingAction: PendingAction }) => {
      setCurrentEvent({
        title: data.title,
        description: data.description,
      });
    });

    // Card drawn event
    socket.on('game:card-drawn', (data: { card: Card; deckType: string }) => {
      setDrawnCard(data);
    });

    return () => {
      socket.off('game:state-update');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:error');
      socket.off('game:dice-result');
      socket.off('game:event-trigger');
      socket.off('game:card-drawn');
    };
  }, [socket]);

  // When we receive game state, update roomId from it
  useEffect(() => {
    if (gameState?.roomId) {
      setRoomId(gameState.roomId);
    }
  }, [gameState?.roomId]);

  // Action: Roll dice
  const rollDice = useCallback(() => {
    if (socket) {
      socket.emit('game:roll-dice');
    }
  }, [socket]);

  // Action: Choose action (for pending actions)
  const chooseAction = useCallback((actionId: string, choice: string) => {
    if (socket) {
      socket.emit('game:choose-action', { actionId, choice });
    }
  }, [socket]);

  // Action: Use card
  const useCard = useCallback((cardId: string, targetPlayerId?: string) => {
    if (socket) {
      socket.emit('game:use-card', { cardId, targetPlayerId });
    }
  }, [socket]);

  // Action: Confirm training plan
  const confirmPlan = useCallback((planId: string) => {
    if (socket) {
      socket.emit('game:confirm-plan', { planId });
    }
  }, [socket]);

  // Clear event
  const clearEvent = useCallback(() => {
    setCurrentEvent(null);
  }, []);

  // Clear dice result
  const clearDiceResult = useCallback(() => {
    setDiceResult(null);
  }, []);

  // Clear drawn card
  const clearDrawnCard = useCallback(() => {
    setDrawnCard(null);
  }, []);

  return (
    <GameContext.Provider value={{
      gameState,
      roomId,
      playerId,
      isLoading: !isConnected,
      rollDice,
      chooseAction,
      useCard,
      confirmPlan,
      currentEvent,
      clearEvent,
      diceResult,
      clearDiceResult,
      drawnCard,
      clearDrawnCard,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameState() {
  return useContext(GameContext);
}
