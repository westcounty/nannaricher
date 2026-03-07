// server/src/game/GameCoordinator.ts — Orchestration layer bridging Socket events and GameEngine
import { Server } from 'socket.io';
import {
  GameState,
  Player,
  TrainingPlan,
  Card,
  PendingAction,
  Position,
  ActiveEffect,
  MIN_PLAYERS,
  INITIAL_TRAINING_DRAW,
  TURNS_PER_ROUND,
  TOTAL_ROUNDS,
  BASE_WIN_THRESHOLD,
  SALARY_PASS,
  SALARY_STOP,
  getRoundName,
  getPlayerPlanIds,
} from '@nannaricher/shared';
import { GameEngine } from './GameEngine.js';
import { GameLogger } from './GameLogger.js';
import { boardData, MAIN_BOARD_SIZE } from '../data/board.js';
import type { GameServer } from '../socket/types.js';

// --- Negate Card System (类无懈可击) ---
const NEGATE_CARD_DEFS: Record<string, {
  scope: ('cell' | 'line' | 'card')[];
  limitDeckType?: 'chance' | 'destiny'; // only negate this deck type's cards
  cardDeckType: 'chance' | 'destiny';   // this card's own deck type
}> = {
  'chance_pie_in_sky':        { scope: ['cell', 'line', 'card'], cardDeckType: 'chance' },   // 画饼充饥
  'destiny_stop_loss':        { scope: ['cell', 'line', 'card'], cardDeckType: 'destiny' },  // 及时止损
  'destiny_how_to_explain':   { scope: ['cell', 'line', 'card'], cardDeckType: 'destiny' },  // 如何解释
  'chance_info_blocked':      { scope: ['card'], limitDeckType: 'chance', cardDeckType: 'chance' },  // 消息闭塞
  'chance_false_move':        { scope: ['card'], limitDeckType: 'destiny', cardDeckType: 'chance' }, // 虚晃一枪
};
const NEGATE_CARD_IDS = new Set(Object.keys(NEGATE_CARD_DEFS));

interface NegateWindow {
  eventType: 'cell' | 'line' | 'card';
  eventDeckType?: 'chance' | 'destiny';
  eventDescription: string;
  targetPlayerId: string;
  executeCallback: () => void;
  cancelCallback: () => void;
  negateStack: { playerId: string; cardId: string; cardName: string; cardDeckType: 'chance' | 'destiny' }[];
  remainingPlayers: string[];
}

/**
 * GameCoordinator — orchestrates game flow for a single room.
 * Owns a GameEngine instance and handles all game events
 * that require IO broadcasting.
 */
export class GameCoordinator {
  private engine: GameEngine;
  private io: GameServer;
  private roomId: string;
  private logger: GameLogger;
  private processingAction = false;
  private pendingActionTimer: ReturnType<typeof setTimeout> | null = null;
  private onFinishedCallback: (() => void) | null = null;
  private negateWindow: NegateWindow | null = null;

  constructor(engine: GameEngine, io: GameServer, roomId: string) {
    this.engine = engine;
    this.io = io;
    this.roomId = roomId;
    this.logger = new GameLogger(roomId);

    // Wire up dice broadcast so event handlers can emit dice results
    this.engine.setDiceResultCallback((pid, vals, total) => {
      this.io.to(this.roomId).emit('game:dice-result', { playerId: pid, values: vals, total });
    });

    // Wire up card draw broadcast so clients can show card reveal
    this.engine.setCardDrawCallback((data) => {
      this.io.to(this.roomId).emit('game:card-drawn', {
        playerId: data.playerId,
        card: data.card,
        deckType: data.card.deckType,
        addedToHand: data.addedToHand,
      });
    });

    // Wire up resource change broadcast for prominent stat change notifications
    this.engine.setResourceChangeCallback((data) => {
      this.io.to(this.roomId).emit('game:resource-change', data);
      const state = this.engine.getState();
      this.logger.log({
        turn: state.turnNumber,
        round: state.roundNumber,
        playerId: data.playerId,
        type: 'resource_change',
        message: `${data.playerName} ${data.stat} ${data.delta >= 0 ? '+' : ''}${data.delta} → ${data.current}`,
        data: { stat: data.stat, delta: data.delta, current: data.current },
      });
    });

    // Wire up plan ability trigger broadcast
    this.engine.setPlanAbilityCallback((data) => {
      const state = this.engine.getState();
      this.io.to(this.roomId).emit('game:plan-ability-trigger', {
        ...data,
        turn: state.turnNumber,
        round: state.roundNumber,
      });
    });

    // Wire up line exit summary broadcast
    this.engine.setLineExitCallback((data) => {
      const state = this.engine.getState();
      this.io.to(this.roomId).emit('game:line-exit-summary', {
        ...data,
        turn: state.turnNumber,
        round: state.roundNumber,
      });
    });
  }

  // --------------------------------------------------
  // Accessors
  // --------------------------------------------------

  /** Register a callback for when the game finishes (a player wins). */
  onFinished(callback: () => void): void {
    this.onFinishedCallback = callback;
  }

  getState(): GameState {
    return this.engine.getState();
  }

  getEngine(): GameEngine {
    return this.engine;
  }

  // --------------------------------------------------
  // Dice helper
  // --------------------------------------------------

  /** Roll dice and broadcast result to all clients */
  private rollAndBroadcast(count: number = 1): number {
    const values = this.engine.rollDice(count);
    const total = values.reduce((a, b) => a + b, 0);
    this.io.to(this.roomId).emit('game:dice-result', {
      playerId: 'system',
      values,
      total,
    });
    return total;
  }

  // --------------------------------------------------
  // Broadcasting
  // --------------------------------------------------

  broadcastState(): void {
    const state = this.engine.getState();
    // Fix floating point precision before broadcasting
    for (const player of state.players) {
      player.gpa = parseFloat(player.gpa.toFixed(1));
      player.exploration = Math.round(player.exploration);
      player.money = Math.round(player.money);
    }

    // Mask vote responses to preserve privacy during ongoing votes
    if (state.pendingAction?.type === 'multi_vote' && state.pendingAction.responses) {
      const maskedState = { ...state, pendingAction: { ...state.pendingAction } };
      const maskedResponses: Record<string, string> = {};
      for (const pid of Object.keys(state.pendingAction.responses)) {
        maskedResponses[pid] = '__voted__';
      }
      maskedState.pendingAction!.responses = maskedResponses;
      this.io.to(this.roomId).emit('game:state-update', maskedState);
      this.startPendingActionTimeout();
      return;
    }

    this.io.to(this.roomId).emit('game:state-update', state);
    this.startPendingActionTimeout();
  }

  // --------------------------------------------------
  // Negate Card System (类无懈可击)
  // --------------------------------------------------

  /**
   * Find players holding negate cards eligible for the given event type.
   * Returns players in turn order starting from currentPlayerIndex.
   */
  private getNegateEligiblePlayers(
    eventType: 'cell' | 'line' | 'card',
    eventDeckType?: 'chance' | 'destiny',
  ): { playerId: string; cards: { id: string; name: string }[] }[] {
    const state = this.engine.getState();
    const currentIdx = state.currentPlayerIndex;
    const result: { playerId: string; cards: { id: string; name: string }[] }[] = [];

    for (let i = 0; i < state.players.length; i++) {
      const idx = (currentIdx + i) % state.players.length;
      const player = state.players[idx];
      if (player.isBankrupt) continue;

      const eligibleCards: { id: string; name: string }[] = [];
      const seenCardIds = new Set<string>();

      for (const card of player.heldCards) {
        if (seenCardIds.has(card.id)) continue;
        const def = NEGATE_CARD_DEFS[card.id];
        if (!def) continue;
        if (!def.scope.includes(eventType)) continue;
        if (def.limitDeckType && eventDeckType && def.limitDeckType !== eventDeckType) continue;
        eligibleCards.push({ id: card.id, name: card.name });
        seenCardIds.add(card.id);
      }

      if (eligibleCards.length > 0) {
        result.push({ playerId: player.id, cards: eligibleCards });
      }
    }

    return result;
  }

  /**
   * Open a negate window before executing an event.
   * If no eligible players hold negate cards, executes immediately.
   */
  private openNegateWindow(
    eventType: 'cell' | 'line' | 'card',
    eventDeckType: 'chance' | 'destiny' | undefined,
    eventDescription: string,
    targetPlayerId: string,
    executeCallback: () => void,
    cancelCallback: () => void,
  ): void {
    const eligible = this.getNegateEligiblePlayers(eventType, eventDeckType);
    if (eligible.length === 0) {
      executeCallback();
      return;
    }

    this.negateWindow = {
      eventType,
      eventDeckType,
      eventDescription,
      targetPlayerId,
      executeCallback,
      cancelCallback,
      negateStack: [],
      remainingPlayers: eligible.map(e => e.playerId),
    };

    this.askNextNegatePlayer();
  }

  /**
   * Ask the next eligible player if they want to use a negate card.
   * If no more players, resolve the negate window.
   */
  private askNextNegatePlayer(): void {
    if (!this.negateWindow) return;
    const state = this.engine.getState();

    while (this.negateWindow.remainingPlayers.length > 0) {
      const nextPlayerId = this.negateWindow.remainingPlayers.shift()!;
      const player = state.players.find(p => p.id === nextPlayerId);
      if (!player || player.isBankrupt) continue;

      // Determine what we're checking eligibility for
      let checkEventType: 'cell' | 'line' | 'card' = this.negateWindow.eventType;
      let checkDeckType = this.negateWindow.eventDeckType;

      if (this.negateWindow.negateStack.length > 0) {
        // Counter-negate: we're negating a card effect (the previous negate card)
        checkEventType = 'card';
        checkDeckType = this.negateWindow.negateStack[this.negateWindow.negateStack.length - 1].cardDeckType;
      }

      // Find eligible negate cards for this player
      const eligibleCards: { id: string; name: string }[] = [];
      const seenCardIds = new Set<string>();
      for (const card of player.heldCards) {
        if (seenCardIds.has(card.id)) continue;
        const def = NEGATE_CARD_DEFS[card.id];
        if (!def) continue;
        if (!def.scope.includes(checkEventType)) continue;
        if (def.limitDeckType && checkDeckType && def.limitDeckType !== checkDeckType) continue;
        eligibleCards.push({ id: card.id, name: card.name });
        seenCardIds.add(card.id);
      }
      if (eligibleCards.length === 0) continue;

      // Build prompt
      const isCounterNegate = this.negateWindow.negateStack.length > 0;
      const lastNegateName = isCounterNegate
        ? this.negateWindow.negateStack[this.negateWindow.negateStack.length - 1].cardName
        : '';
      const prompt = isCounterNegate
        ? `【${lastNegateName}】即将生效，是否使用卡牌进行反制？`
        : `${this.negateWindow.eventDescription}，是否使用卡牌取消？`;

      const options = [
        { label: '跳过', value: 'negate_pass' },
        ...eligibleCards.map(c => ({
          label: `使用【${c.name}】${isCounterNegate ? '反制' : '取消'}`,
          value: `negate_use:${c.id}`,
        })),
      ];

      state.pendingAction = {
        id: `negate_${Date.now()}`,
        playerId: nextPlayerId,
        type: 'choose_option',
        prompt,
        options,
        timeoutMs: 30000,
        callbackHandler: 'negate_response',
      };

      // Anonymous waiting notification
      this.io.to(this.roomId).emit('game:announcement', {
        message: '有玩家正在考虑是否使用响应卡牌',
        type: 'info' as const,
      });

      this.broadcastState();
      return; // Wait for player response
    }

    // No more players to ask → resolve
    this.resolveNegateWindow();
  }

  /**
   * Handle a player's response in the negate window.
   */
  private handleNegateResponse(playerId: string, choice: string): void {
    if (!this.negateWindow) return;
    const state = this.engine.getState();

    if (choice === 'negate_pass') {
      this.askNextNegatePlayer();
      return;
    }

    if (choice.startsWith('negate_use:')) {
      const cardId = choice.replace('negate_use:', '');
      const player = state.players.find(p => p.id === playerId);
      if (!player) {
        this.askNextNegatePlayer();
        return;
      }

      // Find and consume the card from hand
      const cardIndex = player.heldCards.findIndex(c => c.id === cardId);
      if (cardIndex === -1) {
        this.askNextNegatePlayer();
        return;
      }

      const card = player.heldCards[cardIndex];
      player.heldCards.splice(cardIndex, 1);

      const negateCardDef = NEGATE_CARD_DEFS[cardId];
      const cardDeckType = negateCardDef?.cardDeckType || card.deckType;

      // Push to negate stack
      this.negateWindow.negateStack.push({
        playerId,
        cardId: card.id,
        cardName: card.name,
        cardDeckType,
      });

      const isCounterNegate = this.negateWindow.negateStack.length > 1;
      this.addLog(playerId, `${player.name} 使用【${card.name}】${isCounterNegate ? '反制' : '取消效果'}！`);

      this.io.to(this.roomId).emit('game:announcement', {
        message: `${player.name} 使用了【${card.name}】${isCounterNegate ? '进行反制' : '取消了即将生效的效果'}！`,
        type: 'warning' as const,
      });

      // Return card to discard if needed
      if (card.returnToDeck) {
        state.discardPiles[card.deckType].push(card);
      }

      // Check for counter-negate: reset remaining players (all except the one who just used)
      const counterEligible = this.getNegateEligiblePlayers('card', cardDeckType);
      this.negateWindow.remainingPlayers = counterEligible
        .map(e => e.playerId)
        .filter(pid => pid !== playerId);

      this.askNextNegatePlayer();
      return;
    }

    // Unknown choice → treat as pass
    this.askNextNegatePlayer();
  }

  /**
   * Resolve the negate window: execute or cancel based on negate stack.
   * Even number of negates (or 0) → execute. Odd → cancel.
   */
  private resolveNegateWindow(): void {
    if (!this.negateWindow) return;

    const negateCount = this.negateWindow.negateStack.length;
    const executeCallback = this.negateWindow.executeCallback;
    const cancelCallback = this.negateWindow.cancelCallback;
    const state = this.engine.getState();

    // Clear negate window and any residual pendingAction
    this.negateWindow = null;
    state.pendingAction = null;

    if (negateCount % 2 === 0) {
      // Even (or 0): event executes normally
      executeCallback();
    } else {
      // Odd: event cancelled
      this.addLog(
        state.players[state.currentPlayerIndex]?.id || '',
        '效果已被取消',
      );
      cancelCallback();
    }
  }

  // --------------------------------------------------
  // Pending Action Timeout
  // --------------------------------------------------

  private startPendingActionTimeout(): void {
    this.clearPendingActionTimeout();
    const state = this.engine.getState();
    const pa = state.pendingAction;
    if (!pa || !pa.timeoutMs) return;

    this.pendingActionTimer = setTimeout(() => {
      const currentPa = this.engine.getState().pendingAction;
      if (!currentPa || currentPa.id !== pa.id) return;

      this.addLog(pa.playerId, '操作超时，自动处理');

      if (currentPa.type === 'roll_dice') {
        this.handleRollDice(pa.playerId);
      } else if (currentPa.type === 'multi_vote') {
        const responses = currentPa.responses || {};
        const firstOption = currentPa.options?.[0]?.value || 'skip';
        for (const p of this.engine.getState().players) {
          if (!p.isBankrupt && !p.isDisconnected && !responses[p.id]) {
            responses[p.id] = firstOption;
          }
        }
        currentPa.responses = responses;
        this._processAction(pa.id, pa.playerId, firstOption);
      } else if (currentPa.type === 'chain_action') {
        // Fill remaining chain players with default choice and process
        const chainOrder = currentPa.chainOrder || [];
        const responses = currentPa.responses || {};
        const defaultChoice = currentPa.options?.[0]?.value || 'skip';
        for (const pid of chainOrder) {
          if (!responses[pid]) {
            responses[pid] = defaultChoice;
          }
        }
        currentPa.responses = responses;
        // Process as the last player in chain to trigger completion
        const lastPlayer = chainOrder[chainOrder.length - 1] || pa.playerId;
        this._processAction(pa.id, lastPlayer, defaultChoice);
      } else {
        const defaultChoice = currentPa.options?.[0]?.value || 'skip';
        this._processAction(pa.id, pa.playerId, defaultChoice);
      }
    }, pa.timeoutMs + 3000);
  }

  private clearPendingActionTimeout(): void {
    if (this.pendingActionTimer) {
      clearTimeout(this.pendingActionTimer);
      this.pendingActionTimer = null;
    }
  }


  handleDisconnectedPlayerAction(): void {
    const state = this.engine.getState();
    const pa = state.pendingAction;
    if (!pa) return;
    this.clearPendingActionTimeout();
    this.addLog(pa.playerId, '玩家断连，自动处理操作');
    if (pa.type === 'roll_dice') {
      this.handleRollDice(pa.playerId);
    } else if (pa.type === 'chain_action') {
      // Fill remaining chain players with default and complete
      const chainOrder = pa.chainOrder || [];
      const responses = pa.responses || {};
      const defaultChoice = pa.options?.[0]?.value || 'skip';
      for (const pid of chainOrder) {
        if (!responses[pid]) responses[pid] = defaultChoice;
      }
      pa.responses = responses;
      const lastPlayer = chainOrder[chainOrder.length - 1] || pa.playerId;
      this._processAction(pa.id, lastPlayer, defaultChoice);
    } else {
      const defaultChoice = pa.options?.[0]?.value || 'skip';
      this._processAction(pa.id, pa.playerId, defaultChoice);
    }
  }

  // --------------------------------------------------
  // Utility
  // --------------------------------------------------

  private saveGameSummary(): void {
    const state = this.engine.getState();
    this.logger.setGameSummary({
      roomId: this.roomId,
      totalTurns: state.turnNumber,
      totalRounds: state.roundNumber,
      phase: state.phase,
      winner: state.winner,
      players: state.players.map(p => ({
        id: p.id,
        name: p.name,
        money: p.money,
        gpa: p.gpa,
        exploration: p.exploration,
        majorPlan: p.majorPlan,
        minorPlans: p.minorPlans,
        isBankrupt: p.isBankrupt,
        isInHospital: p.isInHospital,
        position: p.position,
      })),
    });
  }

  private addLog(playerId: string, message: string): void {
    const state = this.engine.getState();
    state.log.push({
      turn: state.turnNumber,
      playerId,
      message,
      timestamp: Date.now(),
    });
    this.logger.log({ turn: state.turnNumber, round: state.roundNumber, playerId, type: 'system', message });
  }

  /** Capture player stats snapshot for computing deltas after event execution */
  private capturePlayerSnapshot(playerId: string): { money: number; gpa: number; exploration: number } | null {
    const player = this.engine.getPlayer(playerId);
    if (!player) return null;
    return { money: player.money, gpa: player.gpa, exploration: player.exploration };
  }

  /** Compute deltas between snapshot and current player stats */
  private computeEffectDeltas(playerId: string, snapshot: { money: number; gpa: number; exploration: number } | null): { money?: number; gpa?: number; exploration?: number } | undefined {
    if (!snapshot) return undefined;
    const player = this.engine.getPlayer(playerId);
    if (!player) return undefined;
    const dm = player.money - snapshot.money;
    const dg = +(player.gpa - snapshot.gpa).toFixed(2);
    const de = player.exploration - snapshot.exploration;
    if (dm === 0 && dg === 0 && de === 0) return undefined;
    const result: { money?: number; gpa?: number; exploration?: number } = {};
    if (dm !== 0) result.money = dm;
    if (dg !== 0) result.gpa = dg;
    if (de !== 0) result.exploration = de;
    return result;
  }

  // --------------------------------------------------
  // Turn Management
  // --------------------------------------------------

  advanceTurn(): void {
    const state = this.engine.getState();

    // 化学院链式反应：回合结束时检查是否有增益
    const outgoingPlayer = state.players[state.currentPlayerIndex];
    if (outgoingPlayer && outgoingPlayer.turnStartSnapshot) {
      const snap = outgoingPlayer.turnStartSnapshot;
      const hasPositive = outgoingPlayer.money > snap.money
        || outgoingPlayer.gpa > snap.gpa + 0.001
        || outgoingPlayer.exploration > snap.exploration;
      if (hasPositive) {
        outgoingPlayer.consecutivePositiveTurns++;
      } else {
        outgoingPlayer.consecutivePositiveTurns = 0;
      }
      outgoingPlayer.turnStartSnapshot = undefined;
    }

    // Find next player who can play
    let nextIndex = state.currentPlayerIndex;
    let attempts = 0;

    do {
      nextIndex = (nextIndex + 1) % state.players.length;
      attempts++;

      const nextPlayer = state.players[nextIndex];

      // Skip disconnected or bankrupt players
      if (nextPlayer.isDisconnected || nextPlayer.isBankrupt) {
        continue;
      }

      // Check if player should skip turn
      if (nextPlayer.skipNextTurn) {
        nextPlayer.skipNextTurn = false;

        // Decrement skip_turn effect and check if more skips remain
        const skipEffect = nextPlayer.effects.find(e => e.type === 'skip_turn');
        if (skipEffect) {
          skipEffect.turnsRemaining--;
          if (skipEffect.turnsRemaining > 0) {
            nextPlayer.skipNextTurn = true; // Still has more turns to skip
          } else {
            nextPlayer.effects = nextPlayer.effects.filter(e => e !== skipEffect);
          }
        }

        this.addLog(nextPlayer.id, `${nextPlayer.name} 暂停回合（跳过）`);
        this.io.to(this.roomId).emit('game:announcement', {
          message: `${nextPlayer.name} 本回合被跳过`,
          type: 'warning' as const,
        });
        continue;
      }

      break;
    } while (attempts < state.players.length);

    // If we looped through all players without finding one who can play, end the game
    if (attempts >= state.players.length) {
      const nextPlayer = state.players[nextIndex];
      if (nextPlayer.isDisconnected || nextPlayer.isBankrupt || nextPlayer.skipNextTurn) {
        this.addLog(nextPlayer.id, '所有玩家均无法行动，游戏结束');
        this.forceEndGame();
        return;
      }
    }

    state.currentPlayerIndex = nextIndex;

    // Increment turn number when back to first player
    if (nextIndex === 0) {
      state.turnNumber++;
    }

    // Check if a round (学年) just ended: every TURNS_PER_ROUND turns
    if (nextIndex === 0 && state.turnNumber > 0 && state.turnNumber % TURNS_PER_ROUND === 0) {
      state.roundNumber++;

      // If all rounds are done → force end game
      if (state.roundNumber > TOTAL_ROUNDS) {
        this.forceEndGame();
        return;
      }

      // 大二起：启动年度培养计划选择流程
      if (state.roundNumber >= 2) {
        const roundName = getRoundName(state.roundNumber);
        this.addLog('system', `=== ${roundName}开始 === 升学阶段！`);
        this.io.to(this.roomId).emit('game:announcement', {
          message: `${roundName}开始！升学阶段 — 选择培养计划`,
          type: 'info' as const,
        });

        // All non-bankrupt, non-disconnected players participate in selection
        const eligiblePlayers = state.players.filter(p => !p.isBankrupt && !p.isDisconnected);
        if (eligiblePlayers.length > 0) {
          this.yearlyDrawnPlanIds.clear();
          this.startPlanSelectionForPlayer(eligiblePlayers, 0);
          return;
        }
      }
    }

    // 化学化工学院: disabledCells 持续生效，不再每回合清空

    // Set pending action for next player
    const currentPlayer = state.players[state.currentPlayerIndex];

    // 化学院链式反应：记录回合开始时的资源快照
    currentPlayer.turnStartSnapshot = {
      money: currentPlayer.money,
      gpa: currentPlayer.gpa,
      exploration: currentPlayer.exploration,
    };

    // --- PlanAbilities: on_turn_start check ---
    const planAbilities = this.engine.getPlanAbilities();
    this.engine.setResourceSource('plan:on_turn_start');
    const turnAbility = this.engine.checkAbilitiesAndBroadcast(currentPlayer, state, 'on_turn_start');
    if (turnAbility?.effects?.customEffect) {
      if (turnAbility.message) this.addLog(currentPlayer.id, turnAbility.message);
      const ce = turnAbility.effects.customEffect;

      if (ce === 'jisuanji_bonus') {
        state.pendingAction = {
          id: `jisuanji_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'choose_option',
          prompt: '计算机系能力：选择回合奖励',
          options: [
            { label: '探索+1', value: 'jisuanji_explore' },
            { label: '金钱+100', value: 'jisuanji_money' },
          ],
          callbackHandler: 'plan_jisuanji_choice',
          timeoutMs: 15000,
        };
        if (!this.engine.getEventHandler().hasHandler('plan_jisuanji_choice')) {
          this.engine.getEventHandler().registerHandler('plan_jisuanji_choice', (eng, pid, choice) => {
            if (choice === 'jisuanji_explore') {
              eng.modifyPlayerExploration(pid, 1);
            } else {
              eng.modifyPlayerMoney(pid, 100);
            }
            return null;
          });
        }
        this.broadcastState();
        return;
      }
      if (ce === 'kuangyaming_bonus') {
        state.pendingAction = {
          id: `kuangyaming_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'choose_option',
          prompt: '匡亚明学院能力：选择回合奖励',
          options: [
            { label: 'GPA+0.1', value: 'kuangyaming_gpa' },
            { label: '探索+1', value: 'kuangyaming_explore' },
          ],
          callbackHandler: 'plan_kuangyaming_choice',
          timeoutMs: 15000,
        };
        if (!this.engine.getEventHandler().hasHandler('plan_kuangyaming_choice')) {
          this.engine.getEventHandler().registerHandler('plan_kuangyaming_choice', (eng, pid, choice) => {
            if (choice === 'kuangyaming_gpa') {
              eng.modifyPlayerGpa(pid, 0.1);
            } else {
              eng.modifyPlayerExploration(pid, 1);
            }
            return null;
          });
        }
        this.broadcastState();
        return;
      }
      if (ce === 'wuli_double_move') {
        state.pendingAction = {
          id: `wuli_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'choose_option',
          prompt: '物理学院能力：选择本回合移动方式',
          options: [
            { label: '正常移动', value: 'wuli_normal' },
            { label: '双倍前进', value: 'wuli_double_forward' },
            { label: '双倍后退', value: 'wuli_double_backward' },
          ],
          callbackHandler: 'plan_wuli_choice',
          timeoutMs: 15000,
        };
        if (!this.engine.getEventHandler().hasHandler('plan_wuli_choice')) {
          this.engine.getEventHandler().registerHandler('plan_wuli_choice', (eng, pid, choice) => {
            if (choice === 'wuli_double_forward') {
              eng.addEffectToPlayer(pid, {
                id: `movemod_${Date.now()}`,
                type: 'custom',
                turnsRemaining: 1,
                data: { moveModifier: 'double_forward' },
              });
              eng.log('物理学院：本回合双倍前进', pid);
            } else if (choice === 'wuli_double_backward') {
              eng.addEffectToPlayer(pid, {
                id: `movemod_${Date.now()}`,
                type: 'custom',
                turnsRemaining: 1,
                data: { moveModifier: 'double_backward' },
              });
              eng.log('物理学院：本回合双倍后退', pid);
            }
            return null;
          });
        }
        this.broadcastState();
        return;
      }
      if (ce === 'huaxue_disable') {
        // 化工学院：可禁用主线上有负面效果的格子或线路入口，持续生效
        const NEGATIVE_CELL_IDS = new Set([
          'tuition',      // 交学费：扣钱
          'hospital',     // 校医院：被困
          'ding',         // 鼎：暂停
          'jiang_gong',   // 蒋公的面子：有负面选项
          'society',      // 社团：扣钱或GPA
          'kechuang',     // 科创赛事：扣GPA
          'nanna_cp',     // 南哪诚品：给别人钱
          'chuangmen',    // 闯门：扣GPA选项
          'retake',       // 重修：扣钱
          'qingong',      // 勤工助学：暂停1回合
        ]);
        const disableOptions: { label: string; value: string; group?: string }[] = [];
        for (const c of boardData.mainBoard) {
          if (NEGATIVE_CELL_IDS.has(c.id)) {
            disableOptions.push({ label: c.name, value: `disable_${c.id}`, group: '负面格子' });
          } else if (c.type === 'line_entry') {
            disableOptions.push({ label: c.name, value: `disable_${c.id}`, group: '线路入口' });
          }
        }
        disableOptions.push({ label: '不禁用', value: 'huaxue_skip' });

        state.pendingAction = {
          id: `huaxue_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'choose_option',
          prompt: '化学化工学院能力：选择一个格子或线路入口使其持续失效（直到主修变更或新学年重新选择）',
          options: disableOptions,
          callbackHandler: 'plan_huaxue_choice',
          timeoutMs: 15000,
        };
        if (!this.engine.getEventHandler().hasHandler('plan_huaxue_choice')) {
          this.engine.getEventHandler().registerHandler('plan_huaxue_choice', (eng, pid, choice) => {
            const st = eng.getState();
            // 先清空旧的禁用（重新选择时）
            st.disabledCells = [];
            if (choice && choice.startsWith('disable_')) {
              const cellId = choice.replace('disable_', '');
              st.disabledCells.push(cellId);
              eng.log(`化学化工学院：持续禁用格子 ${cellId}`, pid);
            }
            return null;
          });
        }
        this.broadcastState();
        return;
      }
      if (ce === 'shuxue_set_dice') {
        state.pendingAction = {
          id: `shuxue_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'choose_option',
          prompt: '数学系能力：是否指定本回合骰子点数？',
          options: [
            { label: '不指定', value: 'shuxue_skip' },
            { label: '1', value: 'shuxue_1' },
            { label: '2', value: 'shuxue_2' },
            { label: '3', value: 'shuxue_3' },
            { label: '4', value: 'shuxue_4' },
            { label: '5', value: 'shuxue_5' },
            { label: '6', value: 'shuxue_6' },
          ],
          callbackHandler: 'plan_shuxue_choice',
          timeoutMs: 15000,
        };
        if (!this.engine.getEventHandler().hasHandler('plan_shuxue_choice')) {
          this.engine.getEventHandler().registerHandler('plan_shuxue_choice', (eng, pid, choice) => {
            if (choice && choice.startsWith('shuxue_') && choice !== 'shuxue_skip') {
              const num = parseInt(choice.replace('shuxue_', ''), 10);
              if (num >= 1 && num <= 6) {
                eng.addEffectToPlayer(pid, {
                  id: `forcedDice_${Date.now()}`,
                  type: 'custom',
                  turnsRemaining: 1,
                  data: { forcedDice: num },
                });
                eng.log(`数学系：指定本回合骰子点数为 ${num}`, pid);
              }
            }
            return null;
          });
        }
        this.broadcastState();
        return;
      }
    }

    // Check for forcedDice effect before normal roll
    const forcedDiceEffect = currentPlayer.effects.find(
      e => e.type === 'custom' && e.data?.forcedDice
    );

    // Log turn start with player snapshot
    this.logger.log({
      turn: state.turnNumber,
      round: state.roundNumber,
      playerId: currentPlayer.id,
      type: 'turn_start',
      message: `${currentPlayer.name} 的回合开始`,
      data: {
        position: currentPlayer.position,
        money: currentPlayer.money,
        gpa: currentPlayer.gpa,
        exploration: currentPlayer.exploration,
        effects: currentPlayer.effects.map(e => e.type),
        majorPlan: currentPlayer.majorPlan,
        minorPlans: currentPlayer.minorPlans,
      },
    });

    this.engine.clearResourceSource(); // Clear plan ability source before dice phase

    state.pendingAction = {
      id: `roll_dice_${Date.now()}`,
      playerId: currentPlayer.id,
      type: 'roll_dice',
      prompt: forcedDiceEffect ? `请投骰子（数学系：点数已锁定为 ${forcedDiceEffect.data?.forcedDice}）` : '请投骰子',
      timeoutMs: 60000,
    };

    // Decrement all effect turns (except skip_turn handled above, and permanent custom effects)
    state.players.forEach(player => {
      player.effects = player.effects.filter(e => {
        if (e.type === 'skip_turn') return e.turnsRemaining > 0; // Already decremented in skip logic
        if (e.type === 'custom' && e.turnsRemaining >= 999) return true; // Permanent custom effects
        e.turnsRemaining--;
        return e.turnsRemaining > 0;
      });
    });

    this.broadcastState();
  }

  // --------------------------------------------------
  // Win Condition Checking
  // --------------------------------------------------

  checkWinCondition(): { winnerId: string | null; condition: string | null } {
    const state = this.engine.getState();

    for (const player of state.players) {
      if (player.isBankrupt || player.isDisconnected) continue;
      const disabled = player.disabledWinConditions ?? [];

      // Check base win condition: GPA*10 + exploration >= 60
      if (!disabled.includes('base')) {
        const baseScore = player.gpa * 10 + player.exploration;
        if (baseScore >= BASE_WIN_THRESHOLD) {
          return {
            winnerId: player.id,
            condition: `GPA×10+探索值达到 ${baseScore.toFixed(1)} ≥ ${BASE_WIN_THRESHOLD}`,
          };
        }
      }

      // Check each confirmed training plan's win condition (skip disabled)
      for (const planId of getPlayerPlanIds(player)) {
        if (disabled.includes(planId)) continue;
        const condition = this.checkPlanWinCondition(player, planId, state);
        if (condition) {
          const plan = player.trainingPlans.find(p => p.id === planId);
          return {
            winnerId: player.id,
            condition: `${plan?.name || planId}: ${condition}`,
          };
        }
      }
    }

    return { winnerId: null, condition: null };
  }

  private checkPlanWinCondition(player: Player, planId: string, state: GameState): string | null {
    const history = this.engine.getStateTracker().getPlayerHistory(player.id);

    switch (planId) {
      // === 正确实现的简单数值条件 ===
      case 'plan_shangxue':  // 商学院：金钱达到5555
        if (player.money >= 5555) return '金钱达到5555';
        break;
      case 'plan_huaxue':    // 化学化工学院：连续6回合触发增益（链式反应）
        if (player.consecutivePositiveTurns >= 6) return `连续${player.consecutivePositiveTurns}回合触发增益`;
        break;
      case 'plan_makesi':    // 马克思主义学院：GPA达到4.5
        if (player.gpa >= 4.5) return 'GPA达到4.5';
        break;

      // === 基于跟踪数据的条件 ===
      case 'plan_wenxue': {  // 文学院：离开赚在南哪线时金钱未变化
        if (history) {
          const moneyExits = history.lineExits.filter(e => e.lineId === 'money');
          for (const exit of moneyExits) {
            if (exit.moneyBefore === exit.moneyAfter) return '离开赚在南哪线时金钱未变化';
          }
        }
        break;
      }
      case 'plan_lishi': {   // 历史学院：按顺序经过鼓楼、浦口、仙林、苏州
        if (history) {
          const order = history.campusLineOrder;
          const required = ['gulou', 'pukou', 'xianlin', 'suzhou'];
          let idx = 0;
          for (const campus of order) {
            if (campus === required[idx]) {
              idx++;
              if (idx >= required.length) return '按顺序经过鼓楼、浦口、仙林、苏州校区线';
            }
          }
        }
        break;
      }
      case 'plan_zhexue': {  // 哲学系：完整进出某条线且探索值和GPA无变化且钱没减少
        if (history) {
          for (const exit of history.lineExits) {
            if (Math.abs(exit.gpaBefore - exit.gpaAfter) < 0.01 &&
                Math.abs(exit.explorationBefore - exit.explorationAfter) < 0.01 &&
                exit.moneyAfter >= exit.moneyBefore) {
              return `完整进出${exit.lineId}线，探索值和GPA无变化且钱未减少`;
            }
          }
        }
        break;
      }
      case 'plan_faxue':     // 法学院：场上出现破产玩家且不是你
        if (state.players.some(p => p.isBankrupt && p.id !== player.id)) {
          return '场上出现破产玩家';
        }
        break;
      case 'plan_waiguoyu':  // 外国语学院：抽到过两张包含英文字母的卡
        if (player.cardsDrawnWithEnglish >= 2) return `抽到${player.cardsDrawnWithEnglish}张含英文卡`;
        break;
      case 'plan_xinwen': {  // 新闻传播学院：完整经过乐在南哪线且无探索值和GPA扣减
        if (history) {
          const exploreExits = history.lineExits.filter(e => e.lineId === 'explore');
          for (const exit of exploreExits) {
            if (exit.gpaAfter >= exit.gpaBefore && exit.explorationAfter >= exit.explorationBefore) {
              return '完整经过乐在南哪线且无GPA和探索值扣减';
            }
          }
        }
        break;
      }
      case 'plan_zhengguan': {  // 政府管理学院：探索值达到20且场上金钱差不超过500
        if (player.exploration < 20) break;
        const activePlayers = state.players.filter(p => !p.isBankrupt);
        if (activePlayers.length < 2) break;
        const monies = activePlayers.map(p => p.money);
        const maxMoney = Math.max(...monies);
        const minMoney = Math.min(...monies);
        if (maxMoney - minMoney <= 666) return `探索值≥20且金钱差≤666 (max=${maxMoney}, min=${minMoney})`;
        break;
      }
      case 'plan_guoji': {   // 国际关系学院：和至少两名其他玩家互相使用过机会卡
        const usedOnCount = Object.keys(player.chanceCardsUsedOnPlayers).filter(pid => {
          const other = state.players.find(p => p.id === pid);
          return other && other.chanceCardsUsedOnPlayers[player.id] > 0;
        }).length;
        if (usedOnCount >= 2) return `与${usedOnCount}名玩家互相使用过机会卡`;
        break;
      }
      case 'plan_xinxiguanli':  // 信息管理学院：抽到过4个不重复的数字开头卡
        if (player.cardsDrawnWithDigitStart.length >= 4) {
          return `抽到${player.cardsDrawnWithDigitStart.length}张数字开头卡`;
        }
        break;
      case 'plan_shehuixue': {  // 社会学院：自身探索值≥15且比最低玩家高20（或经修改后高15）
        const threshold = player.modifiedWinThresholds['plan_shehuixue'] ?? 20;
        if (player.exploration < 15) break;
        const minExp = Math.min(...state.players.filter(p => !p.isBankrupt).map(p => p.exploration));
        if (player.exploration >= minExp + threshold) {
          return `探索值≥15且比最低玩家高${threshold} (${player.exploration} vs ${minExp})`;
        }
        break;
      }
      case 'plan_shuxue':   // 数学系：第二次到达鼓楼校区线终点
        if (player.gulou_endpoint_count >= 2) return `第${player.gulou_endpoint_count}次到达鼓楼线终点`;
        break;
      case 'plan_wuli': {   // 物理学院：任选两项指标之和>=85
        const moneyScore = player.money / 100;
        const gpaScore = player.gpa * 10;
        const expScore = player.exploration;
        if (gpaScore + expScore >= 85 || gpaScore + moneyScore >= 85 || expScore + moneyScore >= 85) {
          return `任意两项指标之和≥85 (GPA×10=${gpaScore.toFixed(0)}, 探索=${expScore}, 金钱/100=${moneyScore.toFixed(0)})`;
        }
        break;
      }
      case 'plan_tianwen': { // 天文与空间科学学院：和每位其他玩家同格停留次数均>=2
        if (history) {
          const otherIds = state.players.filter(p => p.id !== player.id && !p.isBankrupt).map(p => p.id);
          const allSharedTwice = otherIds.length > 0 && otherIds.every(pid =>
            (history.sharedCellsWith[pid]?.length ?? 0) >= 2
          );
          if (allSharedTwice) return '与每位其他玩家同格停留≥2次';
        }
        break;
      }
      case 'plan_rengong': { // 人工智能学院：GPA比最低玩家高2.0（或修改后1.5）
        const threshold = player.modifiedWinThresholds['plan_rengong'] ?? 2.0;
        const minGpa = Math.min(...state.players.filter(p => !p.isBankrupt).map(p => p.gpa));
        if (player.gpa >= minGpa + threshold) {
          return `GPA比最低玩家高${threshold} (${player.gpa.toFixed(1)} vs ${minGpa.toFixed(1)})`;
        }
        break;
      }
      case 'plan_jisuanji': { // 计算机科学与技术系：探索值和金钱数字均只包含0或1
        const moneyStr = String(Math.abs(player.money));
        const expStr = String(player.exploration);
        const onlyBinary = (s: string) => /^[01]+$/.test(s);
        if (onlyBinary(moneyStr) && onlyBinary(expStr)) {
          return `探索值(${expStr})和金钱(${moneyStr})均只含0和1`;
        }
        break;
      }
      case 'plan_ruanjian':  // 软件学院：到达交学费格支出3200金钱（需在event_tuition时特殊处理，此处仅检查标记）
        // 此胜利条件在交学费事件中触发检查
        break;
      case 'plan_dianzi':   // 电子科学与工程学院：科创赛事投到6（在kechuang_join中标记）
        // 此胜利条件在科创赛事handler中触发标记
        break;
      case 'plan_xiandai': { // 现代工程与应用科学学院：进入过除苏州校区外所有线
        const requiredLines = ['pukou', 'study', 'money', 'explore', 'gulou', 'xianlin', 'food'];
        const allVisited = requiredLines.every(l => player.linesVisited.includes(l));
        if (allVisited) return '进入过除苏州外所有线路';
        break;
      }
      case 'plan_huanjing': { // 环境学院：经历过仙林校区线至少5个不同事件
        const xianlinEvents = player.lineEventsTriggered['xianlin'] || [];
        if (xianlinEvents.length >= 5) return `经历过仙林线${xianlinEvents.length}个不同事件`;
        break;
      }
      case 'plan_diqiu': {   // 地球科学与工程学院：进入过每一条线
        const allLines = ['pukou', 'study', 'money', 'suzhou', 'explore', 'gulou', 'xianlin', 'food'];
        const allVisited = allLines.every(l => player.linesVisited.includes(l));
        if (allVisited) return '进入过全部8条线路';
        break;
      }
      case 'plan_dili': {    // 地理与海洋科学学院：执行过四个校区线的终点效果
        const campusLines = ['pukou', 'suzhou', 'gulou', 'xianlin'];
        const campusExits = history?.lineExits.filter(e => campusLines.includes(e.lineId)) || [];
        const completedCampus = new Set(campusExits.map(e => e.lineId));
        if (completedCampus.size >= 4) return '执行过四个校区线终点效果';
        break;
      }
      case 'plan_daqi': {    // 大气科学学院：18回合内金钱始终不为唯一最多
        if (history && state.turnNumber >= 18) {
          const moneyHist = history.moneyHistory;
          if (moneyHist.length >= 18) {
            let neverRichest = true;
            // 简化检查：当前金钱不是唯一最高
            const maxMoney = Math.max(...state.players.filter(p => !p.isBankrupt).map(p => p.money));
            const playersWithMax = state.players.filter(p => !p.isBankrupt && p.money === maxMoney);
            if (player.money === maxMoney && playersWithMax.length === 1) {
              neverRichest = false;
            }
            if (neverRichest) return '18回合内金钱始终不为唯一最多';
          }
        }
        break;
      }
      case 'plan_shengming':  // 生命科学学院：食堂线连续三次无负面效果
        if (player.cafeteriaNoNegativeStreak >= 3) {
          return `食堂线连续${player.cafeteriaNoNegativeStreak}次无负面效果`;
        }
        break;
      case 'plan_yixue':     // 医学院：进入过三次医院
        if (player.hospitalVisits >= 3) return `进入${player.hospitalVisits}次医院`;
        break;
      case 'plan_gongguan':  // 工程管理学院：金钱在0-200且未破产
        if (player.money >= 0 && player.money <= 200 && !player.isBankrupt) return `金钱${player.money}在0-200范围内且未破产`;
        break;
      case 'plan_kuangyaming': { // 匡亚明学院：满足≥2个不同玩家的培养计划条件
        let matchedCount = 0;
        const matchedNames: string[] = [];
        for (const other of state.players) {
          if (other.id === player.id) continue;
          for (const otherPlanId of getPlayerPlanIds(other)) {
            if (otherPlanId === 'plan_kuangyaming' || otherPlanId === 'plan_haiwai') continue;
            const result = this.checkPlanWinCondition(player, otherPlanId, state);
            if (result) {
              matchedCount++;
              matchedNames.push(other.name);
              break;
            }
          }
        }
        if (matchedCount >= 2) return `满足${matchedCount}个玩家(${matchedNames.join('、')})的计划条件`;
        break;
      }
      case 'plan_haiwai':    // 海外教育学院：有玩家获胜时，若你对其使用过至少两次机会卡
        // 此条件在胜利判定时特殊处理（检查winner时对比）
        break;
      case 'plan_jianzhu': { // 建筑与城市规划学院：经历过起点、校医院、鼎、候车厅和闯门中任意4个
        if (history) {
          const visited = history.mainCellVisited;
          const requiredIndices = [0, 7, 14, 21]; // 起点、校医院、鼎、候车厅
          const visitedIndices = new Set(visited);
          let count = 0;
          for (const i of requiredIndices) {
            if (visitedIndices.has(`main_${i}`)) count++;
          }
          if (visited.some(v => v.includes('chuang_men'))) count++;
          if (count >= 4) return `经历过5个标志格中的${count}个`;
        }
        break;
      }
      case 'plan_yishu': {   // 艺术学院：经历过浦口线每个事件
        const pukouEvents = player.lineEventsTriggered['pukou'] || [];
        // 浦口线有12个事件格(index 0-11)
        if (pukouEvents.length >= 12) return '经历过浦口线每个事件';
        break;
      }
      case 'plan_suzhou': {  // 苏州校区：经历过苏州校区的每个事件
        const suzhouEvents = player.lineEventsTriggered['suzhou'] || [];
        // 苏州线有10个事件格(index 0-9)
        if (suzhouEvents.length >= 10) return '经历过苏州线每个事件';
        break;
      }
      default:
        break;
    }
    return null;
  }

  /**
   * Start a penalty chain for the 出行方式 majority side.
   * Players choose their penalty one at a time.
   */
  private startTravelPenaltyChain(playerIds: string[], side: 'shared' | 'walk'): void {
    if (playerIds.length === 0) return;

    const [currentId, ...remaining] = playerIds;
    const player = this.engine.getPlayer(currentId);
    if (!player) {
      this.startTravelPenaltyChain(remaining, side);
      return;
    }

    const penaltyOptions = side === 'shared'
      ? [
          { label: '金钱 -100', value: 'money_loss' },
          { label: '暂停一回合', value: 'skip_turn' },
        ]
      : [
          { label: '探索值 -1', value: 'exp_loss' },
          { label: '暂停一回合', value: 'skip_turn' },
        ];

    // Store remaining players in a temp effect on current player
    if (remaining.length > 0) {
      player.effects.push({
        id: `travel_penalty_queue_${Date.now()}`,
        type: 'custom' as const,
        turnsRemaining: 1,
        data: { travelPenaltyQueue: remaining, travelPenaltySide: side },
      });
    }

    const state = this.engine.getState();
    state.pendingAction = {
      id: `travel_penalty_${Date.now()}`,
      playerId: currentId,
      type: 'choose_option',
      prompt: `出行方式：${player.name}，选择你的惩罚`,
      options: penaltyOptions,
      callbackHandler: 'travel_penalty_callback',
      timeoutMs: 30000,
    };
  }

  /**
   * Resolve multi-vote card effects based on card type and player votes.
   */
  private resolveMultiVoteCard(
    cardId: string,
    groups: Record<string, string[]>,
    counts: Record<string, number>,
  ): void {
    this.engine.setResourceSource(`card-cb:${cardId}`);
    switch (cardId) {
      case 'chance_light_shadow': {
        // 光影变幻 — majority decides
        const lizhaohu = counts['lizhaohu'] || 0;
        const caigentan = counts['caigentan'] || 0;
        if (lizhaohu > caigentan) {
          this.engine.getAllPlayers().forEach(p => this.engine.modifyPlayerMoney(p.id, 200));
          this.addLog('system', '光影变幻：日照金波，所有玩家金钱+200');
        } else if (caigentan > lizhaohu) {
          this.engine.getAllPlayers().forEach(p => this.engine.modifyPlayerExploration(p.id, 2));
          this.addLog('system', '光影变幻：漆新牛塑，所有玩家探索值+2');
        } else {
          this.engine.getAllPlayers().forEach(p => this.engine.modifyPlayerGpa(p.id, 0.2));
          this.addLog('system', '光影变幻：蒸蒸日上，所有玩家GPA+0.2');
        }
        break;
      }
      case 'chance_course_group': {
        // 课程建群 — majority decides
        const qq = counts['qq'] || 0;
        const wechat = counts['wechat'] || 0;
        if (qq > wechat) {
          this.engine.getAllPlayers().forEach(p => this.engine.modifyPlayerGpa(p.id, 0.2));
          this.addLog('system', '课程建群：文件管理，所有玩家GPA+0.2');
        } else if (wechat > qq) {
          this.engine.getAllPlayers().forEach(p => this.engine.modifyPlayerExploration(p.id, 2));
          this.addLog('system', '课程建群：面对面建群，所有玩家探索值+2');
        } else {
          this.engine.getAllPlayers().forEach(p => {
            this.engine.modifyPlayerGpa(p.id, 0.1);
            this.engine.modifyPlayerExploration(p.id, 1);
          });
          this.addLog('system', '课程建群：平分秋色，所有玩家GPA+0.1, 探索值+1');
        }
        break;
      }
      case 'chance_transfer_moment': {
        // 换乘时刻 — vote + dice
        const dice = this.rollAndBroadcast(1);
        const isOdd = dice % 2 === 1;
        if (isOdd) {
          for (const pid of groups['xinjiekou'] || []) this.engine.modifyPlayerExploration(pid, -1);
          for (const pid of groups['jinmalu'] || []) this.engine.modifyPlayerExploration(pid, 1);
          this.addLog('system', `换乘时刻(${dice}奇数)：人满为患，新街口探索-1，金马路探索+1`);
        } else {
          for (const pid of groups['xinjiekou'] || []) this.engine.modifyPlayerMoney(pid, 100);
          for (const pid of groups['jinmalu'] || []) this.engine.modifyPlayerMoney(pid, -100);
          this.addLog('system', `换乘时刻(${dice}偶数)：仙林湖不是家，新街口金钱+100，金马路金钱-100`);
        }
        break;
      }
      case 'chance_wit_words': {
        // 妙语连珠 — vote + dice
        const dice = this.rollAndBroadcast(1);
        const isOdd = dice % 2 === 1;
        if (isOdd) {
          for (const pid of groups['debate'] || []) this.engine.modifyPlayerExploration(pid, 2);
          this.addLog('system', `妙语连珠(${dice}奇数)：唇枪舌剑，选辩论赛的探索值+2`);
        } else {
          for (const pid of groups['speaker'] || []) {
            this.engine.modifyPlayerExploration(pid, 1);
            this.engine.modifyPlayerMoney(pid, 100);
          }
          this.addLog('system', `妙语连珠(${dice}偶数)：滔滔不绝，选演说家的探索值+1,金钱+100`);
        }
        break;
      }
      case 'chance_school_sports_meet': {
        // 校运动会 — vote + dice
        const dice = this.rollAndBroadcast(1);
        const isOdd = dice % 2 === 1;
        if (isOdd) {
          for (const pid of groups['exercise'] || []) {
            this.engine.modifyPlayerExploration(pid, 3);
            this.engine.modifyPlayerGpa(pid, -0.1);
          }
          this.addLog('system', `校运动会(${dice}奇数)：七彩阳光，选广播操的探索+3,GPA-0.1`);
        } else {
          for (const pid of groups['entrance'] || []) {
            this.engine.modifyPlayerExploration(pid, 3);
            this.engine.modifyPlayerMoney(pid, -100);
          }
          this.addLog('system', `校运动会(${dice}偶数)：才思泉涌，选入场式的探索+3,金钱-100`);
        }
        break;
      }
      case 'chance_travel_method': {
        // 出行方式 — majority decides, minority benefits, majority chooses penalty
        const shared = counts['shared'] || 0;
        const walk = counts['walk'] || 0;
        if (shared > walk) {
          // 共享出行人多 → 丈量校园玩家探索+2, 共享出行玩家选惩罚
          for (const pid of groups['walk'] || []) this.engine.modifyPlayerExploration(pid, 2);
          this.addLog('system', `共享出行(${shared})人多，丈量校园玩家探索+2`);
          this.startTravelPenaltyChain(groups['shared'] || [], 'shared');
        } else if (walk > shared) {
          // 丈量校园人多 → 共享出行玩家GPA+0.2, 丈量校园玩家选惩罚
          for (const pid of groups['shared'] || []) this.engine.modifyPlayerGpa(pid, 0.2);
          this.addLog('system', `丈量校园(${walk})人多，共享出行玩家GPA+0.2`);
          this.startTravelPenaltyChain(groups['walk'] || [], 'walk');
        } else {
          // 相等 → 所有人GPA+0.1，探索+1
          for (const pid of [...(groups['shared'] || []), ...(groups['walk'] || [])]) {
            this.engine.modifyPlayerGpa(pid, 0.1);
            this.engine.modifyPlayerExploration(pid, 1);
          }
          this.addLog('system', '出行方式：井然有序，所有玩家GPA+0.1，探索+1');
        }
        break;
      }
      case 'destiny_four_schools': {
        // 四校联动 — 奇数：选人数>1的校区玩家各探索+2，偶数：选人数=1的校区玩家各探索+2
        const dice = this.rollAndBroadcast(1);
        const isOdd = dice % 2 === 1;
        for (const [campus, pids] of Object.entries(groups)) {
          const qualifies = isOdd ? pids.length > 1 : pids.length === 1;
          if (qualifies) {
            for (const pid of pids) this.engine.modifyPlayerExploration(pid, 2);
          }
        }
        this.addLog('system', `四校联动(${dice}${isOdd ? '奇' : '偶'})：${isOdd ? '人数>1' : '人数=1'}的校区玩家探索+2`);
        break;
      }
      case 'chance_swimming_pool_regular': {
        // 泳馆常客 — 骰子奇偶决定效果
        const dice = this.rollAndBroadcast(1);
        if (dice % 2 === 1) {
          // 闭馆不赔：年卡金钱-300，按次金钱+100
          for (const pid of groups['annual'] || []) this.engine.modifyPlayerMoney(pid, -300);
          for (const pid of groups['per_use'] || []) this.engine.modifyPlayerMoney(pid, 100);
          this.addLog('system', `泳馆常客(${dice}奇)：闭馆不赔，年卡金钱-300，按次金钱+100`);
        } else {
          // 酷暑难耐：年卡探索+5，按次探索-1,GPA-0.1
          for (const pid of groups['annual'] || []) this.engine.modifyPlayerExploration(pid, 5);
          for (const pid of groups['per_use'] || []) {
            this.engine.modifyPlayerExploration(pid, -1);
            this.engine.modifyPlayerGpa(pid, -0.1);
          }
          this.addLog('system', `泳馆常客(${dice}偶)：酷暑难耐，年卡探索+5，按次探索-1,GPA-0.1`);
        }
        break;
      }
      case 'chance_meeting_is_fate': {
        // 相逢是缘 — 骰子奇偶决定效果
        const dice = this.rollAndBroadcast(1);
        if (dice % 2 === 1) {
          // 纸条传情：图书馆GPA+0.2,金钱-100
          for (const pid of groups['library'] || []) {
            this.engine.modifyPlayerGpa(pid, 0.2);
            this.engine.modifyPlayerMoney(pid, -100);
          }
          this.addLog('system', `相逢是缘(${dice}奇)：纸条传情，图书馆GPA+0.2,金钱-100`);
        } else {
          // 热血青春：运动场探索+2,金钱-100
          for (const pid of groups['sports'] || []) {
            this.engine.modifyPlayerExploration(pid, 2);
            this.engine.modifyPlayerMoney(pid, -100);
          }
          this.addLog('system', `相逢是缘(${dice}偶)：热血青春，运动场探索+2,金钱-100`);
        }
        break;
      }
      case 'chance_first_snow': {
        // 初雪留痕 — 初雪告白人数决定效果
        const confessionCount = (groups['confession'] || []).length;
        if (confessionCount === 0) {
          // 全选大雪无声：所有玩家GPA+0.1
          this.engine.getAllPlayers().filter(p => !p.isBankrupt).forEach(p => this.engine.modifyPlayerGpa(p.id, 0.1));
          this.addLog('system', '初雪留痕：风声雪声读书声，所有玩家GPA+0.1');
        } else if (confessionCount % 2 === 1) {
          // 奇数：初雪告白者探索-2
          for (const pid of groups['confession'] || []) this.engine.modifyPlayerExploration(pid, -2);
          this.addLog('system', '初雪留痕：错综复杂，初雪告白者探索值-2');
        } else {
          // 偶数且不为0：初雪告白者探索+3
          for (const pid of groups['confession'] || []) this.engine.modifyPlayerExploration(pid, 3);
          this.addLog('system', '初雪留痕：圆满顺遂，初雪告白者探索值+3');
        }
        break;
      }
      case 'chance_strange_tales': {
        // 怪奇物谈 — 骰子奇偶
        const dice = this.rollAndBroadcast(1);
        if (dice % 2 === 1) {
          for (const pid of groups['ding'] || []) this.engine.modifyPlayerExploration(pid, 2);
          this.addLog('system', `怪奇物谈(${dice}奇)：理论专家，选鼎里的探索值+2`);
        } else {
          for (const pid of groups['tianwenshan'] || []) this.engine.modifyPlayerGpa(pid, 0.2);
          this.addLog('system', `怪奇物谈(${dice}偶)：流星许愿，选天文山的GPA+0.2`);
        }
        break;
      }
      case 'chance_delivery_theft': {
        // 外卖贼盗 — 骰子vs选监控报警人数
        const reportCount = (groups['report'] || []).length;
        const dice = this.rollAndBroadcast(1);
        // Find the card drawer (the player who started the action)
        const allPlayerIds = [...(groups['report'] || []), ...(groups['silent'] || [])];
        // The drawer is the one NOT in allPlayerIds (since only others voted)
        const drawerId = this.engine.getAllPlayers().find(p => !p.isBankrupt && !allPlayerIds.includes(p.id))?.id;
        if (dice > reportCount) {
          // 劳神费力
          for (const pid of groups['report'] || []) this.engine.skipPlayerTurn(pid, 1);
          if (drawerId) {
            this.engine.skipPlayerTurn(drawerId, 1);
            this.engine.modifyPlayerMoney(drawerId, -100);
          }
          this.addLog('system', `外卖贼盗(${dice}>${reportCount})：劳神费力，监控报警者和抽卡者暂停一回合`);
        } else {
          // 群策群力
          for (const pid of groups['report'] || []) this.engine.modifyPlayerExploration(pid, 3);
          if (drawerId) this.engine.modifyPlayerExploration(drawerId, 4);
          this.addLog('system', `外卖贼盗(${dice}<=${reportCount})：群策群力，监控报警者探索+3，抽卡者探索+4`);
        }
        break;
      }
      case 'chance_root_finding_moment': {
        // 寻根时刻 — 骰子奇偶
        const dice = this.rollAndBroadcast(1);
        if (dice % 2 === 1) {
          // 工期紧张：装潢暂停一回合，历史古迹金钱+200
          for (const pid of groups['renovate'] || []) this.engine.skipPlayerTurn(pid, 1);
          for (const pid of groups['historic'] || []) this.engine.modifyPlayerMoney(pid, 200);
          this.addLog('system', `寻根时刻(${dice}奇)：装潢暂停一回合，历史古迹金钱+200`);
        } else {
          // 形象实际：装潢探索+1,GPA+0.1，历史古迹探索-1
          for (const pid of groups['renovate'] || []) {
            this.engine.modifyPlayerExploration(pid, 1);
            this.engine.modifyPlayerGpa(pid, 0.1);
          }
          for (const pid of groups['historic'] || []) this.engine.modifyPlayerExploration(pid, -1);
          this.addLog('system', `寻根时刻(${dice}偶)：装潢探索+1,GPA+0.1，历史古迹探索-1`);
        }
        break;
      }
      case 'chance_rest_moment': {
        // 休憩时刻 — 多数决
        const daqishan = counts['daqishan'] || 0;
        const yangshanhu = counts['yangshanhu'] || 0;
        const allPlayers = this.engine.getAllPlayers().filter(p => !p.isBankrupt);
        if (daqishan > yangshanhu) {
          allPlayers.forEach(p => {
            this.engine.modifyPlayerMoney(p.id, 100);
            this.engine.modifyPlayerExploration(p.id, 1);
          });
          this.addLog('system', '休憩时刻：免费赏花，所有玩家金钱+100,探索+1');
        } else if (yangshanhu > daqishan) {
          allPlayers.forEach(p => {
            this.engine.modifyPlayerMoney(p.id, -100);
            this.engine.modifyPlayerExploration(p.id, 3);
          });
          this.addLog('system', '休憩时刻：野餐时刻，所有玩家金钱-100,探索+3');
        } else {
          allPlayers.forEach(p => this.engine.modifyPlayerGpa(p.id, 0.2));
          this.addLog('system', '休憩时刻：鸽以卷积，所有玩家GPA+0.2');
        }
        break;
      }
      default: {
        // Unhandled card type — log a warning so we can catch missing implementations
        console.warn(`[GameCoordinator] resolveMultiVoteCard: unhandled cardId="${cardId}"`);
        this.addLog('system', `投票完成 (${cardId})`);
        break;
      }
    }
    this.engine.clearResourceSource();
  }

  /**
   * Check win condition and emit player-won if someone won. Returns true if game ended.
   */
  private checkAndEmitWin(): boolean {
    const state = this.engine.getState();
    const { winnerId, condition } = this.checkWinCondition();
    if (winnerId) {
      let finalWinnerId = winnerId;
      let finalCondition = condition;

      // 海外教育学院拦截：对获胜者使用过≥2次机会卡的玩家优先获胜
      for (const p of state.players) {
        if (p.id === winnerId || p.isBankrupt || p.isDisconnected) continue;
        if (p.majorPlan !== 'plan_haiwai' && !p.minorPlans.includes('plan_haiwai')) continue;
        const disabled = p.disabledWinConditions ?? [];
        if (disabled.includes('plan_haiwai')) continue;
        const usedCount = p.chanceCardsUsedOnPlayers[winnerId] ?? 0;
        if (usedCount >= 2) {
          finalWinnerId = p.id;
          finalCondition = `海外教育学院：对获胜者使用过${usedCount}次机会卡，优先获胜`;
          this.addLog(p.id, finalCondition);
          break;
        }
      }

      // 补天计划拦截：持有者获得最后一次行动机会
      // TODO: 补天计划需要完整的"最后一次行动"机制（掷骰+移动+事件）
      // 当前简化实现：如果持有者已满足任意胜利条件，则其优先获胜
      for (const p of state.players) {
        if (p.id === finalWinnerId || p.isBankrupt || p.isDisconnected) continue;
        const mendingIdx = p.effects.findIndex(e => e.type === 'custom' && e.data?.mendingPlan);
        if (mendingIdx >= 0) {
          // 消耗补天计划效果
          p.effects.splice(mendingIdx, 1);
          // 检查持有者是否也满足胜利条件
          const pDisabled = p.disabledWinConditions ?? [];
          if (!pDisabled.includes('base')) {
            const score = p.gpa * 10 + p.exploration;
            if (score >= BASE_WIN_THRESHOLD) {
              finalWinnerId = p.id;
              finalCondition = `补天计划：在${condition}之际，以GPA×10+探索值=${score.toFixed(1)}优先获胜`;
              this.addLog(p.id, finalCondition);
              break;
            }
          }
          for (const planId of getPlayerPlanIds(p)) {
            if (pDisabled.includes(planId)) continue;
            const planCond = this.checkPlanWinCondition(p, planId, state);
            if (planCond) {
              const plan = p.trainingPlans.find(tp => tp.id === planId);
              finalWinnerId = p.id;
              finalCondition = `补天计划：在${condition}之际，以${plan?.name || planId}条件优先获胜`;
              this.addLog(p.id, finalCondition);
              break;
            }
          }
          if (finalWinnerId !== winnerId) break;
          this.addLog(p.id, '补天计划发动但未能满足任何胜利条件');
        }
      }

      const winner = state.players.find(p => p.id === finalWinnerId);
      state.winner = finalWinnerId;
      state.phase = 'finished';
      this.logger.log({ turn: state.turnNumber, playerId: finalWinnerId, type: 'phase_change', message: `Game won: ${finalCondition}`, data: { winnerId: finalWinnerId, condition: finalCondition } });
      this.saveGameSummary();
      this.logger.persist().catch(err => console.error('Failed to persist game log:', err));
      this.io.to(this.roomId).emit('game:player-won', {
        playerId: finalWinnerId,
        playerName: winner?.name || 'Unknown',
        condition: finalCondition || 'Unknown condition',
      });
      this.onFinishedCallback?.();
      this.broadcastState();
      return true;
    }
    return false;
  }

  // --------------------------------------------------
  // Force End Game (学年结束结算)
  // --------------------------------------------------

  /** Force end the game via the engine, emit win event. */
  private forceEndGame(): void {
    const state = this.engine.getState();
    this.engine.forceEndGame();

    const winnerId = state.winner;
    const winner = state.players.find(p => p.id === winnerId);
    if (winnerId && winner) {
      this.logger.log({ turn: state.turnNumber, playerId: winnerId, type: 'phase_change', message: `Game force-ended: 毕业结算`, data: { winnerId, condition: '毕业结算' } });
      this.saveGameSummary();
      this.logger.persist().catch(err => console.error('Failed to persist game log:', err));
      this.io.to(this.roomId).emit('game:player-won', {
        playerId: winnerId,
        playerName: winner.name,
        condition: '毕业结算',
      });
    }
    this.onFinishedCallback?.();
    this.broadcastState();
  }

  // --------------------------------------------------
  // Plan Selection Chain (升学阶段 — 年度培养计划选择，大二起)
  // --------------------------------------------------

  /** IDs of plans drawn in the current redraw phase, per player */
  private redrawDrawnPlanIds: Map<string, string[]> = new Map();

  /** 当轮升学阶段所有已被抽取的计划ID（保证全场不重复） */
  private yearlyDrawnPlanIds: Set<string> = new Set();

  /**
   * 为玩家抽取3张培养计划，保证：
   * 1. 不与玩家已加入列表的计划重复
   * 2. 不与当轮其他玩家已抽取的计划重复
   */
  private drawPlansForPlayer(player: Player): TrainingPlan[] {
    const state = this.engine.getState();
    const existingIds = new Set([
      ...getPlayerPlanIds(player),
      ...this.yearlyDrawnPlanIds,
    ]);

    const drawn: TrainingPlan[] = [];
    const deck = state.cardDecks.training;

    for (let i = 0; i < INITIAL_TRAINING_DRAW && deck.length > 0; i++) {
      // 从牌堆中找一张不重复的
      let found = false;
      for (let j = 0; j < deck.length; j++) {
        if (!existingIds.has(deck[j].id)) {
          const [plan] = deck.splice(j, 1);
          drawn.push(plan);
          this.yearlyDrawnPlanIds.add(plan.id);
          existingIds.add(plan.id);
          found = true;
          break;
        }
      }
      if (!found) break; // 没有可用的计划了
    }

    return drawn;
  }

  /**
   * 大二起：每年开始时的培养计划选择流程
   * 每个玩家顺序执行：抽3张 → 根据状态决定流程
   */
  private startPlanSelectionForPlayer(eligiblePlayers: Player[], playerIdx: number): void {
    const state = this.engine.getState();
    console.log(`[PlanSelection] startPlanSelectionForPlayer: playerIdx=${playerIdx}, total=${eligiblePlayers.length}`);

    if (playerIdx >= eligiblePlayers.length) {
      // 所有玩家完成 → 将未选择的计划放回牌堆
      this.returnUnselectedPlans();
      // 恢复正常游戏流程
      const currentPlayer = state.players[state.currentPlayerIndex];
      console.log(`[PlanSelection] All players done, setting roll_dice for ${currentPlayer.name}`);
      state.pendingAction = {
        id: `roll_dice_${Date.now()}`,
        playerId: currentPlayer.id,
        type: 'roll_dice',
        prompt: '请投骰子',
        timeoutMs: 60000,
      };
      this.broadcastState();
      return;
    }

    const player = eligiblePlayers[playerIdx];
    const drawnPlans = this.drawPlansForPlayer(player);

    if (drawnPlans.length === 0) {
      this.addLog(player.id, `${player.name} 升学阶段：牌堆已空，跳过`);
      this.startPlanSelectionForPlayer(eligiblePlayers, playerIdx + 1);
      return;
    }

    // 临时存储抽到的计划
    this.redrawDrawnPlanIds.set(player.id, drawnPlans.map(p => p.id));
    // 将抽到的计划暂存到玩家的 trainingPlans 中（方便UI展示）
    const tempPlanIds = drawnPlans.map(p => p.id);
    for (const plan of drawnPlans) {
      if (!player.trainingPlans.find(p => p.id === plan.id)) {
        player.trainingPlans.push(plan);
      }
    }

    const hasPlan = player.majorPlan !== null;
    const ctx = { eligiblePlayers, playerIdx, drawnPlanIds: tempPlanIds };
    console.log(`[PlanSelection] Player ${player.name} (idx=${playerIdx}): hasPlan=${hasPlan}, drawnPlans=${drawnPlans.length}`);

    if (!hasPlan) {
      // 无培养计划：必须选1-2项加入
      this.showPlanSelection(player, drawnPlans, ctx, 1, Math.min(2, player.planSlotLimit));
    } else {
      // 有培养计划：先选择「不调整」或「调整」
      state.pendingAction = {
        id: `plan_adjust_${Date.now()}`,
        playerId: player.id,
        type: 'choose_option',
        prompt: `升学阶段：${player.name}，你已有培养计划（主修: ${player.trainingPlans.find(p => p.id === player.majorPlan)?.name || '无'}），是否调整？`,
        options: [
          { label: '不调整', value: 'keep', description: '保留当前主修和辅修方向' },
          { label: '调整培养计划', value: 'adjust', description: `从新抽到的${drawnPlans.length}张计划中选择加入` },
        ],
        callbackHandler: `plan_adjust_choice_${player.id}_${Date.now()}`,
        timeoutMs: 60000,
      };

      const adjustHandlerId = state.pendingAction.callbackHandler!;
      this.engine.getEventHandler().registerHandler(adjustHandlerId, (_eng, pid, choice) => {
        if (choice === 'keep' || !choice) {
          // 不调整，放回抽到的计划
          this.discardTempDrawnPlans(pid, ctx.drawnPlanIds);
          this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
        } else {
          // 调整
          const p = this.engine.getPlayer(pid);
          if (p) {
            this.showPlanSelection(p, drawnPlans, ctx, 1, Math.min(2, p.planSlotLimit));
          }
        }
        return null;
      });

      this.broadcastState();
    }
  }

  /**
   * 展示计划选择界面（选择1-N项加入培养列表）
   */
  private showPlanSelection(
    player: Player,
    drawnPlans: TrainingPlan[],
    ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
    minSelect: number,
    maxSelect: number,
  ): void {
    const state = this.engine.getState();
    const options = drawnPlans.map(p => ({
      label: p.name,
      value: p.id,
      description: `胜利条件: ${p.winCondition}${p.passiveAbility ? '\n被动能力: ' + p.passiveAbility : ''}`,
    }));

    state.pendingAction = {
      id: `plan_select_${Date.now()}`,
      playerId: player.id,
      type: 'choose_option',
      prompt: `升学阶段：${player.name}，选择${minSelect}-${maxSelect}项培养计划加入`,
      options,
      maxSelections: maxSelect,
      minSelections: minSelect,
      callbackHandler: `plan_select_handler_${player.id}_${Date.now()}`,
      timeoutMs: 60000,
    };

    const selectHandlerId = state.pendingAction.callbackHandler!;
    this.engine.getEventHandler().registerHandler(selectHandlerId, (_eng, pid, choice) => {
      this.handlePlanSelectionResponse(pid, choice, ctx);
      return null;
    });

    this.broadcastState();
  }

  /**
   * 处理玩家的计划选择响应
   */
  private handlePlanSelectionResponse(
    playerId: string,
    choice: string | undefined,
    ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
  ): void {
    const selectedIds = (!choice || choice === 'skip') ? [] : choice.split(',');
    const player = this.engine.getPlayer(playerId);
    if (!player) {
      this.discardTempDrawnPlans(playerId, ctx.drawnPlanIds);
      this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
      return;
    }

    if (selectedIds.length === 0) {
      this.discardTempDrawnPlans(playerId, ctx.drawnPlanIds);
      this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
      return;
    }

    // 将选中的计划加入培养列表
    // 先处理溢出：如果加入后超过 planSlotLimit
    const existingPlanIds = getPlayerPlanIds(player);
    const allPlanIds = [...new Set([...existingPlanIds, ...selectedIds])];

    if (allPlanIds.length > player.planSlotLimit) {
      // 需要选择保留哪些
      this.showPlanOverflowSelection(player, allPlanIds, ctx);
    } else {
      // 不超出，直接进入主修设置
      this.showMajorSelection(player, allPlanIds, ctx);
    }
  }

  /**
   * 溢出选择：让玩家选择保留哪些计划
   */
  private showPlanOverflowSelection(
    player: Player,
    allPlanIds: string[],
    ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
  ): void {
    const state = this.engine.getState();
    const options = allPlanIds.map(id => {
      const plan = player.trainingPlans.find(p => p.id === id);
      return {
        label: plan?.name || id,
        value: id,
        description: plan ? `胜利条件: ${plan.winCondition}` : undefined,
      };
    });

    state.pendingAction = {
      id: `plan_overflow_${Date.now()}`,
      playerId: player.id,
      type: 'choose_option',
      prompt: `你有${allPlanIds.length}个计划（上限${player.planSlotLimit}），选择要保留的（1-${player.planSlotLimit}个）：`,
      options,
      maxSelections: player.planSlotLimit,
      minSelections: 1,
      callbackHandler: `plan_overflow_handler_${player.id}_${Date.now()}`,
      timeoutMs: 60000,
    };

    const overflowHandlerId = state.pendingAction.callbackHandler!;
    this.engine.getEventHandler().registerHandler(overflowHandlerId, (_eng, pid, choice) => {
      const keepIds = (!choice || choice === 'skip') ? [] : choice.split(',');
      const p = this.engine.getPlayer(pid);
      if (p && keepIds.length > 0) {
        this.showMajorSelection(p, keepIds, ctx);
      } else {
        this.discardTempDrawnPlans(pid, ctx.drawnPlanIds);
        this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
      }
      return null;
    });

    this.broadcastState();
  }

  /**
   * 让玩家从保留的计划中选择主修方向
   */
  private showMajorSelection(
    player: Player,
    keepPlanIds: string[],
    ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
  ): void {
    const state = this.engine.getState();
    const oldMajor = player.majorPlan;

    if (keepPlanIds.length === 1) {
      // 只有一个计划，自动设为主修
      this.finalizePlanSelection(player, keepPlanIds[0], [], oldMajor, ctx);
      return;
    }

    const options = keepPlanIds.map(id => {
      const plan = player.trainingPlans.find(p => p.id === id);
      return {
        label: plan?.name || id,
        value: id,
        description: plan?.passiveAbility ? `被动能力: ${plan.passiveAbility}` : '无被动能力',
      };
    });

    state.pendingAction = {
      id: `plan_major_${Date.now()}`,
      playerId: player.id,
      type: 'choose_option',
      prompt: `选择你的主修方向（只有主修的被动效果生效）：`,
      options,
      maxSelections: 1,
      minSelections: 1,
      callbackHandler: `plan_major_handler_${player.id}_${Date.now()}`,
      timeoutMs: 60000,
    };

    const majorHandlerId = state.pendingAction.callbackHandler!;
    this.engine.getEventHandler().registerHandler(majorHandlerId, (_eng, pid, choice) => {
      const p = this.engine.getPlayer(pid);
      if (p && choice) {
        const majorId = choice.split(',')[0];
        const minorIds = keepPlanIds.filter(id => id !== majorId);
        this.finalizePlanSelection(p, majorId, minorIds, oldMajor, ctx);
      } else {
        this.discardTempDrawnPlans(pid, ctx.drawnPlanIds);
        this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
      }
      return null;
    });

    this.broadcastState();
  }

  /**
   * 最终确定培养计划选择：设置主修/辅修，清理临时计划，触发效果
   */
  private finalizePlanSelection(
    player: Player,
    majorId: string,
    minorIds: string[],
    oldMajor: string | null,
    ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
  ): void {
    const keepIds = [majorId, ...minorIds];

    // 更新 trainingPlans：只保留选中的
    player.trainingPlans = player.trainingPlans.filter(p => keepIds.includes(p.id));
    player.majorPlan = majorId;
    player.minorPlans = minorIds;

    const majorName = player.trainingPlans.find(p => p.id === majorId)?.name || majorId;
    this.addLog(player.id, `${player.name} 设置主修方向: ${majorName}`);
    if (minorIds.length > 0) {
      const minorNames = minorIds.map(id => player.trainingPlans.find(p => p.id === id)?.name || id);
      this.addLog(player.id, `${player.name} 辅修方向: ${minorNames.join(', ')}`);
    }

    // 将未选中的抽取计划放回牌堆
    this.discardTempDrawnPlans(player.id, ctx.drawnPlanIds.filter(id => !keepIds.includes(id)));

    // 化工不再是主修时清空禁用格子
    if (oldMajor === 'plan_huaxue' && majorId !== 'plan_huaxue') {
      const state = this.engine.getState();
      state.disabledCells = [];
      this.addLog(player.id, `${player.name} 不再主修化学化工学院，禁用格子效果解除`);
    }

    // 主修方向变化时触发 on_confirm 效果
    if (majorId !== oldMajor) {
      console.log(`[PlanSelection] finalizePlanSelection: ${player.name} major changed ${oldMajor} -> ${majorId}, triggering effects`);
      this.triggerPlanConfirmEffects(player.id, majorId);
      // 检查是否有 post-confirm action
      const postAction = this.createPostConfirmAction(player, player.id);
      if (postAction) {
        console.log(`[PlanSelection] finalizePlanSelection: ${player.name} has postAction, saving context (playerIdx=${ctx.playerIdx})`);
        this.pendingConfirmContext = {
          eligiblePlayers: ctx.eligiblePlayers,
          playerIdx: ctx.playerIdx,
          drawnPlanIds: ctx.drawnPlanIds,
        };
        const state = this.engine.getState();
        state.pendingAction = postAction;
        this.broadcastState();
        return;
      }
    }

    // 继续下一个玩家
    console.log(`[PlanSelection] finalizePlanSelection: ${player.name} done, continuing to next player (playerIdx=${ctx.playerIdx + 1})`);
    this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
  }

  /**
   * 将临时抽取的、未被选中的计划从玩家的 trainingPlans 中移除并放回牌堆
   */
  private discardTempDrawnPlans(playerId: string, planIds: string[]): void {
    const player = this.engine.getPlayer(playerId);
    const state = this.engine.getState();
    if (!player) return;

    const keepIds = new Set(getPlayerPlanIds(player));

    for (const planId of planIds) {
      if (!keepIds.has(planId)) {
        const idx = player.trainingPlans.findIndex(p => p.id === planId);
        if (idx >= 0) {
          const [plan] = player.trainingPlans.splice(idx, 1);
          state.cardDecks.training.push(plan); // 放回牌堆底部
        }
        this.yearlyDrawnPlanIds.delete(planId);
      }
    }
  }

  /**
   * 当轮所有玩家选择完毕后，清理追踪状态
   */
  private returnUnselectedPlans(): void {
    this.yearlyDrawnPlanIds.clear();
    this.redrawDrawnPlanIds.clear();
  }

  /**
   * Trigger on_confirm effects for a specific plan.
   * Unlike handleConfirmPlan, this does NOT add to majorPlan/minorPlans.
   * It only triggers the on_confirm ability effects.
   */
  private triggerPlanConfirmEffects(playerId: string, planId: string): void {
    const state = this.engine.getState();
    const player = this.engine.getPlayer(playerId);
    if (!player) return;

    const plan = player.trainingPlans.find(p => p.id === planId);
    if (!plan) return;

    // --- PlanAbilities: on_confirm trigger (for this specific plan only) ---
    const planAbilities = this.engine.getPlanAbilities();
    const confirmResult = planAbilities.checkAbilityForPlan(planId, player, state, 'on_confirm');
    if (confirmResult?.effects) {
      const fx = confirmResult.effects;
      if (confirmResult.message) {
        this.addLog(playerId, confirmResult.message);
      }

      if (fx.moveToLine) {
        this.engine.enterLine(playerId, fx.moveToLine, !fx.skipEntryFee);
      }
      if (fx.moveToCell) {
        const cellIndex = boardData.mainBoard.findIndex(c => c.cornerType === fx.moveToCell || c.id === fx.moveToCell);
        if (cellIndex >= 0) {
          this.engine.movePlayerTo(playerId, { type: 'main', index: cellIndex });
        }
      }
      if (fx.drawCard) {
        const card = this.engine.drawCard(playerId, fx.drawCard);
        if (card) {
          if (card.holdable) {
            this.engine.addCardToPlayer(playerId, card);
            this.addLog(playerId, `${player.name} 获得${fx.drawCard === 'chance' ? '机会' : '命运'}卡: ${card.name}`);
          } else {
            const cardAction = this.engine.getEventHandler().execute(`card_${card.id}`, playerId);
            if (card.returnToDeck) {
              state.discardPiles[fx.drawCard].push(card);
            }
            if (cardAction) {
              state.pendingAction = cardAction;
              this.broadcastState();
              this.io.to(this.roomId).emit('game:event-trigger', {
                title: fx.drawCard === 'chance' ? '机会卡' : '命运卡',
                description: cardAction.prompt,
                pendingAction: cardAction,
              });
              return;
            }
          }
        }
      }
      if (fx.money) this.engine.modifyPlayerMoney(playerId, fx.money);
      if (fx.gpa) this.engine.modifyPlayerGpa(playerId, fx.gpa);
      if (fx.exploration) this.engine.modifyPlayerExploration(playerId, fx.exploration);

      // customEffect handling
      if (fx.customEffect === 'guoji_target_draw') {
        state.players.forEach(p => {
          if (p.id !== playerId && !p.isBankrupt) {
            const card = this.engine.drawCard(p.id, 'chance');
            if (card) {
              this.engine.addCardToPlayer(p.id, card);
              this.addLog(p.id, `${p.name} 因国际关系学院能力获得机会卡: ${card.name}`);
            }
          }
        });
      }
      if (fx.customEffect === 'xinxiguanli_give_card') {
        const infoCard: Card = {
          id: 'xinxiguanli_data_integration',
          name: '数据整合',
          description: '信息管理学院专属。选择至多两位有卡牌的玩家，从他们手中获取卡牌（每人至多2张，总计不超过3张）',
          deckType: 'destiny',
          holdable: true,
          singleUse: true,
          returnToDeck: false,
          useTiming: 'own_turn',
          effects: [],
        };
        this.engine.addCardToPlayer(playerId, infoCard);
        this.addLog(playerId, `${player.name} 获得信息管理学院专属卡牌「数据整合」`);
      }
      if (fx.customEffect === 'shengming_maimen') {
        const shieldCard: Card = {
          id: 'maimen_shield',
          name: '麦门护盾',
          description: '抵消下一次负面效果',
          deckType: 'chance',
          holdable: true,
          singleUse: true,
          returnToDeck: false,
          effects: [],
        };
        this.engine.addCardToPlayer(playerId, shieldCard);
        this.addLog(playerId, `${player.name} 获得麦门护盾卡`);
      }
      if (fx.customEffect === 'gongguan_fund_dispatch') {
        // 只有第一次成为主修时才获得资金调度令
        if (!player.gongguan_card_given) {
          const fundCard: Card = {
            id: 'fund_dispatch',
            name: '资金调度令',
            description: '工程管理学院专属。在自己回合使用，可选择将自己的金钱变为等同于全场最高或全场最低',
            deckType: 'chance',
            holdable: true,
            singleUse: true,
            returnToDeck: false,
            useTiming: 'own_turn',
            effects: [],
          };
          this.engine.addCardToPlayer(playerId, fundCard);
          player.gongguan_card_given = true;
          this.addLog(playerId, `${player.name} 获得工程管理学院专属卡牌「资金调度令」`);
        }
      }
      if (fx.customEffect === 'shehuixue_reduce_threshold') {
        player.modifiedWinThresholds['plan_shehuixue_pending'] = 1;
      }
      if (fx.customEffect === 'rengong_reduce_threshold') {
        player.modifiedWinThresholds['plan_rengong_pending'] = 1;
      }
      if (fx.customEffect === 'xiandai_assign_card') {
        player.modifiedWinThresholds['plan_xiandai_pending'] = 1;
      }
      if (fx.customEffect === 'daqi_draw_three') {
        player.modifiedWinThresholds['plan_daqi_pending'] = 1;
      }
      if (plan.id === 'plan_faxue') {
        player.lawyerShield = true;
        this.addLog(playerId, '法学院能力：获得法律护盾（一次免除金钱损失）');
      }
      if (plan.id === 'plan_haiwai') {
        if (!player.effects.find(e => e.type === 'custom' && e.data?.foodLineOptional)) {
          this.engine.addEffectToPlayer(playerId, {
            id: `haiwai_food_optional_${Date.now()}`,
            type: 'custom',
            turnsRemaining: 999,
            data: { foodLineOptional: true },
          });
        }
        this.addLog(playerId, '海外教育学院能力：食堂线改为可选进入');
      }
    }
  }

  /** Storage for confirmation chain context across async actions */
  private pendingConfirmContext: {
    eligiblePlayers: Player[];
    playerIdx: number;
    drawnPlanIds?: string[];
  } | null = null;

  /**
   * Create post-confirm PendingAction for plans that need interactive choices.
   */
  private createPostConfirmAction(player: Player, playerId: string): PendingAction | null {
    const state = this.engine.getState();

    // 社会学院: choose to trade a win slot for lower threshold
    if (player.modifiedWinThresholds['plan_shehuixue_pending']) {
      delete player.modifiedWinThresholds['plan_shehuixue_pending'];
      // 如果胜利条件位只剩1个，无法再减少，自动跳过
      if (player.maxWinConditionSlots <= 1) {
        this.addLog(playerId, '社会学院：胜利条件位不足，无法降低阈值');
        // Fall through to next post-confirm action
      } else {
        const action = this.engine.createPendingAction(
          playerId, 'choose_option',
          `社会学院能力：降低阈值(20→15)但永久减少一个胜利条件位(${player.maxWinConditionSlots}→${player.maxWinConditionSlots - 1})？`,
          [
            { label: `降低阈值 (减少1个胜利条件位: ${player.maxWinConditionSlots}→${player.maxWinConditionSlots - 1})`, value: 'shehuixue_reduce' },
            { label: '保持原阈值 (不减少胜利条件位)', value: 'shehuixue_keep' },
          ]
        );
        action.callbackHandler = 'plan_shehuixue_callback';
        if (!this.engine.getEventHandler().hasHandler('plan_shehuixue_callback')) {
          this.engine.getEventHandler().registerHandler('plan_shehuixue_callback', (eng, pid, choice) => {
            if (choice === 'shehuixue_reduce') {
              const p = eng.getPlayer(pid);
              if (p) {
                p.modifiedWinThresholds['plan_shehuixue'] = 15;
                p.maxWinConditionSlots = Math.max(1, p.maxWinConditionSlots - 1);
                eng.log(`社会学院：阈值降为高15，胜利条件位减为${p.maxWinConditionSlots}`, pid);
              }
            }
            // Check if win condition slots overflowed (need to disable some conditions)
            this.checkWinConditionSlotOverflow(pid, () => {
              this.continuePostConfirmChain(pid);
            });
            return null;
          });
        }
        return action;
      }
    }

    // 人工智能学院: choose to trade a win slot for lower threshold
    if (player.modifiedWinThresholds['plan_rengong_pending']) {
      delete player.modifiedWinThresholds['plan_rengong_pending'];
      if (player.maxWinConditionSlots <= 1) {
        this.addLog(playerId, '人工智能学院：胜利条件位不足，无法降低阈值');
      } else {
        const action = this.engine.createPendingAction(
          playerId, 'choose_option',
          `人工智能学院能力：降低GPA阈值(2.0→1.5)但永久减少一个胜利条件位(${player.maxWinConditionSlots}→${player.maxWinConditionSlots - 1})？`,
          [
            { label: `降低阈值 (减少1个胜利条件位: ${player.maxWinConditionSlots}→${player.maxWinConditionSlots - 1})`, value: 'rengong_reduce' },
            { label: '保持原阈值 (不减少胜利条件位)', value: 'rengong_keep' },
          ]
        );
        action.callbackHandler = 'plan_rengong_callback';
        if (!this.engine.getEventHandler().hasHandler('plan_rengong_callback')) {
          this.engine.getEventHandler().registerHandler('plan_rengong_callback', (eng, pid, choice) => {
            if (choice === 'rengong_reduce') {
              const p = eng.getPlayer(pid);
              if (p) {
                p.modifiedWinThresholds['plan_rengong'] = 1.5;
                p.maxWinConditionSlots = Math.max(1, p.maxWinConditionSlots - 1);
                eng.log(`人工智能学院：阈值降为1.5，胜利条件位减为${p.maxWinConditionSlots}`, pid);
              }
            }
            this.checkWinConditionSlotOverflow(pid, () => {
              this.continuePostConfirmChain(pid);
            });
            return null;
          });
        }
        return action;
      }
    }

    // 现代工程学院: draw a destiny card and assign to a player
    if (player.modifiedWinThresholds['plan_xiandai_pending']) {
      delete player.modifiedWinThresholds['plan_xiandai_pending'];
      const card = this.engine.drawCard(playerId, 'destiny');
      if (card) {
        this.addLog(playerId, `现代工程学院：抽到命运卡 ${card.name}`);
        const targets = state.players
          .filter(p => !p.isBankrupt && !p.isDisconnected)
          .map(p => p.id);
        const action = this.engine.createPendingAction(
          playerId, 'choose_player',
          `现代工程学院：选择一位玩家执行命运卡「${card.name}」`,
          undefined, targets
        );
        action.callbackHandler = 'plan_xiandai_assign_callback';
        action.cardId = card.id;
        this.engine.getEventHandler().registerHandler('plan_xiandai_assign_callback', (eng, pid, targetId) => {
          if (targetId && card) {
            const handlerId = `card_${card.id}`;
            if (this.engine.getEventHandler().hasHandler(handlerId)) {
              const cardAction = this.engine.getEventHandler().execute(handlerId, targetId);
              if (cardAction) {
                state.pendingAction = cardAction;
              }
            } else {
              // Apply simple effects to target
              card.effects.forEach(effect => {
                if (effect.stat === 'money' && effect.delta) eng.modifyPlayerMoney(targetId, effect.delta);
                if (effect.stat === 'gpa' && effect.delta) eng.modifyPlayerGpa(targetId, effect.delta);
                if (effect.stat === 'exploration' && effect.delta) eng.modifyPlayerExploration(targetId, effect.delta);
              });
            }
            const target = eng.getPlayer(targetId);
            eng.log(`现代工程学院：${target?.name} 执行了命运卡 ${card.name}`, pid);
          }
          this.continuePostConfirmChain(pid);
          return null;
        });
        return action;
      }
    }

    // 大气科学学院: draw 3 cards, pick 1
    if (player.modifiedWinThresholds['plan_daqi_pending']) {
      delete player.modifiedWinThresholds['plan_daqi_pending'];
      const cards: { card: import('@nannaricher/shared').Card; deckType: 'chance' | 'destiny' }[] = [];
      for (let i = 0; i < 3; i++) {
        const deckType = Math.random() < 0.5 ? 'chance' : 'destiny';
        const card = this.engine.drawCard(playerId, deckType);
        if (card) cards.push({ card, deckType });
      }

      if (cards.length > 0) {
        const options = cards.map((c, i) => ({
          label: `${c.deckType === 'chance' ? '机会' : '命运'}卡: ${c.card.name}`,
          value: `daqi_pick_${i}`,
        }));
        options.push({ label: '不执行任何卡', value: 'daqi_skip' });

        const action = this.engine.createPendingAction(
          playerId, 'choose_option',
          '大气科学学院：选择一张卡牌执行',
          options
        );
        action.callbackHandler = 'plan_daqi_pick_callback';
        // Store cards for callback
        this.engine.getEventHandler().registerHandler('plan_daqi_pick_callback', (eng, pid, choice) => {
          if (choice && choice.startsWith('daqi_pick_')) {
            const idx = parseInt(choice.replace('daqi_pick_', ''), 10);
            if (idx >= 0 && idx < cards.length) {
              const picked = cards[idx];
              eng.log(`大气科学学院：执行 ${picked.card.name}`, pid);
              if (picked.card.holdable) {
                eng.addCardToPlayer(pid, picked.card);
              } else {
                const cardAction = this.engine.getEventHandler().execute(`card_${picked.card.id}`, pid);
                if (picked.card.returnToDeck) {
                  eng.getState().discardPiles[picked.deckType].push(picked.card);
                }
                if (cardAction) {
                  state.pendingAction = cardAction;
                }
              }
            }
          }
          // Return unused cards to discard
          cards.forEach((c, i) => {
            if (choice !== `daqi_pick_${i}` && !c.card.holdable) {
              eng.getState().discardPiles[c.deckType].push(c.card);
            }
          });
          this.continuePostConfirmChain(pid);
          return null;
        });
        return action;
      }
    }

    return null;
  }

  /**
   * Continue the post-confirm chain: check for more post-actions, then next player.
   */
  private continuePostConfirmChain(playerId: string): void {
    const player = this.engine.getPlayer(playerId);
    if (!player || !this.pendingConfirmContext) {
      console.warn(`[PlanSelection] continuePostConfirmChain: cannot continue — player=${!!player}, pendingConfirmContext=${!!this.pendingConfirmContext}`);
      return;
    }

    // Check if there are more post-confirm actions for this player
    const nextAction = this.createPostConfirmAction(player, playerId);
    if (nextAction) {
      console.log(`[PlanSelection] continuePostConfirmChain: ${player.name} has more post-actions`);
      const state = this.engine.getState();
      state.pendingAction = nextAction;
      this.broadcastState();
      return;
    }

    const ctx = this.pendingConfirmContext;
    this.pendingConfirmContext = null;

    // Continue to next player in plan selection
    console.log(`[PlanSelection] continuePostConfirmChain: ${player.name} done, continuing to playerIdx=${ctx.playerIdx + 1}`);
    this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
  }

  /**
   * Check if a player has more active win conditions than their available slots.
   * If so, prompt them to choose which condition(s) to disable.
   * @param onComplete Called when selection is done (or not needed)
   */
  private checkWinConditionSlotOverflow(playerId: string, onComplete: () => void): void {
    const player = this.engine.getPlayer(playerId);
    if (!player) { onComplete(); return; }

    const slots = player.maxWinConditionSlots ?? 3;
    // Active conditions = base (if not disabled) + confirmed plans (if not disabled)
    const disabled = player.disabledWinConditions ?? [];
    const activeConditions: string[] = [];
    if (!disabled.includes('base')) activeConditions.push('base');
    for (const planId of getPlayerPlanIds(player)) {
      if (!disabled.includes(planId)) activeConditions.push(planId);
    }

    if (activeConditions.length <= slots) {
      onComplete();
      return;
    }

    // Need to disable (activeConditions.length - slots) conditions
    const toDisable = activeConditions.length - slots;
    const state = this.engine.getState();

    // Build options: player chooses which to DISABLE
    const options: { label: string; value: string }[] = [];
    if (!disabled.includes('base')) {
      options.push({ label: '放弃基础胜利条件 (GPA×10+探索值≥60)', value: 'disable_base' });
    }
    for (const planId of getPlayerPlanIds(player)) {
      if (disabled.includes(planId)) continue;
      const plan = player.trainingPlans.find(p => p.id === planId);
      const planName = plan?.name || planId;
      options.push({ label: `放弃「${planName}」的胜利条件`, value: `disable_${planId}` });
    }

    state.pendingAction = {
      id: `win_slot_overflow_${Date.now()}`,
      playerId,
      type: 'choose_option',
      prompt: `你有${activeConditions.length}个胜利条件但只有${slots}个胜利条件位，请选择放弃${toDisable}个胜利条件：`,
      options,
      callbackHandler: 'win_slot_overflow_callback',
      timeoutMs: 30000,
    };

    this.engine.getEventHandler().registerHandler('win_slot_overflow_callback', (_eng, pid, choice) => {
      const p = this.engine.getPlayer(pid);
      if (p && choice && choice.startsWith('disable_')) {
        const conditionId = choice.replace('disable_', '');
        if (!p.disabledWinConditions) p.disabledWinConditions = [];
        p.disabledWinConditions.push(conditionId);
        const condLabel = conditionId === 'base' ? '基础胜利条件' : conditionId;
        this.addLog(pid, `放弃了「${condLabel}」的胜利条件`);

        // Check if still overflowing (may need to disable multiple)
        this.checkWinConditionSlotOverflow(pid, onComplete);
      } else {
        onComplete();
      }
      return null;
    });

    this.broadcastState();
  }

  // --------------------------------------------------
  // Cell Landing
  // --------------------------------------------------

  handleCellLanding(playerId: string, position: Position): void {
    const state = this.engine.getState();
    const planAbilities = this.engine.getPlanAbilities();
    const player = this.engine.getPlayer(playerId);

    if (position.type === 'main') {
      const cell = boardData.mainBoard[position.index];
      if (!cell) return;

      // --- 化学化工学院: disabledCells check ---
      if (state.disabledCells && state.disabledCells.includes(cell.id)) {
        this.addLog(playerId, `化学化工学院：格子 ${cell.name} 已被禁用，跳过事件`);
        this.broadcastState();
        if (state.phase === 'playing') {
          if (this.checkAndEmitWin()) return;
          this.advanceTurn();
        }
        return;
      }

      // --- PlanAbilities: on_cell_enter check ---
      if (player) {
        this.engine.setResourceSource('plan:on_cell_enter');
        const cellAbility = this.engine.checkAbilitiesAndBroadcast(player, state, 'on_cell_enter', { cellId: cell.id });
        if (cellAbility?.effects) {
          const fx = cellAbility.effects;
          if (cellAbility.message) this.addLog(playerId, cellAbility.message);

          // Apply direct stat effects
          if (fx.money) this.engine.modifyPlayerMoney(playerId, fx.money);
          if (fx.gpa) this.engine.modifyPlayerGpa(playerId, fx.gpa);
          if (fx.exploration) this.engine.modifyPlayerExploration(playerId, fx.exploration);

          // skipEvent: skip the normal cell handler entirely
          if (fx.skipEvent) {
            this.broadcastState();
            if (state.phase === 'playing') {
              if (this.checkAndEmitWin()) return;
              this.advanceTurn();
            }
            return;
          }

          // yixue: free hospital discharge
          if (fx.customEffect === 'yixue_free_discharge') {
            this.engine.setPlayerHospitalStatus(playerId, false);
            this.addLog(playerId, '医学院能力：免费出院');
            this.broadcastState();
            if (state.phase === 'playing') {
              if (this.checkAndEmitWin()) return;
              this.advanceTurn();
            }
            return;
          }

          // dianzi: 科创赛事只需-0.1GPA（补偿+0.2让净效果从-0.3变为-0.1）
          if (fx.customEffect === 'dianzi_kechuang') {
            // The +0.2 GPA is already applied via fx.gpa above
            // Let the normal event handler proceed (it will deduct -0.3)
            // Net effect: +0.2 - 0.3 = -0.1 GPA
            this.addLog(playerId, '电子学院能力：科创赛事只需-0.1GPA');
            // Don't return — let normal handler continue
          }

          // yishu: 浦口线双倍经验卡 — 实际逻辑已移至 GameEngine.exitLine()
          // 通过 majorPlan/minorPlans 检查 plan_yishu

          // wenxue: custom choice for jiang_gong cell
          if (fx.customEffect === 'wenxue_jiang_gong') {
            state.pendingAction = {
              id: `wenxue_choice_${Date.now()}`,
              playerId,
              type: 'choose_option',
              prompt: '文学院能力：蒋公的面子 — 选择效果',
              options: [
                { label: '+100金钱', value: 'wenxue_money' },
                { label: '喊"不吃"+2探索', value: 'wenxue_explore' },
              ],
              callbackHandler: 'wenxue_jiang_gong_choice',
              timeoutMs: 30000,
            };
            // Register inline handler for the choice
            if (!this.engine.getEventHandler().hasHandler('wenxue_jiang_gong_choice')) {
              this.engine.getEventHandler().registerHandler('wenxue_jiang_gong_choice', (eng, pid, choice) => {
                if (choice === 'wenxue_money') {
                  eng.modifyPlayerMoney(pid, 100);
                  eng.log('文学院：蒋公的面子 +100金钱', pid);
                } else {
                  eng.modifyPlayerExploration(pid, 2);
                  eng.log('文学院：喊"不吃" +2探索', pid);
                }
                return null;
              });
            }
            this.broadcastState();
            return;
          }
        }
        this.engine.clearResourceSource();
      }

      let handlerId: string | null = null;
      let resourceSource = 'cell';

      switch (cell.type) {
        case 'corner':
          if (cell.cornerType === 'start') {
            handlerId = 'corner_start_stop';
          } else if (cell.cornerType === 'hospital') {
            handlerId = 'corner_hospital_enter';
          } else if (cell.cornerType === 'ding') {
            handlerId = 'corner_ding';
          } else if (cell.cornerType === 'waiting_room') {
            handlerId = 'corner_waiting_room';
          }
          resourceSource = `corner:${cell.cornerType || 'unknown'}`;
          break;
        case 'event':
          handlerId = `event_${cell.id}`;
          resourceSource = `event:${cell.name || cell.id}`;
          break;
        case 'chance': {
          // Draw one card: randomly chance or destiny
          const cardType = Math.random() < 0.5 ? 'chance' : 'destiny';
          const card = this.engine.drawCard(playerId, cardType);
          if (card) {
            if (card.holdable) {
              this.engine.addCardToPlayer(playerId, card);
              this.addLog(playerId, `${this.engine.getPlayer(playerId)?.name} 抽到${cardType === 'chance' ? '机会' : '命运'}卡: ${card.name}`);
              // Notify clients about card draw (holdable → added to hand)
              this.io.to(this.roomId).emit('game:card-drawn', {
                playerId, card, deckType: cardType, addedToHand: true,
              });
            } else {
              // Notify clients about card draw BEFORE executing effect
              this.io.to(this.roomId).emit('game:card-drawn', {
                playerId, card, deckType: cardType, addedToHand: false,
              });

              this.addLog(playerId, `${this.engine.getPlayer(playerId)?.name} 抽到${cardType === 'chance' ? '机会' : '命运'}卡: ${card.name}`);

              // Open negate window before executing card effect
              const deckLabel = cardType === 'chance' ? '机会卡' : '命运卡';
              this.openNegateWindow(
                'card', cardType,
                `${deckLabel}【${card.name}】即将生效`,
                playerId,
                () => {
                  // Execute card effect
                  this.engine.setResourceSource(`card:${card.name}`);
                  const cHandlerId = `card_${card.id}`;
                  const hasHandler = this.engine.getEventHandler().hasHandler(cHandlerId);
                  let cardPendingAction = hasHandler
                    ? this.engine.getEventHandler().execute(cHandlerId, playerId)
                    : null;

                  if (!hasHandler && card.effects.length > 0) {
                    for (const effect of card.effects) {
                      if (effect.stat && effect.delta) {
                        if (effect.stat === 'money') this.engine.modifyPlayerMoney(playerId, effect.delta);
                        if (effect.stat === 'gpa') this.engine.modifyPlayerGpa(playerId, effect.delta);
                        if (effect.stat === 'exploration') this.engine.modifyPlayerExploration(playerId, effect.delta);
                      }
                    }
                  }
                  this.engine.clearResourceSource();

                  if (card.returnToDeck) {
                    state.discardPiles[cardType].push(card);
                  }

                  if (cardPendingAction) {
                    state.pendingAction = cardPendingAction;
                    this.broadcastState();
                    this.io.to(this.roomId).emit('game:event-trigger', {
                      title: deckLabel,
                      description: cardPendingAction.prompt,
                      pendingAction: cardPendingAction,
                    });
                    return;
                  }

                  this.broadcastState();
                  if (state.phase === 'playing') {
                    if (this.checkAndEmitWin()) return;
                    this.advanceTurn();
                  }
                },
                () => {
                  // Effect cancelled by negate card
                  if (card.returnToDeck) {
                    state.discardPiles[cardType].push(card);
                  }
                  this.broadcastState();
                  if (state.phase === 'playing') {
                    if (this.checkAndEmitWin()) return;
                    this.advanceTurn();
                  }
                },
              );
              return;
            }
          }
          // Card draw completed (holdable or no card), advance turn
          this.broadcastState();
          if (state.phase === 'playing') {
            if (this.checkAndEmitWin()) return;
            this.advanceTurn();
          }
          return;
        }
        case 'line_entry': {
          // Check if force entry is overridden by player effect (e.g., food line optional card)
          let isForced = cell.forceEntry || false;
          if (isForced && player) {
            const optionalEffect = player.effects.find(
              e => e.type === 'custom' && e.data?.foodLineOptional && cell.lineId === 'food'
            );
            if (optionalEffect) {
              isForced = false;
            }
          }

          // Calculate actual entry fee with plan discounts
          const baseFee = cell.entryFee || 0;
          const actualEntryFee = player
            ? planAbilities.calculateEntryFee(player, state, cell.lineId || '', baseFee)
            : baseFee;
          const feeLabel = actualEntryFee < baseFee
            ? `支付 ${actualEntryFee} (原价${baseFee}) 进入`
            : `支付 ${baseFee} 进入`;

          state.pendingAction = {
            id: `line_entry_${Date.now()}`,
            playerId,
            type: 'choose_option',
            prompt: isForced
              ? `必须进入 ${cell.name}`
              : actualEntryFee === 0
                ? `培养计划能力：免费进入 ${cell.name}！`
                : `是否支付 ${actualEntryFee} 金钱进入 ${cell.name}？`,
            options: isForced
              ? [{ label: '进入', value: `enter_${cell.lineId}` }]
              : [
                  { label: actualEntryFee === 0 ? '免费进入' : feeLabel, value: `enter_${cell.lineId}` },
                  { label: '不进入', value: 'skip' },
                ],
            timeoutMs: 30000,
          };
          this.broadcastState();
          return;
        }
      }

      if (handlerId) {
        const cell = boardData.mainBoard[position.index];
        const cellName = cell?.name || handlerId;

        // Open negate window before executing cell event
        this.openNegateWindow(
          'cell', undefined,
          `格子事件【${cellName}】即将触发`,
          playerId,
          () => {
            // Execute cell event
            this.engine.setResourceSource(resourceSource);
            this.logger.log({ turn: state.turnNumber, playerId, type: 'event', message: `Cell landing: ${cellName}`, data: { position, cellName } });
            const snapshot = this.capturePlayerSnapshot(playerId);
            const pendingAction = this.engine.getEventHandler().execute(handlerId!, playerId);
            if (pendingAction) {
              state.pendingAction = pendingAction;
              this.broadcastState();
              this.io.to(this.roomId).emit('game:event-trigger', {
                title: cellName,
                description: pendingAction.prompt,
                pendingAction,
                ...(cell?.type === 'corner' ? { severity: 'epic' as const } : {}),
              });
            } else if (state.pendingAction) {
              this.broadcastState();
              this.io.to(this.roomId).emit('game:event-trigger', {
                title: cellName,
                description: state.pendingAction.prompt,
                pendingAction: state.pendingAction,
                ...(cell?.type === 'corner' ? { severity: 'epic' as const } : {}),
              });
            } else {
              const effectDeltas = this.computeEffectDeltas(playerId, snapshot);
              if (cell) {
                const playerName = this.engine.getPlayer(playerId)?.name || '玩家';
                const lastLog = state.log.length > 0 ? state.log[state.log.length - 1] : null;
                const effectDesc = lastLog && lastLog.playerId === playerId
                  ? lastLog.message
                  : `${playerName} 触发了 ${cell.name}`;
                this.io.to(this.roomId).emit('game:event-trigger', {
                  title: cell.name || '事件',
                  description: effectDesc,
                  playerId,
                  ...(effectDeltas ? { effects: effectDeltas } : {}),
                  ...(cell.type === 'corner' ? { severity: 'epic' as const } : {}),
                });
              }
              this.broadcastState();
              if (state.phase === 'playing') {
                if (this.checkAndEmitWin()) return;
                this.advanceTurn();
              }
            }
            this.engine.clearResourceSource();
          },
          () => {
            // Cell event cancelled by negate
            this.broadcastState();
            if (state.phase === 'playing') {
              if (this.checkAndEmitWin()) return;
              this.advanceTurn();
            }
          },
        );
      } else {
        // No handler needed for this cell, advance turn
        if (state.phase === 'playing') {
          this.advanceTurn();
        }
      }
    } else if (position.type === 'line') {
      // Handle line cell events
      const line = boardData.lines[position.lineId];
      if (line && line.cells[position.index]) {
        const cell = line.cells[position.index];
        if (cell.handlerId) {
          // --- Card effect: foodShield (麦门护盾) — skip negative food line events ---
          if (position.lineId === 'food' && player) {
            const shieldIdx = player.effects.findIndex(
              e => e.type === 'custom' && e.data?.foodShield
            );
            if (shieldIdx >= 0) {
              // Consume the shield
              player.effects.splice(shieldIdx, 1);
              this.addLog(playerId, `麦门护盾生效：跳过食堂线事件「${cell.name || cell.handlerId}」`);
              this.broadcastState();
              if (state.phase === 'playing') {
                if (this.checkAndEmitWin()) return;
                this.advanceTurn();
              }
              return;
            }
          }

          const lineCellName = cell.name || cell.handlerId;
          const lineHandlerId = cell.handlerId;

          // Open negate window before executing line event
          this.openNegateWindow(
            'line', undefined,
            `支线事件【${lineCellName}】即将触发`,
            playerId,
            () => {
              // Execute line event
              this.engine.setResourceSource(`line:${position.lineId}:${lineCellName}`);
              const lineSnapshot = this.capturePlayerSnapshot(playerId);
              const pendingAction = this.engine.getEventHandler().execute(lineHandlerId, playerId);
              if (pendingAction) {
                state.pendingAction = pendingAction;
                this.broadcastState();
                this.io.to(this.roomId).emit('game:event-trigger', {
                  title: lineCellName,
                  description: pendingAction.prompt,
                  pendingAction,
                });
              } else if (state.pendingAction) {
                this.broadcastState();
                this.io.to(this.roomId).emit('game:event-trigger', {
                  title: lineCellName,
                  description: state.pendingAction.prompt,
                  pendingAction: state.pendingAction,
                });
              } else {
                const lineEffectDeltas = this.computeEffectDeltas(playerId, lineSnapshot);
                const playerName = this.engine.getPlayer(playerId)?.name || '玩家';
                const lastLog = state.log.length > 0 ? state.log[state.log.length - 1] : null;
                const effectDesc = lastLog && lastLog.playerId === playerId
                  ? lastLog.message
                  : `${playerName} 触发了 ${cell.description || cell.name}`;
                this.io.to(this.roomId).emit('game:event-trigger', {
                  title: lineCellName,
                  description: effectDesc,
                  playerId,
                  ...(lineEffectDeltas ? { effects: lineEffectDeltas } : {}),
                });
                this.broadcastState();
                if (state.phase === 'playing') {
                  if (this.checkAndEmitWin()) return;
                  this.advanceTurn();
                }
              }
              this.engine.clearResourceSource();
            },
            () => {
              // Line event cancelled by negate
              this.broadcastState();
              if (state.phase === 'playing') {
                if (this.checkAndEmitWin()) return;
                this.advanceTurn();
              }
            },
          );
        } else {
          // No handler for this line cell, advance turn
          if (state.phase === 'playing') {
            this.advanceTurn();
          }
        }
      }
    }
  }

  // --------------------------------------------------
  // Game Event Handlers
  // --------------------------------------------------

  handleRollDice(playerId: string): void {
    this.clearPendingActionTimeout();
    const state = this.engine.getState();
    if (state.phase !== 'playing') return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return;

    // Guard against double-roll — only process if pending action is roll_dice
    if (!state.pendingAction || state.pendingAction.type !== 'roll_dice') return;

    // Clear pending action immediately to prevent double-clicks
    state.pendingAction = null;

    // Handle hospital case — player needs to roll to leave
    if (currentPlayer.isInHospital) {
      const values = this.engine.rollDice(1);
      const total = values[0];

      this.io.to(this.roomId).emit('game:dice-result', {
        playerId,
        values,
        total,
      });

      if (total >= 3) {
        this.engine.setPlayerHospitalStatus(playerId, false);
        this.addLog(playerId, `${currentPlayer.name} 投出 ${total}，成功出院！`);

        // Set up normal dice roll for movement
        state.pendingAction = {
          id: `roll_dice_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'roll_dice',
          prompt: '已出院，请投骰子移动',
          timeoutMs: 60000,
        };
        this.broadcastState();
        return;
      } else {
        this.addLog(playerId, `${currentPlayer.name} 投出 ${total}，未能出院，等待下一回合`);
        this.broadcastState();
        this.advanceTurn();
        return;
      }
    }

    // Handle Ding case
    if (currentPlayer.isAtDing) {
      const values = this.engine.rollDice(currentPlayer.diceCount);
      const total = values.reduce((a, b) => a + b, 0);

      this.io.to(this.roomId).emit('game:dice-result', {
        playerId,
        values,
        total,
      });

      this.engine.setPlayerDingStatus(playerId, false);
      this.engine.movePlayerForward(playerId, total);
      this.addLog(playerId, `${currentPlayer.name} 从鼎移动 ${total} 步`);

      // Handle landing on new cell
      this.handleCellLanding(playerId, currentPlayer.position);
      return;
    }

    // --- Check forcedDice effect (数学系) ---
    const forcedDiceIdx = currentPlayer.effects.findIndex(
      e => e.type === 'custom' && e.data?.forcedDice
    );
    let values: number[];
    if (forcedDiceIdx >= 0) {
      const forcedVal = currentPlayer.effects[forcedDiceIdx].data?.forcedDice as number;
      currentPlayer.effects.splice(forcedDiceIdx, 1);
      values = [forcedVal];
      this.addLog(playerId, `数学系能力：骰子点数锁定为 ${forcedVal}`);
    } else {
      // --- Check doubleDiceChoice effect (鼓点重奏) ---
      const doubleDiceIdx = currentPlayer.effects.findIndex(
        e => e.type === 'custom' && e.data?.doubleDiceChoice
      );
      if (doubleDiceIdx >= 0) {
        currentPlayer.effects.splice(doubleDiceIdx, 1);
        const diceCount = currentPlayer.diceCount;
        const roll1 = this.engine.rollDice(diceCount);
        const roll2 = this.engine.rollDice(diceCount);
        const total1 = roll1.reduce((a, b) => a + b, 0);
        const total2 = roll2.reduce((a, b) => a + b, 0);

        // Auto-pick the higher roll for simplicity
        // (In a full implementation this would prompt the player to choose)
        values = total1 >= total2 ? roll1 : roll2;
        this.addLog(playerId, `鼓点重奏：投出 ${roll1.join('+')}=${total1} 和 ${roll2.join('+')}=${total2}，选择 ${values.reduce((a, b) => a + b, 0)}`);
      } else {
        // Normal dice roll
        const diceCount = currentPlayer.diceCount;
        values = this.engine.rollDice(diceCount);
      }
    }

    let total = values.reduce((a, b) => a + b, 0);

    // --- Check moveModifier effect (物理学院) ---
    const moveModIdx = currentPlayer.effects.findIndex(
      e => e.type === 'custom' && e.data?.moveModifier
    );
    let isBackward = false;
    if (moveModIdx >= 0) {
      const modifier = currentPlayer.effects[moveModIdx].data?.moveModifier as string;
      currentPlayer.effects.splice(moveModIdx, 1);
      if (modifier === 'double_forward') {
        total = total * 2;
        this.addLog(playerId, `物理学院：双倍前进 ${total} 步`);
      } else if (modifier === 'double_backward') {
        total = total * 2;
        isBackward = true;
        this.addLog(playerId, `物理学院：双倍后退 ${total} 步`);
      }
    }

    // --- Check reverse_move effect (浦口食堂/卡牌) ---
    const reverseIdx = currentPlayer.effects.findIndex(e => e.type === 'reverse_move');
    if (reverseIdx >= 0) {
      currentPlayer.effects.splice(reverseIdx, 1);
      isBackward = true;
      this.addLog(playerId, '倒退效果生效：本次移动改为后退');
    }

    this.io.to(this.roomId).emit('game:dice-result', {
      playerId,
      values,
      total,
    });

    // Record dice values for abilities (e.g. ding highest dice exemption)
    currentPlayer.lastDiceValues = values;

    this.addLog(playerId, `${currentPlayer.name} 投出了 ${values.join('+')}=${total}`);
    this.logger.log({ turn: state.turnNumber, round: state.roundNumber, playerId, type: 'dice_roll', message: `Rolled ${values.join('+')}=${total}`, data: { values, total, backward: isBackward } });

    const posBefore = { ...currentPlayer.position };

    // Move player
    if (isBackward) {
      this.engine.movePlayerBackward(playerId, total);
    } else {
      this.engine.movePlayerForward(playerId, total);
    }

    this.logger.log({ turn: state.turnNumber, round: state.roundNumber, playerId, type: 'move', message: `移动到 ${JSON.stringify(currentPlayer.position)}`, data: { from: posBefore, to: currentPlayer.position, steps: total, backward: isBackward } });

    // Handle landing
    this.handleCellLanding(playerId, currentPlayer.position);
  }

  handleChooseAction(playerId: string, actionId: string, choice: string): void {
    this.clearPendingActionTimeout();
    const state = this.engine.getState();
    if (!state.pendingAction) return;

    // Validate actionId matches current pendingAction to prevent stale/duplicate requests
    if (actionId !== state.pendingAction.id) return;

    // Prevent concurrent processing of the same action
    if (this.processingAction) return;

    // Verify it's this player's action (multi_vote allows 'all')
    if (state.pendingAction.playerId !== playerId && state.pendingAction.playerId !== 'all') {
      return;
    }

    // For non-vote actions, set processing lock
    if (state.pendingAction.type !== 'multi_vote' && state.pendingAction.type !== 'chain_action') {
      this.processingAction = true;
    }

    try {
      this._processAction(playerId, actionId, choice);
    } finally {
      this.processingAction = false;
      this.engine.clearResourceSource();
    }
  }

  private _processAction(playerId: string, actionId: string, choice: string): void {
    const state = this.engine.getState();
    if (!state.pendingAction) return;

    // Infer resource source from pending action context
    const paId = state.pendingAction.id || '';
    const paPrompt = state.pendingAction.prompt || '';
    const paCb = state.pendingAction.callbackHandler || '';
    if (paCb.startsWith('plan_')) {
      this.engine.setResourceSource(`plan:${paCb}`);
    } else if (paId.startsWith('line_entry_') || choice.startsWith('enter_')) {
      this.engine.setResourceSource('line-entry');
    } else if (paCb.startsWith('card_')) {
      this.engine.setResourceSource(`card-cb:${paCb}`);
    } else if (paPrompt.includes('事件') || paPrompt.includes('格子')) {
      this.engine.setResourceSource(`event-cb:${paPrompt.slice(0, 20)}`);
    }

    this.logger.log({
      turn: state.turnNumber,
      round: state.roundNumber,
      playerId,
      type: 'choice',
      message: `Action choice: ${choice}`,
      data: {
        actionId,
        choice,
        actionType: state.pendingAction.type,
        prompt: state.pendingAction.prompt,
        options: state.pendingAction.options?.map(o => ({ label: o.label, value: o.value })),
      },
    });

    const pendingActionId = state.pendingAction.id;

    // Handle based on pending action type
    if (state.pendingAction.type === 'choose_option') {
      // Save and clear pendingAction BEFORE processing to avoid infinite broadcast loop
      const savedPendingAction = state.pendingAction;
      state.pendingAction = null;
      let pendingAction: import('@nannaricher/shared').PendingAction | null = null;

      // Handle line entry choices inline (enter_* patterns)
      if (choice.startsWith('enter_')) {
        const lineId = choice.replace('enter_', '');
        const line = boardData.lines[lineId];
        if (line) {
          this.engine.enterLine(playerId, lineId, !line.forceEntry);
          this.addLog(playerId, `${this.engine.getPlayer(playerId)?.name} 进入 ${line.name}`);
        }
      } else if (choice === 'skip') {
        // Player chose to skip (e.g. declined line entry) — no handler to execute
      } else if (savedPendingAction.callbackHandler === 'negate_response') {
        // Negate card system: handle response within the negate window
        this.handleNegateResponse(playerId, choice);
        return; // Negate system manages its own state
      } else if (savedPendingAction.callbackHandler) {
        // Use callbackHandler: pass choice as the third parameter
        pendingAction = this.engine.getEventHandler().execute(
          savedPendingAction.callbackHandler, playerId, choice
        );
      } else {
        // Default: choice is the handler ID
        pendingAction = this.engine.getEventHandler().execute(choice, playerId);
      }

      if (pendingAction) {
        state.pendingAction = pendingAction;
        this.broadcastState();
      } else {
        // Check if this was a pre-turn plan bonus or plan confirmation/selection
        const isPlanConfirm = pendingActionId.startsWith('plan_confirm_') || pendingActionId.startsWith('general_move_')
          || pendingActionId.startsWith('plan_redraw_') || pendingActionId.startsWith('plan_overflow_')
          || pendingActionId.startsWith('win_slot_overflow_')
          || pendingActionId.startsWith('plan_select_') || pendingActionId.startsWith('plan_major_')
          || pendingActionId.startsWith('plan_adjust_');
        const isPlanBonus = pendingActionId.startsWith('jisuanji_') || pendingActionId.startsWith('kuangyaming_')
          || pendingActionId.startsWith('wuli_') || pendingActionId.startsWith('huaxue_')
          || pendingActionId.startsWith('shuxue_');

        if (state.phase === 'playing') {
          if (this.checkAndEmitWin()) return;

          // If the callback already set a new pendingAction, broadcast and notify client
          const newPa = this.engine.getState().pendingAction;
          if (newPa) {
            this.broadcastState();
            // Plan selection chain actions should NOT emit game:event-trigger
            // because they need to use ChoiceDialog/MultiSelectDialog (not EventModal)
            const isPlanSelectionChain = newPa.id.startsWith('plan_select_')
              || newPa.id.startsWith('plan_major_') || newPa.id.startsWith('plan_adjust_')
              || newPa.id.startsWith('plan_overflow_');
            if (!isPlanSelectionChain) {
              this.io.to(this.roomId).emit('game:event-trigger', {
                title: '事件触发',
                description: newPa.prompt,
                pendingAction: newPa,
              });
            }
          } else if (isPlanConfirm) {
            // Plan confirmation/selection chain handles its own progression
            // If pendingAction is null here, the chain callback may have failed
            console.log(`[PlanSelection] _processAction: isPlanConfirm path, pendingActionId=${pendingActionId}, newPa is null`);
            if (this.pendingConfirmContext) {
              // Recover: continue the plan selection chain
              console.warn(`[PlanSelection] Recovering from broken chain: pendingConfirmContext exists, resuming next player`);
              const ctx = this.pendingConfirmContext;
              this.pendingConfirmContext = null;
              this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
            }
            this.broadcastState();
          } else if (isPlanBonus) {
            // Plan bonus completed: set up roll_dice for the same player
            const currentPlayer = state.players[state.currentPlayerIndex];
            state.pendingAction = {
              id: `roll_dice_${Date.now()}`,
              playerId: currentPlayer.id,
              type: 'roll_dice',
              prompt: '请投骰子',
              timeoutMs: 60000,
            };
            this.broadcastState();
          } else {
            state.pendingAction = null;
            this.advanceTurn();
          }
        } else {
          state.pendingAction = null;
          this.broadcastState();
        }
      }
    } else if (state.pendingAction.type === 'choose_player') {
      // Save and clear pendingAction BEFORE processing to avoid infinite broadcast loop
      const savedPlayerAction = state.pendingAction;
      state.pendingAction = null;
      // Target player selected — use callbackHandler if available
      let pendingAction: import('@nannaricher/shared').PendingAction | null = null;
      if (savedPlayerAction.callbackHandler) {
        pendingAction = this.engine.getEventHandler().execute(
          savedPlayerAction.callbackHandler, playerId, choice
        );
      } else if (savedPlayerAction.targetPlayerIds?.includes(choice)) {
        const handlerId = `${pendingActionId}_${choice}`;
        pendingAction = this.engine.getEventHandler().execute(handlerId, playerId);
      }
      if (pendingAction) {
        state.pendingAction = pendingAction;
        this.broadcastState();
      } else {
        // Check if callback already set the next action (e.g. plan confirmation chain)
        if (state.pendingAction) {
          this.broadcastState();
        } else if (this.pendingConfirmContext) {
          // Plan confirmation chain context exists but no action was set — recover
          console.warn(`[PlanSelection] choose_player handler didn't set pendingAction but pendingConfirmContext exists, recovering...`);
          const ctx = this.pendingConfirmContext;
          this.pendingConfirmContext = null;
          this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
          this.broadcastState();
        } else {
          state.pendingAction = null;
          this.broadcastState();
          if (this.checkAndEmitWin()) return;
          this.advanceTurn();
        }
      }
    } else if (state.pendingAction.type === 'choose_line') {
      // Line selected for entry
      state.pendingAction = null;
      if (choice.startsWith('enter_')) {
        const lineId = choice.replace('enter_', '');
        const line = boardData.lines[lineId];
        if (line) {
          this.engine.enterLine(playerId, lineId, !line.forceEntry);
          this.addLog(playerId, `${this.engine.getPlayer(playerId)?.name} 进入 ${line.name}`);
        }
      }
      // enterLine may have set a new pendingAction from the first cell handler
      const linePa = this.engine.getState().pendingAction;
      if (linePa) {
        this.broadcastState();
        this.io.to(this.roomId).emit('game:event-trigger', {
          title: '事件触发',
          description: linePa.prompt,
          pendingAction: linePa,
        });
      } else {
        this.advanceTurn();
      }
    } else if (state.pendingAction.type === 'multi_vote') {
      // Multi-player voting — each player votes
      if (!state.pendingAction.responses) {
        state.pendingAction.responses = {};
      }
      state.pendingAction.responses[playerId] = choice;

      const optionLabel = state.pendingAction.options?.find(o => o.value === choice)?.label || choice;
      this.addLog(playerId, `${this.engine.getPlayer(playerId)?.name} 选择了: ${optionLabel}`);

      // Check if all players have voted
      const totalVoters = state.pendingAction.targetPlayerIds?.length || state.players.length;
      const votedCount = Object.keys(state.pendingAction.responses).length;

      console.log(`[VOTE] ${playerId} voted '${choice}' on ${state.pendingAction.cardId} | voted=${votedCount}/${totalVoters} | targetIds=${JSON.stringify(state.pendingAction.targetPlayerIds)} | responseKeys=${JSON.stringify(Object.keys(state.pendingAction.responses))}`);

      if (votedCount >= totalVoters) {
        // All votes collected — resolve based on card type
        const responses = state.pendingAction.responses;
        const cardId = state.pendingAction.cardId;

        // Group players by their vote
        const groups: Record<string, string[]> = {};
        for (const [pid, vote] of Object.entries(responses)) {
          const v = vote as string;
          if (!groups[v]) groups[v] = [];
          groups[v].push(pid);
        }

        // Count votes per option
        const counts: Record<string, number> = {};
        for (const [option, pids] of Object.entries(groups)) {
          counts[option] = pids.length;
        }

        // Broadcast vote result for balance analysis
        if (cardId) {
          const winnerOption = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
          this.io.to(this.roomId).emit('game:vote-result', {
            cardId,
            results: groups,
            winnerOption,
            turn: state.turnNumber,
            round: state.roundNumber,
          });
        }

        try {
          if (cardId) {
            this.resolveMultiVoteCard(cardId, groups, counts);
          }
        } catch (err) {
          console.error(`[VOTE ERROR] resolveMultiVoteCard failed for ${cardId}:`, err);
        }

        // If resolveMultiVoteCard set a follow-up pendingAction (e.g. penalty chain),
        // don't clear it — just broadcast and wait for the new action to resolve
        if (state.pendingAction && state.pendingAction.type !== 'multi_vote') {
          this.broadcastState();
          return;
        }

        state.pendingAction = null;
        this.broadcastState();
        if (this.checkAndEmitWin()) return;
        this.advanceTurn();
      } else {
        // Not all votes in yet
        this.broadcastState();
      }
    } else if (state.pendingAction.type === 'chain_action') {
      // Chain action — players act in sequence
      const chainOrder = state.pendingAction.chainOrder || [];
      const currentIdx = chainOrder.indexOf(playerId);

      if (currentIdx !== -1) {
        // Record this player's action
        if (!state.pendingAction.responses) {
          state.pendingAction.responses = {};
        }
        state.pendingAction.responses[playerId] = choice;

        this.addLog(playerId, `${this.engine.getPlayer(playerId)?.name} 选择: ${choice}`);

        // Find next player in chain
        const nextIdx = currentIdx + 1;
        if (nextIdx < chainOrder.length) {
          // Continue chain with next player
          this.broadcastState();
        } else {
          // Chain complete — execute final effect
          const cardId = state.pendingAction.cardId;
          if (cardId) {
            const responses = state.pendingAction.responses;
            const continueCount = Object.values(responses).filter(r => r === 'continue').length;

            // Broadcast chain result for balance analysis
            this.io.to(this.roomId).emit('game:chain-result', {
              cardId,
              chainLength: continueCount,
              participants: chainOrder,
              turn: state.turnNumber,
              round: state.roundNumber,
            });

            this.engine.getEventHandler().execute(`chain_${cardId}_end_${continueCount}`, playerId);
          }

          state.pendingAction = null;
          this.broadcastState();
          this.advanceTurn();
        }
      } else {
        // Player not in chain order — invalid state, recover by ignoring
        console.warn(`[GameCoordinator] Player ${playerId} responded to chain_action but not in chainOrder`);
      }
    }
  }

  handleUseCard(playerId: string, cardId: string, targetPlayerId?: string): { error?: string } {
    const state = this.engine.getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player) return { error: '玩家不存在' };

    const cardIndex = player.heldCards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { error: '你没有这张卡牌' };
    const card = player.heldCards[cardIndex];

    // Block manual use of negate cards — they can only be used reactively during negate windows
    if (NEGATE_CARD_IDS.has(card.id)) {
      return { error: '此卡牌只能在事件触发时作为响应使用，无法主动使用' };
    }

    // Validate use timing: own_turn cards can only be used during player's own turn
    const isCurrentTurn = state.players[state.currentPlayerIndex]?.id === playerId;
    if (card.useTiming !== 'any_turn' && !isCurrentTurn) {
      return { error: '只能在自己的回合使用这张卡牌' };
    }

    // Validate contextual card requirements before consuming the card
    const contextError = this.validateCardContext(player, card);
    if (contextError) {
      return { error: contextError };
    }

    // Remove card from hand (after validation)
    player.heldCards.splice(cardIndex, 1);
    this.addLog(playerId, `${player.name} 使用手牌: ${card.name}`);

    // Announce card use to all players
    this.io.to(this.roomId).emit('game:announcement', {
      message: `${player.name} 使用了 ${card.deckType === 'chance' ? '机遇' : '命运'}卡【${card.name}】`,
      type: 'info' as const,
    });

    // Open negate window before executing card effect
    const cardDeckType = card.deckType as 'chance' | 'destiny';
    this.openNegateWindow(
      'card', cardDeckType,
      `手牌【${card.name}】即将生效`,
      playerId,
      () => {
        // Execute card effect
        this.engine.setResourceSource(`card-use:${card.name}`);
        const useHandlerId = `card_${card.id}`;
        if (this.engine.getEventHandler().hasHandler(useHandlerId)) {
          const pendingAction = this.engine.getEventHandler().execute(useHandlerId, playerId, targetPlayerId);

          if (card.returnToDeck) {
            state.discardPiles[card.deckType].push(card);
          }

          if (pendingAction) {
            state.pendingAction = pendingAction;
            this.io.to(this.roomId).emit('game:event-trigger', {
              title: `使用手牌: ${card.name}`,
              description: pendingAction.prompt,
              pendingAction,
            });
          }

          this.broadcastState();
          this.engine.clearResourceSource();
          this.checkAndEmitWin();
          return;
        }

        // Fallback: apply simple effects from card.effects array
        card.effects.forEach(effect => {
          let targetId = playerId;

          if (effect.target && effect.target !== 'self') {
            switch (effect.target) {
              case 'choose_player':
                if (targetPlayerId) targetId = targetPlayerId;
                break;
              case 'all':
                state.players.forEach(p => {
                  if (p.id !== playerId && !p.isBankrupt) {
                    if (effect.stat === 'money' && effect.delta) this.engine.modifyPlayerMoney(p.id, effect.delta);
                    if (effect.stat === 'gpa' && effect.delta) this.engine.modifyPlayerGpa(p.id, effect.delta);
                    if (effect.stat === 'exploration' && effect.delta) this.engine.modifyPlayerExploration(p.id, effect.delta);
                  }
                });
                return;
              case 'richest':
                targetId = this.engine.getPlayersByMoneyRank()[0]?.id || playerId;
                break;
              case 'poorest': {
                const ranked = this.engine.getPlayersByMoneyRank();
                targetId = ranked[ranked.length - 1]?.id || playerId;
                break;
              }
              case 'highest_gpa':
                targetId = this.engine.getPlayersByGpaRank()[0]?.id || playerId;
                break;
              case 'lowest_gpa': {
                const ranked = this.engine.getPlayersByGpaRank();
                targetId = ranked[ranked.length - 1]?.id || playerId;
                break;
              }
            }
          }

          if (effect.stat && effect.delta) {
            if (effect.stat === 'money') this.engine.modifyPlayerMoney(targetId, effect.delta);
            if (effect.stat === 'gpa') this.engine.modifyPlayerGpa(targetId, effect.delta);
            if (effect.stat === 'exploration') this.engine.modifyPlayerExploration(targetId, effect.delta);
          }
        });

        if (card.returnToDeck) {
          state.discardPiles[card.deckType].push(card);
        }

        this.engine.clearResourceSource();
        this.broadcastState();
        this.checkAndEmitWin();
      },
      () => {
        // Card effect cancelled by negate — card already consumed
        if (card.returnToDeck) {
          state.discardPiles[card.deckType].push(card);
        }
        this.broadcastState();
      },
    );
    return {};
  }

  private validateCardContext(player: import('@nannaricher/shared').Player, card: import('@nannaricher/shared').Card): string | null {
    switch (card.id) {
      case 'destiny_urgent_deadline':
        if (!player.isInHospital && !player.isAtDing) {
          return '当前不在校医院或鼎，无法使用工期紧迫';
        }
        break;
      case 'destiny_alternative_path':
        if (player.position.type !== 'line') {
          return '当前不在支线内，无法使用另辟蹊径';
        }
        break;
      case 'destiny_cross_college_exit':
        if (player.minorPlans.length === 0) {
          return '没有辅修培养计划，无法使用跨院准出';
        }
        break;
      case 'xinxiguanli_data_integration': {
        const state = this.engine.getState();
        const othersWithCards = state.players.filter(p =>
          p.id !== player.id && !p.isBankrupt && p.heldCards.length > 0
        );
        if (othersWithCards.length === 0) {
          return '当前没有其他玩家持有卡牌，无法使用数据整合';
        }
        break;
      }
    }
    return null;
  }

  handleConfirmPlan(playerId: string, planId: string): { error?: string } {
    const state = this.engine.getState();

    const player = state.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found' };

    const plan = player.trainingPlans.find(p => p.id === planId);
    if (!plan) return { error: 'Plan not found' };

    // Check if can confirm (planSlotLimit)
    if (getPlayerPlanIds(player).length >= player.planSlotLimit) {
      return { error: '已达到最大确认计划数' };
    }

    // Turn interval check removed — confirmation is now server-driven
    // via pendingAction chains (升学阶段 redraw or setup phase)

    if (player.majorPlan !== plan.id && !player.minorPlans.includes(plan.id)) {
      if (!player.majorPlan) {
        player.majorPlan = plan.id;
      } else {
        player.minorPlans.push(plan.id);
      }
    }

    this.addLog(playerId, `${player.name} 确认了培养计划: ${plan.name}`);

    // Trigger on_confirm effects via shared helper
    this.triggerPlanConfirmEffects(playerId, planId);

    // In playing phase, remove unconfirmed plans immediately after confirming one
    // (this is for the every-6-turns plan confirmation during gameplay)
    const confirmedIds = getPlayerPlanIds(player);
    player.trainingPlans = player.trainingPlans.filter(p =>
      confirmedIds.includes(p.id) || p.id === planId
    );

    this.broadcastState();

    // Check win condition
    const { winnerId, condition } = this.checkWinCondition();
    if (winnerId) {
      const winner = state.players.find(p => p.id === winnerId);
      state.winner = winnerId;
      state.phase = 'finished';
      this.logger.log({ turn: state.turnNumber, playerId: winnerId, type: 'phase_change', message: `Game won via plan: ${condition}`, data: { winnerId, condition } });
      this.saveGameSummary();
      this.logger.persist().catch(err => console.error('Failed to persist game log:', err));
      this.io.to(this.roomId).emit('game:player-won', {
        playerId: winnerId,
        playerName: winner?.name || 'Unknown',
        condition: condition || 'Unknown condition',
      });
      this.onFinishedCallback?.();
    }

    return {};
  }

}
