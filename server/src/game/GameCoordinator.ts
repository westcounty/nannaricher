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
  MAX_TRAINING_PLANS,
  PLAN_CONFIRM_INTERVAL,
  BASE_WIN_THRESHOLD,
  SALARY_PASS,
  SALARY_STOP,
} from '@nannaricher/shared';
import { GameEngine } from './GameEngine.js';
import { boardData, MAIN_BOARD_SIZE } from '../data/board.js';
import type { GameServer } from '../socket/types.js';

/**
 * GameCoordinator — orchestrates game flow for a single room.
 * Owns a GameEngine instance and handles all game events
 * that require IO broadcasting.
 */
export class GameCoordinator {
  private engine: GameEngine;
  private io: GameServer;
  private roomId: string;

  constructor(engine: GameEngine, io: GameServer, roomId: string) {
    this.engine = engine;
    this.io = io;
    this.roomId = roomId;
  }

  // --------------------------------------------------
  // Accessors
  // --------------------------------------------------

  getState(): GameState {
    return this.engine.getState();
  }

  getEngine(): GameEngine {
    return this.engine;
  }

  // --------------------------------------------------
  // Broadcasting
  // --------------------------------------------------

  broadcastState(): void {
    const state = this.engine.getState();
    this.io.to(this.roomId).emit('game:state-update', state);
  }

  // --------------------------------------------------
  // Utility
  // --------------------------------------------------

  private addLog(playerId: string, message: string): void {
    const state = this.engine.getState();
    state.log.push({
      turn: state.turnNumber,
      playerId,
      message,
      timestamp: Date.now(),
    });
  }

  // --------------------------------------------------
  // Turn Management
  // --------------------------------------------------

  advanceTurn(): void {
    const state = this.engine.getState();

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
        // Decrement effect turns
        nextPlayer.effects = nextPlayer.effects.filter(e => {
          if (e.type === 'skip_turn') {
            e.turnsRemaining--;
            return e.turnsRemaining > 0;
          }
          return true;
        });
        continue;
      }

      break;
    } while (attempts < state.players.length);

    state.currentPlayerIndex = nextIndex;

    // Increment turn number when back to first player
    if (nextIndex === 0) {
      state.turnNumber++;
    }

    // Set pending action for next player
    const currentPlayer = state.players[state.currentPlayerIndex];
    state.pendingAction = {
      id: `roll_dice_${Date.now()}`,
      playerId: currentPlayer.id,
      type: 'roll_dice',
      prompt: '请投骰子',
      timeoutMs: 60000,
    };

    // Decrement all effect turns
    state.players.forEach(player => {
      player.effects = player.effects.filter(e => {
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

      // Check base win condition: GPA*10 + exploration >= 60
      const baseScore = player.gpa * 10 + player.exploration;
      if (baseScore >= BASE_WIN_THRESHOLD) {
        return {
          winnerId: player.id,
          condition: `GPA×10+探索值达到 ${baseScore.toFixed(1)} ≥ ${BASE_WIN_THRESHOLD}`,
        };
      }

      // Check each confirmed training plan's win condition
      for (const planId of player.confirmedPlans) {
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
    switch (planId) {
      case 'plan_shangxue':
        if (player.money >= 5000) return '金钱达到5000';
        break;
      case 'plan_huaxue':
        if (player.exploration >= 45) return '探索值达到45';
        break;
      case 'plan_makesi':
        if (player.gpa >= 4.5) return 'GPA达到4.5';
        break;
      case 'plan_jisuanji':
        if (player.gpa >= 4.0 && player.exploration >= 30) return 'GPA≥4.0且探索值≥30';
        break;
      case 'plan_wenxue':
        if (player.gpa >= 3.5 && player.exploration >= 35) return 'GPA≥3.5且探索值≥35';
        break;
      case 'plan_dianzi':
        if (player.money >= 4000 && player.gpa >= 3.5) return '金钱≥4000且GPA≥3.5';
        break;
      case 'plan_shuxue':
        if (player.gpa >= 4.2 && player.money >= 2000) return 'GPA≥4.2且金钱≥2000';
        break;
      case 'plan_wuli':
        if (player.exploration >= 40 && player.gpa >= 3.8) return '探索值≥40且GPA≥3.8';
        break;
      case 'plan_dili':
        if (player.linesVisited.length >= 4) return `游览${player.linesVisited.length}条线路`;
        break;
      case 'plan_lishi':
        if (player.exploration >= 30 && player.heldCards.length >= 5) return '探索值≥30且持有5张卡';
        break;
      case 'plan_zhexue': {
        const gpaChange = Math.abs(player.gpa - 3.0);
        if (gpaChange <= 0.5 && player.exploration >= 20) return 'GPA稳定且探索值≥20';
        break;
      }
      case 'plan_xinwen': {
        const minExploration = Math.min(...state.players.map(p => p.exploration));
        if (player.exploration >= minExploration + 20) return `探索值比最低玩家高20 (${player.exploration} vs ${minExploration})`;
        break;
      }
      case 'plan_shehui': {
        const minExp = Math.min(...state.players.map(p => p.exploration));
        if (player.exploration >= minExp + 20) return `探索值比最低玩家高20 (${player.exploration} vs ${minExp})`;
        break;
      }
      case 'plan_faxue':
        if (player.money >= 3000 && player.exploration >= 25) return '金钱≥3000且探索值≥25';
        break;
      case 'plan_xinli': {
        const avgGpa = state.players.reduce((sum, p) => sum + p.gpa, 0) / state.players.length;
        const gpaDiff = Math.abs(player.gpa - avgGpa);
        if (gpaDiff <= 0.3) return 'GPA最接近全场平均值';
        break;
      }
      case 'plan_yishu':
        if (player.exploration >= 35 && player.heldCards.length >= 3) return '探索值≥35且持有3张卡';
        break;
      case 'plan_waiyu':
        if (player.gpa >= 3.8 && player.exploration >= 25 && player.money >= 2500) return 'GPA≥3.8,探索值≥25,金钱≥2500';
        break;
      case 'plan_tiayu':
        if (player.exploration >= 30 && player.gpa >= 3.0) return '探索值≥30且GPA≥3.0';
        break;
      case 'plan_huanjing':
        if (player.exploration >= 35 && player.linesVisited.length >= 3) return '探索值≥35且游览3条线路';
        break;
      case 'plan_yixue':
        if (player.gpa >= 4.3 && player.money >= 1500) return 'GPA≥4.3且金钱≥1500';
        break;
      case 'plan_jianzhu':
        if (player.exploration >= 30 && player.money >= 3000) return '探索值≥30且金钱≥3000';
        break;
      default:
        break;
    }
    return null;
  }

  /**
   * Resolve multi-vote card effects based on card type and player votes.
   */
  private resolveMultiVoteCard(
    cardId: string,
    groups: Record<string, string[]>,
    counts: Record<string, number>,
  ): void {
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
        const dice = this.engine.rollDice(1)[0];
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
        const dice = this.engine.rollDice(1)[0];
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
        const dice = this.engine.rollDice(1)[0];
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
        // 出行方式 — majority decides (simplified)
        const shared = counts['shared'] || 0;
        const walk = counts['walk'] || 0;
        if (shared > walk) {
          for (const pid of groups['walk'] || []) this.engine.modifyPlayerExploration(pid, 2);
          for (const pid of groups['shared'] || []) this.engine.modifyPlayerMoney(pid, -100);
          this.addLog('system', '出行方式：供不应求，丈量校园探索+2，共享出行金钱-100');
        } else if (walk > shared) {
          for (const pid of groups['shared'] || []) this.engine.modifyPlayerGpa(pid, 0.2);
          for (const pid of groups['walk'] || []) this.engine.modifyPlayerExploration(pid, -1);
          this.addLog('system', '出行方式：抢占先机，共享出行GPA+0.2，丈量校园探索-1');
        } else {
          this.engine.getAllPlayers().forEach(p => {
            this.engine.modifyPlayerGpa(p.id, 0.1);
            this.engine.modifyPlayerExploration(p.id, 1);
          });
          this.addLog('system', '出行方式：井然有序，所有玩家GPA+0.1, 探索值+1');
        }
        break;
      }
      default: {
        // Fallback for unknown card types — just log
        this.addLog('system', `投票完成`);
        break;
      }
    }
  }

  /**
   * Check win condition and emit player-won if someone won. Returns true if game ended.
   */
  private checkAndEmitWin(): boolean {
    const state = this.engine.getState();
    const { winnerId, condition } = this.checkWinCondition();
    if (winnerId) {
      const winner = state.players.find(p => p.id === winnerId);
      state.winner = winnerId;
      state.phase = 'finished';
      this.io.to(this.roomId).emit('game:player-won', {
        playerId: winnerId,
        playerName: winner?.name || 'Unknown',
        condition: condition || 'Unknown condition',
      });
      this.broadcastState();
      return true;
    }
    return false;
  }

  // --------------------------------------------------
  // Cell Landing
  // --------------------------------------------------

  handleCellLanding(playerId: string, position: Position): void {
    const state = this.engine.getState();

    if (position.type === 'main') {
      const cell = boardData.mainBoard[position.index];
      if (!cell) return;

      let handlerId: string | null = null;

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
          break;
        case 'event':
          handlerId = `event_${cell.id}`;
          break;
        case 'chance': {
          // Draw one card: randomly chance or destiny
          const cardType = Math.random() < 0.5 ? 'chance' : 'destiny';
          const card = this.engine.drawCard(playerId, cardType);
          if (card) {
            if (card.holdable) {
              this.engine.addCardToPlayer(playerId, card);
              this.addLog(playerId, `${this.engine.getPlayer(playerId)?.name} 抽到${cardType === 'chance' ? '机会' : '命运'}卡: ${card.name}`);
            } else {
              // Execute card effect immediately
              const cardPendingAction = this.engine.getEventHandler().execute(`card_${card.id}`, playerId);

              // Return to discard pile if needed
              if (card.returnToDeck) {
                state.discardPiles[cardType].push(card);
              }

              if (cardPendingAction) {
                state.pendingAction = cardPendingAction;
                this.broadcastState();
                this.io.to(this.roomId).emit('game:event-trigger', {
                  title: cardType === 'chance' ? '机会卡' : '命运卡',
                  description: cardPendingAction.prompt,
                  pendingAction: cardPendingAction,
                });
                return; // Wait for player action
              }
            }
          }
          // Card effect completed, advance turn
          this.broadcastState();
          if (state.phase === 'playing') {
            if (this.checkAndEmitWin()) return;
            this.advanceTurn();
          }
          return;
        }
        case 'line_entry': {
          // Ask player if they want to enter the line
          state.pendingAction = {
            id: `line_entry_${Date.now()}`,
            playerId,
            type: 'choose_option',
            prompt: cell.forceEntry
              ? `必须进入 ${cell.name}`
              : `是否支付 ${cell.entryFee} 金钱进入 ${cell.name}？`,
            options: cell.forceEntry
              ? [{ label: '进入', value: `enter_${cell.lineId}` }]
              : [
                  { label: `支付 ${cell.entryFee} 进入`, value: `enter_${cell.lineId}` },
                  { label: '不进入', value: 'skip' },
                ],
            timeoutMs: 30000,
          };
          this.broadcastState();
          return;
        }
      }

      if (handlerId) {
        const pendingAction = this.engine.getEventHandler().execute(handlerId, playerId);
        if (pendingAction) {
          state.pendingAction = pendingAction;
          this.broadcastState();

          // Trigger event for client
          this.io.to(this.roomId).emit('game:event-trigger', {
            title: '事件触发',
            description: pendingAction.prompt,
            pendingAction,
          });
        } else {
          // Event completed automatically, advance turn
          this.broadcastState();
          if (state.phase === 'playing') {
            if (this.checkAndEmitWin()) return;
            this.advanceTurn();
          }
        }
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
          const pendingAction = this.engine.getEventHandler().execute(cell.handlerId, playerId);
          if (pendingAction) {
            state.pendingAction = pendingAction;
            this.broadcastState();
          } else {
            // Line event completed automatically, advance turn
            this.broadcastState();
            if (state.phase === 'playing') {
              if (this.checkAndEmitWin()) return;
              this.advanceTurn();
            }
          }
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
    const state = this.engine.getState();
    if (state.phase !== 'playing') return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return;

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
      } else {
        this.addLog(playerId, `${currentPlayer.name} 投出 ${total}，未能出院`);
        this.advanceTurn();
        return;
      }

      this.broadcastState();
      return;
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

    // Normal dice roll
    const diceCount = currentPlayer.diceCount;
    const values = this.engine.rollDice(diceCount);
    const total = values.reduce((a, b) => a + b, 0);

    this.io.to(this.roomId).emit('game:dice-result', {
      playerId,
      values,
      total,
    });

    this.addLog(playerId, `${currentPlayer.name} 投出了 ${values.join('+')}=${total}`);

    // Move player
    this.engine.movePlayerForward(playerId, total);

    // Handle landing
    this.handleCellLanding(playerId, currentPlayer.position);
  }

  handleChooseAction(playerId: string, actionId: string, choice: string): void {
    const state = this.engine.getState();
    if (!state.pendingAction) return;

    // Verify it's this player's action
    if (state.pendingAction.playerId !== playerId && state.pendingAction.playerId !== 'all') {
      return;
    }

    const pendingActionId = state.pendingAction.id;

    // Handle based on pending action type
    if (state.pendingAction.type === 'choose_option') {
      let pendingAction: import('@nannaricher/shared').PendingAction | null = null;

      // Handle line entry choices inline (enter_* patterns)
      if (choice.startsWith('enter_')) {
        const lineId = choice.replace('enter_', '');
        const line = boardData.lines[lineId];
        if (line) {
          this.engine.enterLine(playerId, lineId, !line.forceEntry);
          this.addLog(playerId, `${this.engine.getPlayer(playerId)?.name} 进入 ${line.name}`);
        }
      } else if (state.pendingAction.callbackHandler) {
        // Use callbackHandler: pass choice as the third parameter
        pendingAction = this.engine.getEventHandler().execute(
          state.pendingAction.callbackHandler, playerId, choice
        );
      } else {
        // Default: choice is the handler ID
        pendingAction = this.engine.getEventHandler().execute(choice, playerId);
      }

      if (pendingAction) {
        state.pendingAction = pendingAction;
        this.broadcastState();
      } else {
        // Action completed, advance turn if in playing phase
        state.pendingAction = null;
        if (state.phase === 'playing') {
          if (this.checkAndEmitWin()) return;
          this.advanceTurn();
        } else {
          this.broadcastState();
        }
      }
    } else if (state.pendingAction.type === 'choose_player') {
      // Target player selected
      if (state.pendingAction.targetPlayerIds?.includes(choice)) {
        const handlerId = `${pendingActionId}_${choice}`;
        this.engine.getEventHandler().execute(handlerId, playerId);
        state.pendingAction = null;
        this.broadcastState();
      }
    } else if (state.pendingAction.type === 'choose_line') {
      // Line selected for entry
      if (choice.startsWith('enter_')) {
        const lineId = choice.replace('enter_', '');
        const line = boardData.lines[lineId];
        if (line) {
          this.engine.enterLine(playerId, lineId, !line.forceEntry);
          this.addLog(playerId, `${this.engine.getPlayer(playerId)?.name} 进入 ${line.name}`);
        }
      }
      state.pendingAction = null;
      this.advanceTurn();
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

        if (cardId) {
          this.resolveMultiVoteCard(cardId, groups, counts);
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
            this.engine.getEventHandler().execute(`chain_${cardId}_end_${continueCount}`, playerId);
          }

          state.pendingAction = null;
          this.broadcastState();
          this.advanceTurn();
        }
      }
    }
  }

  handleUseCard(playerId: string, cardId: string, targetPlayerId?: string): void {
    const state = this.engine.getState();

    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const card = player.heldCards.find(c => c.id === cardId);
    if (!card) return;

    // Execute card effects
    card.effects.forEach(effect => {
      let targetId = playerId;

      if (effect.target && effect.target !== 'self') {
        switch (effect.target) {
          case 'choose_player':
            if (targetPlayerId) targetId = targetPlayerId;
            break;
          case 'all':
            state.players.forEach(p => {
              if (p.id !== playerId) {
                if (effect.stat === 'money' && effect.delta) {
                  this.engine.modifyPlayerMoney(p.id, effect.delta);
                }
                if (effect.stat === 'gpa' && effect.delta) {
                  this.engine.modifyPlayerGpa(p.id, effect.delta);
                }
                if (effect.stat === 'exploration' && effect.delta) {
                  this.engine.modifyPlayerExploration(p.id, effect.delta);
                }
              }
            });
            return;
          case 'richest':
            targetId = this.engine.getPlayersByMoneyRank()[0]?.id || playerId;
            break;
          case 'poorest':
            targetId = this.engine.getPlayersByMoneyRank()[this.engine.getAllPlayers().length - 1]?.id || playerId;
            break;
          case 'highest_gpa':
            targetId = this.engine.getPlayersByGpaRank()[0]?.id || playerId;
            break;
          case 'lowest_gpa':
            targetId = this.engine.getPlayersByGpaRank()[this.engine.getAllPlayers().length - 1]?.id || playerId;
            break;
        }
      }

      if (effect.stat && effect.delta) {
        if (effect.stat === 'money') this.engine.modifyPlayerMoney(targetId, effect.delta);
        if (effect.stat === 'gpa') this.engine.modifyPlayerGpa(targetId, effect.delta);
        if (effect.stat === 'exploration') this.engine.modifyPlayerExploration(targetId, effect.delta);
      }
    });

    this.addLog(playerId, `${player.name} 使用了 ${card.name}`);
    player.heldCards = player.heldCards.filter(c => c.id !== cardId);

    if (card.returnToDeck) {
      if (card.deckType === 'chance') {
        state.discardPiles.chance.push(card);
      } else {
        state.discardPiles.destiny.push(card);
      }
    }

    this.broadcastState();
  }

  handleConfirmPlan(playerId: string, planId: string): { error?: string } {
    const state = this.engine.getState();

    const player = state.players.find(p => p.id === playerId);
    if (!player) return { error: 'Player not found' };

    const plan = player.trainingPlans.find(p => p.id === planId);
    if (!plan) return { error: 'Plan not found' };

    // Check if can confirm (max 2 plans)
    if (player.confirmedPlans.length >= MAX_TRAINING_PLANS) {
      return { error: '已达到最大确认计划数' };
    }

    // Check if it's the right turn interval (every 6 turns)
    if (state.turnNumber % PLAN_CONFIRM_INTERVAL !== 0 && state.phase === 'playing') {
      return { error: `只能在第 ${PLAN_CONFIRM_INTERVAL} 的倍数回合确认计划` };
    }

    plan.confirmed = true;
    if (!player.confirmedPlans.includes(plan.id)) {
      player.confirmedPlans.push(plan.id);
    }

    this.addLog(playerId, `${player.name} 确认了培养计划: ${plan.name}`);

    // Check if all players have confirmed plans in setup phase
    if (state.phase === 'setup_plans') {
      const allPlayersHavePlans = state.players.every(
        p => p.trainingPlans.length > 0 && p.trainingPlans.some(tp => tp.confirmed)
      );

      if (allPlayersHavePlans) {
        // Remove unconfirmed plans for all players after setup phase ends
        state.players.forEach(p => {
          p.trainingPlans = p.trainingPlans.filter(tp => tp.confirmed);
        });

        state.phase = 'playing';
        state.pendingAction = {
          id: `roll_dice_${Date.now()}`,
          playerId: state.players[0].id,
          type: 'roll_dice',
          prompt: '请投骰子',
          timeoutMs: 60000,
        };

        this.io.to(this.roomId).emit('game:announcement', {
          message: '所有玩家已确认培养计划，游戏正式开始！',
          type: 'success',
        });
      }
    } else {
      // In playing phase, remove unconfirmed plans immediately after confirming one
      // (this is for the every-6-turns plan confirmation during gameplay)
      player.trainingPlans = player.trainingPlans.filter(p =>
        p.confirmed || p.id === planId
      );
    }

    this.broadcastState();

    // Check win condition
    const { winnerId, condition } = this.checkWinCondition();
    if (winnerId) {
      const winner = state.players.find(p => p.id === winnerId);
      state.winner = winnerId;
      state.phase = 'finished';
      this.io.to(this.roomId).emit('game:player-won', {
        playerId: winnerId,
        playerName: winner?.name || 'Unknown',
        condition: condition || 'Unknown condition',
      });
    }

    return {};
  }

  // --------------------------------------------------
  // Setup Phase
  // --------------------------------------------------

  handleSetupDrawTrainingPlans(): void {
    const state = this.engine.getState();
    console.log(`[handleSetupDrawTrainingPlans] roomId: ${this.roomId}, state exists: true, phase: ${state.phase}`);
    console.log(`[handleSetupDrawTrainingPlans] players count: ${state.players.length}, training deck count: ${state.cardDecks.training.length}`);

    if (state.phase !== 'setup_plans') return;

    state.players.forEach(player => {
      const drawnPlans: TrainingPlan[] = [];
      for (let i = 0; i < INITIAL_TRAINING_DRAW; i++) {
        const plan = state.cardDecks.training.pop();
        if (plan) drawnPlans.push(plan);
      }
      player.trainingPlans = drawnPlans;
      console.log(`[handleSetupDrawTrainingPlans] Player ${player.name} drew ${drawnPlans.length} plans:`, drawnPlans.map(p => p.name));
    });

    state.pendingAction = {
      id: `setup_choose_plans_${Date.now()}`,
      type: 'draw_training_plan',
      playerId: 'all',
      prompt: '选择1-2项培养计划保留',
      options: [],
      timeoutMs: 120000,
    };

    this.broadcastState();
  }
}
