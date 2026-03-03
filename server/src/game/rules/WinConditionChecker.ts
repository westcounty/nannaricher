// server/src/game/rules/WinConditionChecker.ts
import { Player, GameState, PlayerHistory } from '@nannaricher/shared';

export interface WinResult {
  won: boolean;
  condition: string | null;
  planId: string | null;
}

export class WinConditionChecker {
  /**
   * 检查玩家的所有已确认培养计划是否达成胜利条件
   */
  checkWinConditions(player: Player, state: GameState, history: PlayerHistory): WinResult {
    // 先检查基础胜利条件
    const baseResult = this.checkBaseWinCondition(player);
    if (baseResult.won) return baseResult;

    // 检查每个已确认的培养计划
    for (const planId of player.confirmedPlans) {
      const result = this.checkPlanWinCondition(player, planId, state, history);
      if (result.won) return result;
    }

    return { won: false, condition: null, planId: null };
  }

  /**
   * 基础胜利条件：GPA×10 + 探索值 ≥ 60
   */
  private checkBaseWinCondition(player: Player): WinResult {
    const score = player.gpa * 10 + player.exploration;
    if (score >= 60) {
      return {
        won: true,
        condition: `GPA×10+探索值达到 ${score.toFixed(1)} ≥ 60`,
        planId: 'base',
      };
    }
    return { won: false, condition: null, planId: null };
  }

  /**
   * 检查特定培养计划的胜利条件
   */
  private checkPlanWinCondition(
    player: Player,
    planId: string,
    state: GameState,
    history: PlayerHistory
  ): WinResult {
    switch (planId) {
      // 商学院：金钱达到5000
      case 'plan_shangxue':
        if (player.money >= 5000) {
          return { won: true, condition: `商学院：金钱达到${player.money}`, planId };
        }
        break;

      // 化学化工学院：探索值达到45
      case 'plan_huaxue':
        if (player.exploration >= 45) {
          return { won: true, condition: `化学化工学院：探索值达到${player.exploration}`, planId };
        }
        break;

      // 马克思主义学院：GPA达到4.5
      case 'plan_makesi':
        if (player.gpa >= 4.5) {
          return { won: true, condition: `马克思主义学院：GPA达到${player.gpa}`, planId };
        }
        break;

      // 法学院：场上出现破产玩家且不是自己
      case 'plan_faxue':
        const hasBankrupt = state.players.some(p => p.id !== player.id && p.isBankrupt);
        if (hasBankrupt) {
          return { won: true, condition: '法学院：场上出现破产玩家', planId };
        }
        break;

      // 外国语学院：抽到过2张含英文字母的卡
      case 'plan_waiguoyu':
        if (history.cardsDrawn.filter(c => c.hasEnglish).length >= 2) {
          return { won: true, condition: '外国语学院：抽到2张含英文字母的卡', planId };
        }
        break;

      // 医学院：进入医院3次
      case 'plan_yixue':
        if (history.hospitalVisits >= 3) {
          return { won: true, condition: '医学院：进入医院3次', planId };
        }
        break;

      // 工程管理学院：第2次金钱为0
      case 'plan_gongguan':
        if (history.moneyZeroCount >= 2) {
          return { won: true, condition: '工程管理学院：第2次金钱为0', planId };
        }
        break;

      // 数学系：第3次到达鼓楼线终点
      case 'plan_shuxue':
        if (history.gulouEndpointReached >= 3) {
          return { won: true, condition: '数学系：第3次到达鼓楼线终点', planId };
        }
        break;

      // 生命科学学院：食堂线连续3次无负面效果
      case 'plan_shengming':
        if (history.foodLineNegativeFreeStreak >= 3) {
          return { won: true, condition: '生命科学学院：食堂线连续3次无负面效果', planId };
        }
        break;

      // 物理学院：任选两项达到60分
      case 'plan_wuli':
        if (this.checkPhysicsWin(player)) {
          return { won: true, condition: '物理学院：两项属性分数达到60', planId };
        }
        break;

      // 计算机系：探索值和金钱数字中均只含0或1
      case 'plan_jisuanji':
        if (this.checkBinaryWin(player)) {
          return { won: true, condition: '计算机系：探索值和金钱只含0和1', planId };
        }
        break;

      // 历史学院：按顺序经过鼓楼→浦口→仙林→苏州校区线
      case 'plan_lishi':
        if (this.checkSequentialCampusVisit(history, ['gulou', 'pukou', 'xianlin', 'suzhou'])) {
          return { won: true, condition: '历史学院：按顺序经过四个校区线', planId };
        }
        break;

      // 地球科学与工程学院：进入每一条线
      case 'plan_diqiu':
        const allLines = ['pukou', 'study', 'money', 'suzhou', 'gulou', 'xianlin', 'explore', 'food'];
        if (allLines.every(line => history.linesVisited.includes(line))) {
          return { won: true, condition: '地球科学学院：进入所有线路', planId };
        }
        break;

      // 环境学院：经历仙林线每个事件
      case 'plan_huanjing':
        const xianlinEvents = history.lineEventsTriggered['xianlin'] || [];
        if (xianlinEvents.length >= 7) {
          return { won: true, condition: '环境学院：经历仙林线所有事件', planId };
        }
        break;

      // 艺术学院：经历浦口线每个事件
      case 'plan_yishu':
        const pukouEvents = history.lineEventsTriggered['pukou'] || [];
        if (pukouEvents.length >= 12) {
          return { won: true, condition: '艺术学院：经历浦口线所有事件', planId };
        }
        break;

      // 苏州校区：经历苏州线每个事件
      case 'plan_suzhou':
        const suzhouEvents = history.lineEventsTriggered['suzhou'] || [];
        if (suzhouEvents.length >= 10) {
          return { won: true, condition: '苏州校区：经历苏州线所有事件', planId };
        }
        break;

      // 建筑学院：经历过起点、校医院、鼎、候车厅、闯门
      case 'plan_jianzhu':
        const requiredCells = ['start', 'hospital', 'ding', 'waiting_room', 'chuangmen'];
        if (requiredCells.every(cellId => history.mainCellVisited.includes(cellId))) {
          return { won: true, condition: '建筑学院：经历过所有主要格子', planId };
        }
        break;

      // 政府管理学院：三项属性均不与其他任何玩家一致
      case 'plan_zhengguan':
        if (this.checkUniqueStats(player, state)) {
          return { won: true, condition: '政府管理学院：三项属性均独一无二', planId };
        }
        break;

      // 天文学院：与所有其他玩家在同一格停留过
      case 'plan_tianwen':
        if (this.checkAllPlayersSharedCell(player, state, history)) {
          return { won: true, condition: '天文学院：与所有其他玩家在同一格相遇', planId };
        }
        break;

      // 其他培养计划需要更复杂的检查或在特定时机触发
      default:
        break;
    }

    return { won: false, condition: null, planId: null };
  }

  // === 辅助方法 ===

  private checkPhysicsWin(player: Player): boolean {
    const scores = [
      player.exploration,
      player.gpa * 10,
      player.money / 100,
    ];
    let pairsCount = 0;
    for (let i = 0; i < scores.length; i++) {
      for (let j = i + 1; j < scores.length; j++) {
        if (scores[i] >= 60 && scores[j] >= 60) {
          pairsCount++;
        }
      }
    }
    return pairsCount >= 1;
  }

  private checkBinaryWin(player: Player): boolean {
    const expStr = player.exploration.toString();
    const moneyStr = player.money.toString();
    const binaryRegex = /^[01]+$/;
    return binaryRegex.test(expStr) && binaryRegex.test(moneyStr);
  }

  private checkSequentialCampusVisit(history: PlayerHistory, order: string[]): boolean {
    const visitOrder = history.campusLineOrder;
    let searchIndex = 0;
    for (const line of order) {
      const idx = visitOrder.indexOf(line, searchIndex);
      if (idx === -1 || idx < searchIndex) return false;
      searchIndex = idx + 1;
    }
    return true;
  }

  private checkUniqueStats(player: Player, state: GameState): boolean {
    for (const other of state.players) {
      if (other.id === player.id) continue;
      if (other.money === player.money && other.gpa === player.gpa && other.exploration === player.exploration) {
        return false;
      }
    }
    return true;
  }

  private checkAllPlayersSharedCell(player: Player, state: GameState, history: PlayerHistory): boolean {
    const otherPlayerIds = state.players.filter(p => p.id !== player.id).map(p => p.id);
    return otherPlayerIds.every(id => history.sharedCellsWith[id]?.length > 0);
  }
}
