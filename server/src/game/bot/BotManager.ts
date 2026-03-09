/**
 * BotManager — Handles automatic bot decision-making during gameplay.
 *
 * When a pendingAction targets a bot player, BotManager schedules an
 * automatic response after a short animation delay so that human players
 * can see what happened on-screen.
 */

import type { GameState, PendingAction, Player } from '@nannaricher/shared';
import { createStrategy, type Strategy } from './BotStrategy.js';

/** Delay (ms) before a bot acts — gives clients time to show animations */
const BOT_ACTION_DELAY_MS = 800;
/** Shorter delay for multi-player actions (votes / chains) where bots aren't the focus */
const BOT_MULTI_DELAY_MS = 300;
/** Safety net: if a bot action hasn't been handled within this time, retry */
const BOT_SAFETY_NET_MS = 5000;

type ActionExecutor = (playerId: string, actionId: string, choice: string) => void;
type RollDiceExecutor = (playerId: string) => void;
type UseCardExecutor = (playerId: string, cardId: string, targetPlayerId?: string) => void;

export class BotManager {
  private strategies = new Map<string, Strategy>();
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private disposed = false;
  private lastScheduledActionId: string | null = null;

  /** Register (or re-register) a bot player's strategy */
  registerBot(playerId: string, strategyName: string): void {
    this.strategies.set(playerId, createStrategy(strategyName));
  }

  /** Unregister a bot */
  unregisterBot(playerId: string): void {
    this.strategies.delete(playerId);
  }

  /** Check if a player is managed by BotManager */
  isBot(playerId: string): boolean {
    return this.strategies.has(playerId);
  }

  /** Clean up all pending timers */
  dispose(): void {
    this.disposed = true;
    for (const timer of this.pendingTimers) clearTimeout(timer);
    this.pendingTimers.clear();
    this.strategies.clear();
  }

  /**
   * Check if the current pendingAction is for a bot and schedule auto-response.
   * Called after every broadcastState().
   */
  scheduleBotAction(
    state: GameState,
    executeAction: ActionExecutor,
    executeDice: RollDiceExecutor,
    executeUseCard: UseCardExecutor,
  ): void {
    if (this.disposed) return;
    const pa = state.pendingAction;
    if (!pa) return;

    // Clear all stale timers from previous actions to avoid actionId mismatches
    for (const timer of this.pendingTimers) clearTimeout(timer);
    this.pendingTimers.clear();

    // Handle different action types
    if (pa.type === 'multi_vote') {
      // Vote actions: all bots that haven't voted yet should vote
      this.scheduleBotVotes(state, pa, executeAction);
      return;
    }

    if (pa.type === 'chain_action') {
      // Chain actions: find the current chain player, if bot, auto-respond
      this.scheduleBotChain(state, pa, executeAction);
      return;
    }

    if (pa.type === 'parallel_plan_selection') {
      // Parallel plan selection: all bots respond
      this.scheduleBotPlanSelection(state, pa, executeAction);
      return;
    }

    // Single-player actions: check if the target player is a bot
    const strategy = this.strategies.get(pa.playerId);
    if (!strategy) return;

    const bot = state.players.find(p => p.id === pa.playerId);
    if (!bot) return;

    const delay = BOT_ACTION_DELAY_MS;
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      if (this.disposed) return;

      if (pa.type === 'roll_dice') {
        executeDice(pa.playerId);
      } else if (pa.type === 'choose_option' || pa.type === 'choose_line') {
        const choice = strategy.chooseOption(
          pa.options || [],
          state,
          pa,
          pa.playerId,
        ) || pa.options?.[0]?.value || 'skip';
        executeAction(pa.playerId, pa.id, choice);
      } else if (pa.type === 'choose_player') {
        const choice = strategy.choosePlayer(
          pa.targetPlayerIds || [],
          state,
          pa.playerId,
        ) || pa.targetPlayerIds?.[0] || 'skip';
        executeAction(pa.playerId, pa.id, choice);
      } else if (pa.type === 'choose_card') {
        const choice = pa.options?.[0]?.value || 'skip';
        executeAction(pa.playerId, pa.id, choice);
      } else if (pa.type === 'draw_training_plan') {
        const choice = pa.options?.[0]?.value || 'skip';
        executeAction(pa.playerId, pa.id, choice);
      } else {
        const choice = pa.options?.[0]?.value || 'skip';
        executeAction(pa.playerId, pa.id, choice);
      }

      // After acting, try to use cards proactively
      this.tryBotCardUse(bot, state, strategy, executeUseCard);
    }, delay);
    this.pendingTimers.add(timer);
  }

  /**
   * Schedule bot votes for multi_vote actions.
   * Each bot that hasn't voted yet submits a vote.
   */
  private scheduleBotVotes(
    state: GameState,
    pa: PendingAction,
    executeAction: ActionExecutor,
  ): void {
    const responses = pa.responses || {};
    for (const player of state.players) {
      if (!player.isBot) continue;
      if (responses[player.id]) continue; // already voted

      const strategy = this.strategies.get(player.id);
      if (!strategy) continue;

      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        if (this.disposed) return;

        const choice = strategy.chooseVote(
          pa.options || [],
          state,
          pa,
          player.id,
        ) || pa.options?.[0]?.value || 'skip';
        executeAction(player.id, pa.id, choice);
      }, BOT_MULTI_DELAY_MS);
      this.pendingTimers.add(timer);
    }
  }

  /**
   * Schedule bot response for chain_action.
   * Find the next player in chain order who needs to respond.
   */
  private scheduleBotChain(
    state: GameState,
    pa: PendingAction,
    executeAction: ActionExecutor,
  ): void {
    const chainOrder = pa.chainOrder || [];
    const responses = pa.responses || {};

    // Find first player in chain who hasn't responded
    for (const pid of chainOrder) {
      if (responses[pid]) continue;

      const strategy = this.strategies.get(pid);
      if (!strategy) break; // Not a bot — wait for human

      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        if (this.disposed) return;

        const choice = strategy.chooseChain(
          pa.options || [],
          state,
          pa,
          pid,
        ) || pa.options?.[0]?.value || 'skip';
        executeAction(pid, pa.id, choice);
      }, BOT_MULTI_DELAY_MS);
      this.pendingTimers.add(timer);
      break; // Only schedule for the next player in chain
    }
  }

  /**
   * Schedule bot responses for parallel_plan_selection.
   */
  private scheduleBotPlanSelection(
    state: GameState,
    pa: PendingAction,
    executeAction: ActionExecutor,
  ): void {
    const responses = pa.responses || {};
    const perPlayer = pa.planSelectionData?.perPlayer || {};

    for (const player of state.players) {
      if (!player.isBot) continue;
      if (responses[player.id]) continue;

      const strategy = this.strategies.get(player.id);
      if (!strategy) continue;

      const playerData = perPlayer[player.id];
      if (!playerData) continue;

      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        if (this.disposed) return;

        const result = strategy.choosePlanSelection(playerData, state, player.id);
        // Encode plan selection as a JSON string choice
        executeAction(player.id, pa.id, JSON.stringify(result));
      }, BOT_MULTI_DELAY_MS);
      this.pendingTimers.add(timer);
    }
  }

  /**
   * Try to use cards proactively after a bot's main action.
   */
  private tryBotCardUse(
    bot: Player,
    state: GameState,
    strategy: Strategy,
    executeUseCard: UseCardExecutor,
  ): void {
    if (!bot.heldCards || bot.heldCards.length === 0) return;

    const cardsToUse = strategy.chooseCardsToUse(bot.heldCards as unknown as Array<{ id: string; useTiming?: string; [key: string]: unknown }>, state, bot.id);
    for (const cardAction of cardsToUse) {
      executeUseCard(bot.id, cardAction.cardId, cardAction.targetPlayerId);
    }
  }
}
