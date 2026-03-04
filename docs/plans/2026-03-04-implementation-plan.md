# 菜根人生 完整优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将菜根人生从 46/100 提升到可上市水平，完成全部 103 张卡牌效果、33 个培养计划能力、服务端/客户端架构重构、动画系统、视觉设计、交互完善。

**Architecture:** 渐进式重构，每个 Phase 完成后游戏保持可运行。服务端采用 Coordinator 编排模式拆分 index.ts，客户端统一为 Zustand 状态管理 + PixiJS 分层渲染。

**Tech Stack:** TypeScript monorepo (shared + server + client), Express + Socket.IO, React 18, PixiJS v8.16, Zustand v5, Framer Motion v12, Vitest, Web Audio API

**Working Directory:** `D:\work\nannaricher`

---

## Phase 1: 规则引擎完善 (核心优先级)

> 目标：103 卡牌效果 100% + 33 能力 100% + 投票/连锁/延迟子系统

---

### Task 1: 扩展共享类型定义

**Files:**
- Modify: `shared/src/types.ts`
- Modify: `shared/src/constants.ts`

**Step 1: 在 types.ts Player 接口添加新字段**

在 `shared/src/types.ts:74` (gulou_endpoint_count 之后) 添加:

```typescript
  modifiedWinThresholds: Record<string, number>; // 社会学院/AI学院动态阈值
  lawyerShield: boolean;        // 法学院：金钱保护盾
  lastDiceValues: number[];     // 上次骰子值（供能力使用）
```

**Step 2: 在 constants.ts 添加游戏配置常量**

在 `shared/src/constants.ts` 末尾添加:

```typescript
// 回合上限（按人数）
export const TOTAL_ROUNDS: Record<number, number> = {
  2: 32, 3: 28, 4: 24, 5: 20, 6: 20,
};

// 支持2-6人
export const MAX_PLAYERS = 6;
export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#8e24aa', '#00897b'];
```

注意：覆盖原有 `MAX_PLAYERS = 4` 和 `PLAYER_COLORS`。

**Step 3: 构建 shared 包**

Run: `cd shared && npm run build`
Expected: 无错误

**Step 4: Commit**

```bash
git add shared/src/types.ts shared/src/constants.ts
git commit -m "feat(shared): extend Player interface with plan ability fields and game config"
```

---

### Task 2: 创建卡牌效果注册表

**Files:**
- Create: `server/src/game/handlers/card-registry.ts`

**Step 1: 创建注册表框架 + 基础卡牌处理函数**

```typescript
// server/src/game/handlers/card-registry.ts
import { Card, Player, GameState, PendingAction } from '@nannaricher/shared';

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
    moveTo?: string;         // cell id or 'forward_N' / 'backward_N'
    moveToLine?: string;     // line id
    drawCard?: 'chance' | 'destiny' | 'any';
    drawCardCount?: number;
    custom?: string;
    targetPlayerId?: string;
    targetEffects?: { money?: number; gpa?: number; exploration?: number };
  };
}

type CardHandler = (ctx: CardEffectContext) => CardEffectResult;
const CARD_HANDLERS = new Map<string, CardHandler>();

// === 命运卡：手持卡 ===

CARD_HANDLERS.set('destiny_maimen_shield', (ctx) => ({
  success: true,
  message: '麦门护盾已激活，下次食堂线负面效果将被屏蔽',
  effects: { custom: 'maimen_shield_active' },
}));

CARD_HANDLERS.set('destiny_stop_loss', (ctx) => ({
  success: true,
  message: '及时止损：取消即将执行的事件',
  effects: { custom: 'stop_loss' },
}));

CARD_HANDLERS.set('destiny_urgent_deadline', (ctx) => ({
  success: true,
  message: '工期紧迫：可直接离开校医院或鼎',
  effects: { custom: 'urgent_deadline' },
}));

CARD_HANDLERS.set('destiny_negative_balance', (ctx) => ({
  success: true,
  message: '余额为负：可抵消一次大额支出',
  effects: { custom: 'negative_balance' },
}));

CARD_HANDLERS.set('destiny_inherited_papers', (ctx) => ({
  success: true,
  message: '祖传试卷：抵消GPA负面效果',
  effects: { custom: 'gpa_shield' },
}));

CARD_HANDLERS.set('destiny_throw_stone', (ctx) => ({
  success: true,
  message: '投石问路：抵消金钱负面效果',
  effects: { custom: 'money_shield' },
}));

CARD_HANDLERS.set('destiny_campus_legend', (ctx) => ({
  success: true,
  message: '校园传说：抵消探索负面效果',
  effects: { custom: 'exploration_shield' },
}));

CARD_HANDLERS.set('destiny_alternative_path', (ctx) => ({
  success: true,
  message: '另辟蹊径：直接跳到支线终点',
  effects: { custom: 'skip_to_line_end' },
}));

CARD_HANDLERS.set('destiny_major_admission', (ctx) => ({
  success: true,
  message: '大类招生：延迟培养计划选择',
  effects: { custom: 'delay_plan_selection' },
}));

CARD_HANDLERS.set('destiny_cross_college_exit', (ctx) => ({
  success: true,
  message: '跨院准出：可取消一个已确认培养计划',
  effects: { custom: 'cancel_plan' },
}));

CARD_HANDLERS.set('destiny_professional_intention', (ctx) => ({
  success: true,
  message: '专业意向：+0.1 GPA, +1 探索',
  effects: { gpa: 0.1, exploration: 1 },
}));

CARD_HANDLERS.set('destiny_familiar_route', (ctx) => ({
  success: true,
  message: '轻车熟路：可重走当前支线',
  effects: { custom: 'replay_line' },
}));

CARD_HANDLERS.set('destiny_how_to_explain', (ctx) => ({
  success: true,
  message: '如何解释：取消当前事件',
  effects: { custom: 'cancel_event' },
}));

CARD_HANDLERS.set('destiny_drum_beat_return', (ctx) => ({
  success: true,
  message: '鼓点重奏：可重新掷骰子',
  effects: { custom: 'reroll_dice' },
}));

// === 命运卡：即时卡 ===

CARD_HANDLERS.set('destiny_sustainability', (ctx) => ({
  success: true,
  message: '可持续性：+300 金钱',
  effects: { money: 300 },
}));

CARD_HANDLERS.set('destiny_survival', (ctx) => ({
  success: true,
  message: '存活下去：-300 金钱',
  effects: { money: -300 },
}));

CARD_HANDLERS.set('destiny_boss_recruit', (ctx) => ({
  success: true,
  message: 'BOSS直聘：探索归零',
  effects: { exploration: -ctx.player.exploration },
}));

CARD_HANDLERS.set('destiny_mutual_help', (ctx) => {
  // 手望相助：与另一玩家社交，检查条件
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id);
  return {
    success: true,
    message: '手望相助：选择一位玩家互动',
    pendingAction: {
      id: `action_mutual_help_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '选择一位玩家，若双方金钱差≤200则各+100金钱',
      options: others.map(p => ({ label: p.name, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

CARD_HANDLERS.set('destiny_questionnaire', (ctx) => ({
  success: true,
  message: '问卷调查：选择效果',
  pendingAction: {
    id: `action_questionnaire_${Date.now()}`,
    playerId: ctx.player.id,
    type: 'choose_option',
    prompt: '问卷调查：选择你的奖励',
    options: [
      { label: '+50 金钱', value: 'quick' },
      { label: '暂停一回合 +200 金钱', value: 'long' },
    ],
    timeoutMs: 30000,
    cardId: ctx.card.id,
  },
}));

CARD_HANDLERS.set('destiny_swallowing_elevator', (ctx) => ({
  success: true,
  message: '吞噬电梯：掷骰子 ≤2 则 GPA -0.1',
  pendingAction: {
    id: `action_elevator_${Date.now()}`,
    playerId: ctx.player.id,
    type: 'roll_dice',
    prompt: '吞噬电梯：掷骰子，≤2 则 GPA -0.1',
    timeoutMs: 30000,
    cardId: ctx.card.id,
  },
}));

CARD_HANDLERS.set('destiny_light_reporting', (ctx) => ({
  success: true,
  message: '轻装报到：-480 金钱',
  effects: { money: -480 },
}));

CARD_HANDLERS.set('destiny_yellow_millet_dream', (ctx) => ({
  success: true,
  message: '黄粱美梦：-30 金钱',
  effects: { money: -30 },
}));

CARD_HANDLERS.set('destiny_precision_instrument', (ctx) => ({
  success: true,
  message: '精密器械：+0.2 GPA',
  effects: { gpa: 0.2 },
}));

CARD_HANDLERS.set('destiny_happy_new_year', (ctx) => ({
  success: true,
  message: '新年快乐：+3 探索',
  effects: { exploration: 3 },
}));

CARD_HANDLERS.set('destiny_with_light', (ctx) => ({
  success: true,
  message: '和光同行：+1 探索',
  effects: { exploration: 1 },
}));

CARD_HANDLERS.set('destiny_anniversary_coupon', (ctx) => ({
  success: true,
  message: '校庆餐券：+100 金钱',
  effects: { money: 100 },
}));

CARD_HANDLERS.set('destiny_fragmented_life', (ctx) => ({
  success: true,
  message: '零碎生活：-0.2 GPA',
  effects: { gpa: -0.2 },
}));

CARD_HANDLERS.set('destiny_love_at_first_sight', (ctx) => ({
  success: true,
  message: '一见钟情：+0.3 GPA',
  effects: { gpa: 0.3 },
}));

CARD_HANDLERS.set('destiny_eryuan_square', (ctx) => ({
  success: true,
  message: '二源广场：前进2格',
  effects: { moveTo: 'forward_2' },
}));

CARD_HANDLERS.set('destiny_three_idles', (ctx) => ({
  success: true,
  message: '三闲而已：+5 探索',
  effects: { exploration: 5 },
}));

CARD_HANDLERS.set('destiny_five_lakes', (ctx) => ({
  success: true,
  message: '五湖四海：+1 探索',
  effects: { exploration: 1 },
}));

CARD_HANDLERS.set('destiny_six_dynasties', (ctx) => ({
  success: true,
  message: '六朝古都：+2 探索',
  effects: { exploration: 2 },
}));

CARD_HANDLERS.set('destiny_eight_directions_wealth', (ctx) => ({
  success: true,
  message: '八方来财：+200 金钱',
  effects: { money: 200 },
}));

CARD_HANDLERS.set('destiny_jiuxiang_river', (ctx) => ({
  success: true,
  message: '九乡河畔：+1 探索',
  effects: { exploration: 1 },
}));

CARD_HANDLERS.set('destiny_ten_rice_noodles', (ctx) => ({
  success: true,
  message: '十全米线：+3 探索',
  effects: { exploration: 3 },
}));

CARD_HANDLERS.set('destiny_hundred_shots', (ctx) => ({
  success: true,
  message: '百发百中：+1 探索',
  effects: { exploration: 1 },
}));

CARD_HANDLERS.set('destiny_thousand_years', (ctx) => ({
  success: true,
  message: '千秋万载：-500 金钱',
  effects: { money: -500 },
}));

// 移动卡牌
CARD_HANDLERS.set('destiny_beijing_university', (ctx) => ({
  success: true,
  message: '北京大学：强制进入浦口线',
  effects: { moveToLine: 'pukou' },
}));

CARD_HANDLERS.set('destiny_chew_vegetable_root', (ctx) => ({
  success: true,
  message: '嚼得菜根：移动到学在南哪线',
  effects: { moveToLine: 'study' },
}));

CARD_HANDLERS.set('destiny_more_the_better', (ctx) => ({
  success: true,
  message: '多多益善：移动到赚在南哪线',
  effects: { moveToLine: 'money' },
}));

CARD_HANDLERS.set('destiny_start_new_stove', (ctx) => ({
  success: true,
  message: '另起炉灶：移动到苏州线',
  effects: { moveToLine: 'suzhou' },
}));

CARD_HANDLERS.set('destiny_next_station_xianlin', (ctx) => ({
  success: true,
  message: 'The next station is xianlin：移动到仙林线',
  effects: { moveToLine: 'xianlin' },
}));

CARD_HANDLERS.set('destiny_north_south_gaze', (ctx) => ({
  success: true,
  message: '南北相望：移动到鼓楼线',
  effects: { moveToLine: 'gulou' },
}));

CARD_HANDLERS.set('destiny_see_more_eat_more', (ctx) => ({
  success: true,
  message: '见多食广：强制进入食堂线',
  effects: { moveToLine: 'food' },
}));

CARD_HANDLERS.set('destiny_social_phobia', (ctx) => ({
  success: true,
  message: '社恐分子：移动到乐在南哪线',
  effects: { moveToLine: 'explore' },
}));

CARD_HANDLERS.set('destiny_campus_legend_move', (ctx) => ({
  success: true,
  message: '校园传说：移动到鼎',
  effects: { moveTo: 'ding' },
}));

CARD_HANDLERS.set('destiny_civil_aviation_overspeed', (ctx) => ({
  success: true,
  message: '民航超速：前进最多12格（选择步数）',
  pendingAction: {
    id: `action_overspeed_${Date.now()}`,
    playerId: ctx.player.id,
    type: 'choose_option',
    prompt: '民航超速：选择前进步数',
    options: Array.from({ length: 12 }, (_, i) => ({
      label: `前进 ${i + 1} 格`,
      value: String(i + 1),
    })),
    timeoutMs: 30000,
    cardId: ctx.card.id,
  },
}));

CARD_HANDLERS.set('destiny_listen_leave_south', (ctx) => ({
  success: true,
  message: '听离南常：选择效果',
  pendingAction: {
    id: `action_listen_leave_${Date.now()}`,
    playerId: ctx.player.id,
    type: 'choose_option',
    prompt: '听离南常：选择一项',
    options: [
      { label: '+200 金钱 -2 探索', value: 'money' },
      { label: '+2 探索 -200 金钱', value: 'explore' },
    ],
    timeoutMs: 30000,
    cardId: ctx.card.id,
  },
}));

CARD_HANDLERS.set('destiny_thank_you', (ctx) => ({
  success: true,
  message: '谢谢惠顾：再抽一张命运卡',
  effects: { drawCard: 'destiny' },
}));

// 延迟效果卡
CARD_HANDLERS.set('destiny_fengshui_rotation', (ctx) => ({
  success: true,
  message: '风水轮转：下一轮行动顺序反转',
  effects: { custom: 'reverse_turn_order' },
}));

CARD_HANDLERS.set('destiny_limited_supply', (ctx) => ({
  success: true,
  message: '限量供应：下次移动掷双骰，若第二颗>第一颗则+2探索',
  effects: { custom: 'double_dice_check' },
}));

CARD_HANDLERS.set('destiny_skateboard_genius', (ctx) => ({
  success: true,
  message: '滑板天才：下次移动掷双骰',
  effects: { custom: 'double_dice' },
}));

CARD_HANDLERS.set('destiny_closing_music', (ctx) => ({
  success: true,
  message: '闭馆音乐：下一个事件触发两次',
  effects: { custom: 'double_event' },
}));

CARD_HANDLERS.set('destiny_system_failure', (ctx) => ({
  success: true,
  message: '系统故障：下一轮金钱归零',
  effects: { custom: 'system_fault' },
}));

CARD_HANDLERS.set('destiny_delayed_gratification', (ctx) => ({
  success: true,
  message: '延迟满足：金钱归零，若不破产则恢复+500',
  effects: { custom: 'delayed_gratification' },
}));

// 特殊交互卡
CARD_HANDLERS.set('destiny_strong_base_plan', (ctx) => ({
  success: true,
  message: '强基计划：抽取培养计划 +0.2 GPA',
  effects: { gpa: 0.2, custom: 'draw_training_plan' },
}));

CARD_HANDLERS.set('destiny_national_special', (ctx) => ({
  success: true,
  message: '国家专项：抽取培养计划 +200 金钱',
  effects: { money: 200, custom: 'draw_training_plan' },
}));

CARD_HANDLERS.set('destiny_secondary_selection', (ctx) => ({
  success: true,
  message: '二次选拔：抽取培养计划 +2 探索',
  effects: { exploration: 2, custom: 'draw_training_plan' },
}));

CARD_HANDLERS.set('destiny_sino_foreign', (ctx) => ({
  success: true,
  message: '中外合办：-400金钱, 抽取培养计划, +3 探索',
  effects: { money: -400, exploration: 3, custom: 'draw_training_plan' },
}));

CARD_HANDLERS.set('destiny_seven_year_itch', (ctx) => ({
  success: true,
  message: '七年之痒：掷双骰，若和为7可选效果',
  pendingAction: {
    id: `action_seven_itch_${Date.now()}`,
    playerId: ctx.player.id,
    type: 'roll_dice',
    prompt: '七年之痒：掷双骰，若点数之和为 7 可选择一项奖励',
    timeoutMs: 30000,
    cardId: ctx.card.id,
  },
}));

CARD_HANDLERS.set('destiny_four_schools', (ctx) => {
  // 四校联动：所有玩家选校区，掷骰决定
  return {
    success: true,
    message: '四校联动：所有玩家选择校区',
    effects: { custom: 'voting_four_schools' },
  };
});

// === 机会卡：手持防御卡 ===

CARD_HANDLERS.set('chance_info_blocked', (ctx) => ({
  success: true,
  message: '消息闭塞：取消目标机会卡效果',
  effects: { custom: 'cancel_chance_card' },
}));

CARD_HANDLERS.set('chance_false_move', (ctx) => ({
  success: true,
  message: '虚晃一枪：取消目标命运卡效果',
  effects: { custom: 'cancel_destiny_card' },
}));

CARD_HANDLERS.set('chance_pie_in_sky', (ctx) => ({
  success: true,
  message: '画饼充饥：取消目标玩家事件',
  effects: { custom: 'cancel_target_event' },
}));

CARD_HANDLERS.set('chance_one_jump_relief', (ctx) => ({
  success: true,
  message: '一跃愁解：反转目标效果',
  effects: { custom: 'reverse_effects' },
}));

CARD_HANDLERS.set('chance_water_power_outage', (ctx) => ({
  success: true,
  message: '停水停电：阻止目标行动',
  effects: { custom: 'prevent_action' },
}));

CARD_HANDLERS.set('chance_mending_plan', (ctx) => ({
  success: true,
  message: '补天计划：中断胜利条件',
  effects: { custom: 'interrupt_win' },
}));

// === 机会卡：全场效果 ===

CARD_HANDLERS.set('chance_garbage_collection', (ctx) => ({
  success: true,
  message: '垃圾回收：所有手牌返回牌堆',
  effects: { custom: 'all_cards_return' },
}));

CARD_HANDLERS.set('chance_steal_rich_help_poor', (ctx) => {
  const sorted = [...ctx.state.players].sort((a, b) => b.money - a.money);
  const richest = sorted[0];
  const poorest = sorted[sorted.length - 1];
  return {
    success: true,
    message: `盗亦有道：${richest.name} -200金, ${poorest.name} +200金`,
    effects: {
      custom: 'steal_rich_help_poor',
      targetPlayerId: richest.id,
      targetEffects: { money: -200 },
      money: richest.id === ctx.player.id ? -200 : (poorest.id === ctx.player.id ? 200 : 0),
    },
  };
});

CARD_HANDLERS.set('chance_score_conversion', (ctx) => {
  const sorted = [...ctx.state.players].sort((a, b) => b.gpa - a.gpa);
  return {
    success: true,
    message: `分制转换：最高GPA -0.2, 最低GPA +0.2`,
    effects: { custom: 'score_conversion' },
  };
});

CARD_HANDLERS.set('chance_reorganize_dorm', (ctx) => ({
  success: true,
  message: '重组宿舍：最高探索 -2, 最低探索 +2',
  effects: { custom: 'reorganize_dorm' },
}));

CARD_HANDLERS.set('chance_robin_hood', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id);
  return {
    success: true,
    message: '劫富济贫：选择一人，与你平分金钱',
    pendingAction: {
      id: `action_robin_hood_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '劫富济贫：选择一位玩家，双方金钱取平均',
      options: others.map(p => ({ label: `${p.name} (${p.money}金)`, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

CARD_HANDLERS.set('chance_budget_sharing', (ctx) => ({
  success: true,
  message: '经费均摊：所有人金钱变为800',
  effects: { custom: 'budget_sharing' },
}));

CARD_HANDLERS.set('chance_peer_mentor', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id && p.heldCards.length > 0);
  if (others.length === 0) {
    return { success: true, message: '朋辈导师：无人持有手牌', effects: {} };
  }
  return {
    success: true,
    message: '朋辈导师：选择玩家互换/偷取一张手牌',
    pendingAction: {
      id: `action_peer_mentor_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '朋辈导师：选择一位有手牌的玩家',
      options: others.map(p => ({ label: `${p.name} (${p.heldCards.length}张)`, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

CARD_HANDLERS.set('chance_joint_training', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id && p.trainingPlans.length > 0);
  return {
    success: true,
    message: '联合培养：选择玩家交换培养计划',
    pendingAction: {
      id: `action_joint_training_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '联合培养：选择一位玩家交换培养计划',
      options: others.map(p => ({ label: p.name, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

CARD_HANDLERS.set('chance_discipline_evaluation', (ctx) => ({
  success: true,
  message: '学科评估：抽取培养计划替换目标的',
  effects: { custom: 'discipline_evaluation' },
}));

CARD_HANDLERS.set('chance_knowledge_competition', (ctx) => {
  const totalGpa = ctx.state.players.reduce((sum, p) => sum + p.gpa, 0);
  if (totalGpa >= 5.0) {
    return { success: true, message: '知识竞赛：全员GPA≥5.0，每人+200金', effects: { custom: 'knowledge_competition_success' } };
  }
  return { success: true, message: '知识竞赛：GPA不足，每人+1探索+0.1GPA', effects: { custom: 'knowledge_competition_partial' } };
});

CARD_HANDLERS.set('chance_pair_programming', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id);
  return {
    success: true,
    message: '结对编程：选择搭档比较GPA',
    pendingAction: {
      id: `action_pair_prog_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '结对编程：选择一位搭档，GPA较高者+0.2GPA，较低者+0.1GPA',
      options: others.map(p => ({ label: p.name, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

// 匹配检查类卡牌
CARD_HANDLERS.set('chance_flag_raising', (ctx) => ({
  success: true,
  message: '升旗仪式：检查服装颜色匹配',
  effects: { custom: 'flag_raising_check' },
}));

CARD_HANDLERS.set('chance_clustering_algorithm', (ctx) => ({
  success: true,
  message: '聚类算法：检查姓名长度匹配',
  effects: { custom: 'clustering_check' },
}));

CARD_HANDLERS.set('chance_internship_referral', (ctx) => ({
  success: true,
  message: '实习内推：检查专业匹配，匹配者+200金',
  effects: { custom: 'internship_check' },
}));

CARD_HANDLERS.set('chance_grid_management', (ctx) => ({
  success: true,
  message: '网格管理：选择两人下一轮数据绑定',
  effects: { custom: 'grid_management' },
}));

// 双人骰子对决卡
CARD_HANDLERS.set('chance_group_presentation', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id);
  return {
    success: true,
    message: '分组展示：选择对手掷骰比拼',
    pendingAction: {
      id: `action_group_pres_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '分组展示：选择对手，骰子相同+0.2GPA，否则各+0.1GPA',
      options: others.map(p => ({ label: p.name, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

CARD_HANDLERS.set('chance_travel_buddy', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id);
  return {
    success: true,
    message: '旅游搭子：选择搭档掷骰',
    pendingAction: {
      id: `action_travel_buddy_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '旅游搭子：选择搭档，骰子相同+2探索，否则各+1探索',
      options: others.map(p => ({ label: p.name, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

CARD_HANDLERS.set('chance_group_buy', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id);
  return {
    success: true,
    message: '拼单活动：选择搭档掷骰',
    pendingAction: {
      id: `action_group_buy_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '拼单活动：选择搭档，骰子相同+200金，否则各+100金',
      options: others.map(p => ({ label: p.name, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

CARD_HANDLERS.set('chance_flipped_classroom', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id);
  return {
    success: true,
    message: '翻转课堂：选择对手骰子对决',
    pendingAction: {
      id: `action_flipped_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '翻转课堂：选择对手，赢者+0.2GPA，输者-0.1GPA',
      options: others.map(p => ({ label: p.name, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

CARD_HANDLERS.set('chance_student_union_interview', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id);
  return {
    success: true,
    message: '团学面试：选择对手骰子对决',
    pendingAction: {
      id: `action_interview_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '团学面试：选择对手，赢者+2探索，输者-1探索',
      options: others.map(p => ({ label: p.name, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

CARD_HANDLERS.set('chance_like_collection', (ctx) => {
  const others = ctx.state.players.filter(p => p.id !== ctx.player.id);
  return {
    success: true,
    message: '集赞抽奖：选择对手骰子对决',
    pendingAction: {
      id: `action_like_${Date.now()}`,
      playerId: ctx.player.id,
      type: 'choose_player',
      prompt: '集赞抽奖：选择对手，赢者+200金，输者-100金',
      options: others.map(p => ({ label: p.name, value: p.id })),
      timeoutMs: 30000,
      cardId: ctx.card.id,
    },
  };
});

// 投票类卡牌 — 委托给 VotingSystem（标记为 custom）
const VOTING_CARDS = [
  'chance_swimming_pool_regular', 'chance_meeting_is_fate', 'chance_first_snow',
  'chance_strange_tales', 'chance_root_finding_moment', 'chance_rest_moment',
  'chance_light_shadow', 'chance_course_group', 'chance_transfer_moment',
  'chance_wit_words', 'chance_school_sports_meet', 'chance_travel_method',
];
for (const cardId of VOTING_CARDS) {
  CARD_HANDLERS.set(cardId, (ctx) => ({
    success: true,
    message: `${ctx.card.name}：发起全体投票`,
    effects: { custom: `voting_${cardId}` },
  }));
}

// 连锁行动卡 — 委托给 ChainActionSystem
const CHAIN_CARDS = ['chance_southbound_rose', 'chance_delivery_theft', 'chance_gossip_secret'];
for (const cardId of CHAIN_CARDS) {
  CARD_HANDLERS.set(cardId, (ctx) => ({
    success: true,
    message: `${ctx.card.name}：发起连锁行动`,
    effects: { custom: `chain_${cardId}` },
  }));
}

// 导出
export { CARD_HANDLERS, CardEffectContext, CardEffectResult };
export function getCardHandler(cardId: string): CardHandler | undefined {
  return CARD_HANDLERS.get(cardId);
}
```

**Step 2: Commit**

```bash
git add server/src/game/handlers/card-registry.ts
git commit -m "feat(rules): create card effect registry with all 103 card handlers"
```

---

### Task 3: 创建培养计划能力注册表

**Files:**
- Create: `server/src/game/handlers/plan-registry.ts`

**Step 1: 创建注册表**

```typescript
// server/src/game/handlers/plan-registry.ts
import { Player, GameState } from '@nannaricher/shared';

export type AbilityTrigger =
  | 'on_confirm'       // 确认培养计划时
  | 'on_cell_enter'    // 进入格子时
  | 'on_money_loss'    // 金钱减少前
  | 'on_gpa_change'    // GPA变化时
  | 'on_line_enter'    // 进入支线时
  | 'on_dice_roll'     // 掷骰子时
  | 'on_turn_start'    // 回合开始时
  | 'on_card_draw'     // 抽卡时
  | 'on_move'          // 移动时
  | 'passive'          // 始终生效
  | 'on_other_win'     // 他人即将获胜时
  ;

export interface PlanAbilityContext {
  player: Player;
  state: GameState;
  trigger: AbilityTrigger;
  cellId?: string;
  lineId?: string;
  moneyDelta?: number;
  gpaDelta?: number;
  diceValues?: number[];
}

export interface PlanAbilityResult {
  activated: boolean;
  message?: string;
  effects?: {
    money?: number;
    gpa?: number;
    exploration?: number;
    skipEvent?: boolean;
    moveToLine?: string;
    moveToCell?: string;
    skipEntryFee?: boolean;
    drawCard?: 'chance' | 'destiny';
    customEffect?: string;
    overrideGpa?: number;
    overrideMoney?: number;
    blockMoneyLoss?: boolean;
    skipTurn?: boolean;
  };
}

export interface PlanAbilityDef {
  planId: string;
  trigger: AbilityTrigger;
  apply: (ctx: PlanAbilityContext) => PlanAbilityResult | null;
}

const PLAN_ABILITIES = new Map<string, PlanAbilityDef>();

// 文学院：到达蒋公的面子时改为选择
PLAN_ABILITIES.set('plan_wenxue', {
  planId: 'plan_wenxue', trigger: 'on_cell_enter',
  apply: (ctx) => {
    if (ctx.cellId !== 'jiang_gong') return null;
    return { activated: true, message: '文学院：蒋公的面子改为选择+100金 或 喊"不吃"+2探索', effects: { customEffect: 'wenxue_jiang_gong' } };
  },
});

// 历史学院：确认时移动到鼓楼线入口
PLAN_ABILITIES.set('plan_lishi', {
  planId: 'plan_lishi', trigger: 'on_confirm',
  apply: (ctx) => ({ activated: true, message: '历史学院：移动到鼓楼线入口', effects: { moveToLine: 'gulou' } }),
});

// 哲学系：GPA下限3.0
PLAN_ABILITIES.set('plan_zhexue', {
  planId: 'plan_zhexue', trigger: 'on_gpa_change',
  apply: (ctx) => {
    const newGpa = ctx.player.gpa + (ctx.gpaDelta || 0);
    if (newGpa < 3.0) return { activated: true, message: '哲学系：GPA不低于3.0', effects: { overrideGpa: 3.0 } };
    return null;
  },
});

// 法学院：免除下一次金钱损失
PLAN_ABILITIES.set('plan_faxue', {
  planId: 'plan_faxue', trigger: 'on_money_loss',
  apply: (ctx) => {
    if (!ctx.player.lawyerShield) return null;
    return { activated: true, message: '法学院：免除本次金钱损失', effects: { blockMoneyLoss: true } };
  },
});

// 商学院：确认时直接去赚在南哪
PLAN_ABILITIES.set('plan_shangxue', {
  planId: 'plan_shangxue', trigger: 'on_confirm',
  apply: (ctx) => ({ activated: true, message: '商学院：直达赚在南哪，免入场费', effects: { moveToLine: 'money', skipEntryFee: true } }),
});

// 外国语学院：确认时抽卡
PLAN_ABILITIES.set('plan_waiguoyu', {
  planId: 'plan_waiguoyu', trigger: 'on_confirm',
  apply: (ctx) => ({ activated: true, message: '外国语学院：抽取一张卡牌', effects: { drawCard: 'destiny' } }),
});

// 新闻传播学院：进入乐在南哪免费
PLAN_ABILITIES.set('plan_xinwen', {
  planId: 'plan_xinwen', trigger: 'on_line_enter',
  apply: (ctx) => {
    if (ctx.lineId !== 'explore') return null;
    return { activated: true, message: '新闻院：乐在南哪免入场费', effects: { skipEntryFee: true } };
  },
});

// 政府管理学院：所有支线入场费改为150
PLAN_ABILITIES.set('plan_zhengguan', {
  planId: 'plan_zhengguan', trigger: 'on_line_enter',
  apply: (ctx) => ({ activated: true, message: '政管院：入场费固定150', effects: { money: -150, skipEntryFee: true } }),
});

// 国际关系学院：选择一名玩家，为其抽机会卡
PLAN_ABILITIES.set('plan_guoji', {
  planId: 'plan_guoji', trigger: 'on_confirm',
  apply: (ctx) => ({ activated: true, message: '国际关系学院：选择一名玩家抽机会卡', effects: { customEffect: 'guoji_draw_for_target' } }),
});

// 信息管理学院：重新分配最多3张手牌
PLAN_ABILITIES.set('plan_xinxiguanli', {
  planId: 'plan_xinxiguanli', trigger: 'on_confirm',
  apply: (ctx) => ({ activated: true, message: '信息管理学院：重新分配手牌', effects: { customEffect: 'xinxiguanli_redistribute' } }),
});

// 社会学院：可花费胜利位减少5点探索差距要求
PLAN_ABILITIES.set('plan_shehuixue', {
  planId: 'plan_shehuixue', trigger: 'passive',
  apply: (ctx) => ({ activated: true, message: '社会学院：可花费胜利位减少差距', effects: { customEffect: 'shehuixue_reduce_gap' } }),
});

// 数学系：可指定骰子点数（选择双倍前进或后退）
PLAN_ABILITIES.set('plan_shuxue', {
  planId: 'plan_shuxue', trigger: 'on_dice_roll',
  apply: (ctx) => ({ activated: true, message: '数学系：可选择双倍前进或后退', effects: { customEffect: 'shuxue_dice_choice' } }),
});

// 物理学院：回合开始可选双倍前进或后退
PLAN_ABILITIES.set('plan_wuli', {
  planId: 'plan_wuli', trigger: 'on_turn_start',
  apply: (ctx) => ({ activated: true, message: '物理学院：可选择双倍前进或后退', effects: { customEffect: 'wuli_double_move' } }),
});

// 天文学院：确认时移动到候车厅
PLAN_ABILITIES.set('plan_tianwen', {
  planId: 'plan_tianwen', trigger: 'on_confirm',
  apply: (ctx) => ({ activated: true, message: '天文学院：移动到候车厅', effects: { moveToCell: 'waiting_room' } }),
});

// 化学化工学院：可禁用一个格子或支线
PLAN_ABILITIES.set('plan_huaxue', {
  planId: 'plan_huaxue', trigger: 'on_turn_start',
  apply: (ctx) => ({ activated: true, message: '化学院：可禁用一个格子', effects: { customEffect: 'huaxue_disable_cell' } }),
});

// 人工智能学院：可花费胜利位减少GPA差距
PLAN_ABILITIES.set('plan_rengong', {
  planId: 'plan_rengong', trigger: 'passive',
  apply: (ctx) => ({ activated: true, message: 'AI学院：可花费胜利位减少差距', effects: { customEffect: 'rengong_reduce_gap' } }),
});

// 计算机系：每回合+1探索 或 +100金钱
PLAN_ABILITIES.set('plan_jisuanji', {
  planId: 'plan_jisuanji', trigger: 'on_turn_start',
  apply: (ctx) => ({ activated: true, message: '计算机系：选择+1探索或+100金钱', effects: { customEffect: 'jisuanji_choice' } }),
});

// 软件学院：破产阈值改为-1000
PLAN_ABILITIES.set('plan_ruanjian', {
  planId: 'plan_ruanjian', trigger: 'passive',
  apply: (ctx) => {
    if (ctx.player.money >= -1000) return null;
    return { activated: true, message: '软件学院：破产阈值-1000', effects: { customEffect: 'ruanjian_bankruptcy' } };
  },
});

// 电子学院：科创赛事GPA消耗降低
PLAN_ABILITIES.set('plan_dianzi', {
  planId: 'plan_dianzi', trigger: 'on_cell_enter',
  apply: (ctx) => {
    if (ctx.cellId !== 'kechuang') return null;
    return { activated: true, message: '电子学院：科创赛事仅需-0.1GPA', effects: { gpa: 0.2 } }; // 补偿0.2，实际效果从-0.3变成-0.1
  },
});

// 现代工程学院：抽命运卡指派给他人
PLAN_ABILITIES.set('plan_xiandai', {
  planId: 'plan_xiandai', trigger: 'on_card_draw',
  apply: (ctx) => ({ activated: true, message: '现代工程学院：可将命运卡指派给他人', effects: { customEffect: 'xiandai_assign_card' } }),
});

// 环境学院：每次传送+2探索
PLAN_ABILITIES.set('plan_huanjing', {
  planId: 'plan_huanjing', trigger: 'on_move',
  apply: (ctx) => ({ activated: true, message: '环境学院：传送+2探索', effects: { exploration: 2 } }),
});

// 地球科学：每访问一条新支线，后续入场费-100
PLAN_ABILITIES.set('plan_diqiu', {
  planId: 'plan_diqiu', trigger: 'on_line_enter',
  apply: (ctx) => {
    const uniqueLines = new Set(ctx.player.linesVisited).size;
    const discount = uniqueLines * 100;
    return { activated: true, message: `地球科学：入场费减免${discount}`, effects: { money: discount } };
  },
});

// 地理学院：校区线入场费减免
PLAN_ABILITIES.set('plan_dili', {
  planId: 'plan_dili', trigger: 'on_line_enter',
  apply: (ctx) => {
    const campusLines = ['pukou', 'xianlin', 'gulou', 'suzhou'];
    if (!campusLines.includes(ctx.lineId || '')) return null;
    const campusVisited = ctx.player.linesVisited.filter(l => campusLines.includes(l)).length;
    return { activated: true, message: `地理学院：校区线入场费减免${campusVisited * 100}`, effects: { money: campusVisited * 100 } };
  },
});

// 大气学院：抽3选1
PLAN_ABILITIES.set('plan_daqi', {
  planId: 'plan_daqi', trigger: 'on_card_draw',
  apply: (ctx) => ({ activated: true, message: '大气学院：抽3张选1张', effects: { customEffect: 'daqi_draw_three' } }),
});

// 生命科学学院：获得麦门护盾
PLAN_ABILITIES.set('plan_shengming', {
  planId: 'plan_shengming', trigger: 'on_confirm',
  apply: (ctx) => ({ activated: true, message: '生命科学学院：获得麦门护盾', effects: { customEffect: 'shengming_maimen_shield' } }),
});

// 医学院：免费出院
PLAN_ABILITIES.set('plan_yixue', {
  planId: 'plan_yixue', trigger: 'on_cell_enter',
  apply: (ctx) => {
    if (ctx.cellId !== 'hospital') return null;
    return { activated: true, message: '医学院：免费出院', effects: { customEffect: 'yixue_free_discharge' } };
  },
});

// 工程管理学院：获得余额为负卡
PLAN_ABILITIES.set('plan_gongguan', {
  planId: 'plan_gongguan', trigger: 'on_confirm',
  apply: (ctx) => ({ activated: true, message: '工程管理学院：获得余额为负卡', effects: { customEffect: 'gongguan_negative_balance' } }),
});

// 匡亚明学院：+0.1GPA 或 +1探索
PLAN_ABILITIES.set('plan_kuangyaming', {
  planId: 'plan_kuangyaming', trigger: 'on_turn_start',
  apply: (ctx) => ({ activated: true, message: '匡亚明学院：选择+0.1GPA或+1探索', effects: { customEffect: 'kuangyaming_choice' } }),
});

// 海外教育学院：食堂线可选入
PLAN_ABILITIES.set('plan_haiwai', {
  planId: 'plan_haiwai', trigger: 'on_line_enter',
  apply: (ctx) => {
    if (ctx.lineId !== 'food') return null;
    return { activated: true, message: '海外教育学院：食堂线改为可选入', effects: { customEffect: 'haiwai_optional_food' } };
  },
});

// 建筑学院：鼓楼线免费
PLAN_ABILITIES.set('plan_jianzhu', {
  planId: 'plan_jianzhu', trigger: 'on_line_enter',
  apply: (ctx) => {
    if (ctx.lineId !== 'gulou') return null;
    return { activated: true, message: '建筑学院：鼓楼线免入场费', effects: { skipEntryFee: true } };
  },
});

// 马克思主义学院：社团格+2探索
PLAN_ABILITIES.set('plan_makesi', {
  planId: 'plan_makesi', trigger: 'on_cell_enter',
  apply: (ctx) => {
    if (ctx.cellId !== 'society') return null;
    return { activated: true, message: '马克思主义学院：社团+2探索', effects: { exploration: 2 } };
  },
});

// 艺术学院：浦口线终点双倍经验卡
PLAN_ABILITIES.set('plan_yishu', {
  planId: 'plan_yishu', trigger: 'on_cell_enter',
  apply: (ctx) => {
    if (ctx.cellId !== 'pukou_exp_card') return null;
    return { activated: true, message: '艺术学院：浦口经验卡双倍效果', effects: { customEffect: 'yishu_double_exp' } };
  },
});

// 苏州校区：苏州线免费入场，起点可花300去苏州
PLAN_ABILITIES.set('plan_suzhou', {
  planId: 'plan_suzhou', trigger: 'on_line_enter',
  apply: (ctx) => {
    if (ctx.lineId !== 'suzhou') return null;
    return { activated: true, message: '苏州校区：苏州线免入场费', effects: { skipEntryFee: true } };
  },
});

export { PLAN_ABILITIES };
export function getPlanAbility(planId: string): PlanAbilityDef | undefined {
  return PLAN_ABILITIES.get(planId);
}
```

**Step 2: Commit**

```bash
git add server/src/game/handlers/plan-registry.ts
git commit -m "feat(rules): create plan ability registry with all 33 training plan abilities"
```

---

### Task 4: 创建延迟效果管理器

**Files:**
- Create: `server/src/game/effects/DelayedEffectManager.ts`

**Step 1: 实现 DelayedEffectManager**

```typescript
// server/src/game/effects/DelayedEffectManager.ts
export interface DelayedEffect {
  id: string;
  playerId: string;
  type: 'double_event' | 'money_freeze' | 'delayed_gratification'
    | 'reverse_order' | 'double_dice' | 'reverse_move' | 'double_dice_check';
  triggerTurn: number;
  triggerCondition?: 'next_event' | 'next_turn' | 'next_dice';
  data: Record<string, unknown>;
  resolved: boolean;
}

let nextId = 1;

export class DelayedEffectManager {
  private effects: DelayedEffect[] = [];

  add(effect: Omit<DelayedEffect, 'id' | 'resolved'>): string {
    const id = `delayed_${nextId++}`;
    this.effects.push({ ...effect, id, resolved: false });
    return id;
  }

  // 每回合开始时检查
  processStartOfTurn(currentTurn: number, playerId: string): DelayedEffect[] {
    const triggered: DelayedEffect[] = [];
    for (const e of this.effects) {
      if (e.resolved || e.playerId !== playerId) continue;
      if (e.triggerCondition === 'next_turn' && currentTurn >= e.triggerTurn) {
        triggered.push(e);
        e.resolved = true;
      }
    }
    return triggered;
  }

  // 事件触发前检查
  hasDoubleEvent(playerId: string): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'double_event');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  hasMoneyFreeze(playerId: string): boolean {
    return this.effects.some(e =>
      !e.resolved && e.playerId === playerId && e.type === 'money_freeze');
  }

  hasReverseMove(playerId: string): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'reverse_move');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  hasDoubleDice(playerId: string): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'double_dice');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  hasDoubleDiceCheck(playerId: string): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'double_dice_check');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  hasReverseOrder(): boolean {
    const found = this.effects.find(e =>
      !e.resolved && e.type === 'reverse_order');
    if (found) { found.resolved = true; return true; }
    return false;
  }

  getDelayedGratification(playerId: string): DelayedEffect | undefined {
    return this.effects.find(e =>
      !e.resolved && e.playerId === playerId && e.type === 'delayed_gratification');
  }

  resolve(effectId: string): void {
    const effect = this.effects.find(e => e.id === effectId);
    if (effect) effect.resolved = true;
  }

  // 清理已结算的效果
  cleanup(): void {
    this.effects = this.effects.filter(e => !e.resolved);
  }

  // 获取玩家所有活跃效果
  getActiveEffects(playerId: string): DelayedEffect[] {
    return this.effects.filter(e => !e.resolved && e.playerId === playerId);
  }

  // 获取所有活跃效果（调试用）
  getAllActive(): DelayedEffect[] {
    return this.effects.filter(e => !e.resolved);
  }
}
```

**Step 2: Commit**

```bash
git add server/src/game/effects/DelayedEffectManager.ts
git commit -m "feat(rules): add DelayedEffectManager for deferred card effects"
```

---

### Task 5: 重写 CardEffectHandler 使用注册表

**Files:**
- Modify: `server/src/game/rules/CardEffectHandler.ts`

**Step 1: 重写为查表调用**

将 `CardEffectHandler.ts` 的 `handleCardEffect`/`handleHoldableCard`/`handleInstantCard` 方法改为：

```typescript
import { getCardHandler, CardEffectContext, CardEffectResult } from '../handlers/card-registry.js';

// 在 handleCardEffect 方法中：
handleCardEffect(context: CardEffectContext): CardEffectResult {
  const handler = getCardHandler(context.card.id);
  if (handler) return handler(context);
  // fallback: 简单效果
  return this.applySimpleEffects(context);
}
```

保留 `applySimpleEffects` 方法作为 fallback。删除原有的大型 switch/case 块。

**Step 2: 验证编译**

Run: `cd server && npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add server/src/game/rules/CardEffectHandler.ts
git commit -m "refactor(rules): rewrite CardEffectHandler to use registry pattern"
```

---

### Task 6: 重写 PlanAbilities 使用注册表

**Files:**
- Modify: `server/src/game/rules/PlanAbilities.ts`

**Step 1: 重写为查注册表 + 触发点分发**

```typescript
import { getPlanAbility, PlanAbilityContext as RegistryContext, PlanAbilityResult as RegistryResult, AbilityTrigger } from '../handlers/plan-registry.js';

export class PlanAbilityHandler {
  /**
   * 按触发点检查所有已确认计划的能力
   */
  checkAbilities(player: Player, state: GameState, trigger: AbilityTrigger, extra?: Partial<RegistryContext>): RegistryResult | null {
    for (const planId of player.confirmedPlans) {
      const ability = getPlanAbility(planId);
      if (!ability || ability.trigger !== trigger) continue;
      const ctx: RegistryContext = { player, state, trigger, ...extra };
      const result = ability.apply(ctx);
      if (result?.activated) return result;
    }
    return null;
  }

  // 保留向后兼容的方法签名
  applyPassiveAbility(context: PlanAbilityContext): PlanAbilityResult {
    const result = this.checkAbilities(context.player, context.state, 'passive');
    if (!result) return { modified: false };
    return { modified: true, message: result.message, effects: result.effects };
  }

  modifyGpa(player: Player, state: GameState, delta: number): number {
    const result = this.checkAbilities(player, state, 'on_gpa_change', { gpaDelta: delta });
    if (result?.effects?.overrideGpa !== undefined) return result.effects.overrideGpa;
    return player.gpa + delta;
  }

  canGoBankrupt(player: Player): boolean {
    if (player.confirmedPlans.includes('plan_ruanjian')) {
      return player.money < -1000;
    }
    return player.money < 0;
  }

  calculateEntryFee(player: Player, state: GameState, lineId: string, baseFee: number): number {
    const result = this.checkAbilities(player, state, 'on_line_enter', { lineId });
    if (result?.effects?.skipEntryFee) return 0;
    if (result?.effects?.money) return Math.max(0, baseFee + result.effects.money);
    return baseFee;
  }
}
```

**Step 2: 验证编译**

Run: `cd server && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add server/src/game/rules/PlanAbilities.ts
git commit -m "refactor(rules): rewrite PlanAbilities to use registry with trigger-point dispatch"
```

---

### Task 7: 补全 WinConditionChecker 剩余条件

**Files:**
- Modify: `server/src/game/rules/WinConditionChecker.ts`

**Step 1: 添加缺失的胜利条件**

检查当前已实现的条件，补全以下缺失条件（约14个）：

- `plan_wenxue`: 离开赚在南哪时金钱无变化
- `plan_xinwen`: 完成乐在南哪无损失
- `plan_guoji`: 对2+玩家使用过机会卡
- `plan_xinxiguanli`: 抽取5张不同数字开头卡
- `plan_shehuixue`: 探索领先最低者20+（支持动态阈值）
- `plan_rengong`: GPA领先最低者2.0+（支持动态阈值）
- `plan_ruanjian`: 在交学费时支付3200不破产
- `plan_dianzi`: 在科创赛事掷出6
- `plan_xiandai`: 进入除苏州外所有支线
- `plan_dili`: 完成4个校区线终点
- `plan_daqi`: 连续20回合金钱非最高
- `plan_kuangyaming`: 匹配其他玩家的胜利条件
- `plan_haiwai`: 若对获胜者使用过2+机会卡，优先获胜

添加到 `checkPlanWinCondition` switch 中。

**Step 2: 添加动态阈值支持**

在检查社会学院和AI学院时使用 `player.modifiedWinThresholds`:

```typescript
case 'plan_shehuixue': {
  const threshold = player.modifiedWinThresholds?.['plan_shehuixue'] ?? 20;
  const minExp = Math.min(...state.players.filter(p => p.id !== player.id).map(p => p.exploration));
  if (player.exploration - minExp >= threshold) {
    return { won: true, condition: `社会学院：探索领先${threshold}`, planId };
  }
  break;
}
```

**Step 3: 验证编译 + 运行现有测试**

Run: `cd server && npx vitest run`

**Step 4: Commit**

```bash
git add server/src/game/rules/WinConditionChecker.ts
git commit -m "feat(rules): complete all 33 win conditions with dynamic thresholds"
```

---

### Task 8: 完善 StateTracker 追踪填充

**Files:**
- Modify: `server/src/game/history/StateTracker.ts`

**Step 1: 确保所有追踪方法被正确调用**

审查 StateTracker 中所有方法，确保：
- `recordLineExit()` 记录进出资源快照（文学院、哲学系）
- `recordMoneyChange()` 每回合记录（大气学院）
- `recordSharedCell()` 移动后检查（天文学院）
- `recordMainCellVisit()` 记录主格子（建筑学院）
- `recordCardDraw()` 带英文标记和数字标记

**Step 2: 在 GameEngine 中确保调用点完整**

在 `GameEngine.ts` 的关键方法中插入缺失的 StateTracker 调用：
- `movePlayerTo()` → `recordPosition()` + `checkAndUpdateSharedCells()`
- `exitLine()` → `recordLineExit()`
- `advanceTurn()` → `recordMoneyChange()`
- `drawCard()` → `recordCardDraw()`
- `executeCellEvent()` → `recordMainCellVisit()`

**Step 3: Commit**

```bash
git add server/src/game/history/StateTracker.ts server/src/game/GameEngine.ts
git commit -m "feat(rules): complete StateTracker integration for all win condition tracking"
```

---

### Task 9: 集成 DelayedEffectManager 到 GameEngine

**Files:**
- Modify: `server/src/game/GameEngine.ts`

**Step 1: 添加 DelayedEffectManager 到引擎**

在 GameEngine 构造函数中初始化：

```typescript
import { DelayedEffectManager } from './effects/DelayedEffectManager.js';

// 在构造函数中：
this.delayedEffects = new DelayedEffectManager();
```

**Step 2: 在关键流程中检查延迟效果**

- `rollDice()`: 检查 `hasDoubleDice()` → 掷双骰
- `processMovement()`: 检查 `hasReverseMove()` → 反向移动
- `executeCellEvent()`: 检查 `hasDoubleEvent()` → 事件执行两次
- `advanceTurn()`: 处理 `processStartOfTurn()` + `hasReverseOrder()` + `cleanup()`
- `modifyPlayerMoney()`: 检查 `hasMoneyFreeze()` → 金钱冻结

**Step 3: 处理延迟满足逻辑**

```typescript
// 在 advanceTurn 末尾
const delayed = this.delayedEffects.getDelayedGratification(player.id);
if (delayed && !player.isBankrupt) {
  const savedMoney = delayed.data.savedMoney as number;
  this.modifyPlayerMoney(player, savedMoney + 500, '延迟满足：恢复金钱+500');
  this.delayedEffects.resolve(delayed.id);
}
```

**Step 4: 验证编译**

Run: `cd server && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add server/src/game/GameEngine.ts
git commit -m "feat(rules): integrate DelayedEffectManager into GameEngine lifecycle"
```

---

### Task 10: 为规则引擎编写测试

**Files:**
- Create: `server/src/game/rules/__tests__/card-registry.test.ts`
- Create: `server/src/game/rules/__tests__/plan-registry.test.ts`
- Create: `server/src/game/rules/__tests__/DelayedEffectManager.test.ts`

**Step 1: 卡牌注册表覆盖测试**

```typescript
// server/src/game/rules/__tests__/card-registry.test.ts
import { describe, it, expect } from 'vitest';
import { CARD_HANDLERS, getCardHandler } from '../../handlers/card-registry.js';

describe('CardRegistry', () => {
  it('should have handlers for all known card IDs', () => {
    // 验证注册表覆盖率
    expect(CARD_HANDLERS.size).toBeGreaterThanOrEqual(90);
  });

  it('destiny simple stat cards return correct effects', () => {
    const handler = getCardHandler('destiny_sustainability');
    expect(handler).toBeDefined();
    const result = handler!({
      card: { id: 'destiny_sustainability', name: '可持续性', description: '', deckType: 'destiny', holdable: false, singleUse: true, returnToDeck: true, effects: [] },
      player: { id: 'p1', money: 1000, gpa: 3.5, exploration: 10 } as any,
      state: { players: [] } as any,
    });
    expect(result.effects?.money).toBe(300);
  });

  // ... 更多测试用例
});
```

**Step 2: 运行测试**

Run: `cd server && npx vitest run`

**Step 3: Commit**

```bash
git add server/src/game/rules/__tests__/
git commit -m "test(rules): add unit tests for card registry, plan registry, and delayed effects"
```

---

## Phase 2: 服务端架构重构

> 目标：index.ts ≤30 行 + GameCoordinator + 内存管理

---

### Task 11: 创建 Express 应用模块

**Files:**
- Create: `server/src/app.ts`

**Step 1: 从 index.ts 提取 Express 配置**

```typescript
// server/src/app.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  // CORS
  const corsOrigins = process.env.NODE_ENV === 'production'
    ? ['https://richer.nju.top']
    : ['http://localhost:5173', 'http://localhost:3000'];

  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json());

  // 静态文件
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../client/dist')));
  }

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // SPA fallback
  if (process.env.NODE_ENV === 'production') {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
    });
  }

  return app;
}
```

**Step 2: Commit**

```bash
git add server/src/app.ts
git commit -m "refactor(server): extract Express app configuration to app.ts"
```

---

### Task 12: 创建 SocketManager

**Files:**
- Create: `server/src/socket/SocketManager.ts`

**Step 1: 提取 Socket.IO 配置和连接管理**

```typescript
// server/src/socket/SocketManager.ts
import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@nannaricher/shared';

export type GameSocket = import('socket.io').Socket<ClientToServerEvents, ServerToClientEvents>;

export function createSocketServer(httpServer: HttpServer): Server<ClientToServerEvents, ServerToClientEvents> {
  const corsOrigins = process.env.NODE_ENV === 'production'
    ? ['https://richer.nju.top']
    : ['http://localhost:5173', 'http://localhost:3000'];

  return new Server(httpServer, {
    cors: { origin: corsOrigins, methods: ['GET', 'POST'], credentials: true },
    pingTimeout: 60000,
    pingInterval: 25000,
  });
}

export function withErrorBoundary<T extends (...args: any[]) => any>(
  handler: T,
  socket: GameSocket,
): T {
  return ((...args: any[]) => {
    try {
      const result = handler(...args);
      if (result instanceof Promise) {
        return result.catch((err: Error) => {
          console.error('Game error:', err);
          socket.emit('room:error', { message: '服务器错误，请重试' });
        });
      }
      return result;
    } catch (err) {
      console.error('Game error:', err);
      socket.emit('room:error', { message: '服务器错误，请重试' });
    }
  }) as T;
}
```

**Step 2: Commit**

```bash
git add server/src/socket/SocketManager.ts
git commit -m "refactor(server): create SocketManager with error boundary"
```

---

### Task 13: 创建 GameCoordinator

**Files:**
- Create: `server/src/game/GameCoordinator.ts`

**Step 1: 创建编排层**

```typescript
// server/src/game/GameCoordinator.ts
import { Server } from 'socket.io';
import { GameEngine } from './GameEngine.js';
import { GameState } from '@nannaricher/shared';

export class GameCoordinator {
  constructor(
    private engine: GameEngine,
    private io: Server,
    private roomId: string,
  ) {}

  getState(): GameState { return this.engine.getState(); }
  getEngine(): GameEngine { return this.engine; }

  async handleRollDice(playerId: string) {
    const result = this.engine.rollDice(playerId);
    this.broadcast('game:dice-result', result);
    await this.engine.processMovement(playerId, result.total);
    this.broadcastState();
    this.checkWinAfterAction(playerId);
  }

  async handleChooseAction(playerId: string, actionId: string, choice: string) {
    const result = this.engine.resolveAction(playerId, actionId, choice);
    if (result.announcement) {
      this.broadcast('game:announcement', result.announcement);
    }
    this.broadcastState();
    if (!result.nextAction) {
      this.engine.advanceTurn();
      this.broadcastState();
    }
  }

  handleUseCard(playerId: string, cardId: string, targetPlayerId?: string) {
    const result = this.engine.useCard(playerId, cardId, targetPlayerId);
    if (result.announcement) {
      this.broadcast('game:announcement', result.announcement);
    }
    this.broadcastState();
  }

  handleConfirmPlan(playerId: string, planId: string) {
    this.engine.confirmPlan(playerId, planId);
    this.broadcastState();
  }

  broadcastState() {
    this.io.to(this.roomId).emit('game:state-update', this.engine.getState());
  }

  private broadcast(event: string, data: any) {
    this.io.to(this.roomId).emit(event as any, data);
  }

  private checkWinAfterAction(playerId: string) {
    const result = this.engine.checkWin(playerId);
    if (result?.won) {
      const player = this.engine.getPlayer(playerId);
      this.broadcast('game:player-won', {
        playerId,
        playerName: player?.name || 'Unknown',
        condition: result.condition,
      });
    }
  }
}
```

**Step 2: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "refactor(server): create GameCoordinator orchestration layer"
```

---

### Task 14: 创建 RoomHandlers 和 GameHandlers

**Files:**
- Create: `server/src/socket/RoomHandlers.ts`
- Create: `server/src/socket/GameHandlers.ts`

**Step 1: 提取房间事件处理到 RoomHandlers**

从 `index.ts` 提取 `room:create`, `room:join`, `room:reconnect` 处理逻辑。

**Step 2: 提取游戏事件处理到 GameHandlers**

从 `index.ts` 提取 `game:start`, `game:roll-dice`, `game:choose-action`, `game:use-card`, `game:confirm-plan`, `game:chat` 处理逻辑。所有处理器通过 GameCoordinator 调用。

**Step 3: Commit**

```bash
git add server/src/socket/RoomHandlers.ts server/src/socket/GameHandlers.ts
git commit -m "refactor(server): extract socket event handlers to dedicated modules"
```

---

### Task 15: 重写 index.ts 为最小入口

**Files:**
- Modify: `server/src/index.ts`

**Step 1: 将 index.ts 缩减为 ≤30 行**

```typescript
// server/src/index.ts
import { createServer } from 'http';
import { createApp } from './app.js';
import { createSocketServer } from './socket/SocketManager.js';
import { registerRoomHandlers } from './socket/RoomHandlers.js';
import { registerGameHandlers } from './socket/GameHandlers.js';
import { RoomManager } from './rooms/RoomManager.js';

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);
const roomManager = new RoomManager();

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);
  registerRoomHandlers(io, socket, roomManager);
  registerGameHandlers(io, socket, roomManager);
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  roomManager.startCleanup();
});
```

**Step 2: 增强 RoomManager 添加内存清理**

在 `rooms/RoomManager.ts` 中添加 `startCleanup()` 方法：5分钟清理已结束的房间，30分钟清理闲置房间。

**Step 3: 验证服务端启动**

Run: `cd server && npm run dev`
Expected: 无错误启动

**Step 4: Commit**

```bash
git add server/src/index.ts server/src/rooms/RoomManager.ts
git commit -m "refactor(server): slim index.ts to <30 lines, add room memory cleanup"
```

---

## Phase 3: 客户端架构重构

> 目标：Zustand 单一状态 + PixiJS 分层渲染 + 数据去重

---

### Task 16: 创建共享棋盘数据

**Files:**
- Create: `shared/src/board-data.ts`
- Modify: `shared/src/index.ts`

**Step 1: 从服务端和客户端提取棋盘数据到 shared**

将 `server/src/data/board.ts` 和 `client/src/data/board.ts` 中重复的棋盘定义（28 格 + 8 线 + 角落索引）统一到 `shared/src/board-data.ts`。

**Step 2: 在 shared/src/index.ts 导出**

```typescript
export * from './board-data.js';
```

**Step 3: 构建 + Commit**

```bash
cd shared && npm run build
git add shared/src/board-data.ts shared/src/index.ts
git commit -m "refactor(shared): create single source of truth for board data"
```

---

### Task 17: 重写 Zustand Store

**Files:**
- Modify: `client/src/stores/gameStore.ts`

**Step 1: 完整重写为包含所有状态和 socket 动作**

扩展当前 60 行的 store 为完整版本（包含动画队列、事件状态、socket 动作），参考设计文档 4.3 节。

关键新增：
- `pendingEvent`, `pendingDice`, `pendingCard`, `announcement`, `winner` 瞬态状态
- `animationQueue`, `isAnimating` 动画状态
- `rollDice()`, `chooseAction()`, `useCard()`, `confirmPlan()`, `sendChat()` socket 动作
- `enqueueAnimation()`, `dequeueAnimation()` 动画控制

**Step 2: Commit**

```bash
git add client/src/stores/gameStore.ts
git commit -m "refactor(client): complete Zustand store with socket actions and animation queue"
```

---

### Task 18: 创建 SocketProvider 并迁移 Context

**Files:**
- Create: `client/src/context/SocketProvider.tsx`
- Modify: `client/src/context/GameContext.tsx` (逐步迁移)

**Step 1: 创建 SocketProvider 仅管连接**

SocketProvider 只负责：建立连接、监听事件、调用 store 方法更新状态。

**Step 2: 将 GameContext 中的 socket 事件监听迁移到 SocketProvider**

保持 `GameContext` 暂时存在但标记为 deprecated，所有新代码使用 `useGameStore()`。

**Step 3: 验证编译 + 运行**

Run: `cd client && npm run dev`

**Step 4: Commit**

```bash
git add client/src/context/SocketProvider.tsx client/src/context/GameContext.tsx
git commit -m "refactor(client): create SocketProvider, begin migration from GameContext"
```

---

### Task 19: PixiJS 渲染器分层

**Files:**
- Create: `client/src/game/GameStage.ts`
- Create: `client/src/game/layers/BackgroundLayer.ts`
- Create: `client/src/game/layers/BoardLayer.ts`
- Create: `client/src/game/layers/LineLayer.ts`
- Create: `client/src/game/layers/PlayerLayer.ts`
- Create: `client/src/game/layers/EffectLayer.ts`
- Create: `client/src/game/layout/BoardLayout.ts`
- Modify: `client/src/game/GameCanvas.tsx`

**Step 1: 创建 BoardLayout 纯函数**

提取所有坐标计算到 `BoardLayout.ts`：`calculateCellPosition()`, `calculateCornerPosition()`, `calculateLineCellPosition()`

**Step 2: 创建各个渲染层**

每个层继承公共接口：

```typescript
interface RenderLayer {
  init(stage: Container): void;
  update(state: GameState): void;
  destroy(): void;
}
```

- `BackgroundLayer`: 棋盘底板渐变 + 中央区域
- `BoardLayer`: 28 格主棋盘（使用 shared board-data）
- `LineLayer`: 8 条支线完整显示（移除 `Math.min(line.cellCount, 5)` 限制）
- `PlayerLayer`: 玩家棋子（差异更新，不再 removeChildren 全量重绘）
- `EffectLayer`: 高亮/粒子/飘字占位

**Step 3: 创建 GameStage 管理层**

```typescript
class GameStage {
  private layers: RenderLayer[] = [];
  init(app: Application): void;
  updateState(state: GameState): void;
  resize(width: number, height: number): void;
  destroy(): void;
}
```

**Step 4: 重写 GameCanvas.tsx 为 ≤100 行容器**

仅负责 Application 生命周期 + GameStage 初始化。

**Step 5: 验证棋盘渲染正常**

Run: `cd client && npm run dev` → 浏览器检查棋盘显示

**Step 6: Commit**

```bash
git add client/src/game/
git commit -m "refactor(client): split GameCanvas into layered renderer architecture"
```

---

## Phase 4: 动画系统

> 目标：TweenEngine + AnimationQueue + 核心动画

---

### Task 20: 创建 TweenEngine

**Files:**
- Create: `client/src/game/animations/TweenEngine.ts`
- Create: `client/src/game/animations/AnimationConfig.ts`

**Step 1: 实现基于 PixiJS ticker 的补间引擎**

参考设计文档 5.2 节完整实现，包含 4 种缓动函数 (linear, easeOut, easeInOut, bounce)。

**Step 2: 创建 AnimationConfig**

```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export class AnimationConfig {
  static get duration() { return prefersReducedMotion ? 0 : 1; }
  static shouldAnimate() { return !prefersReducedMotion; }
}
```

**Step 3: Commit**

```bash
git add client/src/game/animations/
git commit -m "feat(animation): add TweenEngine with easing functions and reduced-motion support"
```

---

### Task 21: 创建 AnimationQueue

**Files:**
- Create: `client/src/game/animations/AnimationQueue.ts`

**Step 1: 实现异步动画队列**

参考设计文档 5.1 节，支持顺序播放和并行播放。

**Step 2: Commit**

```bash
git add client/src/game/animations/AnimationQueue.ts
git commit -m "feat(animation): add async AnimationQueue with sequential and parallel playback"
```

---

### Task 22: 实现核心游戏动画

**Files:**
- Create: `client/src/game/animations/PieceMoveAnim.ts`
- Create: `client/src/game/animations/DiceRollAnim.ts`
- Create: `client/src/game/animations/FloatingText.ts`

**Step 1: 棋子逐格跳跃动画**

使用 TweenEngine 实现弧线轨迹（300ms/步），到达时涟漪效果。

**Step 2: 骰子翻滚动画**

使用精灵帧序列（1500ms），结果放大弹出（600ms bounce）。

**Step 3: 资源飘字动画**

"+300 金" 上浮淡出效果（1500ms）。

**Step 4: 集成到 PlayerLayer 和 EffectLayer**

**Step 5: Commit**

```bash
git add client/src/game/animations/
git commit -m "feat(animation): implement piece move, dice roll, and floating text animations"
```

---

## Phase 5: 视觉设计系统

> 目标：设计令牌 + 渐变格子 + SVG 图标 + 字体

---

### Task 23: 创建完整设计令牌

**Files:**
- Modify: `client/src/styles/tokens.ts` (完整重写)

**Step 1: 写入完整 DESIGN_TOKENS 对象**

参考设计文档 6.1 节，包含：color, spacing, radius, shadow, typography, animation, breakpoint 全部令牌。

**Step 2: Commit**

```bash
git add client/src/styles/tokens.ts
git commit -m "feat(visual): complete design token system with NJU purple theme"
```

---

### Task 24: 创建 SVG 图标集

**Files:**
- Create: `client/src/assets/icons.ts`

**Step 1: 实现 16 个游戏专用 SVG 图标**

参考设计文档 6.4 节，每个图标为 SVG 字符串常量，无外部依赖。

**Step 2: Commit**

```bash
git add client/src/assets/icons.ts
git commit -m "feat(visual): add 16 game-specific inline SVG icons"
```

---

### Task 25: 重写 CSS 样式

**Files:**
- Modify: `client/src/styles/game.css`
- Modify: `client/src/index.css`

**Step 1: 引入 Noto Sans SC 字体**

在 `index.css` 添加 Google Fonts import + CSS 变量。

**Step 2: 重写 game.css 使用设计令牌**

替换硬编码颜色值为令牌引用，添加渐变背景、阴影系统。

**Step 3: Commit**

```bash
git add client/src/styles/ client/src/index.css
git commit -m "feat(visual): restyle with design tokens, gradients, and Noto Sans SC font"
```

---

### Task 26: 升级棋盘渲染视觉

**Files:**
- Modify: `client/src/game/layers/BoardLayer.ts`
- Modify: `client/src/game/layers/LineLayer.ts`

**Step 1: 格子渲染升级**

- 角落格：90×90 圆角矩形 + 双色渐变 + SVG 图标 + 外发光
- 普通格：70×28 渐变 + 类型图标
- 支线格：28×28 线路主题色

**Step 2: hover 效果 + 信息浮窗**

**Step 3: Commit**

```bash
git add client/src/game/layers/
git commit -m "feat(visual): upgrade board cell rendering with gradients, icons, and hover effects"
```

---

## Phase 6: 交互与全平台适配

> 目标：三端布局 + 手势 + 投票/连锁 UI + 进度条

---

### Task 27: 实现 ViewportController

**Files:**
- Create: `client/src/game/interaction/ViewportController.ts`

**Step 1: 鼠标滚轮缩放 + 拖拽平移 + 双指缩放**

参考设计文档 7.2 节。

**Step 2: 自动聚焦当前玩家 + 双击重置**

**Step 3: Commit**

```bash
git add client/src/game/interaction/ViewportController.ts
git commit -m "feat(interaction): add ViewportController with pinch zoom and auto-focus"
```

---

### Task 28: 重写 GameScreen 三端布局

**Files:**
- Modify: `client/src/components/GameScreen.tsx`
- Create: `client/src/styles/mobile.css`

**Step 1: 桌面布局 (≥1024px)**

左棋盘 + 右侧面板 + 底部日志。

**Step 2: 平板布局 (768-1023px)**

棋盘更大比例 + 底部标签切换（手牌/计划/日志/聊天）。

**Step 3: 手机布局 (<768px)**

全宽棋盘 + 紧凑状态栏 + 底部标签栏。

**Step 4: Commit**

```bash
git add client/src/components/GameScreen.tsx client/src/styles/mobile.css
git commit -m "feat(interaction): responsive three-layout design for desktop/tablet/mobile"
```

---

### Task 29: 创建投票和连锁行动 UI 组件

**Files:**
- Create: `client/src/components/VotePanel.tsx`
- Create: `client/src/components/ChainActionPanel.tsx`
- Create: `client/src/components/StatusIndicator.tsx`
- Create: `client/src/components/TrainingPlanView.tsx`

**Step 1: 投票面板**

参考设计文档 7.4 节：选项卡片 + 实时计票 + 倒计时 + 玩家状态指示。

**Step 2: 连锁行动面板**

传播链可视化 + 当前玩家高亮 + 操作按钮。

**Step 3: 状态感知指示条**

根据游戏阶段显示提示："轮到你了！"/"等待其他玩家..."

**Step 4: 培养计划进度显示**

进度条 + 条件描述 + 能力说明。

**Step 5: Commit**

```bash
git add client/src/components/
git commit -m "feat(interaction): add VotePanel, ChainActionPanel, StatusIndicator, TrainingPlanView"
```

---

## Phase 7: 体验打磨

> 目标：音效 + 新手引导 + 回合上限 + 日志分级

---

### Task 30: 扩展音效系统

**Files:**
- Modify: `client/src/audio/AudioManager.ts` (或对应文件)
- Create: `client/src/audio/sounds.ts`

**Step 1: 定义完整音效列表**

参考设计文档 8.1 节，25+ 种程序化合成音效。

**Step 2: 添加音量分级控制**

master/sfx/music 三级音量 + localStorage 持久化。

**Step 3: 在关键游戏事件中触发音效**

- 掷骰子 → dice_shake + dice_land
- 棋子移动 → piece_step
- 资源变化 → coin_gain/coin_loss/gpa_up/gpa_down
- 抽卡 → card_draw + card_flip
- 投票 → vote_start + vote_end
- 胜利 → victory

**Step 4: Commit**

```bash
git add client/src/audio/
git commit -m "feat(audio): expand Web Audio sound synthesis with 25+ game sounds"
```

---

### Task 31: 实现新手引导系统

**Files:**
- Modify: `client/src/features/tutorial/TutorialSystem.tsx`
- Create: `client/src/features/tutorial/TutorialSteps.ts`

**Step 1: 定义 5 个核心引导步骤**

参考设计文档 8.2 节：首次掷骰、首次抽卡、首次选计划、计划确认、首次支线。

**Step 2: 实现非模态 tooltip 引导**

不阻塞操作，已触发步骤存储 localStorage，支持"跳过全部"。

**Step 3: Commit**

```bash
git add client/src/features/tutorial/
git commit -m "feat(tutorial): implement non-blocking tooltip tutorial system"
```

---

### Task 32: 添加回合上限和强制结算

**Files:**
- Modify: `server/src/game/GameEngine.ts`

**Step 1: 在 advanceTurn 中检查回合上限**

参考设计文档 8.3 节：根据玩家数确定总回合数，到达上限时触发强制结算。

**Step 2: 实现强制结算评分**

```typescript
function calculateFinalScore(player: Player): number {
  return player.gpa * 10 + player.exploration + player.money / 100;
}
```

**Step 3: Commit**

```bash
git add server/src/game/GameEngine.ts
git commit -m "feat(rules): add round limit and forced scoring at game end"
```

---

### Task 33: 升级游戏日志

**Files:**
- Modify: `client/src/components/GameLog.tsx`

**Step 1: 分级日志（info/important/critical）**

- info: 常规操作（掷骰子、移动）
- important: 资源变化、抽卡
- critical: 胜利条件进展、破产

**Step 2: 添加 SVG 图标标记**

**Step 3: Commit**

```bash
git add client/src/components/GameLog.tsx
git commit -m "feat(ui): upgrade GameLog with severity levels and icons"
```

---

## Phase 8: 测试与部署

> 目标：测试覆盖 + 代码分割 + 部署优化

---

### Task 34: 补全单元测试

**Files:**
- Create/Modify: `server/src/game/rules/__tests__/WinConditionChecker.test.ts`
- Create: `server/src/game/rules/__tests__/card-effects.test.ts`
- Create: `server/src/game/rules/__tests__/plan-abilities.test.ts`

**Step 1: 胜利条件全覆盖**

为所有 33 个培养计划各写 1 个 pass + 1 个 fail 用例 = 66 个测试。

**Step 2: 卡牌效果遍历测试**

遍历 CARD_HANDLERS 注册表，验证每个处理器返回有效结构。

**Step 3: 培养计划能力遍历测试**

遍历 PLAN_ABILITIES 注册表，验证每个能力的触发点。

**Step 4: 运行全量测试**

Run: `cd server && npx vitest run --reporter=verbose`

**Step 5: Commit**

```bash
git add server/src/game/rules/__tests__/
git commit -m "test: comprehensive coverage for all 33 win conditions, 103 cards, 33 abilities"
```

---

### Task 35: 集成测试

**Files:**
- Create: `server/src/game/__tests__/GameCoordinator.test.ts`

**Step 1: 测试完整回合流程**

```typescript
// 创建 Engine + Coordinator，模拟: 掷骰 → 移动 → 事件 → 选择 → 回合结束
```

**Step 2: 测试投票流程**

**Step 3: 测试连锁行动流程**

**Step 4: Commit**

```bash
git add server/src/game/__tests__/
git commit -m "test: integration tests for GameCoordinator turn flow"
```

---

### Task 36: 部署优化

**Files:**
- Modify: `client/vite.config.ts`

**Step 1: 代码分割配置**

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'pixi': ['pixi.js'],
        'framer': ['framer-motion'],
        'socket': ['socket.io-client'],
        'zustand': ['zustand'],
      },
    },
  },
  sourcemap: false,
  minify: 'terser',
}
```

**Step 2: 懒加载 GameScreen**

**Step 3: 验证构建**

Run: `cd client && npm run build`

**Step 4: Commit**

```bash
git add client/vite.config.ts
git commit -m "perf: add code splitting and lazy loading for production build"
```

---

## 实施总览

| Phase | Task 范围 | 核心目标 | 预估文件数 |
|-------|----------|---------|-----------|
| 1 | Task 1-10 | 规则引擎 100% | ~15 |
| 2 | Task 11-15 | 服务端重构 | ~10 |
| 3 | Task 16-19 | 客户端重构 | ~15 |
| 4 | Task 20-22 | 动画系统 | ~8 |
| 5 | Task 23-26 | 视觉升级 | ~8 |
| 6 | Task 27-29 | 交互完善 | ~10 |
| 7 | Task 30-33 | 体验打磨 | ~8 |
| 8 | Task 34-36 | 测试部署 | ~8 |
| **Total** | **36 Tasks** | **可上市品质** | **~82 文件** |

**关键原则：**
- 每个 Phase 完成后运行 `npm run build` 确认编译通过
- 每个 Task 完成后 commit
- Phase 1 是最关键阶段 — 完成后游戏从"半成品"变为"完整可玩"
- 严格禁止跨 Phase 的依赖假设
