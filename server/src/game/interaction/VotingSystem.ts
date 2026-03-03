// server/src/game/interaction/VotingSystem.ts
import { GameState, Player, PendingAction } from '@nannaricher/shared';

export interface VoteOption {
  id: string;
  label: string;
  description?: string;
}

export interface VoteResult {
  optionId: string;
  playerIds: string[];
  count: number;
}

export interface VotingContext {
  cardId: string;
  options: VoteOption[];
  diceRollNeeded: boolean;
  effectMapping: Record<string, (player: Player, diceValue: number, state: GameState) => void>;
}

/**
 * 投票卡牌配置
 */
export const VOTING_CARDS: Record<string, VotingContext> = {
  'chance_swimming_pool_regular': {
    cardId: 'chance_swimming_pool_regular',
    options: [
      { id: 'per_visit', label: '按次缴费', description: '每次使用付费' },
      { id: 'yearly_card', label: '年卡用户', description: '一次性付费全年使用' },
    ],
    diceRollNeeded: true,
    effectMapping: {
      'per_visit_odd': (player, dice, state) => {
        // 奇数：年卡-300金,按次+100金
        // 在结果处理时应用
      },
      'per_visit_even': (player, dice, state) => {
        // 偶数：年卡探索+5,按次探索-1,GPA-0.1
      },
    },
  },
  'chance_meeting_is_fate': {
    cardId: 'chance_meeting_is_fate',
    options: [
      { id: 'library', label: '图书馆', description: '安静学习' },
      { id: 'playground', label: '运动场', description: '运动健身' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_first_snow': {
    cardId: 'chance_first_snow',
    options: [
      { id: 'confess', label: '初雪告白', description: '勇敢表白' },
      { id: 'silent', label: '大雪无声', description: '默默欣赏' },
    ],
    diceRollNeeded: false,
    effectMapping: {},
  },
  'chance_strange_tales': {
    cardId: 'chance_strange_tales',
    options: [
      { id: 'in_ding', label: '鼎里', description: '传说之地' },
      { id: 'astronomy_hill', label: '天文山', description: '观星之处' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_root_finding_moment': {
    cardId: 'chance_root_finding_moment',
    options: [
      { id: 'renovated', label: '装潢一新', description: '现代化设施' },
      { id: 'historical', label: '历史古迹', description: '保留历史' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_rest_moment': {
    cardId: 'chance_rest_moment',
    options: [
      { id: 'daqishan', label: '大气山', description: '自然风光' },
      { id: 'yangshan_lake', label: '羊山湖', description: '湖边漫步' },
    ],
    diceRollNeeded: false, // 多数决
    effectMapping: {},
  },
  'chance_light_shadow': {
    cardId: 'chance_light_shadow',
    options: [
      { id: 'lizhao_lake', label: '藜照湖', description: '校园湖泊' },
      { id: 'caigen_tan', label: '菜根谭', description: '精神象征' },
    ],
    diceRollNeeded: false, // 多数决
    effectMapping: {},
  },
  'chance_course_group': {
    cardId: 'chance_course_group',
    options: [
      { id: 'qq', label: 'QQ群', description: '腾讯QQ' },
      { id: 'wechat', label: '微信群', description: '微信' },
    ],
    diceRollNeeded: false,
    effectMapping: {},
  },
  'chance_transfer_moment': {
    cardId: 'chance_transfer_moment',
    options: [
      { id: 'xinjiekou', label: '新街口', description: '市中心' },
      { id: 'jinmalu', label: '金马路', description: '地铁换乘' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_wit_words': {
    cardId: 'chance_wit_words',
    options: [
      { id: 'debate', label: '南哪辩论赛', description: '逻辑交锋' },
      { id: 'speech', label: '南哪演说家', description: '演讲比赛' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_school_sports_meet': {
    cardId: 'chance_school_sports_meet',
    options: [
      { id: 'entrance', label: '入场式', description: '开幕式表演' },
      { id: 'broadcast', label: '广播操', description: '集体健身' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_travel_method': {
    cardId: 'chance_travel_method',
    options: [
      { id: 'shared', label: '共享', description: '共享单车/滑板车' },
      { id: 'walk', label: '丈量', description: '步行' },
    ],
    diceRollNeeded: false,
    effectMapping: {},
  },
  'destiny_four_schools': {
    cardId: 'destiny_four_schools',
    options: [
      { id: 'pukou', label: '浦口校区', description: '江北校区' },
      { id: 'xianlin', label: '仙林校区', description: '主校区' },
      { id: 'gulou', label: '鼓楼校区', description: '老校区' },
      { id: 'suzhou', label: '苏州校区', description: '新建校区' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
};

export class VotingSystem {
  /**
   * 创建投票待处理动作
   */
  createVoteAction(cardId: string, state: GameState, timeoutMs: number = 120000): PendingAction | null {
    const context = VOTING_CARDS[cardId];
    if (!context) return null;

    return {
      id: `vote_${cardId}_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote',
      prompt: `请选择：${context.options.map(o => o.label).join(' 或 ')}`,
      options: context.options.map(o => ({
        label: o.label,
        value: o.id,
        description: o.description,
      })),
      targetPlayerIds: state.players.filter(p => !p.isDisconnected).map(p => p.id),
      responses: {},
      timeoutMs,
      cardId,
    };
  }

  /**
   * 处理投票响应
   */
  processVoteResponse(
    action: PendingAction,
    playerId: string,
    choice: string
  ): { complete: boolean; results?: VoteResult[] } {
    if (!action.responses) {
      action.responses = {};
    }
    action.responses[playerId] = choice;

    // 检查是否所有人都已投票
    const totalVoters = action.targetPlayerIds?.length || 0;
    const votedCount = Object.keys(action.responses).length;

    if (votedCount >= totalVoters) {
      return {
        complete: true,
        results: this.tallyVotes(action.responses),
      };
    }

    return { complete: false };
  }

  /**
   * 统计投票结果
   */
  tallyVotes(responses: Record<string, string>): VoteResult[] {
    const counts: Record<string, string[]> = {};

    for (const [playerId, choice] of Object.entries(responses)) {
      if (!counts[choice]) {
        counts[choice] = [];
      }
      counts[choice].push(playerId);
    }

    return Object.entries(counts)
      .map(([optionId, playerIds]) => ({
        optionId,
        playerIds,
        count: playerIds.length,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 执行投票效果（需要骰子时）
   */
  executeVoteEffect(
    cardId: string,
    results: VoteResult[],
    diceValue: number,
    state: GameState
  ): void {
    const context = VOTING_CARDS[cardId];
    if (!context) return;

    const isOdd = diceValue % 2 === 1;

    switch (cardId) {
      case 'chance_swimming_pool_regular':
        this.executeSwimmingPoolEffect(results, isOdd, state);
        break;
      case 'chance_meeting_is_fate':
        this.executeMeetingIsFateEffect(results, isOdd, state);
        break;
      case 'chance_first_snow':
        this.executeFirstSnowEffect(results, state);
        break;
      // ... 其他投票卡牌效果
      default:
        // 默认多数决处理
        this.executeMajorityEffect(results, state);
    }
  }

  private executeSwimmingPoolEffect(
    results: VoteResult[],
    isOdd: boolean,
    state: GameState
  ): void {
    const yearlyCardPlayers = results.find(r => r.optionId === 'yearly_card')?.playerIds || [];
    const perVisitPlayers = results.find(r => r.optionId === 'per_visit')?.playerIds || [];

    for (const player of state.players) {
      if (yearlyCardPlayers.includes(player.id)) {
        if (isOdd) {
          player.money -= 300;
        } else {
          player.exploration += 5;
        }
      } else if (perVisitPlayers.includes(player.id)) {
        if (isOdd) {
          player.money += 100;
        } else {
          player.exploration -= 1;
          player.gpa = Math.max(0, player.gpa - 0.1);
        }
      }
    }
  }

  private executeMeetingIsFateEffect(
    results: VoteResult[],
    isOdd: boolean,
    state: GameState
  ): void {
    const libraryPlayers = results.find(r => r.optionId === 'library')?.playerIds || [];
    const playgroundPlayers = results.find(r => r.optionId === 'playground')?.playerIds || [];

    for (const player of state.players) {
      if (libraryPlayers.includes(player.id)) {
        if (isOdd) {
          player.gpa += 0.2;
          player.money -= 100;
        }
      } else if (playgroundPlayers.includes(player.id)) {
        if (!isOdd) {
          player.exploration += 2;
          player.money -= 100;
        }
      }
    }
  }

  private executeFirstSnowEffect(results: VoteResult[], state: GameState): void {
    const confessPlayers = results.find(r => r.optionId === 'confess')?.playerIds || [];
    const silentPlayers = results.find(r => r.optionId === 'silent')?.playerIds || [];

    const confessCount = confessPlayers.length;

    if (confessCount === 0) {
      // 没人告白：全员GPA+0.1
      for (const player of state.players) {
        player.gpa += 0.1;
      }
    } else if (confessCount % 2 === 1) {
      // 奇数人告白：告白者探索-2
      for (const player of state.players) {
        if (confessPlayers.includes(player.id)) {
          player.exploration = Math.max(0, player.exploration - 2);
        }
      }
    } else {
      // 偶数人告白且>0：告白者探索+3
      for (const player of state.players) {
        if (confessPlayers.includes(player.id)) {
          player.exploration += 3;
        }
      }
    }
  }

  private executeMajorityEffect(results: VoteResult[], state: GameState): void {
    if (results.length === 0) return;

    const winner = results[0];
    const isTie = results.length > 1 && results[0].count === results[1].count;

    // 平局时的处理（通常全员+0.1GPA或其他效果）
    if (isTie) {
      for (const player of state.players) {
        player.gpa += 0.1;
      }
    }
  }
}
