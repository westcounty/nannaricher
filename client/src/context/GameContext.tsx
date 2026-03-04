/**
 * @deprecated This context is superseded by the unified Zustand store (stores/gameStore.ts)
 * and SocketProvider (context/SocketProvider.tsx). It is kept for backward compatibility
 * during the migration period. New code should use:
 *   - `useGameStore()` for state
 *   - `useGameStore().socketActions` for actions
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { GameState, PendingAction, Card } from '@nannaricher/shared';
import { useSocket } from './SocketContext';

// Event data structure for modal display
export interface GameEvent {
  title: string;
  description: string;
  pendingAction?: PendingAction;
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

// Announcement data
export interface Announcement {
  message: string;
  type: 'info' | 'warning' | 'success';
  timestamp: number;
}

// Winner data
export interface WinnerInfo {
  playerId: string;
  playerName: string;
  condition: string;
}

interface GameContextValue {
  gameState: GameState | null;
  roomId: string | null;
  playerId: string | null;
  isLoading: boolean;
  isRolling: boolean;
  error: string | null;
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
  // Announcement
  announcement: Announcement | null;
  clearAnnouncement: () => void;
  // Winner
  winner: WinnerInfo | null;
  clearWinner: () => void;
  // Helpers
  isMyTurn: boolean;
  currentPlayerId: string | null;
}

const GameContext = createContext<GameContextValue>({
  gameState: null,
  roomId: null,
  playerId: null,
  isLoading: true,
  isRolling: false,
  error: null,
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
  announcement: null,
  clearAnnouncement: () => {},
  winner: null,
  clearWinner: () => {},
  isMyTurn: false,
  currentPlayerId: null,
});

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { socket, isConnected } = useSocket();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);
  const [diceResult, setDiceResult] = useState<DiceResult | null>(null);
  const [drawnCard, setDrawnCard] = useState<{ card: Card; deckType: string } | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [winner, setWinner] = useState<WinnerInfo | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerIdRef = useRef<string | null>(null);
  playerIdRef.current = playerId;

  useEffect(() => {
    if (!socket) return;

    const handleStateUpdate = (state: GameState) => {
      setGameState(state);
      setIsRolling(false);
    };

    const handleRoomCreated = ({ roomId: id, playerId: pid }: { roomId: string; playerId: string }) => {
      setRoomId(id);
      setPlayerId(pid);
      setError(null);
    };

    const handleRoomJoined = ({ playerId: pid }: { playerId: string }) => {
      setPlayerId(pid);
      setError(null);
    };

    const handleRoomError = ({ message }: { message: string }) => {
      console.error('Room error:', message);
      setError(message);
    };

    const handleDiceResult = (data: DiceResult) => {
      setDiceResult(data);
      setIsRolling(false);
    };

    const handleEventTrigger = (data: { title: string; description: string; pendingAction: PendingAction }) => {
      // Only show event modal if this event is for the current player
      if (data.pendingAction?.playerId && data.pendingAction.playerId !== playerIdRef.current) {
        return;
      }
      setCurrentEvent({
        title: data.title,
        description: data.description,
        pendingAction: data.pendingAction,
      });
    };

    const handleCardDrawn = (data: { card: Card; deckType: string }) => {
      setDrawnCard(data);
    };

    const handleAnnouncement = (data: { message: string; type: 'info' | 'warning' | 'success' }) => {
      setAnnouncement({
        message: data.message,
        type: data.type,
        timestamp: Date.now(),
      });

      // Auto-clear announcement after 5 seconds
      setTimeout(() => {
        setAnnouncement(null);
      }, 5000);
    };

    const handlePlayerWon = (data: WinnerInfo) => {
      setWinner(data);
    };

    socket.on('game:state-update', handleStateUpdate);
    socket.on('room:created', handleRoomCreated);
    socket.on('room:joined', handleRoomJoined);
    socket.on('room:error', handleRoomError);
    socket.on('game:dice-result', handleDiceResult);
    socket.on('game:event-trigger', handleEventTrigger);
    socket.on('game:card-drawn', handleCardDrawn);
    socket.on('game:announcement', handleAnnouncement);
    socket.on('game:player-won', handlePlayerWon);

    return () => {
      socket.off('game:state-update', handleStateUpdate);
      socket.off('room:created', handleRoomCreated);
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:error', handleRoomError);
      socket.off('game:dice-result', handleDiceResult);
      socket.off('game:event-trigger', handleEventTrigger);
      socket.off('game:card-drawn', handleCardDrawn);
      socket.off('game:announcement', handleAnnouncement);
      socket.off('game:player-won', handlePlayerWon);
    };
  }, [socket]);

  // When we receive game state, update roomId from it
  useEffect(() => {
    if (gameState?.roomId) {
      setRoomId(gameState.roomId);
    }
  }, [gameState?.roomId]);

  // Compute derived state
  const isMyTurn = gameState
    ? gameState.players[gameState.currentPlayerIndex]?.id === playerId
    : false;
  const currentPlayerId = gameState?.players[gameState.currentPlayerIndex]?.id || null;

  // Action: Roll dice
  const rollDice = useCallback(() => {
    if (socket && isMyTurn && !isRolling) {
      setIsRolling(true);
      socket.emit('game:roll-dice');
    }
  }, [socket, isMyTurn, isRolling]);

  // Action: Choose action (for pending actions)
  const chooseAction = useCallback((actionId: string, choice: string) => {
    if (socket) {
      socket.emit('game:choose-action', { actionId, choice });
      // Clear the event after making a choice
      setCurrentEvent(null);
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

  // Clear announcement
  const clearAnnouncement = useCallback(() => {
    setAnnouncement(null);
  }, []);

  // Clear winner
  const clearWinner = useCallback(() => {
    setWinner(null);
  }, []);

  return (
    <GameContext.Provider value={{
      gameState,
      roomId,
      playerId,
      isLoading: !isConnected,
      isRolling,
      error,
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
      announcement,
      clearAnnouncement,
      winner,
      clearWinner,
      isMyTurn,
      currentPlayerId,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameState() {
  return useContext(GameContext);
}
