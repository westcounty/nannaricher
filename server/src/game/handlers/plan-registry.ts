// server/src/game/handlers/plan-registry.ts
// Plan Ability Registry — all 33 training plan passive abilities
import { Player, GameState } from '@nannaricher/shared';

export type AbilityTrigger =
  | 'on_confirm' | 'on_cell_enter' | 'on_money_loss' | 'on_gpa_change'
  | 'on_line_enter' | 'on_dice_roll' | 'on_turn_start' | 'on_card_draw'
  | 'on_move' | 'passive' | 'on_other_win';

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

function register(def: PlanAbilityDef): void {
  PLAN_ABILITIES.set(def.planId, def);
}

// ---------- 1. plan_wenxue — 文学院 ----------
// 到达蒋公的面子时，改为选择：+100金 或 喊"不吃"+2探索
register({
  planId: 'plan_wenxue',
  trigger: 'on_cell_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_cell_enter' || ctx.cellId !== 'jiang_gong') return null;
    return {
      activated: true,
      message: '文学院能力触发：蒋公的面子可改为+100金或喊"不吃"+2探索',
      effects: { customEffect: 'wenxue_jiang_gong' },
    };
  },
});

// ---------- 2. plan_lishi — 历史学院 ----------
// 确认时移动到鼓楼线入口
register({
  planId: 'plan_lishi',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '历史学院能力：移动到鼓楼线入口',
      effects: { moveToLine: 'gulou' },
    };
  },
});

// ---------- 3. plan_zhexue — 哲学系 ----------
// GPA不低于3.0
register({
  planId: 'plan_zhexue',
  trigger: 'on_gpa_change',
  apply(ctx) {
    if (ctx.trigger !== 'on_gpa_change') return null;
    const gpaDelta = ctx.gpaDelta ?? 0;
    if (gpaDelta >= 0) return null;
    const newGpa = ctx.player.gpa + gpaDelta;
    if (newGpa >= 3.0) return null;
    return {
      activated: true,
      message: '哲学系能力：GPA不低于3.0',
      effects: { overrideGpa: 3.0 },
    };
  },
});

// ---------- 4. plan_faxue — 法学院 ----------
// 若 lawyerShield 为 true，阻止扣款
register({
  planId: 'plan_faxue',
  trigger: 'on_money_loss',
  apply(ctx) {
    if (ctx.trigger !== 'on_money_loss') return null;
    if (!ctx.player.lawyerShield) return null;
    return {
      activated: true,
      message: '法学院能力：免除本次金钱损失',
      effects: { blockMoneyLoss: true },
    };
  },
});

// ---------- 5. plan_shangxue — 商学院 ----------
// 确认时移动到赚在南哪（money线），免入场费
register({
  planId: 'plan_shangxue',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '商学院能力：移动到赚在南哪，免入场费',
      effects: { moveToLine: 'money', skipEntryFee: true },
    };
  },
});

// ---------- 6. plan_waiguoyu — 外国语学院 ----------
// 确认时抽一张 destiny 卡
register({
  planId: 'plan_waiguoyu',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '外国语学院能力：立即抽取一张命运卡',
      effects: { drawCard: 'destiny' },
    };
  },
});

// ---------- 7. plan_xinwen — 新闻传播学院 ----------
// 进入乐在南哪线（explore线）免入场费
register({
  planId: 'plan_xinwen',
  trigger: 'on_line_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_line_enter') return null;
    if (ctx.lineId !== 'explore') return null;
    return {
      activated: true,
      message: '新闻传播学院能力：乐在南哪免入场费',
      effects: { skipEntryFee: true },
    };
  },
});

// ---------- 8. plan_zhengguan — 政府管理学院 ----------
// 进入四个校区线入场费固定150
register({
  planId: 'plan_zhengguan',
  trigger: 'on_line_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_line_enter') return null;
    const campusLines = ['pukou', 'suzhou', 'gulou', 'xianlin'];
    if (!campusLines.includes(ctx.lineId ?? '')) return null;
    return {
      activated: true,
      message: '政府管理学院能力：校区线入场费150金钱',
      effects: { customEffect: 'zhengguan_discount' },
    };
  },
});

// ---------- 9. plan_guoji — 国际关系学院 ----------
// 确认时选择玩家抽机会卡
register({
  planId: 'plan_guoji',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '国际关系学院能力：指定玩家抽机会卡',
      effects: { customEffect: 'guoji_target_draw' },
    };
  },
});

// ---------- 10. plan_xinxiguanli — 信息管理学院 ----------
// 确认时获得专属卡牌「数据整合」
register({
  planId: 'plan_xinxiguanli',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '信息管理学院能力：获得专属卡牌「数据整合」',
      effects: { customEffect: 'xinxiguanli_give_card' },
    };
  },
});

// ---------- 11. plan_shehuixue — 社会学院 ----------
// 确认时：可选择永久减少阈值 (20→15)
register({
  planId: 'plan_shehuixue',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '社会学院能力：可选择将获胜条件修改为高15',
      effects: { customEffect: 'shehuixue_reduce_threshold' },
    };
  },
});

// ---------- 12. plan_shuxue — 数学系 ----------
// 回合开始时可选择指定本回合骰子点数
register({
  planId: 'plan_shuxue',
  trigger: 'on_turn_start',
  apply(ctx) {
    if (ctx.trigger !== 'on_turn_start') return null;
    return {
      activated: true,
      message: '数学系能力：可指定本回合骰子点数',
      effects: { customEffect: 'shuxue_set_dice' },
    };
  },
});

// ---------- 13. plan_wuli — 物理学院 ----------
// 回合开始时可选择双倍前进或后退
register({
  planId: 'plan_wuli',
  trigger: 'on_turn_start',
  apply(ctx) {
    if (ctx.trigger !== 'on_turn_start') return null;
    return {
      activated: true,
      message: '物理学院能力：可选双倍前进/后退',
      effects: { customEffect: 'wuli_double_move' },
    };
  },
});

// ---------- 14. plan_tianwen — 天文与空间科学学院 ----------
// 确认时移动到候车厅
register({
  planId: 'plan_tianwen',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '天文学院能力：移动到候车厅',
      effects: { moveToCell: 'waiting_room' },
    };
  },
});

// ---------- 15. plan_huaxue — 化学化工学院 ----------
// 回合开始时可禁用一个格子
register({
  planId: 'plan_huaxue',
  trigger: 'on_turn_start',
  apply(ctx) {
    if (ctx.trigger !== 'on_turn_start') return null;
    return {
      activated: true,
      message: '化学化工学院能力：使格子/线路失效',
      effects: { customEffect: 'huaxue_disable' },
    };
  },
});

// ---------- 16. plan_rengong — 人工智能学院 ----------
// 确认时：可选择永久减少GPA差距阈值 (2.0→1.5)
register({
  planId: 'plan_rengong',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '人工智能学院能力：可选择将GPA差距阈值修改为1.5',
      effects: { customEffect: 'rengong_reduce_threshold' },
    };
  },
});

// ---------- 17. plan_jisuanji — 计算机科学与技术系 ----------
// 确认主修时一次性选择+1探索或+100金钱
register({
  planId: 'plan_jisuanji',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '计算机系能力：选择+1探索或+100金钱',
      effects: { customEffect: 'jisuanji_bonus' },
    };
  },
});

// ---------- 18. plan_ruanjian — 软件学院 ----------
// 被动：破产阈值改为-1000
register({
  planId: 'plan_ruanjian',
  trigger: 'passive',
  apply(ctx) {
    if (ctx.trigger !== 'passive') return null;
    return {
      activated: true,
      message: '软件学院能力：金钱可至低-1000',
      effects: { customEffect: 'ruanjian_bankruptcy_threshold' },
    };
  },
});

// ---------- 19. plan_dianzi — 电子科学与工程学院 ----------
// 到达科创赛事格时GPA消耗降低，补偿+0.2GPA
register({
  planId: 'plan_dianzi',
  trigger: 'on_cell_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_cell_enter' || ctx.cellId !== 'kechuang') return null;
    return {
      activated: true,
      message: '电子学院能力：科创赛事只需-0.1GPA即可投掷',
      effects: { customEffect: 'dianzi_kechuang', gpa: 0.2 },
    };
  },
});

// ---------- 20. plan_xiandai — 现代工程与应用科学学院 ----------
// 确认时：立即抽一张命运卡并指定一位玩家执行
register({
  planId: 'plan_xiandai',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '现代工程学院能力：抽一张命运卡指定玩家执行',
      effects: { customEffect: 'xiandai_assign_card' },
    };
  },
});

// ---------- 21. plan_huanjing — 环境学院 ----------
// 传送(直接移动)时+2探索
register({
  planId: 'plan_huanjing',
  trigger: 'on_move',
  apply(ctx) {
    if (ctx.trigger !== 'on_move') return null;
    return {
      activated: true,
      message: '环境学院能力：直接移动事件+2探索',
      effects: { exploration: 2 },
    };
  },
});

// ---------- 22. plan_diqiu — 地球科学与工程学院 ----------
// 每访问新支线后续入场费-100
register({
  planId: 'plan_diqiu',
  trigger: 'on_line_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_line_enter') return null;
    const uniqueLines = new Set(ctx.player.linesVisited).size;
    const discount = uniqueLines * 100;
    return {
      activated: true,
      message: `地球科学学院能力：已进入${uniqueLines}条不同线，入场费减少${discount}`,
      effects: { customEffect: 'diqiu_line_discount', money: discount },
    };
  },
});

// ---------- 23. plan_dili — 地理与海洋科学学院 ----------
// 进入校区线时入场费减免
register({
  planId: 'plan_dili',
  trigger: 'on_line_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_line_enter') return null;
    const campusLines = ['pukou', 'suzhou', 'gulou', 'xianlin'];
    const visitedCampus = campusLines.filter(l => ctx.player.linesVisited.includes(l)).length;
    const discount = visitedCampus * 100;
    return {
      activated: true,
      message: `地理学院能力：已进入${visitedCampus}个校区，入场费减少${discount}`,
      effects: { customEffect: 'dili_campus_discount', money: discount },
    };
  },
});

// ---------- 24. plan_daqi — 大气科学学院 ----------
// 确认时：抽3张机会/命运卡，选1张执行
register({
  planId: 'plan_daqi',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '大气学院能力：抽3张卡选1张执行',
      effects: { customEffect: 'daqi_draw_three' },
    };
  },
});

// ---------- 25. plan_shengming — 生命科学学院 ----------
// 确认时获得麦门护盾卡
register({
  planId: 'plan_shengming',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '生命科学学院能力：获得麦门护盾',
      effects: { customEffect: 'shengming_maimen' },
    };
  },
});

// ---------- 26. plan_yixue — 医学院 ----------
// 进入医院时免费出院
register({
  planId: 'plan_yixue',
  trigger: 'on_cell_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_cell_enter' || ctx.cellId !== 'hospital') return null;
    return {
      activated: true,
      message: '医学院能力：免付医药费出院',
      effects: { customEffect: 'yixue_free_discharge' },
    };
  },
});

// ---------- 27. plan_gongguan — 工程管理学院 ----------
// 确认时获得余额为负卡
register({
  planId: 'plan_gongguan',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '工程管理学院能力：获得余额为负卡',
      effects: { customEffect: 'gongguan_negative_balance' },
    };
  },
});

// ---------- 28. plan_kuangyaming — 匡亚明学院 ----------
// 确认主修时一次性选择+0.1GPA或+1探索
register({
  planId: 'plan_kuangyaming',
  trigger: 'on_confirm',
  apply(ctx) {
    if (ctx.trigger !== 'on_confirm') return null;
    return {
      activated: true,
      message: '匡亚明学院能力：选择GPA+0.1或探索+1',
      effects: { customEffect: 'kuangyaming_bonus' },
    };
  },
});

// ---------- 29. plan_haiwai — 海外教育学院 ----------
// 进入食堂线时改为可选入
register({
  planId: 'plan_haiwai',
  trigger: 'on_line_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_line_enter') return null;
    if (ctx.lineId !== 'food') return null;
    return {
      activated: true,
      message: '海外教育学院能力：食堂线可选进入',
      effects: { customEffect: 'haiwai_optional_food' },
    };
  },
});

// ---------- 30. plan_jianzhu — 建筑与城市规划学院 ----------
// 进入鼓楼线免入场费
register({
  planId: 'plan_jianzhu',
  trigger: 'on_line_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_line_enter') return null;
    if (ctx.lineId !== 'gulou') return null;
    return {
      activated: true,
      message: '建筑学院能力：鼓楼线免入场费',
      effects: { skipEntryFee: true },
    };
  },
});

// ---------- 31. plan_makesi — 马克思主义学院 ----------
// 走到社团格时直接+2探索
register({
  planId: 'plan_makesi',
  trigger: 'on_cell_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_cell_enter' || ctx.cellId !== 'society') return null;
    return {
      activated: true,
      message: '马克思主义学院能力：社团格直接+2探索',
      effects: { exploration: 2, skipEvent: true },
    };
  },
});

// ---------- 32. plan_yishu — 艺术学院 ----------
// 浦口经验卡双倍效果（实际逻辑在 GameEngine.exitLine 中执行）
register({
  planId: 'plan_yishu',
  trigger: 'passive',
  apply(ctx) {
    if (ctx.trigger !== 'passive') return null;
    // 被动能力：浦口线经验卡双倍奖励，直接在 exitLine 中通过 majorPlan 检查
    return {
      activated: true,
      message: '艺术学院能力：浦口线经验卡奖励翻倍',
    };
  },
});

// ---------- 33. plan_suzhou — 苏州校区 ----------
// 进入苏州线免入场费
register({
  planId: 'plan_suzhou',
  trigger: 'on_line_enter',
  apply(ctx) {
    if (ctx.trigger !== 'on_line_enter') return null;
    if (ctx.lineId !== 'suzhou') return null;
    return {
      activated: true,
      message: '苏州校区能力：苏州线免入场费',
      effects: { skipEntryFee: true },
    };
  },
});

// ---------- Exports ----------

export { PLAN_ABILITIES };

export function getPlanAbility(planId: string): PlanAbilityDef | undefined {
  return PLAN_ABILITIES.get(planId);
}
