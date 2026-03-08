// server/src/game/history/StateTracker.ts
import { Player, Position, Card, PlayerHistory, CardDrawRecord, LineExitRecord, PositionRecord } from '@nannaricher/shared';

export class StateTracker {
  private playerHistories: Map<string, PlayerHistory> = new Map();
  /** 上一次检查时同位的玩家对（用于天文学院去重：只在从"不同位"→"同位"时记录） */
  private previouslyColocatedPairs: Set<string> = new Set();

  /**
   * 初始化玩家历史
   */
  initPlayerHistory(playerId: string, startPosition: Position): void {
    this.playerHistories.set(playerId, {
      positions: [{ turn: 0, position: startPosition, timestamp: Date.now() }],
      linesVisited: [],
      lineEventsTriggered: {},
      sharedCellsWith: {},
      cardsDrawn: [],
      moneyHistory: [],
      chanceCardsUsedOnPlayers: {},
      lineExits: [],
      hospitalVisits: 0,
      moneyZeroCount: 0,
      gulouEndpointReached: 0,
      campusLineOrder: [],
      foodLineNegativeFreeStreak: 0,
      plansConfirmedTurn: [],
      mainCellVisited: [],
    });
  }

  /**
   * 记录位置变化
   */
  recordPosition(playerId: string, position: Position, turn: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.positions.push({ turn, position, timestamp: Date.now() });
    }
  }

  /**
   * 记录访问线路
   */
  recordLineVisit(playerId: string, lineId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.linesVisited.includes(lineId)) {
        history.linesVisited.push(lineId);
      }

      // 记录校区线顺序（历史学院）
      const campusLines = ['pukou', 'gulou', 'xianlin', 'suzhou'];
      if (campusLines.includes(lineId)) {
        if (!history.campusLineOrder.includes(lineId)) {
          history.campusLineOrder.push(lineId);
        }
      }
    }
  }

  /**
   * 记录线路事件触发
   */
  recordLineEvent(playerId: string, lineId: string, eventIndex: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.lineEventsTriggered[lineId]) {
        history.lineEventsTriggered[lineId] = [];
      }
      if (!history.lineEventsTriggered[lineId].includes(eventIndex)) {
        history.lineEventsTriggered[lineId].push(eventIndex);
      }
    }
  }

  /**
   * 记录抽卡
   */
  recordCardDraw(playerId: string, card: Card, turn: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      const record: CardDrawRecord = {
        cardId: card.id,
        cardName: card.name,
        deckType: card.deckType,
        hasEnglish: this.containsEnglish(card.name, card.description),
        startsWithDigit: /^\d/.test(card.name),
        turn,
      };
      history.cardsDrawn.push(record);
    }
  }

  /**
   * 记录与其他玩家在同一格停留（去重：同一回合只记录一次）
   */
  recordSharedCell(playerId: string, otherPlayerId: string, turn: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.sharedCellsWith[otherPlayerId]) {
        history.sharedCellsWith[otherPlayerId] = [];
      }
      const arr = history.sharedCellsWith[otherPlayerId];
      // 同一回合不重复记录
      if (arr.length === 0 || arr[arr.length - 1] !== turn) {
        arr.push(turn);
      }
    }
  }

  /**
   * 记录金钱变化（大气学院）
   */
  recordMoneyChange(playerId: string, money: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.moneyHistory.push(money);
    }
  }

  /**
   * 记录使用机会卡
   */
  recordChanceCardUse(playerId: string, targetPlayerId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.chanceCardsUsedOnPlayers[targetPlayerId]) {
        history.chanceCardsUsedOnPlayers[targetPlayerId] = 0;
      }
      history.chanceCardsUsedOnPlayers[targetPlayerId]++;
    }
  }

  /**
   * 记录线路进出
   */
  recordLineExit(
    playerId: string,
    lineId: string,
    entryTurn: number,
    exitTurn: number,
    player: Player
  ): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      // 需要获取进入时的资源快照，这里简化处理
      const record: LineExitRecord = {
        lineId,
        entryTurn,
        exitTurn,
        gpaBefore: player.gpa, // 简化：应该是进入时的值
        gpaAfter: player.gpa,
        explorationBefore: player.exploration,
        explorationAfter: player.exploration,
        moneyBefore: player.money,
        moneyAfter: player.money,
      };
      history.lineExits.push(record);

      // 鼓楼线终点计数（数学系）
      if (lineId === 'gulou') {
        history.gulouEndpointReached++;
      }
    }
  }

  /**
   * 记录访问医院
   */
  recordHospitalVisit(playerId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.hospitalVisits++;
    }
  }

  /**
   * 记录金钱为0
   */
  recordMoneyZero(playerId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.moneyZeroCount++;
    }
  }

  /**
   * 更新食堂线连续无负面次数
   */
  updateFoodLineStreak(playerId: string, hadNegative: boolean): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (hadNegative) {
        history.foodLineNegativeFreeStreak = 0;
      } else {
        history.foodLineNegativeFreeStreak++;
      }
    }
  }

  /**
   * 记录确认培养计划
   */
  recordPlanConfirm(playerId: string, turn: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.plansConfirmedTurn.push(turn);
    }
  }

  /**
   * 记录访问主地图格子（建筑学院）
   */
  recordMainCellVisit(playerId: string, cellId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.mainCellVisited.includes(cellId)) {
        history.mainCellVisited.push(cellId);
      }
    }
  }

  /**
   * 获取玩家历史
   */
  getPlayerHistory(playerId: string): PlayerHistory | undefined {
    return this.playerHistories.get(playerId);
  }

  /**
   * 获取所有玩家历史（用于大气学院跨玩家比较）
   */
  getAllPlayerHistories(): Map<string, PlayerHistory> {
    return this.playerHistories;
  }

  /**
   * 检查玩家是否在同一格（边沿检测：只在从不同位→同位时记录新的相遇事件）
   */
  checkAndUpdateSharedCells(players: Player[], turn: number): void {
    const currentlyColocated = new Set<string>();

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        if (this.isSamePosition(players[i].position, players[j].position)) {
          const pairKey = `${players[i].id}:${players[j].id}`;
          currentlyColocated.add(pairKey);

          // 只有从"不在同一格"变为"在同一格"才记录（新的独立相遇事件）
          if (!this.previouslyColocatedPairs.has(pairKey)) {
            this.recordSharedCell(players[i].id, players[j].id, turn);
            this.recordSharedCell(players[j].id, players[i].id, turn);
          }
        }
      }
    }

    this.previouslyColocatedPairs = currentlyColocated;
  }

  /**
   * 检查是否同一位置
   */
  private isSamePosition(pos1: Position, pos2: Position): boolean {
    if (pos1.type !== pos2.type) return false;
    if (pos1.type === 'main') {
      return pos1.index === (pos2 as any).index;
    }
    return pos1.lineId === (pos2 as any).lineId && pos1.index === (pos2 as any).index;
  }

  /**
   * 检查字符串是否包含英文字母（除GPA外）
   */
  private containsEnglish(name: string, description: string): boolean {
    const text = name + ' ' + description;
    const englishPattern = /[a-zA-Z]/g;
    const matches = text.match(englishPattern) || [];
    // 排除 GPA
    const nonGpaMatches = matches.filter(m => !/GPA/i.test(m));
    return nonGpaMatches.length > 0;
  }
}
