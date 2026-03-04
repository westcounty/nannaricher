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
  private onFinishedCallback: (() => void) | null = null;

  constructor(engine: GameEngine, io: GameServer, roomId: string) {
    this.engine = engine;
    this.io = io;
    this.roomId = roomId;
  }

  /** Register a callback to be invoked when the game finishes (e.g. to sync room phase). */
  onFinished(callback: () => void): void {
    this.onFinishedCallback = callback;
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
    // Fix floating point precision before broadcasting
    for (const player of state.players) {
      player.gpa = parseFloat(player.gpa.toFixed(1));
      player.exploration = Math.round(player.exploration);
      player.money = Math.round(player.money);
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
      case 'plan_wuli': {   // 物理学院：任选两项指标之和>=60
        const moneyScore = player.money / 100;
        const gpaScore = player.gpa * 10;
        const expScore = player.exploration;
        if (gpaScore + expScore >= 60 || gpaScore + moneyScore >= 60 || expScore + moneyScore >= 60) {
          return `任意两项指标之和≥60 (GPA×10=${gpaScore.toFixed(0)}, 探索=${expScore}, 金钱/100=${moneyScore.toFixed(0)})`;
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
      case 'destiny_four_schools': {
        // 四校联动 — 奇数：选人数>1的校区玩家各探索+2，偶数：选人数=1的校区玩家各探索+2
        const dice = this.engine.rollDice(1)[0];
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
        const dice = this.engine.rollDice(1)[0];
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
        const dice = this.engine.rollDice(1)[0];
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
        const dice = this.engine.rollDice(1)[0];
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
        const dice = this.engine.rollDice(1)[0];
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
        const dice = this.engine.rollDice(1)[0];
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
      const winner = state.players.find(p => p.id === winnerId);
      state.winner = winnerId;
      state.phase = 'finished';
      this.io.to(this.roomId).emit('game:player-won', {
        playerId: winnerId,
        playerName: winner?.name || 'Unknown',
        condition: condition || 'Unknown condition',
      });
      this.broadcastState();
      this.onFinishedCallback?.();
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
      // Target player selected — use callbackHandler if available
      let pendingAction: import('@nannaricher/shared').PendingAction | null = null;
      if (state.pendingAction.callbackHandler) {
        pendingAction = this.engine.getEventHandler().execute(
          state.pendingAction.callbackHandler, playerId, choice
        );
      } else if (state.pendingAction.targetPlayerIds?.includes(choice)) {
        const handlerId = `${pendingActionId}_${choice}`;
        pendingAction = this.engine.getEventHandler().execute(handlerId, playerId);
      }
      if (pendingAction) {
        state.pendingAction = pendingAction;
        this.broadcastState();
      } else {
        state.pendingAction = null;
        this.broadcastState();
        if (this.checkAndEmitWin()) return;
        this.advanceTurn();
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
