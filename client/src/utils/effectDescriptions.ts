import type { ActiveEffect } from '@nannaricher/shared';

const EFFECT_TYPE_NAMES: Record<string, string> = {
  skip_turn: '跳过回合',
  reverse_move: '反向移动',
  double_move: '双倍移动',
  double_event: '双倍事件',
  system_fault: '系统故障',
  delayed_gratification: '延迟满足',
};

const CUSTOM_DATA_NAMES: [string, string][] = [
  ['foodShield', '食堂线负面屏蔽'],
  ['doubleDiceChoice', '投骰两次选一'],
  ['negateExpense', '抵消下次金钱扣除'],
  ['blockGpaLoss', '抵消下次GPA损失'],
  ['blockMoneyLoss', '抵消下次金钱损失'],
  ['blockExplorationLoss', '抵消下次探索损失'],
  ['reenterLine', '离开支线后可重入'],
  ['reverseEffects', '下次事件增减反转'],
  ['mendingPlan', '阻止胜利（补救计划）'],
  ['foodLineOptional', '食堂线可选进入'],
  ['gridLinkTarget', '位置绑定'],
  ['travelPenaltyQueue', '出行罚款待处理'],
  ['xianxianFirstPlayer', '仙林先手'],
  ['suzhouExpTarget', '苏州探索目标'],
];

export function describeEffect(effect: ActiveEffect): string {
  if (effect.type !== 'custom') {
    return EFFECT_TYPE_NAMES[effect.type] || effect.type;
  }
  if (effect.data) {
    for (const [key, label] of CUSTOM_DATA_NAMES) {
      if (effect.data[key]) return label;
    }
  }
  return '特殊效果';
}
