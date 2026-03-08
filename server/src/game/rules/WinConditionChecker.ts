// server/src/game/rules/WinConditionChecker.ts
import { Player, GameState, PlayerHistory, getPlayerPlanIds } from '@nannaricher/shared';

export interface WinResult {
  won: boolean;
  condition: string | null;
  planId: string | null;
}

export class WinConditionChecker {
  /**
   * 检查玩家的所有已确认培养计划是否达成胜利条件
   */
  checkWinConditions(player: Player, state: GameState, history: PlayerHistory, allPlayerHistories?: Map<string, PlayerHistory>): WinResult {
    const disabled = player.disabledWinConditions ?? [];

    // 先检查基础胜利条件（如果未被禁用）
    if (!disabled.includes('base')) {
      const baseResult = this.checkBaseWinCondition(player);
      if (baseResult.won) return baseResult;
    }

    // 检查所有已加入列表的计划（主修+辅修均可触发胜利）
    for (const planId of getPlayerPlanIds(player)) {
      if (disabled.includes(planId)) continue;
      const result = this.checkPlanWinCondition(player, planId, state, history, allPlayerHistories);
      if (result.won) {
        const plan = player.trainingPlans.find(p => p.id === planId);
        const direction = planId === player.majorPlan ? '主修' : '辅修';
        return {
          ...result,
          condition: `${direction}「${plan?.name || planId}」: ${result.condition}`,
        };
      }
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
   * @param allPlayerHistories 所有玩家的历史记录（大气学院需要跨玩家比较）
   */
  private checkPlanWinCondition(
    player: Player,
    planId: string,
    state: GameState,
    history: PlayerHistory,
    allPlayerHistories?: Map<string, PlayerHistory>,
  ): WinResult {
    switch (planId) {
      // 商学院：金钱达到5555
      case 'plan_shangxue':
        if (player.money >= 5555) {
          return { won: true, condition: `商学院：金钱达到${player.money}`, planId };
        }
        break;

      // 化学化工学院：连续6回合触发增益效果（链式反应）
      case 'plan_huaxue':
        if (player.consecutivePositiveTurns >= 6) {
          return { won: true, condition: `化学化工学院：连续${player.consecutivePositiveTurns}回合触发增益（链式反应）`, planId };
        }
        break;

      // 马克思主义学院：GPA达到4.5
      case 'plan_makesi':
        if (player.gpa >= 4.5) {
          return { won: true, condition: `马克思主义学院：GPA达到${player.gpa}`, planId };
        }
        break;

      // 法学院：场上出现破产玩家或罚没收入≥1000
      case 'plan_faxue': {
        const hasBankrupt = state.players.some(p => p.id !== player.id && p.isBankrupt);
        if (hasBankrupt) {
          return { won: true, condition: '法学院：场上出现破产玩家', planId };
        }
        if (player.confiscatedIncome >= 1000) {
          return { won: true, condition: `法学院：罚没收入达到${player.confiscatedIncome}`, planId };
        }
        break;
      }

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

      // 工程管理学院：连续6回合金钱≤500
      case 'plan_gongguan':
        if (player.consecutiveLowMoneyTurns >= 6) {
          return { won: true, condition: `工程管理学院：连续${player.consecutiveLowMoneyTurns}回合金钱≤500`, planId };
        }
        break;

      // 数学系：第2次到达鼓楼线终点
      case 'plan_shuxue':
        if (history.gulouEndpointReached >= 2) {
          return { won: true, condition: '数学系：第2次到达鼓楼线终点', planId };
        }
        break;

      // 生命科学学院：单次食堂线累计3次非负面效果
      case 'plan_shengming':
        if (player.foodLineNonNegativeCount >= 3) {
          return { won: true, condition: `生命科学学院：食堂线累计${player.foodLineNonNegativeCount}次非负面效果`, planId };
        }
        break;

      // 物理学院：任意两项属性分数之和≥85
      case 'plan_wuli':
        if (this.checkPhysicsWin(player)) {
          return { won: true, condition: '物理学院：任意两项属性分数之和≥85', planId };
        }
        break;

      // 计算机系：探索值和金钱数字中均只含0或1
      case 'plan_jisuanji':
        if (this.checkBinaryWin(player)) {
          return { won: true, condition: '计算机系：探索值和金钱只含0和1', planId };
        }
        break;

      // 历史学院：四校区线累计到达12个格子
      case 'plan_lishi': {
        const campusLineIds = ['pukou', 'gulou', 'xianlin', 'suzhou'];
        let totalCampusCells = 0;
        for (const lid of campusLineIds) {
          totalCampusCells += (history.lineEventsTriggered[lid] || []).length;
        }
        if (totalCampusCells >= 12) {
          return { won: true, condition: `历史学院：四校区线累计到达${totalCampusCells}个格子`, planId };
        }
        break;
      }

      // 地球科学与工程学院：进入过浦口、仙林、苏州、鼓楼线
      case 'plan_diqiu': {
        const campusLines = ['pukou', 'xianlin', 'suzhou', 'gulou'];
        if (campusLines.every(line => history.linesVisited.includes(line))) {
          return { won: true, condition: '地球科学学院：进入过四个校区线', planId };
        }
        break;
      }

      // 环境学院：经历仙林线任意5个不同事件
      case 'plan_huanjing':
        const xianlinEvents = history.lineEventsTriggered['xianlin'] || [];
        if (xianlinEvents.length >= 5) {
          return { won: true, condition: `环境学院：经历仙林线${xianlinEvents.length}个事件(≥5)`, planId };
        }
        break;

      // 艺术学院：经历浦口线至少9个不同事件
      case 'plan_yishu':
        const pukouEvents = history.lineEventsTriggered['pukou'] || [];
        if (pukouEvents.length >= 9) {
          return { won: true, condition: `艺术学院：经历浦口线${pukouEvents.length}个不同事件(≥9)`, planId };
        }
        break;

      // 苏州校区：经历苏州线至少8个不同事件
      case 'plan_suzhou':
        const suzhouEvents = history.lineEventsTriggered['suzhou'] || [];
        if (suzhouEvents.length >= 8) {
          return { won: true, condition: `苏州校区：经历苏州线${suzhouEvents.length}个不同事件(≥8)`, planId };
        }
        break;

      // 建筑学院：经历过起点、校医院、鼎、候车厅、闯门中的任意4个
      case 'plan_jianzhu':
        const requiredCells = ['start', 'hospital', 'ding', 'waiting_room', 'chuangmen'];
        const visitedCount = requiredCells.filter(cellId => history.mainCellVisited.includes(cellId)).length;
        if (visitedCount >= 4) {
          return { won: true, condition: `建筑学院：经历过${visitedCount}/5个主要格子`, planId };
        }
        break;

      // 政府管理学院：探索值达到20且场上金钱最高最低差不超过500
      case 'plan_zhengguan':
        if (this.checkZhengguanWin(player, state)) {
          return { won: true, condition: '政府管理学院：探索值≥20且金钱差≤666', planId };
        }
        break;

      // 天文学院：与每位其他玩家同格停留次数均>=2
      case 'plan_tianwen':
        if (this.checkAllPlayersSharedCellTwice(player, state, history)) {
          return { won: true, condition: '天文学院：与每位其他玩家同格停留≥2次', planId };
        }
        break;

      // 文学院：离开赚在南哪线时没有赚钱（不算经验卡和入场费）
      case 'plan_wenxue':
        if (history.lineExits.some(exit => exit.lineId === 'money' && exit.moneyAfter <= exit.moneyBefore)) {
          return { won: true, condition: '文学院：离开赚在南哪线时没有赚钱', planId };
        }
        break;

      // 哲学系：完成一条支线且GPA、探索值无变化且金钱未减少
      case 'plan_zhexue':
        if (this.checkLineNoGpaExpChangeNoMoneyLoss(history)) {
          return { won: true, condition: '哲学系：完成一条支线且GPA、探索值无变化且金钱未减少', planId };
        }
        break;

      // 新闻传播学院：完整经过乐在南哪(explore线)且全程无探索值和GPA扣减
      case 'plan_xinwen':
        if (this.checkExploreLineNoLoss(history)) {
          return { won: true, condition: '新闻传播学院：经过乐在南哪线且无任何损失', planId };
        }
        break;

      // 国际关系学院：累计给他人使用3次机会卡，或被他人累计使用3次机会卡
      case 'plan_guoji': {
        const totalGiven = Object.values(player.chanceCardsUsedOnPlayers).reduce((s, v) => s + v, 0);
        const totalReceived = state.players
          .filter(p => p.id !== player.id)
          .reduce((s, p) => s + (p.chanceCardsUsedOnPlayers[player.id] ?? 0), 0);
        if (totalGiven >= 3) {
          return { won: true, condition: `国际关系学院：累计给他人使用${totalGiven}次机会卡`, planId };
        }
        if (totalReceived >= 3) {
          return { won: true, condition: `国际关系学院：被他人累计使用${totalReceived}次机会卡`, planId };
        }
        break;
      }

      // 信息管理学院：抽取过4张不同的数字开头卡
      case 'plan_xinxiguanli': {
        const uniqueDigitCards = new Set(player.cardsDrawnWithDigitStart);
        if (uniqueDigitCards.size >= 4) {
          return { won: true, condition: `信息管理学院：抽到${uniqueDigitCards.size}张不同的数字开头卡`, planId };
        }
        break;
      }

      // 社会学院：自身探索≥15且探索值比最低者高出阈值（支持动态调整）
      case 'plan_shehuixue': {
        const shehuiThreshold = player.modifiedWinThresholds?.['plan_shehuixue'] ?? 20;
        const minExploration = Math.min(...state.players.filter(p => p.id !== player.id).map(p => p.exploration));
        if (player.exploration >= 15 && player.exploration - minExploration >= shehuiThreshold) {
          return { won: true, condition: `社会学院：探索值${player.exploration}(≥15)且领先最低者${player.exploration - minExploration}(≥${shehuiThreshold})`, planId };
        }
        break;
      }

      // 人工智能学院：GPA比最低者高出阈值（支持动态调整）
      case 'plan_rengong': {
        const rengongThreshold = player.modifiedWinThresholds?.['plan_rengong'] ?? 2.0;
        const minGpa = Math.min(...state.players.filter(p => p.id !== player.id).map(p => p.gpa));
        if (player.gpa - minGpa >= rengongThreshold) {
          return { won: true, condition: `人工智能学院：GPA领先最低者${(player.gpa - minGpa).toFixed(1)}(≥${rengongThreshold})`, planId };
        }
        break;
      }

      // 软件学院：累计交学费≥4200且未破产
      case 'plan_ruanjian':
        if (player.totalTuitionPaid >= 4200 && !player.isBankrupt) {
          return { won: true, condition: `软件学院：累计交学费${player.totalTuitionPaid}≥4200且未破产`, planId };
        }
        break;

      // 电子科学与工程学院：科创赛事累计获得≥0.6 GPA
      case 'plan_dianzi':
        if (player.kechuangGpaGained >= 0.6) {
          return { won: true, condition: `电子科学学院：科创赛事累计GPA${player.kechuangGpaGained.toFixed(1)}≥0.6`, planId };
        }
        break;

      // 现代工程与应用科学学院：GPA≥4且金钱≥4000，或探索值+GPA×10+金钱÷1000≥60
      case 'plan_xiandai': {
        if (player.gpa >= 4 && player.money >= 4000) {
          return { won: true, condition: `现代工程学院：GPA=${player.gpa.toFixed(1)}≥4且金钱=${player.money}≥4000`, planId };
        }
        const xiandaiScore = player.exploration + player.gpa * 10 + player.money / 1000;
        if (xiandaiScore >= 60) {
          return { won: true, condition: `现代工程学院：探索+GPA×10+金钱÷1000=${xiandaiScore.toFixed(1)}≥60`, planId };
        }
        break;
      }

      // 地理与海洋科学学院：进入过赚钱、学习、探索和食堂线
      case 'plan_dili': {
        const diliTargetLines = ['money', 'study', 'explore', 'food'];
        if (diliTargetLines.every(line => history.linesVisited.includes(line))) {
          return { won: true, condition: '地理与海洋科学学院：进入过赚钱、学习、探索和食堂线', planId };
        }
        break;
      }

      // 大气科学学院：连续15回合金钱从未是所有玩家中唯一最多
      case 'plan_daqi':
        if (this.checkNeverRichest(player, state, history, 15, allPlayerHistories)) {
          return { won: true, condition: '大气科学学院：连续15回合金钱从未唯一最多', planId };
        }
        break;

      // 匡亚明学院：满足至少2个不同玩家的已确认培养计划条件
      case 'plan_kuangyaming': {
        const matchResult = this.checkMatchMultiplePlayerPlanWins(player, state, history);
        if (matchResult.matched >= 2) {
          return { won: true, condition: `匡亚明学院：满足${matchResult.matched}个不同玩家的培养计划条件`, planId };
        }
        break;
      }

      // 海外教育学院：当有玩家获胜时，若对其使用过2+次机会卡，优先获胜
      // 此条件在其他玩家胜利时触发，参见 checkHaiwaiIntercept
      case 'plan_haiwai':
        // 此条件不在常规检查中触发，而是在其他玩家获胜时调用 checkHaiwaiIntercept
        break;

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
    for (let i = 0; i < scores.length; i++) {
      for (let j = i + 1; j < scores.length; j++) {
        if (scores[i] + scores[j] >= 85) {
          return true;
        }
      }
    }
    return false;
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

  private checkZhengguanWin(player: Player, state: GameState): boolean {
    if (player.exploration < 20) return false;
    const activePlayers = state.players.filter(p => !p.isBankrupt);
    if (activePlayers.length < 2) return false;
    const monies = activePlayers.map(p => p.money);
    const maxMoney = Math.max(...monies);
    const minMoney = Math.min(...monies);
    return maxMoney - minMoney <= 666;
  }

  private checkAllPlayersSharedCellTwice(player: Player, state: GameState, history: PlayerHistory): boolean {
    const otherPlayerIds = state.players.filter(p => p.id !== player.id && !p.isBankrupt).map(p => p.id);
    if (otherPlayerIds.length === 0) return false;
    // 每条记录已是独立相遇事件（StateTracker 中已做边沿检测去重）
    return otherPlayerIds.every(id => (history.sharedCellsWith[id]?.length ?? 0) >= 2);
  }


  /**
   * 哲学系：完成一条支线且GPA和探索值均无变化，且金钱未减少
   */
  private checkLineNoGpaExpChangeNoMoneyLoss(history: PlayerHistory): boolean {
    return history.lineExits.some(
      exit => exit.gpaBefore === exit.gpaAfter
        && exit.explorationBefore === exit.explorationAfter
        && exit.moneyAfter >= exit.moneyBefore
    );
  }

  /**
   * 新闻传播学院：完整经过乐在南哪(explore线)且无探索值和GPA扣减
   */
  private checkExploreLineNoLoss(history: PlayerHistory): boolean {
    return history.lineExits.some(
      exit => exit.lineId === 'explore' &&
        exit.gpaAfter >= exit.gpaBefore &&
        exit.explorationAfter >= exit.explorationBefore &&
        exit.moneyAfter >= exit.moneyBefore
    );
  }

  /**
   * 大气科学学院：连续N回合金钱从未唯一最多
   * 逐回合比较所有玩家的 moneyHistory，检查最近 N 个回合中该玩家金钱从未是唯一最高
   */
  private checkNeverRichest(
    player: Player,
    state: GameState,
    history: PlayerHistory,
    rounds: number,
    allPlayerHistories?: Map<string, PlayerHistory>,
  ): boolean {
    const myMoneyHistory = history.moneyHistory;
    if (myMoneyHistory.length < rounds) return false;

    // 需要所有玩家的历史记录来做逐回合比较
    if (!allPlayerHistories) return false;

    const otherPlayers = state.players.filter(p => p.id !== player.id && !p.isBankrupt);
    if (otherPlayers.length === 0) return false;

    // 逐回合检查最近 N 个回合
    const startIdx = myMoneyHistory.length - rounds;
    for (let i = startIdx; i < myMoneyHistory.length; i++) {
      const myMoney = myMoneyHistory[i];
      let isUniquelyRichest = true;

      for (const other of otherPlayers) {
        const otherHistory = allPlayerHistories.get(other.id);
        if (!otherHistory || otherHistory.moneyHistory.length <= i) {
          // 如果其他玩家没有足够的历史记录，无法判断，视为不满足
          isUniquelyRichest = false;
          break;
        }
        if (otherHistory.moneyHistory[i] >= myMoney) {
          isUniquelyRichest = false;
          break;
        }
      }

      if (isUniquelyRichest) {
        return false; // 在这个回合是唯一最多的，条件不满足
      }
    }

    return true;
  }

  /**
   * 匡亚明学院：检查满足了多少个不同玩家的已确认培养计划条件
   * 返回匹配的不同玩家数量
   */
  private checkMatchMultiplePlayerPlanWins(player: Player, state: GameState, history: PlayerHistory): { matched: number } {
    const matchedPlayerIds = new Set<string>();
    for (const otherPlayer of state.players) {
      if (otherPlayer.id === player.id) continue;
      for (const otherPlanId of getPlayerPlanIds(otherPlayer)) {
        // 跳过匡亚明本身和海外教育学院（特殊触发）
        if (otherPlanId === 'plan_kuangyaming' || otherPlanId === 'plan_haiwai') continue;
        const result = this.checkPlanWinCondition(player, otherPlanId, state, history);
        if (result.won) {
          matchedPlayerIds.add(otherPlayer.id);
          break; // 已匹配该玩家，检查下一个玩家
        }
      }
    }
    return { matched: matchedPlayerIds.size };
  }

  /**
   * 海外教育学院：当其他玩家获胜时，检查是否可以拦截
   * 返回 true 表示海外教育学院玩家优先获胜
   */
  checkHaiwaiIntercept(player: Player, winningPlayerId: string): boolean {
    if (player.majorPlan !== 'plan_haiwai' && !player.minorPlans.includes('plan_haiwai')) return false;
    const usedCount = player.chanceCardsUsedOnPlayers[winningPlayerId] ?? 0;
    return usedCount >= 2;
  }
}
