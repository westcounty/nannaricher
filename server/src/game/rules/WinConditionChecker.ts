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
  checkWinConditions(player: Player, state: GameState, history: PlayerHistory): WinResult {
    const disabled = player.disabledWinConditions ?? [];

    // 先检查基础胜利条件（如果未被禁用）
    if (!disabled.includes('base')) {
      const baseResult = this.checkBaseWinCondition(player);
      if (baseResult.won) return baseResult;
    }

    // 检查所有已加入列表的计划（主修+辅修均可触发胜利）
    for (const planId of getPlayerPlanIds(player)) {
      if (disabled.includes(planId)) continue;
      const result = this.checkPlanWinCondition(player, planId, state, history);
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
   */
  private checkPlanWinCondition(
    player: Player,
    planId: string,
    state: GameState,
    history: PlayerHistory
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

      // 工程管理学院：第1次金钱为0
      case 'plan_gongguan':
        if (history.moneyZeroCount >= 1) {
          return { won: true, condition: '工程管理学院：第1次金钱为0', planId };
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

      // 文学院：离开赚在南哪(money线)时金钱无变化
      case 'plan_wenxue':
        if (this.checkMoneyLineNoChange(history)) {
          return { won: true, condition: '文学院：离开赚在南哪线时金钱无变化', planId };
        }
        break;

      // 哲学系：完成一条支线且GPA和探索值均无变化
      case 'plan_zhexue':
        if (this.checkLineNoGpaExpChange(history)) {
          return { won: true, condition: '哲学系：完成一条支线且GPA和探索值无变化', planId };
        }
        break;

      // 新闻传播学院：完整经过乐在南哪(explore线)且全程无探索值和GPA扣减
      case 'plan_xinwen':
        if (this.checkExploreLineNoLoss(history)) {
          return { won: true, condition: '新闻传播学院：经过乐在南哪线且无任何损失', planId };
        }
        break;

      // 国际关系学院：对2+名不同玩家使用过机会卡
      case 'plan_guoji': {
        const targetCount = Object.keys(history.chanceCardsUsedOnPlayers).length;
        if (targetCount >= 2) {
          return { won: true, condition: `国际关系学院：对${targetCount}名玩家使用过机会卡`, planId };
        }
        break;
      }

      // 信息管理学院：抽取过5张不同的数字开头卡
      case 'plan_xinxiguanli': {
        const uniqueDigitCards = new Set(player.cardsDrawnWithDigitStart);
        if (uniqueDigitCards.size >= 5) {
          return { won: true, condition: `信息管理学院：抽到${uniqueDigitCards.size}张不同的数字开头卡`, planId };
        }
        break;
      }

      // 社会学院：探索值比最低者高出阈值（支持动态调整）
      case 'plan_shehuixue': {
        const shehuiThreshold = player.modifiedWinThresholds?.['plan_shehuixue'] ?? 20;
        const minExploration = Math.min(...state.players.filter(p => p.id !== player.id).map(p => p.exploration));
        if (player.exploration - minExploration >= shehuiThreshold) {
          return { won: true, condition: `社会学院：探索值领先最低者${player.exploration - minExploration}(≥${shehuiThreshold})`, planId };
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

      // 软件学院：在交学费格子支付3200不破产
      // TODO: 需要在交学费事件处理中触发，此处作为后备检查
      case 'plan_ruanjian':
        // 此条件在交学费格子事件中实时触发，参见 TuitionEventHandler
        break;

      // 电子科学与工程学院：在科创赛事掷出6
      // TODO: 需要在科创赛事事件处理中触发，此处作为后备检查
      case 'plan_dianzi':
        // 此条件在科创赛事事件中实时触发，参见 ScienceCompetitionHandler
        break;

      // 现代工程与应用科学学院：进入除苏州线外所有线
      case 'plan_xiandai': {
        const nonSuzhouLines = ['pukou', 'study', 'money', 'explore', 'xianlin', 'gulou', 'food'];
        if (nonSuzhouLines.every(line => history.linesVisited.includes(line))) {
          return { won: true, condition: '现代工程学院：进入除苏州外所有线路', planId };
        }
        break;
      }

      // 地理与海洋科学学院：完成四个校区线(pukou,xianlin,gulou,suzhou)的终点
      case 'plan_dili': {
        const campusLines = ['pukou', 'xianlin', 'gulou', 'suzhou'];
        const completedCampusLines = campusLines.filter(line =>
          history.lineExits.some(exit => exit.lineId === line)
        );
        if (completedCampusLines.length >= 4) {
          return { won: true, condition: '地理与海洋科学学院：完成四个校区线终点', planId };
        }
        break;
      }

      // 大气科学学院：连续18回合金钱从未是所有玩家中唯一最多
      case 'plan_daqi':
        if (this.checkNeverRichest(player, state, history, 18)) {
          return { won: true, condition: '大气科学学院：连续18回合金钱从未唯一最多', planId };
        }
        break;

      // 匡亚明学院：满足任意其他玩家的已确认培养计划条件
      case 'plan_kuangyaming':
        if (this.checkMatchAnyOtherPlanWin(player, state, history)) {
          return { won: true, condition: '匡亚明学院：满足其他玩家的培养计划条件', planId };
        }
        break;

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
    return otherPlayerIds.every(id => (history.sharedCellsWith[id]?.length ?? 0) >= 2);
  }

  /**
   * 文学院：离开赚在南哪(money线)时金钱无变化
   */
  private checkMoneyLineNoChange(history: PlayerHistory): boolean {
    return history.lineExits.some(
      exit => exit.lineId === 'money' && exit.moneyBefore === exit.moneyAfter
    );
  }

  /**
   * 哲学系：完成一条支线且GPA和探索值均无变化
   */
  private checkLineNoGpaExpChange(history: PlayerHistory): boolean {
    return history.lineExits.some(
      exit => exit.gpaBefore === exit.gpaAfter && exit.explorationBefore === exit.explorationAfter
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
   * 检查 moneyHistory 最近 N 个回合中，该玩家金钱从未是唯一最高
   */
  private checkNeverRichest(player: Player, state: GameState, history: PlayerHistory, rounds: number): boolean {
    const myMoneyHistory = history.moneyHistory;
    if (myMoneyHistory.length < rounds) return false;

    // 从 moneyHistory 获取最近 rounds 个回合的数据
    const recentMoney = myMoneyHistory.slice(-rounds);

    // 检查每个回合是否从未是唯一最高
    // 注意: 需要其他玩家同期的金钱记录来做比较
    // 当前实现使用每回合快照：如果 moneyHistory 按回合顺序记录，
    // 这里简化为检查当前状态下连续 rounds 回合不是唯一最多
    // 完整实现需要逐回合比较所有玩家
    for (let i = 0; i < rounds; i++) {
      const turnMoney = recentMoney[i];
      // 获取该回合其他玩家的最高金钱
      // 简化实现：如果当前该玩家是唯一最高，则不满足条件
      const othersMax = Math.max(...state.players.filter(p => p.id !== player.id).map(p => p.money));
      if (i === rounds - 1 && turnMoney > othersMax) {
        return false;
      }
    }

    // 完整实现：逐回合检查历史记录
    // 当前简化为：当前金钱不是唯一最多 + 有足够的回合历史
    const currentMax = Math.max(...state.players.map(p => p.money));
    const playersAtMax = state.players.filter(p => p.money === currentMax);
    if (playersAtMax.length === 1 && playersAtMax[0].id === player.id) {
      return false;
    }

    return true;
  }

  /**
   * 匡亚明学院：检查是否满足任意其他玩家的已确认培养计划条件
   */
  private checkMatchAnyOtherPlanWin(player: Player, state: GameState, history: PlayerHistory): boolean {
    for (const otherPlayer of state.players) {
      if (otherPlayer.id === player.id) continue;
      for (const otherPlanId of getPlayerPlanIds(otherPlayer)) {
        // 跳过匡亚明本身和海外教育学院（特殊触发）
        if (otherPlanId === 'plan_kuangyaming' || otherPlanId === 'plan_haiwai') continue;
        const result = this.checkPlanWinCondition(player, otherPlanId, state, history);
        if (result.won) return true;
      }
    }
    return false;
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
