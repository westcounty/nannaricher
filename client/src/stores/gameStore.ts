// client/src/stores/gameStore.ts
import { create } from 'zustand';
import { GameState, GamePhase, Player, PendingAction } from '@nannaricher/shared';

interface GameStore {
  // State
  gameState: GameState | null;
  playerId: string | null;
  currentPhase: GamePhase;
  isLoading: boolean;
  error: string | null;

  // Actions
  setGameState: (state: GameState) => void;
  setPlayerId: (id: string) => void;
  setCurrentPhase: (phase: GamePhase) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getCurrentPlayer: () => Player | null;
  getMyPlayer: () => Player | null;
  isMyTurn: () => boolean;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  gameState: null,
  playerId: null,
  currentPhase: 'waiting',
  isLoading: true,
  error: null,

  // Actions
  setGameState: (state) => set({ gameState: state, isLoading: false }),
  setPlayerId: (id) => set({ playerId: id }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),

  // Computed
  getCurrentPlayer: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return gameState.players[gameState.currentPlayerIndex] || null;
  },

  getMyPlayer: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return null;
    return gameState.players.find(p => p.id === playerId) || null;
  },

  isMyTurn: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.id === playerId;
  },
}));
