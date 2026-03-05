// client/src/features/tutorial/TutorialSteps.ts
// 新手引导步骤定义 — 基于游戏状态触发的非阻塞提示

export type TutorialTrigger =
  | 'first_dice'        // 首次出现 roll_dice 待定动作
  | 'first_card_draw'   // 首次抽到卡牌
  | 'plan_confirm'      // 确认培养计划时
  | 'first_branch';     // 首次进入支线

export interface TutorialStep {
  id: string;
  trigger: TutorialTrigger;
  targetSelector: string;
  title: string;
  message: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'step_dice',
    trigger: 'first_dice',
    targetSelector: '[data-tutorial="roll-dice"], [data-tutorial="dice"]',
    title: '投骰子前进',
    message: '点击"投骰子"按钮来掷骰子，根据点数在棋盘上前进。按 R 键也可以快速掷骰。',
    position: 'top',
  },
  {
    id: 'step_plan_confirm',
    trigger: 'plan_confirm',
    targetSelector: '[data-tutorial="plans"], [data-tutorial="training-plan"]',
    title: '确认计划',
    message: '确认你选择的培养计划后，它的被动能力将立即生效。达成计划的胜利条件也可以赢得游戏。',
    position: 'right',
  },
  {
    id: 'step_card_draw',
    trigger: 'first_card_draw',
    targetSelector: '[data-tutorial="hand-cards"], [data-tutorial="cards"]',
    title: '抽到卡牌',
    message: '踩到机会格或命运格时会抽取卡牌。有些卡牌立即生效，有些可以保留在手中择机使用。',
    position: 'top',
  },
  {
    id: 'step_branch',
    trigger: 'first_branch',
    targetSelector: '[data-tutorial="board"], .board-area',
    title: '进入支线',
    message: '你进入了一条支线路径！支线中有独特的事件和奖励，完成后将回到主棋盘。',
    position: 'bottom',
  },
];
