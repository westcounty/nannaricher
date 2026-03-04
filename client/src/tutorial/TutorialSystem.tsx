// client/src/tutorial/TutorialSystem.tsx
// 新手引导系统 - 提供游戏教程和步骤引导

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'hover' | 'none';
  onComplete?: () => void;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '欢迎来到菜根人生！',
    content: '这是一款以南大校园生活为主题的大富翁游戏。在这个游戏中，你将体验四年的大学生活，追求学术成就（GPA）、探索校园（探索值）和积累财富。',
    position: 'center',
  },
  {
    id: 'goal',
    title: '游戏目标',
    content: '游戏胜利条件：GPA×10 + 探索值 ≥ 60，或者完成你选择的培养计划目标。',
    position: 'center',
  },
  {
    id: 'roll_dice',
    title: '投骰子移动',
    content: '点击"投骰子"按钮来移动你的棋子。骰子点数决定你前进的步数。',
    target: '[data-tutorial="roll-dice"]',
    position: 'top',
    action: 'click',
  },
  {
    id: 'board',
    title: '游戏棋盘',
    content: '棋盘有28个格子，包括事件格（橙色）、机会格（紫色）、线路入口（灰色）和特殊角落格。',
    target: '[data-tutorial="board"]',
    position: 'right',
  },
  {
    id: 'lines',
    title: '支线探索',
    content: '棋盘上有8条支线可以进入，每条支线都有独特的事件和奖励。有些需要支付入场费，有些是强制的。',
    position: 'center',
  },
  {
    id: 'training_plan',
    title: '培养计划',
    content: '开局时选择1-2个培养计划，完成其中的胜利条件即可获胜！不同的学院有不同的能力。',
    position: 'center',
  },
  {
    id: 'cards',
    title: '机会与命运卡',
    content: '踩到机会格可以抽卡。有些卡牌可以立即生效，有些可以保留使用。',
    target: '[data-tutorial="hand-cards"]',
    position: 'top',
  },
  {
    id: 'player_info',
    title: '玩家信息',
    content: '这里显示你的金钱、GPA和探索值。密切关注这些数值的变化！',
    target: '[data-tutorial="player-info"]',
    position: 'left',
  },
  {
    id: 'complete',
    title: '准备好了吗？',
    content: '现在你已经了解了游戏的基本规则。祝你在南大的四年生活愉快！',
    position: 'center',
  },
];

interface TutorialSystemProps {
  onComplete: () => void;
  forceShow?: boolean;
}

export const TutorialSystem: React.FC<TutorialSystemProps> = ({ onComplete, forceShow }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 检查是否已经完成过教程
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted || forceShow) {
      setIsVisible(true);
    }
  }, [forceShow]);

  const currentStep = TUTORIAL_STEPS[currentStepIndex];

  const handleNext = useCallback(() => {
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      currentStep.onComplete?.();
    } else {
      handleComplete();
    }
  }, [currentStepIndex, currentStep]);

  const handlePrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem('tutorial_completed', 'true');
    setIsVisible(false);
    onComplete();
  }, [onComplete]);

  if (!isVisible) return null;

  const isCenter = currentStep.position === 'center';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: isCenter ? 'center' : 'flex-start',
          justifyContent: isCenter ? 'center' : 'flex-start',
          padding: isCenter ? 0 : '60px',
        }}
        onClick={isCenter ? undefined : handleSkip}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: isCenter ? '480px' : '360px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* 步骤指示器 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {TUTORIAL_STEPS.map((_, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: idx === currentStepIndex
                    ? '#4ade80'
                    : idx < currentStepIndex
                      ? 'rgba(74, 222, 128, 0.5)'
                      : 'rgba(255, 255, 255, 0.2)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>

          {/* 标题 */}
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#4ade80',
            marginBottom: '12px',
          }}>
            {currentStep.title}
          </h2>

          {/* 内容 */}
          <p style={{
            fontSize: '0.95rem',
            color: '#e2e8f0',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}>
            {currentStep.content}
          </p>

          {/* 按钮组 */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            {currentStepIndex > 0 && (
              <button
                onClick={handlePrevious}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                上一步
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#000',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {currentStepIndex === TUTORIAL_STEPS.length - 1 ? '开始游戏' : '下一步'}
            </button>
          </div>

          {/* 跳过按钮 */}
          <button
            onClick={handleSkip}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '0.8rem',
              padding: '4px 8px',
            }}
          >
            跳过教程
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// 快速教程提示组件
interface QuickTipProps {
  message: string;
  duration?: number;
  onClose: () => void;
}

export const QuickTip: React.FC<QuickTipProps> = ({ message, duration = 3000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(30, 41, 59, 0.95)',
        padding: '12px 24px',
        borderRadius: '8px',
        color: '#e2e8f0',
        fontSize: '0.9rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        zIndex: 1000,
        maxWidth: '80%',
        textAlign: 'center',
      }}
    >
      💡 {message}
    </motion.div>
  );
};

// 重置教程
export const resetTutorial = (): void => {
  localStorage.removeItem('tutorial_completed');
};

export default TutorialSystem;
