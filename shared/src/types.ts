// shared/src/types.ts

// === Position ===
export interface MainPosition { type: 'main'; index: number; }
export interface LinePosition { type: 'line'; lineId: string; index: number; }
export type Position = MainPosition | LinePosition;

// === Effects ===
export interface ActiveEffect {
  id: string;
  type: 'skip_turn' | 'reverse_move' | 'double_move' | 'double_event'
    | 'system_fault' | 'delayed_gratification' | 'custom';
  turnsRemaining: number;
  data?: Record<string, unknown>;
}

// === Cards ===
export interface CardEffect {
  stat?: 'money' | 'gpa' | 'exploration';
  delta?: number;
  multiplier?: number; // delta = multiplier * diceValue
  target?: 'self' | 'all' | 'choose_player' | 'richest' | 'poorest'
    | 'highest_gpa' | 'lowest_gpa' | 'highest_exp' | 'lowest_exp';
}

export interface Card {
  id: string;
  name: string;
  description: string;
  deckType: 'chance' | 'destiny';
  holdable: boolean;        // can be kept in hand
  singleUse: boolean;
  returnToDeck: boolean;    // return after use
  effects: CardEffect[];
  // Complex cards use server-side handler by id
}

export interface TrainingPlan {
  id: string;
  name: string;           // e.g. "文学院"
  winCondition: string;   // description
  passiveAbility: string; // description
  confirmed: boolean;
}

// === Player ===
export interface Player {
  id: string;
  socketId: string;
  name: string;
  color: string;
  money: number;
  gpa: number;
  exploration: number;
  position: Position;
  diceCount: 1 | 2;
  trainingPlans: TrainingPlan[];
  confirmedPlans: string[];    // ids of confirmed plans
  heldCards: Card[];
  effects: ActiveEffect[];
  skipNextTurn: boolean;
  isInHospital: boolean;
  isAtDing: boolean;
  isBankrupt: boolean;
  isDisconnected: boolean;
  linesVisited: string[];
  lineEventsTriggered: Record<string, number[]>;
  hospitalVisits: number;
  moneyZeroCount: number;
  cafeteriaNoNegativeStreak: number;
  cardsDrawnWithEnglish: number;
  cardsDrawnWithDigitStart: string[];
  chanceCardsUsedOnPlayers: Record<string, number>; // playerId -> count
  gulou_endpoint_count: number;
}

// === Pending Action (waiting for player input) ===
export interface PendingAction {
  id: string;
  playerId: string;
  type: 'choose_option' | 'roll_dice' | 'choose_player' | 'choose_line'
    | 'choose_card' | 'multi_player_choice' | 'draw_training_plan';
  prompt: string;
  options?: { label: string; value: string }[];
  targetPlayerIds?: string[];     // for multi-player choices
  responses?: Record<string, string>; // collected responses
  timeoutMs: number;
}

// === Game State ===
export type GamePhase = 'waiting' | 'setup_plans' | 'playing' | 'finished';

export interface GameState {
  roomId: string;
  phase: GamePhase;
  currentPlayerIndex: number;
  turnNumber: number;
  players: Player[];
  cardDecks: {
    chance: Card[];
    destiny: Card[];
    training: TrainingPlan[];
  };
  discardPiles: {
    chance: Card[];
    destiny: Card[];
  };
  pendingAction: PendingAction | null;
  turnOrder: number[];          // player indices
  turnOrderReversed: boolean;
  winner: string | null;        // player id
  log: GameLogEntry[];
}

export interface GameLogEntry {
  turn: number;
  playerId: string;
  message: string;
  timestamp: number;
}

// === Socket Events ===
export interface ClientToServerEvents {
  'room:create': (data: { playerName: string; diceOption: 1 | 2 }) => void;
  'room:join': (data: { roomId: string; playerName: string; diceOption: 1 | 2 }) => void;
  'game:start': () => void;
  'game:roll-dice': () => void;
  'game:choose-action': (data: { actionId: string; choice: string }) => void;
  'game:use-card': (data: { cardId: string; targetPlayerId?: string }) => void;
  'game:confirm-plan': (data: { planId: string }) => void;
  'game:chat': (data: { message: string }) => void;
  'room:reconnect': (data: { roomId: string; playerId: string }) => void;
}

export interface ServerToClientEvents {
  'room:created': (data: { roomId: string; playerId: string }) => void;
  'room:joined': (data: { playerId: string }) => void;
  'room:player-joined': (data: { playerName: string }) => void;
  'room:error': (data: { message: string }) => void;
  'game:state-update': (state: GameState) => void;
  'game:dice-result': (data: { playerId: string; values: number[]; total: number }) => void;
  'game:event-trigger': (data: { title: string; description: string; pendingAction: PendingAction }) => void;
  'game:card-drawn': (data: { card: Card; deckType: string }) => void;
  'game:announcement': (data: { message: string; type: 'info' | 'warning' | 'success' }) => void;
  'game:player-won': (data: { playerId: string; playerName: string; condition: string }) => void;
  'game:chat': (data: { playerName: string; message: string }) => void;
}
