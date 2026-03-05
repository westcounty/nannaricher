// server/src/game/handlers/card-registry.ts
// Card effect registry — maps every card ID to a pure handler function.
// Used by CardEffectHandler / GameEngine for resolving card effects.

import type { Card, Player, GameState, PendingAction } from '@nannaricher/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
    moveToLine?: string;
    drawCard?: 'chance' | 'destiny' | 'any';
    drawCardCount?: number;
    custom?: string;
    targetPlayerId?: string;
    targetEffects?: { money?: number; gpa?: number; exploration?: number };
  };
}

type CardHandler = (ctx: CardEffectContext) => CardEffectResult;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const CARD_HANDLERS = new Map<string, CardHandler>();

function register(cardId: string, handler: CardHandler): void {
  CARD_HANDLERS.set(cardId, handler);
}

// ===========================================================================
//  DESTINY CARDS  (命运卡)  —  51 cards
// ===========================================================================

// ---- Holdable destiny cards (13) ----

register('destiny_maimen_shield', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：单次使用，食堂线屏蔽负面效果`,
  effects: { custom: 'maimen_shield_active' },
}));

register('destiny_stop_loss', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：取消自己即将执行的线内格子或大格子事件`,
  effects: { custom: 'stop_loss' },
}));

register('destiny_urgent_deadline', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：可直接离开校医院或鼎，不需要达成对应条件`,
  effects: { custom: 'urgent_deadline' },
}));

register('destiny_negative_balance', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：可抵消一次不小于当前剩余金钱的支出`,
  effects: { custom: 'negative_balance' },
}));

register('destiny_inherited_papers', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：抵消一次自己的GPA负面效果`,
  effects: { custom: 'gpa_shield' },
}));

register('destiny_throw_stone', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：抵消一次自己的金钱负面效果`,
  effects: { custom: 'money_shield' },
}));

register('destiny_campus_legend', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：抵消一次自己的探索值负面效果`,
  effects: { custom: 'exploration_shield' },
}));

register('destiny_alternative_path', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：在线内将自己直接移动到终点，不领取终点经验卡奖励`,
  effects: { custom: 'alternative_path' },
}));

register('destiny_cross_college_exit', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：取消一个自己的已经固定的培养方案`,
  effects: { custom: 'unfix_plan' },
}));

register('destiny_professional_intention', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：提前一回合固定培养方案，GPA +0.1，探索值 +1`,
  effects: { gpa: 0.1, exploration: 1, custom: 'early_plan_fix' },
}));

register('destiny_familiar_route', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：领取经验卡奖励后可回到该线起点并再次进入`,
  effects: { custom: 'familiar_route' },
}));

register('destiny_how_to_explain', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：取消本次需要执行的格子事件`,
  effects: { custom: 'cancel_cell_event' },
}));

register('destiny_drum_beat_return', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：再投一次骰子，然后自行选择一次的结果执行`,
  effects: { custom: 'drum_beat_return' },
}));

// ---- Immediate destiny cards — simple numeric effects ----

register('destiny_sustainability', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：创办账号成功恰饭，金钱 +300`,
  effects: { money: 300 },
}));

register('destiny_survival', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：接手账号发现入不敷出，金钱 -300`,
  effects: { money: -300 },
}));

register('destiny_anniversary_coupon', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：发现校园卡充值立减羊毛，金钱 +100`,
  effects: { money: 100 },
}));

register('destiny_light_reporting', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：购买学校的480生活用品套餐，金钱 -480`,
  effects: { money: -480 },
}));

register('destiny_yellow_millet_dream', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：睡过了四六级考试报名费打水漂，金钱 -30`,
  effects: { money: -30 },
}));

register('destiny_precision_instrument', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：设备时间和选课网站一致抢课大胜利，GPA +0.2`,
  effects: { gpa: 0.2 },
}));

register('destiny_happy_new_year', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：帮助创作红包封面，探索值 +3`,
  effects: { exploration: 3 },
}));

register('destiny_with_light', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：网速太快触发彩蛋，探索值 +1`,
  effects: { exploration: 1 },
}));

register('destiny_fragmented_life', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：时间表被必修课切得零碎毫无学习动力，GPA -0.2`,
  effects: { gpa: -0.2 },
}));

register('destiny_love_at_first_sight', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：在图书馆遇到喜欢的人成为常客，GPA +0.3`,
  effects: { gpa: 0.3 },
}));

register('destiny_three_idles', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：总是在各群答疑，传承和发展，探索值 +5`,
  effects: { exploration: 5 },
}));

register('destiny_five_lakes', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：和来自各地的同学学习方言，探索值 +1`,
  effects: { exploration: 1 },
}));

register('destiny_six_dynasties', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：尝试多个博物馆的讲解志愿，探索值 +2`,
  effects: { exploration: 2 },
}));

register('destiny_eight_directions_wealth', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：南哪变有钱了正版软件日渐完善，金钱 +200`,
  effects: { money: 200 },
}));

register('destiny_jiuxiang_river', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：九乡河名字不如九龙湖气派，探索值 +1`,
  effects: { exploration: 1 },
}));

register('destiny_ten_rice_noodles', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：被十全米线的美好爱情打动，探索值 +3`,
  effects: { exploration: 3 },
}));

register('destiny_hundred_shots', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：在方肇周第一次射箭就命中靶心，探索值 +1`,
  effects: { exploration: 1 },
}));

register('destiny_thousand_years', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：对南哪拥有坚定信心为南哪激情捐款，金钱 -500`,
  effects: { money: -500 },
}));

// ---- Immediate destiny cards — require dice / choice / special logic ----

register('destiny_boss_recruit', (ctx) => {
  // BOSS直聘：投骰子，探索值重置为 点数*0.1*当前探索值
  if (ctx.diceValue !== undefined) {
    const newExp = Math.round(ctx.diceValue * 0.1 * ctx.player.exploration * 10) / 10;
    return {
      success: true,
      message: `${ctx.card.name}：投出 ${ctx.diceValue}，探索值从 ${ctx.player.exploration} 变为 ${newExp}`,
      effects: { exploration: newExp - ctx.player.exploration },
    };
  }
  // 需要先掷骰子
  return {
    success: true,
    message: `${ctx.card.name}：需要投骰子决定探索值变化`,
    pendingAction: {
      id: `roll_${ctx.card.id}`,
      playerId: ctx.player.id,
      type: 'roll_dice',
      prompt: '投掷骰子决定探索值重置：探索值 = 点数 * 0.1 * 当前探索值',
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

register('destiny_mutual_help', (ctx) => ({
  // 手望相助：是否在各平台关注了手手？
  success: true,
  message: `${ctx.card.name}：是否在各平台关注了手手？`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_option',
    prompt: '是否在各平台关注了手手？(是: 金钱 +100, 否: 探索值 -2，金钱 -200)',
    options: [
      { label: '是（金钱 +100）', value: 'yes' },
      { label: '否（探索值 -2，金钱 -200）', value: 'no' },
    ],
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

register('destiny_strong_base_plan', (ctx) => ({
  // 强基计划：再抽一张培养方案，选定一个固定，GPA +0.2
  success: true,
  message: `${ctx.card.name}：再抽取一张培养方案并选定固定，GPA +0.2`,
  effects: { gpa: 0.2, custom: 'draw_and_fix_plan' },
}));

register('destiny_national_special', (ctx) => ({
  // 国家专项：再抽一张培养方案，选定一个固定，金钱 +200
  success: true,
  message: `${ctx.card.name}：再抽取一张培养方案并选定固定，金钱 +200`,
  effects: { money: 200, custom: 'draw_and_fix_plan' },
}));

register('destiny_secondary_selection', (ctx) => ({
  // 二次选拔：再抽一张培养方案，选定一个固定，探索值 +2
  success: true,
  message: `${ctx.card.name}：再抽取一张培养方案并选定固定，探索值 +2`,
  effects: { exploration: 2, custom: 'draw_and_fix_plan' },
}));

register('destiny_sino_foreign', (ctx) => ({
  // 中外合办：花费400金钱，再抽取一张培养计划，获得3探索值
  success: true,
  message: `${ctx.card.name}：花费400金钱再抽取一张培养计划，探索值 +3`,
  effects: { money: -400, exploration: 3, custom: 'draw_plan' },
}));

register('destiny_questionnaire', (ctx) => ({
  // 问卷调查：选择 +50金 或 暂停一回合 +200金
  success: true,
  message: `${ctx.card.name}：选择奖励`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_option',
    prompt: '选择一项执行',
    options: [
      { label: '获得50金钱', value: '50gold' },
      { label: '暂停一回合获得200金钱', value: 'skip200' },
    ],
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

register('destiny_swallowing_elevator', (ctx) => {
  // 吞噬电梯：掷骰子，未掷到6则停留一回合 + GPA -0.1
  if (ctx.diceValue !== undefined) {
    if (ctx.diceValue !== 6) {
      return {
        success: true,
        message: `${ctx.card.name}：投出 ${ctx.diceValue}，电梯故障！停留一回合，GPA -0.1`,
        effects: { gpa: -0.1, skipTurn: true },
      };
    }
    return {
      success: true,
      message: `${ctx.card.name}：投出 6，安全到达！`,
    };
  }
  return {
    success: true,
    message: `${ctx.card.name}：需要投骰子`,
    pendingAction: {
      id: `roll_${ctx.card.id}`,
      playerId: ctx.player.id,
      type: 'roll_dice',
      prompt: '投掷骰子，如果未掷到6则停留一回合且GPA -0.1',
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

// ---- Movement destiny cards ----

register('destiny_beijing_university', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：直接移动到浦口线，强制进入`,
  effects: { moveToLine: 'pukou' },
}));

register('destiny_chew_vegetable_root', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：直接移动到学习线`,
  effects: { moveToLine: 'study' },
}));

register('destiny_more_the_better', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：直接移动到家教创业线`,
  effects: { moveToLine: 'money' },
}));

register('destiny_start_new_stove', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：直接移动到苏州线`,
  effects: { moveToLine: 'suzhou' },
}));

register('destiny_next_station_xianlin', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：直接移动到仙林线`,
  effects: { moveToLine: 'xianlin' },
}));

register('destiny_north_south_gaze', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：直接移动到鼓楼线`,
  effects: { moveToLine: 'gulou' },
}));

register('destiny_see_more_eat_more', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：直接移动到食堂线，强制进入`,
  effects: { moveToLine: 'food' },
}));

register('destiny_social_phobia', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：直接移动到学生组织与活动线`,
  effects: { moveToLine: 'explore' },
}));

register('destiny_campus_legend_move', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：直接移动到鼎`,
  effects: { moveTo: 'ding' },
}));

register('destiny_eryuan_square', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：向前移动两格`,
  effects: { custom: 'move_forward_2' },
}));

register('destiny_civil_aviation_overspeed', (ctx) => ({
  // 民航超速：可以移动到前面12格中任意一格
  success: true,
  message: `${ctx.card.name}：可以移动到前面十二个格子中任意一格`,
  effects: { custom: 'civil_aviation_overspeed' },
}));

// ---- Special mechanic destiny cards ----

register('destiny_listen_leave_south', (ctx) => ({
  // 听离南常：以下两个效果二选一
  success: true,
  message: `${ctx.card.name}：以下两个效果二选一`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_option',
    prompt: '听离南常：选择一个效果执行',
    options: [
      { label: '效果一', value: 'option_a' },
      { label: '效果二', value: 'option_b' },
    ],
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

register('destiny_thank_you', (ctx) => ({
  // 谢谢惠顾：再抽一张命运卡
  success: true,
  message: `${ctx.card.name}：再抽一张命运卡`,
  effects: { drawCard: 'destiny', drawCardCount: 1 },
}));

register('destiny_fengshui_rotation', (ctx) => ({
  // 风水轮转：下一回合所有玩家行动顺序反转
  success: true,
  message: `${ctx.card.name}：下一回合开始时所有玩家行动顺序反转`,
  effects: { custom: 'reverse_turn_order' },
}));

register('destiny_limited_supply', (ctx) => {
  // 限量供应：投两次骰子，后大于前则探索+2，否则暂停一回合
  if (ctx.diceValue !== undefined) {
    // diceValue encodes the two rolls (handled by caller)
    return {
      success: true,
      message: `${ctx.card.name}：需要投两次骰子比较大小`,
      effects: { custom: 'limited_supply_dice' },
    };
  }
  return {
    success: true,
    message: `${ctx.card.name}：投两次骰子，后大于前则探索值 +2，否则暂停一回合`,
    effects: { custom: 'limited_supply_dice' },
  };
});

register('destiny_skateboard_genius', (ctx) => ({
  // 滑板天才：下次行动投掷两次骰子，移动两次点数之和
  success: true,
  message: `${ctx.card.name}：下次行动时投掷两次骰子，向前移动两次点数之和`,
  effects: { custom: 'double_dice' },
}));

register('destiny_closing_music', (ctx) => ({
  // 闭馆音乐：下次行动时触发的效果改为触发两次
  success: true,
  message: `${ctx.card.name}：下次行动时触发的效果改为触发两次`,
  effects: { custom: 'double_event' },
}));

register('destiny_system_failure', (ctx) => ({
  // 系统故障：下回合金钱始终为0
  success: true,
  message: `${ctx.card.name}：下一回合内金钱数始终为0，待新回合开始后恢复`,
  effects: { custom: 'system_fault' },
}));

register('destiny_delayed_gratification', (ctx) => ({
  // 延迟满足：选择是否执行
  success: true,
  message: `${ctx.card.name}：选择是否执行延迟满足`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_option',
    prompt: '是否执行延迟满足？（下回合金钱归0，未破产则恢复+500金）',
    options: [
      { label: '执行延迟满足', value: 'execute' },
      { label: '不执行', value: 'skip' },
    ],
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

// ---- Voting destiny card ----

register('destiny_four_schools', (ctx) => ({
  // 四校联动：所有玩家选校区 + 投骰子 → 委托 VotingSystem
  success: true,
  message: `${ctx.card.name}：所有玩家分别选择一个校区，抽卡者投骰子`,
  effects: { custom: 'voting_four_schools' },
}));

// ---- Number series destiny cards (dice-dependent) ----

register('destiny_seven_year_itch', (ctx) => ({
  // 七年之痒：投两次骰子，和为7则选择奖励
  success: true,
  message: `${ctx.card.name}：投两次骰子，若点数之和为7则选择奖励`,
  effects: { custom: 'seven_year_itch_dice' },
}));

// ===========================================================================
//  CHANCE CARDS  (机会卡)  —  42 cards
// ===========================================================================

// ---- Holdable chance cards (6) ----

register('chance_info_blocked', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：抵消一次任意玩家的机会卡效果`,
  effects: { custom: 'block_chance' },
}));

register('chance_false_move', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：抵消一次任意玩家的命运卡效果`,
  effects: { custom: 'block_destiny' },
}));

register('chance_pie_in_sky', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：取消除自己外任意一名玩家即将执行的事件`,
  effects: { custom: 'cancel_other_event' },
}));

register('chance_one_jump_relief', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：指定一位玩家，其下次执行事件时增减效果反转`,
  effects: { custom: 'reverse_effect' },
}));

register('chance_water_power_outage', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：当任意玩家即将行动时禁止之，且不重复执行当前格子事件`,
  effects: { custom: 'skip_player_turn' },
}));

register('chance_mending_plan', (ctx) => ({
  success: true,
  message: `${ctx.card.name}：当任意玩家即将胜利时你立即行动一次抢先`,
  effects: { custom: 'mending_plan' },
}));

// ---- Immediate chance cards — redistribution ----

register('chance_garbage_collection', (ctx) => ({
  // 垃圾回收：所有人持有的卡牌放回牌堆
  success: true,
  message: `${ctx.card.name}：场上所有人持有的机会卡和命运卡重新放回牌堆`,
  effects: { custom: 'garbage_collection' },
}));

register('chance_steal_rich_help_poor', (ctx) => {
  // 盗亦有道：金钱最多者 -200，最少者 +200
  const sorted = [...ctx.state.players].sort((a, b) => b.money - a.money);
  const richest = sorted[0];
  const poorest = sorted[sorted.length - 1];
  return {
    success: true,
    message: `${ctx.card.name}：${richest.name} 金钱 -200，${poorest.name} 金钱 +200`,
    effects: {
      custom: 'steal_rich_help_poor',
      targetPlayerId: richest.id,
      targetEffects: { money: -200 },
    },
  };
});

register('chance_score_conversion', (ctx) => {
  // 分制转换：GPA最高者 -0.2，最低者 +0.2
  const sorted = [...ctx.state.players].sort((a, b) => b.gpa - a.gpa);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  return {
    success: true,
    message: `${ctx.card.name}：${highest.name} GPA -0.2，${lowest.name} GPA +0.2`,
    effects: {
      custom: 'score_conversion',
      targetPlayerId: highest.id,
      targetEffects: { gpa: -0.2 },
    },
  };
});

register('chance_reorganize_dorm', (ctx) => {
  // 重组宿舍：探索值最高者 -2，最低者 +2
  const sorted = [...ctx.state.players].sort((a, b) => b.exploration - a.exploration);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];
  return {
    success: true,
    message: `${ctx.card.name}：${highest.name} 探索值 -2，${lowest.name} 探索值 +2`,
    effects: {
      custom: 'reorganize_dorm',
      targetPlayerId: highest.id,
      targetEffects: { exploration: -2 },
    },
  };
});

register('chance_robin_hood', (ctx) => ({
  // 劫富济贫：选择一位玩家，金钱取平均
  success: true,
  message: `${ctx.card.name}：选择除自己外一位玩家，金钱重置为两人平均值`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_player',
    prompt: '选择一位玩家，你们的金钱将重置为两人金钱数的平均',
    targetPlayerIds: ctx.state.players
      .filter(p => p.id !== ctx.player.id)
      .map(p => p.id),
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

register('chance_budget_sharing', (ctx) => ({
  // 经费均摊：所有玩家金钱重置为800
  success: true,
  message: `${ctx.card.name}：场上所有玩家的金钱数重置为800`,
  effects: { custom: 'budget_sharing_800' },
}));

// ---- Immediate chance cards — need player selection ----

register('chance_peer_mentor', (ctx) => ({
  // 朋辈导师：拿走别人一张卡片 / 或给出一张
  success: true,
  message: `${ctx.card.name}：拿走别人一张卡片，如果没有其它玩家拥有卡片则交出一张`,
  effects: { custom: 'peer_mentor' },
}));

register('chance_joint_training', (ctx) => ({
  // 联合培养：选择一位玩家交换未固定培养计划
  success: true,
  message: `${ctx.card.name}：选择一位其他玩家，将你们各自一张未固定的培养计划交换`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_player',
    prompt: '选择一位其他玩家交换未固定的培养计划',
    targetPlayerIds: ctx.state.players
      .filter(p => p.id !== ctx.player.id)
      .map(p => p.id),
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

register('chance_discipline_evaluation', (ctx) => ({
  // 学科评估：抽取培养计划替换某位玩家未固定的
  success: true,
  message: `${ctx.card.name}：抽取一张培养计划并选择一位玩家替换其未固定的培养计划`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_player',
    prompt: '选择一位玩家，替换其一张未固定的培养计划',
    targetPlayerIds: ctx.state.players
      .filter(p => p.id !== ctx.player.id)
      .map(p => p.id),
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

// ---- Immediate chance cards — choose player + dice compare ----

register('chance_knowledge_competition', (ctx) => ({
  // 知识竞赛：选择一位玩家，GPA总和>=5.0则各得200金，否则各得1探索+0.1GPA
  success: true,
  message: `${ctx.card.name}：选择一位其他玩家进行知识竞赛`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_player',
    prompt: '选择一位其他玩家，若你们GPA总和>=5.0则各得200金钱，否则各得1探索值和0.1GPA',
    targetPlayerIds: ctx.state.players
      .filter(p => p.id !== ctx.player.id)
      .map(p => p.id),
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

register('chance_pair_programming', (ctx) => ({
  // 结对编程：选择一位玩家，GPA高者+0.1，低者+0.2，相等各+0.3
  success: true,
  message: `${ctx.card.name}：选择一位其他玩家进行结对编程`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_player',
    prompt: '选择一位其他玩家，GPA更高者 +0.1GPA，更低者 +0.2GPA，相等各 +0.3GPA',
    targetPlayerIds: ctx.state.players
      .filter(p => p.id !== ctx.player.id)
      .map(p => p.id),
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

// ---- Immediate chance cards — dice duel (choose player + dice) ----

register('chance_group_presentation', (ctx) => ({
  // 分组展示：选择一位玩家，各投骰子，奇偶相同各+0.2GPA，不同各+0.1GPA
  success: true,
  message: `${ctx.card.name}：选择一位其他玩家，各投骰子比较奇偶`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_player',
    prompt: '选择一位其他玩家，各投一次骰子，点数奇偶相同各 +0.2GPA，否则各 +0.1GPA',
    targetPlayerIds: ctx.state.players
      .filter(p => p.id !== ctx.player.id)
      .map(p => p.id),
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

register('chance_travel_buddy', (ctx) => ({
  // 旅游搭子：选择一位玩家，各投骰子，奇偶相同各+2探索，不同各+1探索
  success: true,
  message: `${ctx.card.name}：选择一位其他玩家作为旅游搭子`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_player',
    prompt: '选择一位其他玩家，各投一次骰子，点数奇偶相同各 +2探索值，否则各 +1探索值',
    targetPlayerIds: ctx.state.players
      .filter(p => p.id !== ctx.player.id)
      .map(p => p.id),
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

register('chance_group_buy', (ctx) => ({
  // 拼单活动：选择一位玩家，各投骰子，奇偶相同各+200金，不同各+100金
  success: true,
  message: `${ctx.card.name}：选择一位其他玩家进行拼单`,
  pendingAction: {
    id: `choose_${ctx.card.id}`,
    playerId: ctx.player.id,
    type: 'choose_player',
    prompt: '选择一位其他玩家，各投一次骰子，点数奇偶相同各 +200金钱，否则各 +100金钱',
    targetPlayerIds: ctx.state.players
      .filter(p => p.id !== ctx.player.id)
      .map(p => p.id),
    timeoutMs: 60000,
    cardId: ctx.card.id,
  },
}));

// ---- Immediate chance cards — choose two players + dice duel ----

register('chance_flipped_classroom', (ctx) => ({
  // 翻转课堂：选择两位玩家，各投骰子，大者GPA +0.2，小者GPA -0.1
  success: true,
  message: `${ctx.card.name}：选择任意两位玩家投骰子比较`,
  effects: { custom: 'flipped_classroom_dice' },
}));

register('chance_student_union_interview', (ctx) => ({
  // 团学面试：选择两位玩家，各投骰子，大者探索+2，小者探索-1
  success: true,
  message: `${ctx.card.name}：选择任意两位玩家投骰子比较`,
  effects: { custom: 'student_union_interview_dice' },
}));

register('chance_like_collection', (ctx) => ({
  // 集赞抽奖：选择两位玩家，各投骰子，大者金钱+200，小者金钱-100
  success: true,
  message: `${ctx.card.name}：选择任意两位玩家投骰子比较`,
  effects: { custom: 'like_collection_dice' },
}));

// ---- Immediate chance cards — grid management (link two players) ----

register('chance_grid_management', (ctx) => ({
  // 网格管理：选择两位玩家，下回合内同步增减
  success: true,
  message: `${ctx.card.name}：选择任意两位玩家，下回合内他们的增减同步`,
  effects: { custom: 'grid_management_link' },
}));

// ---- Voting chance cards — delegated to VotingSystem ----

register('chance_swimming_pool_regular', (ctx) => ({
  // 泳馆常客：所有玩家选按次/年卡 + 投骰子
  success: true,
  message: `${ctx.card.name}：所有玩家选择按次缴费或年卡用户，然后抽卡者投骰子`,
  effects: { custom: 'voting_swimming_pool_regular' },
}));

register('chance_meeting_is_fate', (ctx) => ({
  // 相逢是缘：所有玩家选图书馆/运动场 + 投骰子
  success: true,
  message: `${ctx.card.name}：所有玩家选择图书馆或运动场，然后抽卡者投骰子`,
  effects: { custom: 'voting_meeting_is_fate' },
}));

register('chance_first_snow', (ctx) => ({
  // 初雪留痕：所有玩家选初雪告白/大雪无声
  success: true,
  message: `${ctx.card.name}：所有玩家选择初雪告白或大雪无声`,
  effects: { custom: 'voting_first_snow' },
}));

register('chance_strange_tales', (ctx) => ({
  // 怪奇物谈：所有玩家选鼎里/天文山 + 投骰子
  success: true,
  message: `${ctx.card.name}：所有玩家选择鼎里或天文山，然后抽卡者投骰子`,
  effects: { custom: 'voting_strange_tales' },
}));

register('chance_root_finding_moment', (ctx) => ({
  // 寻根时刻：所有玩家选装潢一新/历史古迹 + 投骰子
  success: true,
  message: `${ctx.card.name}：所有玩家选择装潢一新或历史古迹，然后抽卡者投骰子`,
  effects: { custom: 'voting_root_finding_moment' },
}));

register('chance_rest_moment', (ctx) => ({
  // 休憩时刻：所有玩家选大气山/羊山湖（多数决）
  success: true,
  message: `${ctx.card.name}：所有玩家选择大气山或羊山湖`,
  effects: { custom: 'voting_rest_moment' },
}));

register('chance_light_shadow', (ctx) => ({
  // 光影变幻：所有玩家选藜照湖/菜根谭（多数决）
  success: true,
  message: `${ctx.card.name}：所有玩家选择藜照湖或菜根谭`,
  effects: { custom: 'voting_light_shadow' },
}));

register('chance_course_group', (ctx) => ({
  // 课程建群：查看最新有消息记录的渠道来源
  success: true,
  message: `${ctx.card.name}：所有玩家查看课程群中最新消息记录的渠道来源`,
  effects: { custom: 'voting_course_group' },
}));

register('chance_transfer_moment', (ctx) => ({
  // 换乘时刻：所有玩家选新街口/金马路 + 投骰子
  success: true,
  message: `${ctx.card.name}：所有玩家选择新街口或金马路，然后抽卡者投骰子`,
  effects: { custom: 'voting_transfer_moment' },
}));

register('chance_wit_words', (ctx) => ({
  // 妙语连珠：所有玩家选南哪辩论赛/南哪演说家 + 投骰子
  success: true,
  message: `${ctx.card.name}：所有玩家选择南哪辩论赛或南哪演说家，然后抽卡者投骰子`,
  effects: { custom: 'voting_wit_words' },
}));

register('chance_school_sports_meet', (ctx) => ({
  // 校运动会：所有玩家选入场式/广播操 + 投骰子
  success: true,
  message: `${ctx.card.name}：所有玩家选择入场式或广播操，然后抽卡者投骰子`,
  effects: { custom: 'voting_school_sports_meet' },
}));

register('chance_travel_method', (ctx) => ({
  // 出行方式：查看共享单车/电动车/滑板车开卡情况
  success: true,
  message: `${ctx.card.name}：所有玩家查看共享单车/电动车/滑板车开卡情况`,
  effects: { custom: 'voting_travel_method' },
}));

register('chance_delivery_theft', (ctx) => ({
  // 外卖贼盗：除抽卡者外选监控/沉默 + 投骰子 → 委托 ChainActionSystem
  success: true,
  message: `${ctx.card.name}：除抽卡者外所有玩家选择监控报警或默不作声，然后抽卡者投骰子`,
  effects: { custom: 'chain_delivery_theft' },
}));

// ---- Chain action chance cards — delegated to ChainActionSystem ----

register('chance_gossip_secret', (ctx) => ({
  // 八卦秘闻：悄悄告知链 → 委托 ChainActionSystem
  success: true,
  message: `${ctx.card.name}：选择一位玩家悄悄告知或放弃，被告知者继续选择`,
  effects: { custom: 'chain_gossip_secret' },
}));

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { CARD_HANDLERS };
export type { CardHandler };

export function getCardHandler(cardId: string): CardHandler | undefined {
  return CARD_HANDLERS.get(cardId);
}

/**
 * Get all registered card IDs
 */
export function getRegisteredCardIds(): string[] {
  return Array.from(CARD_HANDLERS.keys());
}

/**
 * Check whether a card ID has a registered handler
 */
export function hasCardHandler(cardId: string): boolean {
  return CARD_HANDLERS.has(cardId);
}
