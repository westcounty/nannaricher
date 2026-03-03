// server/src/game/interaction/ChainActionSystem.ts
import { GameState, Player, PendingAction } from '@nannaricher/shared';

export interface ChainActionContext {
  cardId: string;
  currentActorIndex: number;
  actorOrder: string[];
  responses: Map<string, ChainResponse>;
  timeoutPerPlayer: number;
}

export interface ChainResponse {
  playerId: string;
  action: 'continue' | 'pass';
  data?: Record<string, unknown>;
}

/**
 * 连锁行动卡牌配置
 */
export const CHAIN_ACTION_CARDS: Record<string, {
  cardId: string;
  description: string;
  timeoutPerPlayer: number;
  onStart: (state: GameState, cardPlayerId: string) => string[];
  onPlayerAction: (
    player: Player,
    action: 'continue' | 'pass',
    data: Record<string, unknown> | undefined,
    context: ChainActionContext,
    state: GameState
  ) => { effect?: () => void; nextAction?: 'continue' | 'end' };
  onChainEnd: (context: ChainActionContext, state: GameState) => void;
}> = {
  'chance_southbound_rose': {
    cardId: 'chance_southbound_rose',
    description: '南行玫瑰：依次说出校内平台/工具',
    timeoutPerPlayer: 30000,
    onStart: (state, cardPlayerId) => {
      // 从抽卡者开始，按顺序
      const playerIds = state.players
        .filter(p => !p.isDisconnected)
        .map(p => p.id);
      const cardPlayerIndex = playerIds.indexOf(cardPlayerId);
      return [
        ...playerIds.slice(cardPlayerIndex),
        ...playerIds.slice(0, cardPlayerIndex),
      ];
    },
    onPlayerAction: (player, action, data, context, state) => {
      if (action === 'pass') {
        // 停顿>3秒：-1探索
        return {
          effect: () => { player.exploration = Math.max(0, player.exploration - 1); },
          nextAction: 'continue',
        };
      }
      // 成功说出：+1探索
      return {
        effect: () => { player.exploration += 1; },
        nextAction: 'continue',
      };
    },
    onChainEnd: (context, state) => {
      // 链结束无额外效果
    },
  },
  'chance_delivery_theft': {
    cardId: 'chance_delivery_theft',
    description: '外卖贼盗：选监控或沉默',
    timeoutPerPlayer: 30000,
    onStart: (state, cardPlayerId) => {
      // 除抽卡者外的所有玩家
      return state.players
        .filter(p => !p.isDisconnected && p.id !== cardPlayerId)
        .map(p => p.id);
    },
    onPlayerAction: (player, action, data, context, state) => {
      // data.choice = 'monitor' 或 'silent'
      return { nextAction: 'continue' };
    },
    onChainEnd: (context, state) => {
      // 计算监控人数和骰子点数
      const monitorCount = Array.from(context.responses.values())
        .filter(r => r.data?.choice === 'monitor').length;

      // 获取抽卡者（最后一个响应者或第一个玩家）
      const cardPlayer = state.players[0]; // 简化

      // 模拟骰子点数（实际应该从外部传入）
      const diceValue = Math.floor(Math.random() * 6) + 1;

      if (diceValue > monitorCount) {
        // 监控者暂停1回合，抽卡者-100金
        for (const [playerId, response] of context.responses) {
          if (response.data?.choice === 'monitor') {
            const player = state.players.find(p => p.id === playerId);
            if (player) player.skipNextTurn = true;
          }
        }
        cardPlayer.money -= 100;
      } else {
        // 监控者探索+3，抽卡者探索+4
        for (const [playerId, response] of context.responses) {
          if (response.data?.choice === 'monitor') {
            const player = state.players.find(p => p.id === playerId);
            if (player) player.exploration += 3;
          }
        }
        cardPlayer.exploration += 4;
      }
    },
  },
  'chance_gossip_secret': {
    cardId: 'chance_gossip_secret',
    description: '八卦秘闻：悄悄告知或放弃',
    timeoutPerPlayer: 30000,
    onStart: (state, cardPlayerId) => {
      return state.players
        .filter(p => !p.isDisconnected)
        .map(p => p.id);
    },
    onPlayerAction: (player, action, data, context, state) => {
      if (action === 'pass') {
        // 放弃，链结束
        return { nextAction: 'end' };
      }
      // 悄悄告知下一个玩家
      return { nextAction: 'continue' };
    },
    onChainEnd: (context, state) => {
      // 计算连续告知的玩家数N
      const chainLength = Array.from(context.responses.values())
        .filter(r => r.action === 'continue').length;

      // 投骰判断
      const diceValue = Math.floor(Math.random() * 6) + 1;

      if (diceValue > chainLength) {
        // 成功：+200金+0.2GPA+2探索
        for (const [playerId, response] of context.responses) {
          if (response.action === 'continue') {
            const player = state.players.find(p => p.id === playerId);
            if (player) {
              player.money += 200;
              player.gpa += 0.2;
              player.exploration += 2;
            }
          }
        }
      } else {
        // 失败：全部-200金-0.2GPA-2探索
        for (const [playerId, response] of context.responses) {
          const player = state.players.find(p => p.id === playerId);
          if (player) {
            player.money -= 200;
            player.gpa = Math.max(0, player.gpa - 0.2);
            player.exploration = Math.max(0, player.exploration - 2);
          }
        }
      }
    },
  },
};

export class ChainActionSystem {
  private activeChains: Map<string, ChainActionContext> = new Map();

  /**
   * 开始连锁行动
   */
  startChain(cardId: string, state: GameState, cardPlayerId: string): PendingAction | null {
    const config = CHAIN_ACTION_CARDS[cardId];
    if (!config) return null;

    const actorOrder = config.onStart(state, cardPlayerId);
    const context: ChainActionContext = {
      cardId,
      currentActorIndex: 0,
      actorOrder,
      responses: new Map(),
      timeoutPerPlayer: config.timeoutPerPlayer,
    };

    this.activeChains.set(cardId, context);

    return this.createChainAction(cardId, context, state);
  }

  /**
   * 创建当前玩家的连锁行动待处理动作
   */
  private createChainAction(
    cardId: string,
    context: ChainActionContext,
    state: GameState
  ): PendingAction {
    const currentPlayerId = context.actorOrder[context.currentActorIndex];
    const config = CHAIN_ACTION_CARDS[cardId];

    return {
      id: `chain_${cardId}_${Date.now()}`,
      playerId: currentPlayerId,
      type: 'chain_action',
      prompt: config.description,
      options: [
        { label: '继续', value: 'continue' },
        { label: '放弃', value: 'pass' },
      ],
      timeoutMs: context.timeoutPerPlayer,
      cardId,
      chainOrder: context.actorOrder,
    };
  }

  /**
   * 处理连锁行动响应
   */
  processChainResponse(
    cardId: string,
    playerId: string,
    action: 'continue' | 'pass',
    data: Record<string, unknown> | undefined,
    state: GameState
  ): { nextAction: PendingAction | null; chainComplete: boolean } {
    const context = this.activeChains.get(cardId);
    const config = CHAIN_ACTION_CARDS[cardId];

    if (!context || !config) {
      return { nextAction: null, chainComplete: true };
    }

    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      return { nextAction: null, chainComplete: true };
    }

    // 记录响应
    context.responses.set(playerId, { playerId, action, data });

    // 执行玩家行动效果
    const result = config.onPlayerAction(player, action, data || {}, context, state);
    if (result.effect) {
      result.effect();
    }

    // 检查是否结束
    if (result.nextAction === 'end' ||
        context.currentActorIndex >= context.actorOrder.length - 1) {
      // 链结束
      config.onChainEnd(context, state);
      this.activeChains.delete(cardId);
      return { nextAction: null, chainComplete: true };
    }

    // 继续下一个玩家
    context.currentActorIndex++;
    const nextAction = this.createChainAction(cardId, context, state);
    return { nextAction, chainComplete: false };
  }

  /**
   * 处理超时（自动放弃）
   */
  handleTimeout(cardId: string, playerId: string, state: GameState): void {
    this.processChainResponse(cardId, playerId, 'pass', undefined, state);
  }
}
