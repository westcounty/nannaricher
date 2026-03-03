// server/src/socket/types.ts
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GameState,
  Player,
  PendingAction,
  Card,
} from '@nannaricher/shared';

// Re-export shared types for convenience
export type { ClientToServerEvents, ServerToClientEvents };

// Inter-server events (for internal communication between socket instances)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data (attached to each socket)
export interface SocketData {
  playerId?: string;
  roomId?: string;
  playerName?: string;
}

// Typed Socket.io server
export type GameServer = import('socket.io').Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// Typed Socket
export type GameSocket = import('socket.io').Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// Event payload types (extracted from shared types for server use)
export interface RoomCreatePayload {
  playerName: string;
  diceOption: 1 | 2;
}

export interface RoomJoinPayload {
  roomId: string;
  playerName: string;
  diceOption: 1 | 2;
}

export interface RoomReconnectPayload {
  roomId: string;
  playerId: string;
}

export interface GameChooseActionPayload {
  actionId: string;
  choice: string;
}

export interface GameUseCardPayload {
  cardId: string;
  targetPlayerId?: string;
}

export interface GameConfirmPlanPayload {
  planId: string;
}

export interface GameChatPayload {
  message: string;
}

// Response types
export interface RoomCreatedResponse {
  roomId: string;
  playerId: string;
}

export interface RoomJoinedResponse {
  playerId: string;
}

export interface RoomPlayerJoinedResponse {
  playerName: string;
}

export interface RoomErrorResponse {
  message: string;
}

export interface DiceResultResponse {
  playerId: string;
  values: number[];
  total: number;
}

export interface EventTriggerResponse {
  title: string;
  description: string;
  pendingAction: PendingAction;
}

export interface CardDrawnResponse {
  card: Card;
  deckType: 'chance' | 'destiny';
}

export interface AnnouncementResponse {
  message: string;
  type: 'info' | 'warning' | 'success';
}

export interface PlayerWonResponse {
  playerId: string;
  playerName: string;
  condition: string;
}

export interface ChatResponse {
  playerName: string;
  message: string;
}
