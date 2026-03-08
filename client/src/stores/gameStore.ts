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

export interface NotificationItem {
  id: string;
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
  playerId?: string;
  effects?: {
    money?: number;
    gpa?: number;
    exploration?: number;
    cards?: { name: string; deckType: string }[];
    status?: string;
  };
  severity?: 'minor' | 'normal' | 'epic';
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
  drawnCard: { card: Card; deckType: string; playerId?: string; addedToHand?: boolean } | null;
  announcement: AnnouncementData | null;
  winner: WinnerInfo | null;
  voteResult: { cardId: string; results: Record<string, string[]>; winnerOption: string; isTie?: boolean } | null;
  eventDice: { values: number[]; total: number } | null;
  isLoading: boolean;
  error: string | null;
  isRolling: boolean;

  // === Computed Properties (function form) ===
  isMyTurn: () => boolean;
  currentPlayer: () => Player | null;
  currentPlayerId: () => string | null;
  myPlayer: () => Player | null;
  myHandCards: () => Card[];
  otherPlayers: () => Player[];

  // === Notification Feed (stacked, auto-dismiss) ===
  notifications: NotificationItem[];
  addNotification: (msg: string, type?: 'info' | 'warning' | 'success') => void;
  removeNotification: (id: string) => void;

  // === State Setters ===
  setGameState: (state: GameState) => void;
  setRoomId: (id: string) => void;
  setPlayerId: (id: string) => void;
  setCurrentEvent: (event: GameEvent | null) => void;
  setDiceResult: (result: DiceResult | null) => void;
  setDrawnCard: (data: { card: Card; deckType: string; playerId?: string; addedToHand?: boolean } | null) => void;
  setAnnouncement: (data: AnnouncementData | null) => void;
  setWinner: (data: WinnerInfo | null) => void;
  setVoteResult: (data: { cardId: string; results: Record<string, string[]>; winnerOption: string; isTie?: boolean } | null) => void;
  setEventDice: (data: { values: number[]; total: number } | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setRolling: (rolling: boolean) => void;
  readyPlayerIds: string[];
  setReadyPlayerIds: (ids: string[]) => void;
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
  eventDice: null,
  isLoading: true,
  error: null,
  isRolling: false,
  notifications: [],

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
  setEventDice: (data) => set({ eventDice: data }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  setRolling: (rolling) => set({ isRolling: rolling }),

  readyPlayerIds: [],
  setReadyPlayerIds: (ids) => set({ readyPlayerIds: ids }),

  addNotification: (msg, type = 'info') => set((state) => ({
    notifications: [...state.notifications, {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      message: msg,
      type,
      timestamp: Date.now(),
    }].slice(-8), // Keep max 8 notifications
  })),

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id),
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
    notifications: [],
    readyPlayerIds: [],
  }),

  // --- Socket Actions ---
  socketActions: null,
  setSocketActions: (actions) => set({ socketActions: actions }),
}));
