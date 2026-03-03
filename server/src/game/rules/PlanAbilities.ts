// server/src/game/rules/PlanAbilities.ts
import { Player, GameState } from '@nannaricher/shared';

export interface PlanAbilityContext {
  player: Player;
  state: GameState;
  event?: string;
  cellId?: string;
}

export interface PlanAbilityResult {
  modified: boolean;
  message?: string;
  effects?: {
    money?: number;
    gpa?: number;
    exploration?: number;
    skipEvent?: boolean;
    moveToLine?: string;
    moveToCell?: string;
    skipEntryFee?: boolean;
    customEffect?: string;
  };
}

export class PlanAbilityHandler {
  /**
   * 检查并应用玩家已确认培养计划的被动能力
   */
  applyPassiveAbility(context: PlanAbilityContext): PlanAbilityResult {
    const { player } = context;

    for (const planId of player.confirmedPlans) {
      const result = this.applyPlanAbility(planId, context);
      if (result.modified) return result;
    }

    return { modified: false };
  }

  /**
   * 应用特定培养计划的能力
   */
  private applyPlanAbility(planId: string, context: PlanAbilityContext): PlanAbilityResult {
    const { player, state, event, cellId } = context;

    switch (planId) {
      case 'plan_wenxue':
        // 文学院：到达蒋公的面子时改为选择
        if (cellId === 'jiang_gong') {
          return {
            modified: true,
            message: '文学院能力触发：蒋公的面子可改为+100金或喊"不吃"+2探索',
            effects: { customEffect: 'wenxue_jiang_gong' },
          };
        }
        break;

      case 'plan_lishi':
        // 历史学院：移动到鼓楼线入口
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '历史学院能力：移动到鼓楼线入口',
            effects: { moveToLine: 'gulou' },
          };
        }
        break;

      case 'plan_zhexue':
        // 哲学系：GPA下限为3.0（在modifyGpa中处理）
        break;

      case 'plan_faxue':
        // 法学院：免除下一次金钱损失（需要在扣款时检查）
        if ((player as any).lawyerShield) {
          return {
            modified: true,
            message: '法学院能力：免除本次金钱损失',
            effects: { customEffect: 'faxue_shield' },
          };
        }
        break;

      case 'plan_shangxue':
        // 商学院：直接移动至赚在南哪，不交入场费
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '商学院能力：移动到赚在南哪，免入场费',
            effects: { moveToLine: 'money', skipEntryFee: true },
          };
        }
        break;

      case 'plan_waiguoyu':
        // 外国语学院：立即抽取一张机会卡或命运卡
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '外国语学院能力：立即抽卡',
            effects: { customEffect: 'waiguoyu_draw_card' },
          };
        }
        break;

      case 'plan_xinwen':
        // 新闻传播学院：进入乐在南哪线不需要入场费
        if (cellId === 'line_explore') {
          return {
            modified: true,
            message: '新闻传播学院能力：乐在南哪免入场费',
            effects: { skipEntryFee: true },
          };
        }
        break;

      case 'plan_zhengguan':
        // 政府管理学院：四个校区线入场费改为150金
        if (['line_pukou', 'line_suzhou', 'line_gulou', 'line_xianlin'].includes(cellId || '')) {
          return {
            modified: true,
            message: '政府管理学院能力：校区线入场费150金',
            effects: { customEffect: 'zhengguan_discount' },
          };
        }
        break;

      case 'plan_guoji':
        // 国际关系学院：指定一位玩家抽取机会卡
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '国际关系学院能力：指定玩家抽机会卡',
            effects: { customEffect: 'guoji_target_draw' },
          };
        }
        break;

      case 'plan_xinxiguanli':
        // 信息管理学院：重新分配场上卡片（至多3张）
        if (event === 'on_demand') {
          return {
            modified: true,
            message: '信息管理学院能力：重新分配卡片',
            effects: { customEffect: 'xinxiguanli_redistribute' },
          };
        }
        break;

      case 'plan_shuxue':
        // 数学系：指定下一回合骰子点数
        if (event === 'before_roll') {
          return {
            modified: true,
            message: '数学系能力：可指定骰子点数',
            effects: { customEffect: 'shuxue_set_dice' },
          };
        }
        break;

      case 'plan_wuli':
        // 物理学院：前进双倍或后退双倍点数
        if (event === 'after_roll') {
          return {
            modified: true,
            message: '物理学院能力：可选双倍前进/后退',
            effects: { customEffect: 'wuli_double_move' },
          };
        }
        break;

      case 'plan_tianwen':
        // 天文学院：移动去候车厅
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '天文学院能力：移动到候车厅',
            effects: { moveToCell: 'waiting_room' },
          };
        }
        break;

      case 'plan_huaxue':
        // 化学化工学院：选定格子和线路失效
        if (event === 'on_demand') {
          return {
            modified: true,
            message: '化学化工学院能力：使格子/线路失效',
            effects: { customEffect: 'huaxue_disable' },
          };
        }
        break;

      case 'plan_jisuanji':
        // 计算机系：立即+1探索或+100金
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '计算机系能力：选择+1探索或+100金',
            effects: { customEffect: 'jisuanji_bonus' },
          };
        }
        break;

      case 'plan_ruanjian':
        // 软件学院：金钱可至低-1000（在破产检查中处理）
        break;

      case 'plan_dianzi':
        // 电子学院：科创赛事只需-0.1GPA即可投掷
        if (cellId === 'kechuang') {
          return {
            modified: true,
            message: '电子学院能力：科创赛事-0.1GPA即可投掷',
            effects: { customEffect: 'dianzi_kechuang' },
          };
        }
        break;

      case 'plan_xiandai':
        // 现代工程学院：抽取命运卡指定玩家执行
        if (event === 'on_demand') {
          return {
            modified: true,
            message: '现代工程学院能力：抽命运卡指定玩家执行',
            effects: { customEffect: 'xiandai_assign_card' },
          };
        }
        break;

      case 'plan_huanjing':
        // 环境学院：经历直接移动事件+2探索
        if (event === 'direct_move') {
          return {
            modified: true,
            message: '环境学院能力：直接移动事件+2探索',
            effects: { exploration: 2 },
          };
        }
        break;

      case 'plan_diqiu':
      case 'plan_dili':
        // 地球科学/地理学院：入场费减少（在入场费计算中处理）
        break;

      case 'plan_daqi':
        // 大气学院：抽3张卡至多选1张执行
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '大气学院能力：抽3张卡选1张执行',
            effects: { customEffect: 'daqi_draw_three' },
          };
        }
        break;

      case 'plan_shengming':
        // 生命科学学院：获得麦门护盾
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '生命科学学院能力：获得麦门护盾',
            effects: { customEffect: 'shengming_maimen' },
          };
        }
        break;

      case 'plan_yixue':
        // 医学院：进入医院后不需要付款即可出院
        if (cellId === 'hospital') {
          return {
            modified: true,
            message: '医学院能力：免付医药费出院',
            effects: { customEffect: 'yixue_free_discharge' },
          };
        }
        break;

      case 'plan_gongguan':
        // 工程管理学院：获得余额为负卡
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '工程管理学院能力：获得余额为负卡',
            effects: { customEffect: 'gongguan_negative_balance' },
          };
        }
        break;

      case 'plan_kuangyaming':
        // 匡亚明学院：GPA+0.1或探索+1
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '匡亚明学院能力：选择GPA+0.1或探索+1',
            effects: { customEffect: 'kuangyaming_bonus' },
          };
        }
        break;

      case 'plan_haiwai':
        // 海外教育学院：可选进入食堂线
        if (cellId === 'line_food') {
          return {
            modified: true,
            message: '海外教育学院能力：食堂线可选进入',
            effects: { customEffect: 'haiwai_optional_food' },
          };
        }
        break;

      case 'plan_jianzhu':
        // 建筑学院：鼓楼线免入场费
        if (cellId === 'line_gulou') {
          return {
            modified: true,
            message: '建筑学院能力：鼓楼线免入场费',
            effects: { skipEntryFee: true },
          };
        }
        break;

      case 'plan_makesi':
        // 马克思主义学院：社团格直接+2探索
        if (cellId === 'society') {
          return {
            modified: true,
            message: '马克思主义学院能力：社团格直接+2探索',
            effects: { exploration: 2, skipEvent: true },
          };
        }
        break;

      case 'plan_yishu':
        // 艺术学院：浦口线终点双倍经验卡效果
        if (event === 'pukou_endpoint') {
          return {
            modified: true,
            message: '艺术学院能力：浦口线双倍经验卡',
            effects: { customEffect: 'yishu_double_exp' },
          };
        }
        break;

      case 'plan_suzhou':
        // 苏州校区：苏州线免入场费，其他校区可-300金移动到苏州
        if (cellId === 'line_suzhou') {
          return {
            modified: true,
            message: '苏州校区能力：苏州线免入场费',
            effects: { skipEntryFee: true },
          };
        }
        break;
    }

    return { modified: false };
  }

  /**
   * 修改GPA时应用哲学系能力
   */
  modifyGpa(player: Player, delta: number): number {
    if (player.confirmedPlans.includes('plan_zhexue') && delta < 0) {
      const newGpa = player.gpa + delta;
      if (newGpa < 3.0) {
        return 3.0 - player.gpa; // 调整delta使GPA不低于3.0
      }
    }
    return delta;
  }

  /**
   * 检查是否可以破产（软件学院能力）
   */
  canGoBankrupt(player: Player, newMoney: number): boolean {
    if (player.confirmedPlans.includes('plan_ruanjian')) {
      return newMoney < -1000;
    }
    return newMoney < 0;
  }

  /**
   * 计算入场费（地球科学/地理学院能力）
   */
  calculateEntryFee(player: Player, lineId: string, baseFee: number): number {
    let discount = 0;

    if (player.confirmedPlans.includes('plan_diqiu')) {
      // 每进入过不重复的一条线，入场费-100
      const uniqueLines = new Set(player.linesVisited).size;
      discount = Math.min(uniqueLines * 100, baseFee);
    }

    if (player.confirmedPlans.includes('plan_dili')) {
      // 每进入过不重复的一个校区，入场费-100
      const campusLines = ['pukou', 'suzhou', 'gulou', 'xianlin'];
      const visitedCampus = campusLines.filter(l => player.linesVisited.includes(l)).length;
      discount = Math.min(visitedCampus * 100, baseFee);
    }

    return Math.max(0, baseFee - discount);
  }
}
