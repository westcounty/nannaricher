// server/src/game/GameEngine.ts
import {
  GameState,
  Player,
  Position,
  Card,
  TrainingPlan,
  ActiveEffect,
  PendingAction,
  GameLogEntry,
  SALARY_PASS,
  SALARY_STOP,
  BASE_WIN_THRESHOLD,
  ACTION_TIMEOUT_MS,
  TOTAL_ROUNDS,
} from '@nannaricher/shared';
import { boardData, MAIN_BOARD_SIZE } from '../data/board.js';
import { createDecks } from '../data/cards.js';
import { createTrainingDeck } from '../data/trainingPlans.js';
import { EventHandler, GameEngine as IGameEngine } from './EventHandler.js';
import { WinConditionChecker } from './rules/WinConditionChecker.js';
import { PlanAbilityHandler } from './rules/PlanAbilities.js';
import { CardEffectHandler } from './rules/CardEffectHandler.js';
import { StateTracker } from './history/StateTracker.js';
import { DelayedEffectManager } from './effects/DelayedEffectManager.js';
import { VotingSystem } from './interaction/VotingSystem.js';
import { ChainActionSystem } from './interaction/ChainActionSystem.js';

/**
 * GameEngine class - Core game state management and logic
 * Implements the GameEngine interface defined in EventHandler.ts
 */
export class GameEngine implements IGameEngine {
  private state: GameState;
  private eventHandler: EventHandler;
  private winChecker: WinConditionChecker;
  private planAbilities: PlanAbilityHandler;
  private cardHandler: CardEffectHandler;
  private stateTracker: StateTracker;
  private delayedEffects: DelayedEffectManager;
  private votingSystem: VotingSystem;
  private chainSystem: ChainActionSystem;
  /** Snapshot of player resources at line entry, keyed by `${playerId}:${lineId}` */
  private lineEntrySnapshots: Map<string, { money: number; gpa: number; exploration: number; turn: number }> = new Map();

  constructor(roomId: string) {
    this.state = this.createInitialState(roomId);
    this.eventHandler = new EventHandler(this);
    this.winChecker = new WinConditionChecker();
    this.planAbilities = new PlanAbilityHandler();
    this.cardHandler = new CardEffectHandler();
    this.stateTracker = new StateTracker();
    this.delayedEffects = new DelayedEffectManager();
    this.votingSystem = new VotingSystem();
    this.chainSystem = new ChainActionSystem();
  }

  /**
   * Create initial game state for a new room
   */
  private createInitialState(roomId: string): GameState {
    const decks = createDecks();
    return {
      roomId,
      phase: 'waiting',
      currentPlayerIndex: 0,
      turnNumber: 0,
      roundNumber: 1,  // 每隔6回合增加一个大轮
      players: [],
      cardDecks: {
        chance: this.shuffleDeck([...decks.chance]),
        destiny: this.shuffleDeck([...decks.destiny]),
        training: this.shuffleDeck(createTrainingDeck()),
      },
      discardPiles: {
        chance: [],
        destiny: [],
      },
      pendingAction: null,
      turnOrder: [],
      turnOrderReversed: false,
      winner: null,
      log: [],
    };
  }

  /**
   * Fisher-Yates shuffle algorithm
   */
  private shuffleDeck<T>(deck: T[]): T[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get max rounds for the current player count.
   * Falls back to a sensible default if the player count isn't in TOTAL_ROUNDS.
   */
  private getMaxRounds(): number {
    const playerCount = this.state.players.length;
    if (TOTAL_ROUNDS[playerCount] !== undefined) {
      return TOTAL_ROUNDS[playerCount];
    }
    // Fallback: <=3 → 30, <=4 → 25, else 20
    if (playerCount <= 3) return 30;
    if (playerCount <= 4) return 25;
    return 20;
  }

  /**
   * Calculate final score for a player (used in forced scoring at round limit).
   */
  private calculateFinalScore(player: Player): number {
    return player.gpa * 10 + player.exploration + Math.floor(player.money / 100);
  }

  /**
   * Forced scoring when the round limit is reached.
   * Scores all non-bankrupt players, declares the highest scorer as winner.
   */
  private forceEndGame(): void {
    const activePlayers = this.state.players.filter(p => !p.isBankrupt);
    if (activePlayers.length === 0) {
      this.state.phase = 'finished';
      this.log('回合上限到达，无存活玩家，游戏结束');
      return;
    }

    // Calculate scores and find winner
    let bestScore = -Infinity;
    let winnerId = activePlayers[0].id;

    for (const player of activePlayers) {
      const score = this.calculateFinalScore(player);
      this.log(`最终得分: ${score} (GPA×10=${player.gpa * 10}, 探索=${player.exploration}, 金钱÷100=${Math.floor(player.money / 100)})`, player.id);
      if (score > bestScore) {
        bestScore = score;
        winnerId = player.id;
      }
    }

    this.state.phase = 'finished';
    this.state.winner = winnerId;
    this.log(`回合上限到达，强制结算！最高分: ${bestScore}`, winnerId);
    this.log(`获胜！条件: 回合上限强制结算`, winnerId);
  }

  // ============================================
  // State Access Methods
  // ============================================

  getState(): GameState {
    return this.state;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.state.players.find(p => p.id === playerId);
  }

  getAllPlayers(): Player[] {
    return [...this.state.players];
  }

  // ============================================
  // Player Management
  // ============================================

  /**
   * Add a new player to the game
   */
  addPlayer(player: Player): void {
    this.state.players.push(player);
    this.state.turnOrder.push(this.state.players.length - 1);
    // StateTracker: initialize player history
    this.stateTracker.initPlayerHistory(player.id, player.position);
    this.log(`玩家 ${player.name} 加入游戏`);
  }

  /**
   * Remove a player from the game (disconnect)
   */
  removePlayer(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (player) {
      player.isDisconnected = true;
      this.log(`玩家 ${player.name} 断开连接`);
    }
  }

  // ============================================
  // State Modifiers
  // ============================================

  modifyPlayerMoney(playerId: string, delta: number): void {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return;

    // DelayedEffectManager: check money freeze (block all money modifications)
    if (this.delayedEffects.hasMoneyFreeze(playerId)) {
      this.log('金钱冻结效果生效，金钱不变', playerId);
      return;
    }

    // Check plan abilities for money loss protection
    if (delta < 0) {
      const abilityResult = this.planAbilities.applyPassiveAbility({
        player,
        state: this.state,
        event: 'money_loss',
      });

      if (abilityResult.modified && abilityResult.effects?.customEffect === 'faxue_shield') {
        this.log('法学院护盾：免除本次金钱损失', playerId);
        return; // Cancel the money loss
      }
    }

    const oldMoney = player.money;
    player.money += delta;

    // Track money zero count for achievements
    if (player.money === 0 && oldMoney !== 0) {
      player.moneyZeroCount++;
      // StateTracker: record money reaching zero
      this.stateTracker.recordMoneyZero(playerId);
    }

    this.log(`金钱 ${delta >= 0 ? '+' : ''}${delta} (当前: ${player.money})`, playerId);

    // Check bankruptcy after modification
    if (player.money < 0) {
      this.checkBankruptcy(playerId);
    }
  }

  modifyPlayerGpa(playerId: string, delta: number): void {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return;

    const oldGpa = player.gpa;
    let newGpa = player.gpa + delta;

    // Check philosophy plan ability: GPA floor of 3.0
    if (player.confirmedPlans.includes('plan_zhexue') && newGpa < 3.0 && oldGpa >= 3.0) {
      newGpa = 3.0;
      this.log('哲学系能力：GPA下限保持在3.0', playerId);
    }

    player.gpa = parseFloat(Math.max(0, Math.min(5.0, newGpa)).toFixed(1));
    this.log(`GPA ${delta >= 0 ? '+' : ''}${delta} (当前: ${player.gpa})`, playerId);
  }

  modifyPlayerExploration(playerId: string, delta: number): void {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return;

    player.exploration = Math.max(0, player.exploration + delta);
    this.log(`探索值 ${delta >= 0 ? '+' : ''}${delta} (当前: ${player.exploration})`, playerId);
  }

  // ============================================
  // Position Management
  // ============================================

  movePlayerTo(playerId: string, position: Position): void {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return;

    const oldPosition = player.position;
    player.position = position;

    // Check if passing start (only on main board)
    if (oldPosition.type === 'main' && position.type === 'main') {
      if (position.index < oldPosition.index) {
        // Passed start
        this.eventHandler.execute('corner_start_pass', playerId);
      }
    }

    this.log(`移动到 ${this.getPositionName(position)}`, playerId);

    // StateTracker: record position change and shared cells
    this.stateTracker.recordPosition(playerId, position, this.state.turnNumber);
    this.stateTracker.checkAndUpdateSharedCells(this.state.players, this.state.turnNumber);
  }

  movePlayerForward(playerId: string, steps: number): void {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return;

    if (player.position.type !== 'main') {
      // Inside a line, move forward within line
      this.movePlayerInLine(playerId, steps);
      return;
    }

    const oldIndex = player.position.index;
    const newIndex = (oldIndex + steps) % MAIN_BOARD_SIZE;

    // Check if passing start
    if (newIndex < oldIndex) {
      this.eventHandler.execute('corner_start_pass', playerId);
    }

    player.position = { type: 'main', index: newIndex };
    this.log(`前进 ${steps} 步到 ${this.getPositionName(player.position)}`, playerId);

    // StateTracker: record position change and shared cells
    this.stateTracker.recordPosition(playerId, player.position, this.state.turnNumber);
    this.stateTracker.checkAndUpdateSharedCells(this.state.players, this.state.turnNumber);

    // NOTE: Cell event execution is handled by GameCoordinator.handleCellLanding()
  }

  movePlayerBackward(playerId: string, steps: number): void {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return;

    if (player.position.type !== 'main') return;

    let newIndex = player.position.index - steps;
    while (newIndex < 0) {
      newIndex += MAIN_BOARD_SIZE;
    }

    player.position = { type: 'main', index: newIndex };
    this.log(`后退 ${steps} 步到 ${this.getPositionName(player.position)}`, playerId);

    // StateTracker: record position change and shared cells
    this.stateTracker.recordPosition(playerId, player.position, this.state.turnNumber);
    this.stateTracker.checkAndUpdateSharedCells(this.state.players, this.state.turnNumber);

    // NOTE: Cell event execution is handled by GameCoordinator.handleCellLanding()
  }

  private movePlayerInLine(playerId: string, steps: number): void {
    const player = this.getPlayer(playerId);
    if (!player || player.position.type !== 'line') return;

    const lineId = player.position.lineId;
    const line = boardData.lines[lineId];
    if (!line) return;

    const newIndex = player.position.index + steps;

    // Check if reaching end of line
    if (newIndex >= line.cells.length) {
      // Exit line at end
      this.exitLine(playerId, true);
      return;
    }

    player.position = { type: 'line', lineId, index: newIndex };

    // StateTracker: record position change and shared cells
    this.stateTracker.recordPosition(playerId, player.position, this.state.turnNumber);
    this.stateTracker.checkAndUpdateSharedCells(this.state.players, this.state.turnNumber);

    // StateTracker: record line event trigger
    const cell = line.cells[newIndex];
    if (cell) {
      this.stateTracker.recordLineEvent(playerId, lineId, newIndex);

      // StateTracker: update food line streak if applicable
      if (lineId === 'food') {
        const hadNegative = cell.handlerId.includes('negative') || cell.handlerId.includes('bad');
        this.stateTracker.updateFoodLineStreak(playerId, hadNegative);
      }
    }

    // NOTE: Line cell event execution is handled by GameCoordinator.handleCellLanding()
  }

  private getPositionName(position: Position): string {
    if (position.type === 'main') {
      const cell = boardData.mainBoard[position.index];
      return cell?.name || `主板${position.index}`;
    } else {
      const line = boardData.lines[position.lineId];
      const cell = line?.cells[position.index];
      return cell?.name || `${line?.name || position.lineId}线${position.index}`;
    }
  }

  // ============================================
  // Line Handling
  // ============================================

  enterLine(playerId: string, lineId: string, payFee: boolean): boolean {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return false;

    const line = boardData.lines[lineId];
    if (!line) return false;

    // Pay entry fee if required
    if (payFee && line.entryFee > 0) {
      if (player.money < line.entryFee) {
        this.log(`金钱不足，无法进入 ${line.name}`, playerId);
        return false;
      }
      this.modifyPlayerMoney(playerId, -line.entryFee);
    }

    // Track line visit
    if (!player.linesVisited.includes(lineId)) {
      player.linesVisited.push(lineId);
    }

    // Initialize line events tracking
    if (!player.lineEventsTriggered[lineId]) {
      player.lineEventsTriggered[lineId] = [];
    }

    // StateTracker: record line visit and save entry resource snapshot
    this.stateTracker.recordLineVisit(playerId, lineId);
    this.lineEntrySnapshots.set(`${playerId}:${lineId}`, {
      money: player.money,
      gpa: player.gpa,
      exploration: player.exploration,
      turn: this.state.turnNumber,
    });

    // Move player to line start
    player.position = { type: 'line', lineId, index: 0 };
    this.log(`进入 ${line.name}`, playerId);

    // StateTracker: record position change
    this.stateTracker.recordPosition(playerId, player.position, this.state.turnNumber);
    this.stateTracker.checkAndUpdateSharedCells(this.state.players, this.state.turnNumber);

    // Execute first cell event if exists
    if (line.cells[0]) {
      player.lineEventsTriggered[lineId].push(0);
      // StateTracker: record line event for first cell
      this.stateTracker.recordLineEvent(playerId, lineId, 0);
      this.eventHandler.execute(line.cells[0].handlerId, playerId);

      // StateTracker: update food line streak if applicable
      if (lineId === 'food') {
        const hadNegative = line.cells[0].handlerId.includes('negative') || line.cells[0].handlerId.includes('bad');
        this.stateTracker.updateFoodLineStreak(playerId, hadNegative);
      }
    }

    return true;
  }

  exitLine(playerId: string, moveToMainBoard: boolean): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    if (player.position.type !== 'line') return;

    const lineId = player.position.lineId;
    const line = boardData.lines[lineId];

    // StateTracker: record line exit with resource snapshots
    const snapshotKey = `${playerId}:${lineId}`;
    const entrySnapshot = this.lineEntrySnapshots.get(snapshotKey);
    if (entrySnapshot) {
      // Temporarily store current (pre-experience-card) values as exit snapshot
      const exitMoney = player.money;
      const exitGpa = player.gpa;
      const exitExploration = player.exploration;

      // We'll record after experience card, but use pre-card values for now
      // Actually record with current values; experience card is a separate bonus
      this.stateTracker.recordLineExit(
        playerId,
        lineId,
        entrySnapshot.turn,
        this.state.turnNumber,
        {
          ...player,
          // Override with entry snapshot for "before" values — recordLineExit uses player for both
          // so we need to call it with a patched player object
        } as Player
      );

      // Patch: the StateTracker.recordLineExit currently uses player.gpa for both before/after
      // We fix this by directly updating the lineExits record
      const history = this.stateTracker.getPlayerHistory(playerId);
      if (history && history.lineExits.length > 0) {
        const lastExit = history.lineExits[history.lineExits.length - 1];
        lastExit.gpaBefore = entrySnapshot.gpa;
        lastExit.gpaAfter = exitGpa;
        lastExit.explorationBefore = entrySnapshot.exploration;
        lastExit.explorationAfter = exitExploration;
        lastExit.moneyBefore = entrySnapshot.money;
        lastExit.moneyAfter = exitMoney;
      }

      this.lineEntrySnapshots.delete(snapshotKey);
    }

    // Give experience card at end of line
    if (line?.experienceCard && moveToMainBoard) {
      this.eventHandler.execute(line.experienceCard.handlerId, playerId);
    }

    if (moveToMainBoard) {
      // Find the corresponding line entry on main board
      const entryCell = boardData.mainBoard.find(
        cell => cell.type === 'line_entry' && cell.lineId === lineId
      );

      if (entryCell) {
        // Move to next cell after line entry
        const nextIndex = (entryCell.index + 1) % MAIN_BOARD_SIZE;
        player.position = { type: 'main', index: nextIndex };
        this.log(`离开 ${line?.name || lineId}，移动到 ${this.getPositionName(player.position)}`, playerId);

        // NOTE: Cell event execution is handled by GameCoordinator.handleCellLanding()
      }
    } else {
      // Stay at line entry (for early exit)
      const entryCell = boardData.mainBoard.find(
        cell => cell.type === 'line_entry' && cell.lineId === lineId
      );
      if (entryCell) {
        player.position = { type: 'main', index: entryCell.index };
        this.log(`离开 ${line?.name || lineId}`, playerId);
      }
    }
  }

  // ============================================
  // Card Handling
  // ============================================

  drawCard(playerId: string, deckType: 'chance' | 'destiny'): Card | null {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return null;

    let deck = this.state.cardDecks[deckType];
    let discardPile = this.state.discardPiles[deckType];

    // Reshuffle from discard pile if deck is empty
    if (deck.length === 0) {
      if (discardPile.length === 0) {
        // Recreate deck from original cards
        const decks = createDecks();
        deck = this.shuffleDeck(decks[deckType]);
        this.state.cardDecks[deckType] = deck;
      } else {
        deck = this.shuffleDeck([...discardPile]);
        this.state.cardDecks[deckType] = deck;
        this.state.discardPiles[deckType] = [];
      }
    }

    const card = deck.pop();
    if (!card) return null;

    // Track cards with English letters or digits for achievements
    if (/[a-zA-Z]/.test(card.name) && !card.name.includes('GPA')) {
      player.cardsDrawnWithEnglish++;
    }
    if (/^\d/.test(card.name)) {
      player.cardsDrawnWithDigitStart.push(card.id);
    }

    // StateTracker: record card draw
    this.stateTracker.recordCardDraw(playerId, card, this.state.turnNumber);

    this.log(`抽取 ${deckType === 'chance' ? '机会' : '命运'}卡: ${card.name}`, playerId);

    // NOTE: Card effect execution (holdable add / non-holdable execute) is handled
    // by GameCoordinator.handleCellLanding() to avoid duplicate processing.

    return card;
  }

  drawTrainingPlan(playerId: string): TrainingPlan | null {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return null;

    let deck = this.state.cardDecks.training;

    if (deck.length === 0) {
      this.log('培养计划牌堆已空', playerId);
      return null;
    }

    const plan = deck.pop();
    if (!plan) return null;

    player.trainingPlans.push(plan);
    this.log(`抽取培养计划: ${plan.name}`, playerId);

    return plan;
  }

  addCardToPlayer(playerId: string, card: Card): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    player.heldCards.push(card);
    this.log(`获得卡片: ${card.name}`, playerId);
  }

  removeCardFromPlayer(playerId: string, cardId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const index = player.heldCards.findIndex(c => c.id === cardId);
    if (index !== -1) {
      const card = player.heldCards.splice(index, 1)[0];

      // Return to discard pile if needed
      if (card.returnToDeck) {
        this.state.discardPiles[card.deckType].push(card);
      }

      this.log(`使用卡片: ${card.name}`, playerId);
    }
  }

  giveCardToPlayer(playerId: string, card: Card): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    player.heldCards.push(card);
    this.log(`获得卡片: ${card.name}`, playerId);
  }

  // ============================================
  // Effects Management
  // ============================================

  addEffectToPlayer(playerId: string, effect: ActiveEffect): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    // Check if effect already exists
    const existingIndex = player.effects.findIndex(e => e.id === effect.id);
    if (existingIndex !== -1) {
      // Update existing effect
      player.effects[existingIndex] = effect;
    } else {
      player.effects.push(effect);
    }

    this.log(`获得效果: ${effect.type} (${effect.turnsRemaining}回合)`, playerId);
  }

  removeEffectFromPlayer(playerId: string, effectId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const index = player.effects.findIndex(e => e.id === effectId);
    if (index !== -1) {
      const effect = player.effects.splice(index, 1)[0];
      this.log(`效果结束: ${effect.type}`, playerId);
    }
  }

  /**
   * Process effects at start of turn
   */
  processEffectsAtTurnStart(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const effectsToRemove: string[] = [];

    for (const effect of player.effects) {
      if (effect.turnsRemaining > 0) {
        effect.turnsRemaining--;
        if (effect.turnsRemaining === 0) {
          effectsToRemove.push(effect.id);
        }
      }
    }

    for (const effectId of effectsToRemove) {
      this.removeEffectFromPlayer(playerId, effectId);
    }
  }

  // ============================================
  // Turn Control
  // ============================================

  skipPlayerTurn(playerId: string, turns: number): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    player.skipNextTurn = true;
    this.log(`暂停 ${turns} 回合`, playerId);
  }

  /**
   * Get next active player index
   */
  private getNextActivePlayerIndex(): number {
    const order = this.state.turnOrderReversed
      ? [...this.state.turnOrder].reverse()
      : this.state.turnOrder;

    let currentIndex = order.indexOf(this.state.currentPlayerIndex);

    for (let i = 1; i <= order.length; i++) {
      const nextIndex = order[(currentIndex + i) % order.length];
      const nextPlayer = this.state.players[nextIndex];

      if (nextPlayer && !nextPlayer.isBankrupt && !nextPlayer.isDisconnected) {
        return nextIndex;
      }
    }

    return this.state.currentPlayerIndex;
  }

  /**
   * Advance to next turn
   */
  nextTurn(): void {
    // Find next active player
    this.state.currentPlayerIndex = this.getNextActivePlayerIndex();
    this.state.turnNumber++;

    // 每隔6回合增加一个大轮
    if (this.state.turnNumber % 6 === 0) {
      this.state.roundNumber++;
      this.log(`=== 第 ${this.state.roundNumber} 轮开始 ===`, 'system');
    }

    // Check round limit — force end game if exceeded
    const maxRounds = this.getMaxRounds();
    if (this.state.roundNumber > maxRounds) {
      this.log(`已达到回合上限 (${maxRounds} 轮)，触发强制结算`);
      this.forceEndGame();
      return;
    }

    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) return;

    // Check for skip turn
    if (currentPlayer.skipNextTurn) {
      currentPlayer.skipNextTurn = false;
      this.log(`跳过回合`, currentPlayer.id);
      this.nextTurn();
      return;
    }

    // Check hospital status
    if (currentPlayer.isInHospital) {
      this.log(`在校医院中，需要出院才能行动`, currentPlayer.id);
      return;
    }

    // Check ding status
    if (currentPlayer.isAtDing) {
      this.log(`在鼎中，暂停行动`, currentPlayer.id);
      currentPlayer.isAtDing = false;
      this.nextTurn();
      return;
    }

    // Process effects at turn start
    this.processEffectsAtTurnStart(currentPlayer.id);

    // DelayedEffectManager: process start-of-turn effects
    const triggeredEffects = this.delayedEffects.processStartOfTurn(this.state.turnNumber, currentPlayer.id);
    for (const effect of triggeredEffects) {
      this.log(`延迟效果触发: ${effect.type}`, currentPlayer.id);
    }

    // DelayedEffectManager: check action order reversal
    if (this.delayedEffects.hasReverseOrder()) {
      this.state.turnOrderReversed = !this.state.turnOrderReversed;
      this.log('行动顺序反转！', currentPlayer.id);
    }

    // StateTracker: record money snapshot at turn start for all players
    for (const p of this.state.players) {
      if (!p.isBankrupt) {
        this.stateTracker.recordMoneyChange(p.id, p.money);
      }
    }

    this.log(`回合 ${this.state.turnNumber} 开始`, currentPlayer.id);

    // DelayedEffectManager: check delayed gratification at end of turn advance
    const delayed = this.delayedEffects.getDelayedGratification(currentPlayer.id);
    if (delayed && !currentPlayer.isBankrupt) {
      const savedMoney = (delayed.data.savedMoney as number) || 0;
      this.modifyPlayerMoney(currentPlayer.id, savedMoney + 500);
      this.log(`延迟满足：恢复金钱 ${savedMoney} + 奖励 500`, currentPlayer.id);
      this.delayedEffects.resolve(delayed.id);
    }

    // DelayedEffectManager: cleanup resolved effects
    this.delayedEffects.cleanup();
  }

  /**
   * Get current player
   */
  getCurrentPlayer(): Player | undefined {
    return this.state.players[this.state.currentPlayerIndex];
  }

  // ============================================
  // Player Status
  // ============================================

  setPlayerHospitalStatus(playerId: string, inHospital: boolean): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    player.isInHospital = inHospital;
    if (inHospital) {
      player.hospitalVisits++;
      // StateTracker: record hospital visit
      this.stateTracker.recordHospitalVisit(playerId);
      this.log(`进入校医院`, playerId);
    } else {
      this.log(`离开校医院`, playerId);
    }
  }

  setPlayerDingStatus(playerId: string, atDing: boolean): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    player.isAtDing = atDing;
    this.log(atDing ? `进入鼎` : `离开鼎`, playerId);
  }

  // ============================================
  // Cell Event Execution
  // ============================================

  private executeCellEvent(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    if (player.position.type !== 'main') return;

    const cell = boardData.mainBoard[player.position.index];
    if (!cell) return;

    // StateTracker: record main cell visit
    this.stateTracker.recordMainCellVisit(playerId, cell.id || `main_${player.position.index}`);

    // Check how many times to execute the event (double event delayed effect)
    const doubleEvent = this.delayedEffects.hasDoubleEvent(playerId);
    const execCount = doubleEvent ? 2 : 1;

    for (let exec = 0; exec < execCount; exec++) {
      if (exec > 0) {
        this.log('双倍事件效果生效，再次执行格子事件', playerId);
      }

      switch (cell.type) {
        case 'corner':
          this.executeCornerEvent(playerId, cell.cornerType);
          break;

        case 'event':
          this.eventHandler.execute(`event_${cell.id}`, playerId);
          break;

        case 'chance':
          this.drawCard(playerId, Math.random() < 0.5 ? 'chance' : 'destiny');
          break;

        case 'line_entry':
          if (cell.forceEntry && cell.lineId) {
            this.enterLine(playerId, cell.lineId, false);
          } else if (cell.lineId) {
            // Ask player if they want to enter
            this.state.pendingAction = this.createPendingAction(
              playerId,
              'choose_option',
              `是否进入 ${boardData.lines[cell.lineId]?.name || cell.lineId}？`,
              [
                { label: `支付入场费 (${cell.entryFee || 0}) 进入`, value: 'enter' },
                { label: '不进入', value: 'skip' },
              ]
            );
          }
          break;
      }
    }

    // Check win conditions after cell event
    this.checkWinConditions(playerId);
  }

  private executeCornerEvent(playerId: string, cornerType?: string): void {
    switch (cornerType) {
      case 'start':
        this.eventHandler.execute('corner_start_stop', playerId);
        break;

      case 'hospital':
        this.eventHandler.execute('corner_hospital_enter', playerId);
        break;

      case 'ding':
        this.eventHandler.execute('corner_ding', playerId);
        break;

      case 'waiting_room':
        this.eventHandler.execute('corner_waiting_room', playerId);
        break;
    }
  }

  // ============================================
  // Win Condition Checking
  // ============================================

  checkWinConditions(playerId: string): boolean {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return false;

    // Base win condition: GPA*10 + exploration >= 60
    const baseScore = player.gpa * 10 + player.exploration;
    if (baseScore >= BASE_WIN_THRESHOLD) {
      this.declareWinner(playerId, `GPA*10+探索值达到 ${baseScore.toFixed(1)} >= ${BASE_WIN_THRESHOLD}`);
      return true;
    }

    // Check training plan win conditions
    for (const plan of player.confirmedPlans) {
      if (this.checkTrainingPlanWin(playerId, plan)) {
        return true;
      }
    }

    return false;
  }

  private checkTrainingPlanWin(playerId: string, planId: string): boolean {
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const plan = player.trainingPlans.find(p => p.id === planId);
    if (!plan || !plan.confirmed) return false;

    switch (planId) {
      case 'plan_shangxue':
        // 商学院：金钱达到5000
        if (player.money >= 5000) {
          this.declareWinner(playerId, '商学院：金钱达到5000');
          return true;
        }
        break;

      case 'plan_huaxue':
        // 化学化工学院：探索值达到45
        if (player.exploration >= 45) {
          this.declareWinner(playerId, '化学化工学院：探索值达到45');
          return true;
        }
        break;

      case 'plan_makesi':
        // 马克思主义学院：GPA达到4.5
        if (player.gpa >= 4.5) {
          this.declareWinner(playerId, '马克思主义学院：GPA达到4.5');
          return true;
        }
        break;

      case 'plan_faxue':
        // 法学院：场上出现破产玩家且不是你
        const hasOtherBankrupt = this.state.players.some(
          p => p.id !== playerId && p.isBankrupt
        );
        if (hasOtherBankrupt) {
          this.declareWinner(playerId, '法学院：场上出现破产玩家');
          return true;
        }
        break;

      case 'plan_rengong':
        // 人工智能学院：GPA比最低玩家高2.0
        const otherPlayers = this.state.players.filter(p => p.id !== playerId);
        if (otherPlayers.length > 0) {
          const lowestGpa = Math.min(...otherPlayers.map(p => p.gpa));
          if (player.gpa >= lowestGpa + 2.0) {
            this.declareWinner(playerId, '人工智能学院：GPA比最低玩家高2.0');
            return true;
          }
        }
        break;

      case 'plan_jisuanji':
        // 计算机科学与技术系：探索值和金钱数字只包含0或1
        const expStr = player.exploration.toString();
        const moneyStr = player.money.toString();
        const only01 = (str: string) => /^[01]+$/.test(str);
        if (only01(expStr) && only01(moneyStr)) {
          this.declareWinner(playerId, '计算机科学与技术系：探索值和金钱只包含0或1');
          return true;
        }
        break;

      case 'plan_wuli':
        // 物理学院：任选两项达到60 (探索值=GPA*10=金钱/100)
        const scores = [
          player.exploration,
          player.gpa * 10,
          player.money / 100
        ];
        let validPair = false;
        for (let i = 0; i < scores.length && !validPair; i++) {
          for (let j = i + 1; j < scores.length && !validPair; j++) {
            if (scores[i] >= 60 && scores[j] >= 60) {
              validPair = true;
            }
          }
        }
        if (validPair) {
          this.declareWinner(playerId, '物理学院：两项属性达到60');
          return true;
        }
        break;

      case 'plan_gongguan':
        // 工程管理学院：第二次金钱为0
        if (player.moneyZeroCount >= 2) {
          this.declareWinner(playerId, '工程管理学院：第二次金钱为0');
          return true;
        }
        break;

      case 'plan_yixue':
        // 医学院：进入医院三次
        if (player.hospitalVisits >= 3) {
          this.declareWinner(playerId, '医学院：进入医院三次');
          return true;
        }
        break;

      case 'plan_wenxue':
        // 文学院：3项属性均达到20
        const gpaScore = player.gpa * 10;
        const moneyScore = player.money / 100;
        if (gpaScore >= 20 && player.exploration >= 20 && moneyScore >= 20) {
          this.declareWinner(playerId, '文学院：3项属性均达到20');
          return true;
        }
        break;

      case 'plan_shehuixue':
        // 社会学院：探索值比最低玩家高20
        const othersForSocial = this.state.players.filter(p => p.id !== playerId);
        if (othersForSocial.length > 0) {
          const lowestExp = Math.min(...othersForSocial.map(p => p.exploration));
          if (player.exploration >= lowestExp + 20) {
            this.declareWinner(playerId, '社会学院：探索值比最低玩家高20');
            return true;
          }
        }
        break;

      case 'plan_zhengguan':
        // 政府管理学院：3项属性均不与任何其他玩家一致
        const othersForGov = this.state.players.filter(p => p.id !== playerId);
        const noMatch = othersForGov.every(p =>
          p.money !== player.money &&
          p.gpa !== player.gpa &&
          p.exploration !== player.exploration
        );
        if (noMatch && othersForGov.length > 0) {
          this.declareWinner(playerId, '政府管理学院：属性均与其他玩家不同');
          return true;
        }
        break;

      case 'plan_diqiu':
        // 地球科学与工程学院：进入过每一条线
        const allLines = ['pukou', 'study', 'money', 'suzhou', 'explore', 'gulou', 'xianlin', 'food'];
        const visitedAll = allLines.every(line => player.linesVisited.includes(line));
        if (visitedAll) {
          this.declareWinner(playerId, '地球科学与工程学院：进入过每一条线');
          return true;
        }
        break;

      case 'plan_dianzi':
        // 电子科学与工程学院：在科创赛事投到6获胜 (需要事件追踪)
        // 简化版：检查是否触发了科创赛事6
        if (player.lineEventsTriggered['main']?.includes(6)) {
          this.declareWinner(playerId, '电子科学与工程学院：科创赛事投到6');
          return true;
        }
        break;

      // 更多复杂条件需要追踪历史状态，这里添加简化版本
    }

    return false;
  }

  private declareWinner(playerId: string, condition: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    this.state.phase = 'finished';
    this.state.winner = playerId;

    this.log(`获胜！条件: ${condition}`, playerId);
  }

  // ============================================
  // Bankruptcy Check
  // ============================================

  private checkBankruptcy(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    // Check if player has any card that can prevent bankruptcy
    const negativeBalanceCard = player.heldCards.find(c => c.id === 'destiny_negative_balance');
    if (negativeBalanceCard) {
      // Use card to prevent bankruptcy
      this.removeCardFromPlayer(playerId, negativeBalanceCard.id);
      player.money = 0;
      this.log(`使用余额为负卡避免破产`, playerId);
      return;
    }

    // Software plan allows negative balance up to -1000
    const hasSoftwarePlan = player.confirmedPlans.includes('plan_ruanjian');
    if (hasSoftwarePlan && player.money >= -1000) {
      return;
    }

    if (player.money < 0) {
      player.isBankrupt = true;
      this.log(`破产！`, playerId);

      // Check if this triggers other players' win conditions (e.g., Law School plan)
      for (const p of this.state.players) {
        if (p.id !== playerId && p.confirmedPlans.includes('plan_faxue')) {
          this.declareWinner(p.id, '场上出现破产玩家（法学院）');
          return;
        }
      }
    }
  }

  // ============================================
  // Logging
  // ============================================

  log(message: string, playerId?: string): void {
    const entry: GameLogEntry = {
      turn: this.state.turnNumber,
      playerId: playerId || '',
      message,
      timestamp: Date.now(),
    };

    this.state.log.push(entry);

    // Also log to console for debugging
    const playerName = playerId ? this.getPlayer(playerId)?.name : 'System';
    console.log(`[GameEngine] [${playerName}] ${message}`);
  }

  // ============================================
  // Utility Methods
  // ============================================

  rollDice(count: number = 1): number[] {
    const results: number[] = [];
    for (let i = 0; i < count; i++) {
      results.push(Math.floor(Math.random() * 6) + 1);
    }

    const total = results.reduce((sum, val) => sum + val, 0);
    this.log(`投骰子: [${results.join(', ')}] = ${total}`);

    return results;
  }

  getPlayersByMoneyRank(): Player[] {
    return [...this.state.players]
      .filter(p => !p.isBankrupt)
      .sort((a, b) => b.money - a.money);
  }

  getPlayersByGpaRank(): Player[] {
    return [...this.state.players]
      .filter(p => !p.isBankrupt)
      .sort((a, b) => b.gpa - a.gpa);
  }

  getPlayersByExplorationRank(): Player[] {
    return [...this.state.players]
      .filter(p => !p.isBankrupt)
      .sort((a, b) => b.exploration - a.exploration);
  }

  // ============================================
  // Pending Action Creation
  // ============================================

  createPendingAction(
    playerId: string,
    type: PendingAction['type'],
    prompt: string,
    options?: { label: string; value: string }[],
    targetPlayerIds?: string[]
  ): PendingAction {
    return {
      id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      playerId,
      type,
      prompt,
      options,
      targetPlayerIds,
      timeoutMs: ACTION_TIMEOUT_MS,
    };
  }

  /**
   * Set a pending action for the current game state
   */
  setPendingAction(action: PendingAction | null): void {
    this.state.pendingAction = action;
  }

  /**
   * Clear current pending action
   */
  clearPendingAction(): void {
    this.state.pendingAction = null;
  }

  // ============================================
  // Game Flow Methods
  // ============================================

  /**
   * Start the game
   */
  startGame(): void {
    if (this.state.players.length < 2) {
      this.log('需要至少2名玩家才能开始游戏');
      return;
    }

    this.state.phase = 'setup_plans';
    this.state.turnNumber = 1;
    this.state.currentPlayerIndex = 0;

    // Deal initial training plans
    for (const player of this.state.players) {
      for (let i = 0; i < 3; i++) {
        this.drawTrainingPlan(player.id);
      }
    }

    this.log('游戏开始！');
    this.log('请选择培养计划');
  }

  /**
   * Confirm a training plan for a player
   */
  confirmTrainingPlan(playerId: string, planId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const plan = player.trainingPlans.find(p => p.id === planId);
    if (!plan) return;

    plan.confirmed = true;
    if (!player.confirmedPlans.includes(planId)) {
      player.confirmedPlans.push(planId);
    }

    // StateTracker: record plan confirmation
    this.stateTracker.recordPlanConfirm(playerId, this.state.turnNumber);

    this.log(`固定培养计划: ${plan.name}`, playerId);
  }

  /**
   * Handle player choice from pending action
   */
  handleChoice(playerId: string, choice: string): void {
    if (!this.state.pendingAction || this.state.pendingAction.playerId !== playerId) {
      return;
    }

    const handlerId = choice;
    const result = this.eventHandler.execute(handlerId, playerId, choice);

    if (result) {
      // Need more player input
      this.state.pendingAction = result;
    } else {
      // Action complete
      this.state.pendingAction = null;
    }
  }

  /**
   * Process a player's turn roll dice action
   */
  processTurnRoll(playerId: string): number[] {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return [];

    // Check if it's this player's turn
    if (this.state.players[this.state.currentPlayerIndex]?.id !== playerId) {
      return [];
    }

    let diceCount = player.diceCount;

    // Check delayed effect: double dice (always roll 2 dice)
    const hasDoubleDice = this.delayedEffects.hasDoubleDice(playerId);
    // Check delayed effect: double dice check (限量供应 — roll 2, if second > first then +2 exploration)
    const hasDoubleDiceCheck = this.delayedEffects.hasDoubleDiceCheck(playerId);

    if (hasDoubleDice || hasDoubleDiceCheck) {
      diceCount = 2;
    }

    const results = this.rollDice(diceCount);
    const total = results.reduce((sum, val) => sum + val, 0);

    // If double dice check is active and second die > first die, award +2 exploration
    if (hasDoubleDiceCheck && results.length >= 2 && results[1] > results[0]) {
      this.modifyPlayerExploration(playerId, 2);
      this.log('限量供应双骰：第二个骰子更大，探索值+2', playerId);
    }

    // Check delayed effect: reverse move
    let steps = total;
    if (this.delayedEffects.hasReverseMove(playerId)) {
      steps = -steps;
      this.log('反向移动效果生效，方向反转', playerId);
    }

    // Move player (forward or backward depending on reverse)
    if (steps >= 0) {
      this.movePlayerForward(playerId, steps);
    } else {
      this.movePlayerBackward(playerId, -steps);
    }

    return results;
  }

  /**
   * Get event handler (for external use)
   */
  getEventHandler(): EventHandler {
    return this.eventHandler;
  }

  /**
   * Get state tracker (for external use)
   */
  getStateTracker(): StateTracker {
    return this.stateTracker;
  }

  /**
   * Get plan abilities handler
   */
  getPlanAbilities(): PlanAbilityHandler {
    return this.planAbilities;
  }

  /**
   * Get card effect handler
   */
  getCardHandler(): CardEffectHandler {
    return this.cardHandler;
  }

  /**
   * Get delayed effects manager
   */
  getDelayedEffects(): DelayedEffectManager {
    return this.delayedEffects;
  }
}

export default GameEngine;
