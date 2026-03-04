// server/src/game/EventHandler.ts
import { PendingAction, ACTION_TIMEOUT_MS, Player } from '@nannaricher/shared';
import type { DelayedEffectManager } from './effects/DelayedEffectManager.js';
import { registerCornerHandlers } from './handlers/corner-handlers.js';
import { registerEventHandlers } from './handlers/event-handlers.js';
import { registerLineHandlers } from './handlers/line-handlers.js';
import { registerCardHandlers } from './handlers/card-handlers.js';

export type HandlerFn = (
  engine: GameEngine,
  playerId: string,
  choice?: string
) => PendingAction | null;

/**
 * GameEngine interface - defines the contract for interacting with game state
 * The actual GameEngine class will implement these methods
 */
export interface GameEngine {
  // State access
  getState(): import('@nannaricher/shared').GameState;
  getPlayer(playerId: string): Player | undefined;
  getAllPlayers(): Player[];

  // State modifiers
  modifyPlayerMoney(playerId: string, delta: number): void;
  modifyPlayerGpa(playerId: string, delta: number): void;
  modifyPlayerExploration(playerId: string, delta: number): void;

  // Position
  movePlayerTo(playerId: string, position: import('@nannaricher/shared').Position): void;
  movePlayerForward(playerId: string, steps: number): void;
  movePlayerBackward(playerId: string, steps: number): void;

  // Line handling
  enterLine(playerId: string, lineId: string, payFee: boolean): boolean;
  exitLine(playerId: string, moveToMainBoard: boolean): void;

  // Card handling
  drawCard(playerId: string, deckType: 'chance' | 'destiny'): import('@nannaricher/shared').Card | null;
  drawTrainingPlan(playerId: string): import('@nannaricher/shared').TrainingPlan | null;
  addCardToPlayer(playerId: string, card: import('@nannaricher/shared').Card): void;
  removeCardFromPlayer(playerId: string, cardId: string): void;
  giveCardToPlayer(playerId: string, card: import('@nannaricher/shared').Card): void;

  // Effects
  addEffectToPlayer(
    playerId: string,
    effect: import('@nannaricher/shared').ActiveEffect
  ): void;
  removeEffectFromPlayer(playerId: string, effectId: string): void;

  // Delayed effects
  getDelayedEffects(): DelayedEffectManager;

  // Turn control
  skipPlayerTurn(playerId: string, turns: number): void;

  // Player status
  setPlayerHospitalStatus(playerId: string, inHospital: boolean): void;
  setPlayerDingStatus(playerId: string, atDing: boolean): void;

  // Logging
  log(message: string, playerId?: string): void;

  // Utility
  rollDice(count?: number): number[];
  rollDiceAndBroadcast(playerId: string, count?: number): number[];
  getPlayersByMoneyRank(): Player[]; // sorted richest to poorest
  getPlayersByGpaRank(): Player[]; // sorted highest to lowest
  getPlayersByExplorationRank(): Player[]; // sorted highest to lowest

  // Pending action creation
  createPendingAction(
    playerId: string,
    type: PendingAction['type'],
    prompt: string,
    options?: { label: string; value: string }[],
    targetPlayerIds?: string[]
  ): PendingAction;
}

/**
 * EventHandler - Central registry for all game event handlers
 * Maps handlerId strings to handler functions
 */
export class EventHandler {
  private handlers = new Map<string, HandlerFn>();
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.registerAllHandlers();
  }

  /**
   * Execute a handler by its ID
   * @param handlerId - The unique identifier for the handler
   * @param playerId - The player triggering the handler
   * @param choice - Optional choice made by the player
   * @returns PendingAction if player input is needed, null otherwise
   */
  execute(handlerId: string, playerId: string, choice?: string): PendingAction | null {
    const handler = this.handlers.get(handlerId);
    if (!handler) {
      console.warn(`[EventHandler] No handler found for: ${handlerId}`);
      this.engine.log(`Unknown event handler: ${handlerId}`, playerId);
      return null;
    }

    try {
      return handler(this.engine, playerId, choice);
    } catch (error) {
      console.error(`[EventHandler] Error executing handler ${handlerId}:`, error);
      this.engine.log(`Error in event handler: ${handlerId}`, playerId);
      return null;
    }
  }

  /**
   * Register a single handler
   */
  registerHandler(handlerId: string, handler: HandlerFn): void {
    if (this.handlers.has(handlerId)) {
      console.warn(`[EventHandler] Overwriting existing handler: ${handlerId}`);
    }
    this.handlers.set(handlerId, handler);
  }

  /**
   * Register multiple handlers at once
   */
  registerHandlers(handlers: Record<string, HandlerFn>): void {
    for (const [id, handler] of Object.entries(handlers)) {
      this.registerHandler(id, handler);
    }
  }

  /**
   * Check if a handler exists
   */
  hasHandler(handlerId: string): boolean {
    return this.handlers.has(handlerId);
  }

  /**
   * Get all registered handler IDs
   */
  getHandlerIds(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Register all handlers from sub-modules
   */
  private registerAllHandlers(): void {
    // Register corner handlers (4 corners)
    registerCornerHandlers(this);

    // Register main board event handlers
    registerEventHandlers(this);

    // Register line handlers (~90 cells across 8 lines)
    registerLineHandlers(this);

    // Register card handlers (~90 cards)
    registerCardHandlers(this);

    console.log(`[EventHandler] Registered ${this.handlers.size} handlers`);
  }
}
