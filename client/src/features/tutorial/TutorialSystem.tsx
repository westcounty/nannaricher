// client/src/features/tutorial/TutorialSystem.tsx
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '欢迎来到菜根人生',
    content: '这是一个以南大校园为主题的大富翁游戏。你将扮演一名南大学生，通过投骰子前进，体验校园生活中的各种事件。',
    position: 'center',
  },
  {
    id: 'resources',
    title: '三种资源',
    content: '游戏中有三种资源：金钱💰、GPA📚、探索值🧭。它们之间可以换算：1探索 = 0.1GPA = 100金钱。',
    position: 'bottom',
  },
  {
    id: 'dice',
    title: '投骰子',
    content: '每回合点击"掷骰子"按钮，根据点数前进。按R键也可以快速掷骰。',
    target: '[data-tutorial="dice"]',
    position: 'top',
  },
  {
    id: 'board',
    title: '棋盘格子',
    content: '棋盘有28个格子，包括4个角落格、9个事件格、7个机会格和8条支线入口。不同颜色代表不同类型的格子。',
    position: 'center',
  },
  {
    id: 'lines',
    title: '支线系统',
    content: '从入口格可以进入支线探索。有些支线是强制的（如浦口线、食堂线），有些是可选的（需付入场费）。',
    position: 'center',
  },
  {
    id: 'plans',
    title: '培养计划',
    content: '游戏开始时你会抽取3张培养计划，选择1-2项保留。除了基础胜利条件外，达成培养计划条件也能获胜。',
    position: 'left',
  },
  {
    id: 'cards',
    title: '卡牌系统',
    content: '在机会格可以抽取卡牌。命运卡是单人事件，机会卡涉及多人互动。手持型卡牌可以在合适时机使用。',
    position: 'left',
  },
  {
    id: 'win',
    title: '胜利条件',
    content: '基础胜利：GPA×10 + 探索值 ≥ 60。或者达成你已确认的培养计划条件。祝你游戏愉快！',
    position: 'center',
  },
];

interface TutorialSystemProps {
  onComplete?: () => void;
}

export const TutorialSystem: React.FC<TutorialSystemProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(
    localStorage.getItem('nannaricher_tutorial_seen') === 'true'
  );

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    setIsVisible(false);
    localStorage.setItem('nannaricher_tutorial_seen', 'true');
    onComplete?.();
  }, [onComplete]);

  if (hasSeenTutorial || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-xl shadow-2xl max-w-md p-6 mx-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          {/* 进度指示 */}
          <div className="flex gap-1 mb-4">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full ${
                  index <= currentStep ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* 标题 */}
          <h2 className="text-xl font-bold text-purple-800 mb-3">
            {step.title}
          </h2>

          {/* 内容 */}
          <p className="text-gray-600 mb-6 leading-relaxed">
            {step.content}
          </p>

          {/* 按钮 */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              跳过引导
            </button>

            <div className="flex gap-2">
              {!isFirstStep && (
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  上一步
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {isLastStep ? '开始游戏' : '下一步'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
