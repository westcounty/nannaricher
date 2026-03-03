// server/src/game/rules/CardEffectHandler.ts
import { Card, Player, GameState, PendingAction } from '@nannaricher/shared';
import { VotingSystem } from '../interaction/VotingSystem.js';
import { ChainActionSystem } from '../interaction/ChainActionSystem.js';

export interface CardEffectContext {
  card: Card;
  player: Player;
  state: GameState;
  diceValue?: number;
  targetPlayerId?: string;
}

export interface CardEffectResult {
  success: boolean;
  message: string;
  pendingAction?: PendingAction;
  effects?: {
    money?: number;
    gpa?: number;
    exploration?: number;
    skipTurn?: boolean;
    moveTo?: string;
    drawCard?: 'chance' | 'destiny';
    custom?: string;
  };
}

export class CardEffectHandler {
  private votingSystem: VotingSystem;
  private chainSystem: ChainActionSystem;

  constructor() {
    this.votingSystem = new VotingSystem();
    this.chainSystem = new ChainActionSystem();
  }

  /**
   * 处理卡牌效果
   */
  handleCardEffect(context: CardEffectContext): CardEffectResult {
    const { card, player, state } = context;

    // 手持卡牌通常需要特殊触发条件
    if (card.holdable) {
      return this.handleHoldableCard(context);
    }

    // 即时卡牌根据ID处理
    return this.handleInstantCard(context);
  }

  /**
   * 处理手持型卡牌
   */
  private handleHoldableCard(context: CardEffectContext): CardEffectResult {
    const { card, player } = context;

    switch (card.id) {
      case 'destiny_maimen_shield':
        return {
          success: true,
          message: '麦门护盾已激活，下次食堂线负面效果将被屏蔽',
          effects: { custom: 'maimen_shield_active' },
        };

      case 'destiny_stop_loss':
        return {
          success: true,
          message: '及时止损：取消即将执行的事件',
          effects: { custom: 'stop_loss' },
        };

      case 'destiny_urgent_deadline':
        return {
          success: true,
          message: '工期紧迫：可直接离开校医院或鼎',
          effects: { custom: 'urgent_deadline' },
        };

      case 'destiny_negative_balance':
        return {
          success: true,
          message: '余额为负：可抵消一次大额支出',
          effects: { custom: 'negative_balance' },
        };

      case 'destiny_inherited_papers':
        return {
          success: true,
          message: '祖传试卷：抵消GPA负面效果',
          effects: { custom: 'gpa_shield' },
        };

      case 'destiny_throw_stone':
        return {
          success: true,
          message: '投石问路：抵消金钱负面效果',
          effects: { custom: 'money_shield' },
        };

      case 'destiny_campus_legend':
        return {
          success: true,
          message: '校园传说：抵消探索值负面效果',
          effects: { custom: 'exploration_shield' },
        };

      case 'destiny_alternative_path':
        return {
          success: true,
          message: '另辟蹊径：直接移动到线路终点',
          effects: { custom: 'alternative_path' },
        };

      case 'destiny_major_admission':
        return {
          success: true,
          message: '大类招生：延迟一回合选定培养计划',
          effects: { custom: 'delay_plan_selection' },
        };

      case 'destiny_cross_college_exit':
        return {
          success: true,
          message: '跨院准出：取消一个已固定的培养计划',
          effects: { custom: 'unfix_plan' },
        };

      case 'destiny_professional_intention':
        return {
          success: true,
          message: '专业意向：提前固定培养计划',
          effects: { gpa: 0.1, exploration: 1, custom: 'early_plan_fix' },
        };

      case 'destiny_familiar_route':
        return {
          success: true,
          message: '轻车熟路：领取经验卡后可再次进入',
          effects: { custom: 'familiar_route' },
        };

      case 'destiny_how_to_explain':
        return {
          success: true,
          message: '如何解释：取消本次格子事件',
          effects: { custom: 'cancel_cell_event' },
        };

      case 'destiny_drum_beat_return':
        return {
          success: true,
          message: '鼓点重奏：再投一次骰子选择结果',
          effects: { custom: 'drum_beat_return' },
        };

      // 机会卡手持型
      case 'chance_info_blocked':
        return {
          success: true,
          message: '消息闭塞：抵消任意玩家机会卡',
          effects: { custom: 'block_chance' },
        };

      case 'chance_false_move':
        return {
          success: true,
          message: '虚晃一枪：抵消任意玩家命运卡',
          effects: { custom: 'block_destiny' },
        };

      case 'chance_pie_in_sky':
        return {
          success: true,
          message: '画饼充饥：取消其他玩家格子事件',
          effects: { custom: 'cancel_other_event' },
        };

      case 'chance_one_jump_relief':
        return {
          success: true,
          message: '一跃愁解：使目标下次效果反转',
          effects: { custom: 'reverse_effect' },
        };

      case 'chance_water_power_outage':
        return {
          success: true,
          message: '停水停电：禁止任意玩家行动',
          effects: { custom: 'skip_player_turn' },
        };

      case 'chance_mending_plan':
        return {
          success: true,
          message: '补天计划：玩家即将胜利时可抢先行动',
          effects: { custom: 'mending_plan' },
        };

      default:
        return { success: false, message: `未知的手持卡牌: ${card.id}` };
    }
  }

  /**
   * 处理即时型卡牌
   */
  private handleInstantCard(context: CardEffectContext): CardEffectResult {
    const { card, player, state } = context;

    // 检查是否是投票卡
    const voteAction = this.votingSystem.createVoteAction(card.id, state);
    if (voteAction) {
      return {
        success: true,
        message: `投票卡：${card.name}`,
        pendingAction: voteAction,
      };
    }

    // 检查是否是连锁行动卡
    if (this.isChainActionCard(card.id)) {
      // 返回需要启动连锁的信号
      return {
        success: true,
        message: `连锁行动卡：${card.name}`,
        pendingAction: {
          id: `chain_start_${card.id}`,
          playerId: player.id,
          type: 'chain_action',
          prompt: card.description,
          cardId: card.id,
          timeoutMs: 30000,
        },
      };
    }

    // 处理简单效果卡
    if (card.effects && card.effects.length > 0) {
      return this.applySimpleEffects(context);
    }

    // 处理特殊效果卡
    return this.handleSpecialCard(context);
  }

  /**
   * 应用简单数值效果
   */
  private applySimpleEffects(context: CardEffectContext): CardEffectResult {
    const { card, player } = context;
    const effects: CardEffectResult['effects'] = {};
    const messages: string[] = [];

    for (const effect of card.effects!) {
      if (effect.stat && effect.delta !== undefined) {
        switch (effect.stat) {
          case 'money':
            effects.money = (effects.money || 0) + effect.delta;
            messages.push(`金钱${effect.delta >= 0 ? '+' : ''}${effect.delta}`);
            break;
          case 'gpa':
            effects.gpa = (effects.gpa || 0) + effect.delta;
            messages.push(`GPA${effect.delta >= 0 ? '+' : ''}${effect.delta}`);
            break;
          case 'exploration':
            effects.exploration = (effects.exploration || 0) + effect.delta;
            messages.push(`探索${effect.delta >= 0 ? '+' : ''}${effect.delta}`);
            break;
        }
      }
    }

    return {
      success: true,
      message: `${card.name}：${messages.join('，')}`,
      effects,
    };
  }

  /**
   * 处理特殊效果卡
   */
  private handleSpecialCard(context: CardEffectContext): CardEffectResult {
    const { card, player, state, diceValue } = context;

    switch (card.id) {
      case 'destiny_boss_recruit':
        // BOSS直聘：探索值重置为点数*0.1*当前探索值
        if (diceValue) {
          const newExp = diceValue * 0.1 * player.exploration;
          return {
            success: true,
            message: `BOSS直聘：探索值从${player.exploration}变为${newExp.toFixed(1)}`,
            effects: { exploration: newExp - player.exploration },
          };
        }
        return { success: false, message: '需要投骰子' };

      case 'destiny_mutual_help':
        // 手望相助：二选一
        return {
          success: true,
          message: '手望相助：是否关注手手？',
          pendingAction: {
            id: `choose_${card.id}`,
            playerId: player.id,
            type: 'choose_option',
            prompt: '是否在各平台关注了手手？(是: 金钱+100, 否: 探索-2，金钱-200)',
            options: [
              { label: '是', value: 'yes' },
              { label: '否', value: 'no' },
            ],
            timeoutMs: 60000,
          },
        };

      case 'destiny_questionnaire':
        // 问卷调查：二选一
        return {
          success: true,
          message: '问卷调查：选择奖励',
          pendingAction: {
            id: `choose_${card.id}`,
            playerId: player.id,
            type: 'choose_option',
            prompt: '选择一项执行',
            options: [
              { label: '+50金', value: '50gold' },
              { label: '暂停1回合+200金', value: 'skip200' },
            ],
            timeoutMs: 60000,
          },
        };

      case 'destiny_beijing_university':
        return {
          success: true,
          message: '北京大学：移动到浦口线强制进入',
          effects: { moveTo: 'line_pukou' },
        };

      case 'destiny_chew_vegetable_root':
        return {
          success: true,
          message: '嚼得菜根：移动到学习线',
          effects: { moveTo: 'line_study' },
        };

      case 'destiny_more_the_better':
        return {
          success: true,
          message: '多多益善：移动到家教创业线',
          effects: { moveTo: 'line_money' },
        };

      case 'destiny_start_new_stove':
        return {
          success: true,
          message: '另起炉灶：移动到苏州线',
          effects: { moveTo: 'line_suzhou' },
        };

      case 'destiny_next_station_xianlin':
        return {
          success: true,
          message: '移动到仙林线',
          effects: { moveTo: 'line_xianlin' },
        };

      case 'destiny_north_south_gaze':
        return {
          success: true,
          message: '南北相望：移动到鼓楼线',
          effects: { moveTo: 'line_gulou' },
        };

      case 'destiny_see_more_eat_more':
        return {
          success: true,
          message: '见多食广：移动到食堂线强制进入',
          effects: { moveTo: 'line_food' },
        };

      case 'destiny_social_phobia':
        return {
          success: true,
          message: '社恐分子：移动到学生组织与活动线',
          effects: { moveTo: 'line_explore' },
        };

      case 'destiny_campus_legend_move':
        return {
          success: true,
          message: '校园传说：移动到鼎',
          effects: { moveTo: 'ding' },
        };

      case 'destiny_fengshui_rotation':
        return {
          success: true,
          message: '风水轮转：下回合行动顺序反转',
          effects: { custom: 'reverse_turn_order' },
        };

      case 'destiny_system_failure':
        return {
          success: true,
          message: '系统故障：下回合金钱始终为0',
          effects: { custom: 'system_fault' },
        };

      case 'destiny_delayed_gratification':
        return {
          success: true,
          message: '延迟满足：选择是否执行',
          pendingAction: {
            id: `choose_${card.id}`,
            playerId: player.id,
            type: 'choose_option',
            prompt: '是否执行延迟满足？(执行: 下回合金钱归0，未破产则恢复+500金)',
            options: [
              { label: '执行', value: 'execute' },
              { label: '不执行', value: 'skip' },
            ],
            timeoutMs: 60000,
          },
        };

      case 'destiny_limited_supply':
      case 'destiny_skateboard_genius':
      case 'destiny_closing_music':
      case 'destiny_seven_year_itch':
        return {
          success: true,
          message: card.description,
          effects: { custom: card.id },
        };

      // 机会卡即时型
      case 'chance_garbage_collection':
        // 垃圾回收：所有人卡牌放回牌堆
        for (const p of state.players) {
          state.cardDecks.chance.push(...p.heldCards.filter(c => c.deckType === 'chance'));
          state.cardDecks.destiny.push(...p.heldCards.filter(c => c.deckType === 'destiny'));
          p.heldCards = [];
        }
        return { success: true, message: '垃圾回收：所有人卡牌放回牌堆' };

      case 'chance_steal_rich_help_poor':
        return {
          success: true,
          message: '盗亦有道：最富-200金，最穷+200金',
          effects: { custom: 'steal_rich_help_poor' },
        };

      case 'chance_score_conversion':
        return {
          success: true,
          message: '分制转换：最高GPA-0.2，最低+0.2',
          effects: { custom: 'score_conversion' },
        };

      case 'chance_reorganize_dorm':
        return {
          success: true,
          message: '重组宿舍：最高探索-2，最低+2',
          effects: { custom: 'reorganize_dorm' },
        };

      case 'chance_robin_hood':
        return {
          success: true,
          message: '劫富济贫：选择一位玩家金钱取平均',
          pendingAction: {
            id: `choose_${card.id}`,
            playerId: player.id,
            type: 'choose_player',
            prompt: '选择一位玩家，你们的金钱将取平均',
            targetPlayerIds: state.players.filter(p => p.id !== player.id).map(p => p.id),
            timeoutMs: 60000,
          },
        };

      case 'chance_budget_sharing':
        for (const p of state.players) {
          p.money = 800;
        }
        return { success: true, message: '经费均摊：所有玩家金钱重置为800' };

      default:
        return { success: true, message: card.description, effects: { custom: card.id } };
    }
  }

  private isChainActionCard(cardId: string): boolean {
    return ['chance_southbound_rose', 'chance_delivery_theft', 'chance_gossip_secret'].includes(cardId);
  }
}
