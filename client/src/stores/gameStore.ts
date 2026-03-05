// client/src/stores/gameStore.ts
// Unified Zustand store — single source of truth for all game state.
// Replaces the GameContext state management while keeping backward compatibility.

import { create } from 'zustand';
import type { GameState, Player, Card, PendingAction } from '@nannaricher/shared';

// ============================================
// Supporting Types
// ============================================

export interface AnnouncementData {
  message: string;
  type: 'info' | 'warning' | 'success';
  timestamp: number;
}

export interface WinnerInfo {
  playerId: string;
  playerName: string;
  condition: string;
}

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

export interface DiceResult {
  playerId: string;
  values: number[];
  total: number;
}

export interface SocketActions {
  rollDice: () => void;
  chooseAction: (actionId: string, choice: string) => void;
  useCard: (cardId: string, targetPlayerId?: string) => void;
  sendChat: (message: string) => void;
}

// ============================================
// Store Interface
// ============================================

interface GameStore {
  // === Persistent State ===
  gameState: GameState | null;
  roomId: string | null;
  playerId: string | null;

  // === Transient State ===
  currentEvent: GameEvent | null;
  diceResult: DiceResult | null;
  drawnCard: { card: Card; deckType: string } | null;
  announcement: AnnouncementData | null;
  winner: WinnerInfo | null;
  voteResult: { cardId: string; results: Record<string, string[]>; winnerOption: string } | null;
  isLoading: boolean;
  error: string | null;
  isRolling: boolean;
  missedEvents: string[];

  // === Computed Properties (function form) ===
  isMyTurn: () => boolean;
  currentPlayer: () => Player | null;
  currentPlayerId: () => string | null;
  myPlayer: () => Player | null;
  myHandCards: () => Card[];
  otherPlayers: () => Player[];

  // === Opponent Notifications ===
  opponentNotifications: string[];
  addOpponentNotification: (msg: string) => void;
  removeOpponentNotification: (msg: string) => void;

  // === State Setters ===
  setGameState: (state: GameState) => void;
  setRoomId: (id: string) => void;
  setPlayerId: (id: string) => void;
  setCurrentEvent: (event: GameEvent | null) => void;
  setDiceResult: (result: DiceResult | null) => void;
  setDrawnCard: (data: { card: Card; deckType: string } | null) => void;
  setAnnouncement: (data: AnnouncementData | null) => void;
  setWinner: (data: WinnerInfo | null) => void;
  setVoteResult: (data: { cardId: string; results: Record<string, string[]>; winnerOption: string } | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRolling: (rolling: boolean) => void;
  addMissedEvent: (event: string) => void;
  clearMissedEvents: () => void;
  resetToLobby: () => void;

  // === Socket Actions (injected by SocketProvider) ===
  socketActions: SocketActions | null;
  setSocketActions: (actions: SocketActions | null) => void;
}

// ============================================
// Store Implementation
// ============================================

export const useGameStore = create<GameStore>((set, get) => ({
  // --- Persistent State ---
  gameState: null,
  roomId: null,
  playerId: null,

  // --- Transient State ---
  currentEvent: null,
  diceResult: null,
  drawnCard: null,
  announcement: null,
  winner: null,
  voteResult: null,
  isLoading: true,
  error: null,
  isRolling: false,
  missedEvents: [],
  opponentNotifications: [],

  // --- Computed Properties ---
  isMyTurn: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return false;
    const current = gameState.players[gameState.currentPlayerIndex];
    return current?.id === playerId;
  },

  currentPlayer: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return gameState.players[gameState.currentPlayerIndex] || null;
  },

  currentPlayerId: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return gameState.players[gameState.currentPlayerIndex]?.id || null;
  },

  myPlayer: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return null;
    return gameState.players.find(p => p.id === playerId) || null;
  },

  myHandCards: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return [];
    const player = gameState.players.find(p => p.id === playerId);
    return player?.heldCards || [];
  },

  otherPlayers: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return [];
    return gameState.players.filter(p => p.id !== playerId);
  },

  // --- State Setters ---
  setGameState: (state) => set({
    gameState: state,
    isLoading: false,
    isRolling: false,
    // Sync roomId from game state
    ...(state.roomId ? { roomId: state.roomId } : {}),
  }),

  setRoomId: (id) => set({ roomId: id }),

  setPlayerId: (id) => set({ playerId: id }),

  setCurrentEvent: (event) => set({ currentEvent: event }),

  setDiceResult: (result) => set({ diceResult: result, isRolling: false }),

  setDrawnCard: (data) => set({ drawnCard: data }),

  setAnnouncement: (data) => set({ announcement: data }),

  setWinner: (data) => set({ winner: data }),

  setVoteResult: (data) => set({ voteResult: data }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  setRolling: (rolling) => set({ isRolling: rolling }),

  addMissedEvent: (event) => set((state) => ({
    missedEvents: [...state.missedEvents, event].slice(-20),
  })),

  clearMissedEvents: () => set({ missedEvents: [] }),

  addOpponentNotification: (msg) => set((state) => ({
    opponentNotifications: [...state.opponentNotifications, msg],
  })),

  removeOpponentNotification: (msg) => set((state) => ({
    opponentNotifications: state.opponentNotifications.filter((n) => n !== msg),
  })),

  resetToLobby: () => set({
    gameState: null,
    roomId: null,
    winner: null,
    currentEvent: null,
    diceResult: null,
    drawnCard: null,
    announcement: null,
    isRolling: false,
    isLoading: false,
    error: null,
    missedEvents: [],
    opponentNotifications: [],
  }),

  // --- Socket Actions ---
  socketActions: null,
  setSocketActions: (actions) => set({ socketActions: actions }),
}));
