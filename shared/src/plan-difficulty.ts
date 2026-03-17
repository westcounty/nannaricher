export type PlanDifficulty = 'easy' | 'medium' | 'hard';

// 基于 2000 局 2-6人模拟数据（2026-03-17）
// easy: 胜率 > 30%  |  medium: 22%-30%  |  hard: < 22%
export const PLAN_DIFFICULTY: Record<string, PlanDifficulty> = {
  plan_wuli: 'easy',           // 物理学院 35.4%
  plan_xinwen: 'easy',         // 新闻传播学院 34.3%
  plan_xiandai: 'easy',        // 现代工程与应用科学学院 33.3%
  plan_zhexue: 'easy',         // 哲学系 32.9%
  plan_shangxue: 'easy',       // 商学院 31.7%
  plan_wenxue: 'easy',         // 文学院 31.6%
  plan_gongguan: 'easy',       // 工程管理学院 30.6%
  plan_makesi: 'medium',       // 马克思主义学院 29.7%
  plan_tianwen: 'medium',      // 天文与空间科学学院 28.8%
  plan_faxue: 'medium',        // 法学院 28.5%
  plan_huaxue: 'medium',       // 化学化工学院 27.8%
  plan_daqi: 'medium',         // 大气科学学院 26.7%
  plan_dianzi: 'medium',       // 电子科学与工程学院 25.9%
  plan_jisuanji: 'medium',     // 计算机科学与技术系 25.2%
  plan_shuxue: 'medium',       // 数学系 24.4%
  plan_rengong: 'medium',      // 人工智能学院 24.1%
  plan_huanjing: 'medium',     // 环境学院 24.1%
  plan_suzhou: 'medium',       // 苏州校区 23.8%
  plan_shehuixue: 'medium',    // 社会学院 23.7%
  plan_ruanjian: 'medium',     // 软件学院 23.3%
  plan_diqiu: 'medium',        // 地球科学与工程学院 23.3%
  plan_xinxi: 'medium',        // 信息管理学院 22.9%
  plan_shengming: 'medium',    // 生命科学学院 22.9%
  plan_zhengguan: 'medium',    // 政府管理学院 22.7%
  plan_guoji: 'hard',          // 国际关系学院 21.9%
  plan_dili: 'hard',           // 地理与海洋科学学院 21.7%
  plan_jianzhu: 'hard',        // 建筑与城市规划学院 21.6%
  plan_lishi: 'hard',          // 历史学院 21.5%
  plan_kuangyaming: 'hard',    // 匡亚明学院 21.2%
  plan_waiguoyu: 'hard',       // 外国语学院 21.0%
  plan_yishu: 'hard',          // 艺术学院 20.0%
  plan_haiwai: 'hard',         // 海外教育学院 20.0%
  plan_yixue: 'hard',          // 医学院 19.9%
};

// 按人数分层的胜率数据（2-6人）
// 用于在选计划时根据当前房间人数显示更精确的难度
export const PLAN_WINRATE_BY_PLAYERS: Record<string, Record<number, number>> = {
  plan_wuli:       { 2: 63.8, 3: 47.2, 4: 35.2, 5: 28.2, 6: 21.6 },
  plan_xinwen:     { 2: 50.0, 3: 45.8, 4: 37.2, 5: 27.6, 6: 21.8 },
  plan_xiandai:    { 2: 60.0, 3: 40.4, 4: 33.6, 5: 28.8, 6: 20.8 },
  plan_zhexue:     { 2: 47.2, 3: 38.8, 4: 30.8, 5: 29.0, 6: 30.7 },
  plan_shangxue:   { 2: 56.7, 3: 39.8, 4: 32.5, 5: 25.2, 6: 21.9 },
  plan_wenxue:     { 2: 40.6, 3: 43.6, 4: 31.0, 5: 23.9, 6: 28.0 },
  plan_gongguan:   { 2: 56.3, 3: 29.7, 4: 35.8, 5: 22.6, 6: 26.4 },
  plan_makesi:     { 2: 55.6, 3: 28.6, 4: 29.0, 5: 26.4, 6: 21.3 },
  plan_tianwen:    { 2: 54.5, 3: 40.5, 4: 30.0, 5: 22.6, 6: 11.8 },
  plan_faxue:      { 2: 43.8, 3: 33.8, 4: 29.2, 5: 25.0, 6: 22.0 },
  plan_huaxue:     { 2: 54.8, 3: 32.4, 4: 31.8, 5: 21.3, 6: 15.3 },
  plan_daqi:       { 2: 54.5, 3: 32.0, 4: 28.4, 5: 19.4, 6: 17.6 },
  plan_dianzi:     { 2: 52.8, 3: 44.9, 4: 21.6, 5: 16.1, 6: 12.6 },
  plan_jisuanji:   { 2: 61.5, 3: 34.3, 4: 19.3, 5: 18.0, 6: 16.9 },
  plan_shuxue:     { 2: 38.9, 3: 31.0, 4: 24.7, 5: 21.7, 6: 16.1 },
};

export const DIFFICULTY_LABEL: Record<PlanDifficulty, string> = {
  easy: '⭐ 简单',
  medium: '⭐⭐ 中等',
  hard: '⭐⭐⭐ 困难',
};

export const DIFFICULTY_COLOR: Record<PlanDifficulty, string> = {
  easy: 'var(--c-success)',
  medium: 'var(--c-accent)',
  hard: 'var(--c-danger)',
};

/**
 * 根据当前人数获取计划的动态难度
 * 如果有按人数的精细数据，使用该人数的胜率；否则使用总体胜率
 */
export function getPlanDifficulty(planId: string, playerCount?: number): PlanDifficulty {
  if (playerCount && PLAN_WINRATE_BY_PLAYERS[planId]?.[playerCount] !== undefined) {
    const rate = PLAN_WINRATE_BY_PLAYERS[planId][playerCount];
    if (rate > 35) return 'easy';
    if (rate >= 20) return 'medium';
    return 'hard';
  }
  return PLAN_DIFFICULTY[planId] ?? 'medium';
}
