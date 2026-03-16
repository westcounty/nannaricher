export type PlanDifficulty = 'easy' | 'medium' | 'hard';

// 基于 5000 局 4人局模拟数据（2026-03-07）
// easy: 胜率 > 35%  |  medium: 20%-35%  |  hard: < 20%
export const PLAN_DIFFICULTY: Record<string, PlanDifficulty> = {
  plan_tianwen: 'easy',
  plan_zhengguan: 'easy',
  plan_wenxue: 'easy',
  plan_xiandai: 'easy',
  plan_wuli: 'easy',
  plan_diqiu: 'medium',
  plan_zhexue: 'medium',
  plan_shengming: 'medium',
  plan_makesi: 'medium',
  plan_xinxi: 'medium',
  plan_shangxue: 'medium',
  plan_dianzi: 'medium',
  plan_jianzhu: 'medium',
  plan_kuangyaming: 'medium',
  plan_lishi: 'medium',
  plan_huanjing: 'medium',
  plan_ruanjian: 'medium',
  plan_gongguan: 'medium',
  plan_shuxue: 'medium',
  plan_huaxue: 'medium',
  plan_xinwen: 'medium',
  plan_shehuixue: 'medium',
  plan_dili: 'medium',
  plan_faxue: 'medium',
  plan_jisuanji: 'medium',
  plan_guoji: 'medium',
  plan_daqi: 'hard',
  plan_yishu: 'hard',
  plan_waiguoyu: 'hard',
  plan_suzhou: 'hard',
  plan_yixue: 'hard',
  plan_rengong: 'hard',
  plan_haiwai: 'hard',
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
