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
import { GameLogger } from './GameLogger.js';
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
  private logger: GameLogger;
  private processingAction = false;
  private onFinishedCallback: (() => void) | null = null;

  constructor(engine: GameEngine, io: GameServer, roomId: string) {
    this.engine = engine;
    this.io = io;
    this.roomId = roomId;
    this.logger = new GameLogger(roomId);

    // Wire up dice broadcast so event handlers can emit dice results
    this.engine.setDiceResultCallback((pid, vals, total) => {
      this.io.to(this.roomId).emit('game:dice-result', { playerId: pid, values: vals, total });
    });

    // Wire up resource change broadcast for prominent stat change notifications
    this.engine.setResourceChangeCallback((data) => {
      this.io.to(this.roomId).emit('game:resource-change', data);
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
      return;
    }

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
    this.logger.log({ turn: state.turnNumber, playerId, type: 'system', message });
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
        continue;
      }

      break;
    } while (attempts < state.players.length);

    state.currentPlayerIndex = nextIndex;

    // Increment turn number when back to first player
    if (nextIndex === 0) {
      state.turnNumber++;
    }

    // Check if this is a plan confirmation round (every 6 turns)
    if (nextIndex === 0 && state.turnNumber > 0 && state.turnNumber % PLAN_CONFIRM_INTERVAL === 0) {
      // Find players with unconfirmed training plans (check delayPlanConfirm effect)
      const playersWithPlans = state.players.filter(p => {
        if (p.isBankrupt || p.isDisconnected) return false;
        if (p.trainingPlans.length === 0 || p.confirmedPlans.length >= MAX_TRAINING_PLANS) return false;
        // Check delayPlanConfirm effect (大类招生)
        const delayIdx = p.effects.findIndex(e => e.type === 'custom' && e.data?.delayPlanConfirm);
        if (delayIdx >= 0) {
          p.effects.splice(delayIdx, 1);
          return false;
        }
        return true;
      });

      if (playersWithPlans.length > 0) {
        this.addLog('system', `第 ${Math.floor(state.turnNumber / PLAN_CONFIRM_INTERVAL)} 轮升学阶段！可以确认培养方案`);
        this.io.to(this.roomId).emit('game:announcement', {
          message: `升学阶段开始！第 ${Math.floor(state.turnNumber / PLAN_CONFIRM_INTERVAL)} 轮`,
          type: 'info' as const,
        });

        // Start confirmation chain: first eligible player
        this.startPlanConfirmationForPlayer(playersWithPlans, 0);
        return; // Don't proceed to normal roll yet
      }
    }

    // Clear disabledCells at start of each turn (化学化工学院 lasts one round)
    state.disabledCells = [];

    // Set pending action for next player
    const currentPlayer = state.players[state.currentPlayerIndex];

    // --- PlanAbilities: on_turn_start check ---
    const planAbilities = this.engine.getPlanAbilities();
    const turnAbility = planAbilities.checkAbilities(currentPlayer, state, 'on_turn_start');
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
        // Simplified: choose a main board cell to disable for this round
        const mainCells = boardData.mainBoard
          .filter(c => c.type === 'event' || c.type === 'chance' || c.type === 'line_entry')
          .slice(0, 12) // Limit options to keep UI manageable
          .map(c => ({ label: `禁用: ${c.name}`, value: `disable_${c.id}` }));
        mainCells.push({ label: '不禁用', value: 'huaxue_skip' });

        state.pendingAction = {
          id: `huaxue_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'choose_option',
          prompt: '化学化工学院能力：选择一个格子使其本回合失效',
          options: mainCells,
          callbackHandler: 'plan_huaxue_choice',
          timeoutMs: 15000,
        };
        if (!this.engine.getEventHandler().hasHandler('plan_huaxue_choice')) {
          this.engine.getEventHandler().registerHandler('plan_huaxue_choice', (eng, pid, choice) => {
            if (choice && choice.startsWith('disable_')) {
              const cellId = choice.replace('disable_', '');
              const st = eng.getState();
              if (!st.disabledCells) st.disabledCells = [];
              st.disabledCells.push(cellId);
              eng.log(`化学化工学院：禁用了格子 ${cellId}`, pid);
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
      for (const planId of player.confirmedPlans) {
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
      case 'plan_shangxue':  // 商学院：金钱达到5000
        if (player.money >= 5000) return '金钱达到5000';
        break;
      case 'plan_huaxue':    // 化学化工学院：探索值达到45
        if (player.exploration >= 45) return '探索值达到45';
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
      case 'plan_zhexue': {  // 哲学系：完整进出某条线且探索值和GPA无变化
        if (history) {
          for (const exit of history.lineExits) {
            if (Math.abs(exit.gpaBefore - exit.gpaAfter) < 0.01 &&
                Math.abs(exit.explorationBefore - exit.explorationAfter) < 0.01) {
              return `完整进出${exit.lineId}线，探索值和GPA无变化`;
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
      case 'plan_zhengguan': {  // 政府管理学院：探索值、GPA、金钱均不与其他玩家一致
        const others = state.players.filter(p => p.id !== player.id && !p.isBankrupt);
        const allUnique = others.every(p =>
          p.exploration !== player.exploration &&
          Math.abs(p.gpa - player.gpa) >= 0.01 &&
          p.money !== player.money
        );
        if (allUnique && others.length > 0) return '探索值、GPA、金钱均与其他玩家不同';
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
      case 'plan_xinxiguanli':  // 信息管理学院：抽到过5个不重复的数字开头卡
        if (player.cardsDrawnWithDigitStart.length >= 5) {
          return `抽到${player.cardsDrawnWithDigitStart.length}张数字开头卡`;
        }
        break;
      case 'plan_shehuixue': {  // 社会学院：探索值比最低玩家高20（或经修改后高15）
        const threshold = player.modifiedWinThresholds['plan_shehuixue'] ?? 20;
        const minExp = Math.min(...state.players.filter(p => !p.isBankrupt).map(p => p.exploration));
        if (player.exploration >= minExp + threshold) {
          return `探索值比最低玩家高${threshold} (${player.exploration} vs ${minExp})`;
        }
        break;
      }
      case 'plan_shuxue':   // 数学系：第三次到达鼓楼校区线终点
        if (player.gulou_endpoint_count >= 3) return `第${player.gulou_endpoint_count}次到达鼓楼线终点`;
        break;
      case 'plan_wuli': {   // 物理学院：任选两项指标之和>=90
        const moneyScore = player.money / 100;
        const gpaScore = player.gpa * 10;
        const expScore = player.exploration;
        if (gpaScore + expScore >= 90 || gpaScore + moneyScore >= 90 || expScore + moneyScore >= 90) {
          return `任意两项指标之和≥90 (GPA×10=${gpaScore.toFixed(0)}, 探索=${expScore}, 金钱/100=${moneyScore.toFixed(0)})`;
        }
        break;
      }
      case 'plan_tianwen': { // 天文与空间科学学院：和每个其他玩家同格停留过
        if (history) {
          const otherIds = state.players.filter(p => p.id !== player.id && !p.isBankrupt).map(p => p.id);
          const allShared = otherIds.every(pid =>
            history.sharedCellsWith[pid] && history.sharedCellsWith[pid].length > 0
          );
          if (allShared && otherIds.length > 0) return '与每位其他玩家同格停留过';
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
      case 'plan_huanjing': { // 环境学院：经历过仙林校区线每个事件
        const xianlinEvents = player.lineEventsTriggered['xianlin'] || [];
        // 仙林线有8个事件格(index 0-7)
        if (xianlinEvents.length >= 8) return '经历过仙林线每个事件';
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
      case 'plan_daqi': {    // 大气科学学院：20回合内金钱始终不为唯一最多
        if (history && state.turnNumber >= 20) {
          const moneyHist = history.moneyHistory;
          if (moneyHist.length >= 20) {
            let neverRichest = true;
            // 简化检查：当前金钱不是唯一最高
            const maxMoney = Math.max(...state.players.filter(p => !p.isBankrupt).map(p => p.money));
            const playersWithMax = state.players.filter(p => !p.isBankrupt && p.money === maxMoney);
            if (player.money === maxMoney && playersWithMax.length === 1) {
              neverRichest = false;
            }
            if (neverRichest) return '20回合内金钱始终不为唯一最多';
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
      case 'plan_gongguan':  // 工程管理学院：第二次金钱数为0
        if (player.moneyZeroCount >= 2) return `第${player.moneyZeroCount}次金钱为0`;
        break;
      case 'plan_kuangyaming': { // 匡亚明学院：满足任意玩家的已固定培养计划
        for (const other of state.players) {
          if (other.id === player.id) continue;
          for (const otherPlanId of other.confirmedPlans) {
            const result = this.checkPlanWinCondition(player, otherPlanId, state);
            if (result) return `满足${other.name}的${otherPlanId}条件: ${result}`;
          }
        }
        break;
      }
      case 'plan_haiwai':    // 海外教育学院：有玩家获胜时，若你对其使用过至少两次机会卡
        // 此条件在胜利判定时特殊处理（检查winner时对比）
        break;
      case 'plan_jianzhu': { // 建筑与城市规划学院：经历过起点、校医院、鼎、候车厅和闯门
        if (history) {
          const visited = history.mainCellVisited;
          const required = ['corner_start', 'corner_hospital', 'corner_ding', 'corner_waiting_room', 'event_chuang_men'];
          // 也检查position index对应的格子名
          const requiredIndices = [0, 7, 14, 21]; // 起点、校医院、鼎、候车厅
          const visitedIndices = new Set(visited);
          const hasCorners = requiredIndices.every(i => visitedIndices.has(`main_${i}`));
          const hasChuangMen = visited.some(v => v.includes('chuang_men'));
          if (hasCorners && hasChuangMen) return '经历过起点、校医院、鼎、候车厅和闯门';
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
      let finalWinnerId = winnerId;
      let finalCondition = condition;

      // 海外教育学院拦截：对获胜者使用过≥2次机会卡的玩家优先获胜
      for (const p of state.players) {
        if (p.id === winnerId || p.isBankrupt || p.isDisconnected) continue;
        if (!p.confirmedPlans.includes('plan_haiwai')) continue;
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
          for (const planId of p.confirmedPlans) {
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
  // Plan Confirmation Chain (升学阶段)
  // --------------------------------------------------

  /**
   * Start plan confirmation for a specific player in the eligible list.
   * After this player finishes, chain to the next player.
   */
  private startPlanConfirmationForPlayer(eligiblePlayers: Player[], playerIdx: number): void {
    const state = this.engine.getState();

    if (playerIdx >= eligiblePlayers.length) {
      // All players done confirming — resume normal turn
      const currentPlayer = state.players[state.currentPlayerIndex];
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
    const unconfirmedPlans = player.trainingPlans
      .filter(p => !player.confirmedPlans.includes(p.id));

    if (unconfirmedPlans.length === 0 || player.confirmedPlans.length >= MAX_TRAINING_PLANS) {
      // This player has nothing to confirm, skip to next
      this.startPlanConfirmationForPlayer(eligiblePlayers, playerIdx + 1);
      return;
    }

    // Store the eligible list + index for chaining
    const confirmContext = { eligiblePlayers, playerIdx };

    state.pendingAction = {
      id: `plan_confirm_${Date.now()}`,
      playerId: player.id,
      type: 'choose_option',
      prompt: `升学阶段：${player.name}，是否确认一个培养方案？(已确认 ${player.confirmedPlans.length}/${MAX_TRAINING_PLANS})`,
      options: [
        ...unconfirmedPlans.map(p => ({ label: `确认: ${p.name}`, value: `confirm_plan_${p.id}` })),
        { label: '跳过', value: 'skip_plan_confirm' },
      ],
      callbackHandler: 'plan_confirmation_handler',
      timeoutMs: 60000,
    };

    // Register the handler (closure captures confirmContext)
    // Always overwrite to use the latest context
    this.engine.getEventHandler().registerHandler('plan_confirmation_handler', (eng, pid, choice) => {
      if (choice && choice.startsWith('confirm_plan_')) {
        const planId = choice.replace('confirm_plan_', '');
        // Call handleConfirmPlan to trigger all on_confirm effects
        this.handleConfirmPlan(pid, planId);

        // Check for post-confirm pending actions (shehuixue, rengong, xiandai, daqi)
        const confirmedPlayer = eng.getPlayer(pid);
        if (confirmedPlayer) {
          const postAction = this.createPostConfirmAction(confirmedPlayer, pid);
          if (postAction) {
            // Chain: post-confirm action → general move → next player
            this.pendingConfirmContext = { ...confirmContext, needsGeneralMove: true };
            return postAction;
          }
        }

        // No post-confirm action needed, check slot overflow then general move
        this.checkWinConditionSlotOverflow(pid, () => {
          this.offerGeneralMoveOption(pid, confirmContext);
        });
        return null;
      }
      // Skipped — move to next player
      this.startPlanConfirmationForPlayer(confirmContext.eligiblePlayers, confirmContext.playerIdx + 1);
      return null;
    });

    this.broadcastState();
  }

  /** Storage for confirmation chain context across async actions */
  private pendingConfirmContext: {
    eligiblePlayers: Player[];
    playerIdx: number;
    needsGeneralMove?: boolean;
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
              this.engine.getEventHandler().execute(handlerId, targetId);
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
                this.engine.getEventHandler().execute(`card_${picked.card.id}`, pid);
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
   * Continue the post-confirm chain: check for more post-actions, then general move, then next player.
   */
  private continuePostConfirmChain(playerId: string): void {
    const player = this.engine.getPlayer(playerId);
    if (!player || !this.pendingConfirmContext) {
      return;
    }

    // Check if there are more post-confirm actions for this player
    const nextAction = this.createPostConfirmAction(player, playerId);
    if (nextAction) {
      const state = this.engine.getState();
      state.pendingAction = nextAction;
      this.broadcastState();
      return;
    }

    // All post-confirm actions done, check overflow then offer general move
    if (this.pendingConfirmContext.needsGeneralMove) {
      const ctx = this.pendingConfirmContext;
      this.pendingConfirmContext = null;
      this.checkWinConditionSlotOverflow(playerId, () => {
        this.offerGeneralMoveOption(playerId, ctx);
      });
    }
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
    for (const planId of player.confirmedPlans) {
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
    for (const planId of player.confirmedPlans) {
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

  /**
   * Offer the general "move to any line start" option after plan confirmation.
   * Only offered once per player per confirmation round, regardless of how many plans confirmed.
   * Skipped if the plan's specific effect already included a moveToLine.
   */
  private offerGeneralMoveOption(
    playerId: string,
    ctx: { eligiblePlayers: Player[]; playerIdx: number }
  ): void {
    const state = this.engine.getState();
    const player = this.engine.getPlayer(playerId);

    // Check if plan-specific effect already moved the player to a line
    // If they're currently in a line, skip the general move option
    if (!player || player.position.type === 'line') {
      this.startPlanConfirmationForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
      return;
    }

    // Offer move to any line start (with entry fee)
    const lineOptions = [
      { label: '浦口线', value: 'general_move_pukou' },
      { label: '学习线', value: 'general_move_study' },
      { label: '赚钱线', value: 'general_move_money' },
      { label: '苏州线', value: 'general_move_suzhou' },
      { label: '探索线', value: 'general_move_explore' },
      { label: '鼓楼线', value: 'general_move_gulou' },
      { label: '仙林线', value: 'general_move_xianlin' },
      { label: '食堂线', value: 'general_move_food' },
      { label: '不移动', value: 'general_move_skip' },
    ];

    state.pendingAction = {
      id: `general_move_${Date.now()}`,
      playerId,
      type: 'choose_option',
      prompt: '确认培养方案后：是否移动到某条线起点？（需交入场费，经过起点不领工资）',
      options: lineOptions,
      callbackHandler: 'plan_general_move_callback',
      timeoutMs: 30000,
    };

    this.engine.getEventHandler().registerHandler('plan_general_move_callback', (eng, pid, choice) => {
      if (choice && choice.startsWith('general_move_') && choice !== 'general_move_skip') {
        const lineId = choice.replace('general_move_', '');
        // Enter line with fee (skip salary pass — handled by enterLine's skipSalary param)
        const success = eng.enterLine(pid, lineId, true);
        if (success) {
          eng.log(`确认计划后移动到 ${lineId} 线起点`, pid);
        }
      }
      // Chain to next player
      this.startPlanConfirmationForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
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

    // --- Card effect: cancelNextEvent (及时止损/如何解释) ---
    if (player) {
      const cancelIdx = player.effects.findIndex(
        e => e.type === 'custom' && e.data?.cancelNextEvent
      );
      if (cancelIdx >= 0) {
        player.effects.splice(cancelIdx, 1);
        this.addLog(playerId, '事件取消效果生效：跳过本次格子事件');
        this.broadcastState();
        if (state.phase === 'playing') {
          if (this.checkAndEmitWin()) return;
          this.advanceTurn();
        }
        return;
      }
    }

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
        const cellAbility = planAbilities.checkAbilities(player, state, 'on_cell_enter', { cellId: cell.id });
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
          // 通过 player.confirmedPlans.includes('plan_yishu') 直接检查

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
      }

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
        this.logger.log({ turn: state.turnNumber, playerId, type: 'event', message: `Cell landing: ${cell?.name || handlerId}`, data: { position, cellName: cell?.name || handlerId } });
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
          // Event completed automatically — notify current player only
          const cell = boardData.mainBoard[position.index];
          if (cell) {
            this.io.to(this.roomId).emit('game:event-trigger', {
              title: cell.name || '事件',
              description: `${this.engine.getPlayer(playerId)?.name || '玩家'} 触发了事件`,
              playerId,
            });
          }
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
            this.io.to(this.roomId).emit('game:event-trigger', {
              title: cell.name || '线路事件',
              description: pendingAction.prompt,
              pendingAction,
            });
          } else {
            // Line event completed automatically — notify current player only
            this.io.to(this.roomId).emit('game:event-trigger', {
              title: cell.name || '线路事件',
              description: `${this.engine.getPlayer(playerId)?.name || '玩家'} 触发了 ${cell.description || cell.name}`,
              playerId,
            });
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

    this.addLog(playerId, `${currentPlayer.name} 投出了 ${values.join('+')}=${total}`);
    this.logger.log({ turn: state.turnNumber, playerId, type: 'dice_roll', message: `Rolled ${values.join('+')}=${total}`, data: { values, total } });

    // Move player
    if (isBackward) {
      this.engine.movePlayerBackward(playerId, total);
    } else {
      this.engine.movePlayerForward(playerId, total);
    }

    // Handle landing
    this.handleCellLanding(playerId, currentPlayer.position);
  }

  handleChooseAction(playerId: string, actionId: string, choice: string): void {
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
    }
  }

  private _processAction(playerId: string, actionId: string, choice: string): void {
    const state = this.engine.getState();
    if (!state.pendingAction) return;

    this.logger.log({ turn: state.turnNumber, playerId, type: 'choice', message: `Action choice: ${choice}`, data: { actionId, choice } });

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
        // Check if this was a pre-turn plan bonus or plan confirmation
        const isPlanConfirm = pendingActionId.startsWith('plan_confirm_') || pendingActionId.startsWith('general_move_');
        const isPlanBonus = pendingActionId.startsWith('jisuanji_') || pendingActionId.startsWith('kuangyaming_')
          || pendingActionId.startsWith('wuli_') || pendingActionId.startsWith('huaxue_')
          || pendingActionId.startsWith('shuxue_');

        if (state.phase === 'playing') {
          if (this.checkAndEmitWin()) return;

          // If the callback already set a new pendingAction, just broadcast
          if (state.pendingAction) {
            this.broadcastState();
          } else if (isPlanConfirm) {
            // Plan confirmation chain handles its own progression
            // If pendingAction is null here, the chain callback already handled everything
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
        } else {
          state.pendingAction = null;
          this.broadcastState();
          if (this.checkAndEmitWin()) return;
          this.advanceTurn();
        }
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

        try {
          if (cardId) {
            this.resolveMultiVoteCard(cardId, groups, counts);
          }
        } catch (err) {
          console.error(`[VOTE ERROR] resolveMultiVoteCard failed for ${cardId}:`, err);
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

    const cardIndex = player.heldCards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const card = player.heldCards[cardIndex];

    // Remove card from hand
    player.heldCards.splice(cardIndex, 1);
    this.addLog(playerId, `${player.name} 使用手牌: ${card.name}`);

    // Check if there's a registered handler for this card
    const handlerId = `card_${card.id}`;
    if (this.engine.getEventHandler().hasHandler(handlerId)) {
      // Execute card handler (may return PendingAction for further interaction)
      const pendingAction = this.engine.getEventHandler().execute(handlerId, playerId, targetPlayerId);

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
      if (this.checkAndEmitWin()) return;
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

    this.broadcastState();
    if (this.checkAndEmitWin()) return;
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

    // --- PlanAbilities: on_confirm trigger ---
    const planAbilities = this.engine.getPlanAbilities();
    const confirmResult = planAbilities.checkAbilities(player, state, 'on_confirm');
    if (confirmResult?.effects) {
      const fx = confirmResult.effects;
      if (confirmResult.message) {
        this.addLog(playerId, confirmResult.message);
      }

      // moveToLine: enter a specific line (免费)
      if (fx.moveToLine) {
        this.engine.enterLine(playerId, fx.moveToLine, !fx.skipEntryFee);
      }
      // moveToCell: teleport to a named corner/cell
      if (fx.moveToCell) {
        const cellIndex = boardData.mainBoard.findIndex(c => c.cornerType === fx.moveToCell || c.id === fx.moveToCell);
        if (cellIndex >= 0) {
          this.engine.movePlayerTo(playerId, { type: 'main', index: cellIndex });
        }
      }
      // drawCard: draw a card immediately
      if (fx.drawCard) {
        const card = this.engine.drawCard(playerId, fx.drawCard);
        if (card) {
          if (card.holdable) {
            this.engine.addCardToPlayer(playerId, card);
            this.addLog(playerId, `${player.name} 获得${fx.drawCard === 'chance' ? '机会' : '命运'}卡: ${card.name}`);
          } else {
            this.engine.getEventHandler().execute(`card_${card.id}`, playerId);
          }
        }
      }
      // money/gpa/exploration direct effects
      if (fx.money) this.engine.modifyPlayerMoney(playerId, fx.money);
      if (fx.gpa) this.engine.modifyPlayerGpa(playerId, fx.gpa);
      if (fx.exploration) this.engine.modifyPlayerExploration(playerId, fx.exploration);

      // customEffect handling for on_confirm plans
      if (fx.customEffect === 'guoji_target_draw') {
        // 国际关系学院: Let all other players draw a chance card
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
      if (fx.customEffect === 'xinxiguanli_redistribute') {
        // 信息管理学院: Shuffle all active players' cards and redistribute evenly
        const activePlayers = state.players.filter(p => !p.isBankrupt && !p.isDisconnected);
        const allCards = activePlayers.flatMap(p => {
          const cards = [...p.heldCards];
          p.heldCards = [];
          return cards;
        });
        // Shuffle
        for (let i = allCards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
        }
        // Distribute evenly
        let idx = 0;
        for (const card of allCards) {
          activePlayers[idx % activePlayers.length].heldCards.push(card);
          idx++;
        }
        this.addLog(playerId, '信息管理学院能力：所有玩家手牌已重新分配');
      }
      if (fx.customEffect === 'shengming_maimen') {
        // 生命科学学院: Give player a special shield card
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
      if (fx.customEffect === 'gongguan_negative_balance') {
        // 工程管理学院: Give player a negative balance card
        const negCard: Card = {
          id: 'negative_balance',
          name: '余额为负',
          description: '使目标玩家金钱变为负数',
          deckType: 'chance',
          holdable: true,
          singleUse: true,
          returnToDeck: false,
          effects: [],
        };
        this.engine.addCardToPlayer(playerId, negCard);
        this.addLog(playerId, `${player.name} 获得余额为负卡`);
      }
      if (fx.customEffect === 'shehuixue_reduce_threshold') {
        // 社会学院: Optionally reduce win threshold from 20 to 15
        // This is handled as a PendingAction returned from handleConfirmPlan
        // We set a flag that the confirmation flow will check
        player.modifiedWinThresholds['plan_shehuixue_pending'] = 1;
      }
      if (fx.customEffect === 'rengong_reduce_threshold') {
        // 人工智能学院: Optionally reduce GPA gap threshold from 2.0 to 1.5
        player.modifiedWinThresholds['plan_rengong_pending'] = 1;
      }
      if (fx.customEffect === 'xiandai_assign_card') {
        // 现代工程学院: Draw a destiny card and assign to a chosen player
        // Handled as post-confirm pending action
        player.modifiedWinThresholds['plan_xiandai_pending'] = 1;
      }
      if (fx.customEffect === 'daqi_draw_three') {
        // 大气科学学院: Draw 3 cards, pick 1 to execute
        // Handled as post-confirm pending action
        player.modifiedWinThresholds['plan_daqi_pending'] = 1;
      }
      // faxue: set lawyerShield on confirm
      if (plan.id === 'plan_faxue') {
        player.lawyerShield = true;
        this.addLog(playerId, '法学院能力：获得法律护盾（一次免除金钱损失）');
      }
      // haiwai: permanently make food line optional
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
      this.logger.log({ turn: state.turnNumber, playerId: winnerId, type: 'phase_change', message: `Game won via plan: ${condition}`, data: { winnerId, condition } });
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
