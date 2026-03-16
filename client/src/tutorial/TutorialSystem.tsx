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
    title: '🎓 欢迎来到菜根人生',
    content: '这是南大版大富翁——投骰子走格子，在4年大学生活中成长！',
    position: 'center',
  },
  {
    id: 'resources',
    title: '📊 三大资源',
    content: '💰金钱 📚GPA 🐋探索值——当 GPA×10 + 探索值 ≥ 60 即可获胜',
    position: 'center',
  },
  {
    id: 'board',
    title: '🗺️ 棋盘与支线',
    content: '主棋盘28格围成一圈，还有8条支线可以进入，各有独特事件和奖励',
    position: 'center',
  },
  {
    id: 'plans',
    title: '🎯 培养计划',
    content: '大二起每年选专业方向，每个专业有独特的被动能力和胜利条件——这是另一种赢法！',
    position: 'center',
  },
  {
    id: 'cards',
    title: '🃏 卡牌',
    content: '踩到机会/命运格会抽卡。有些卡立即生效，有些可保留在手中择机使用',
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
          background: 'rgba(42, 32, 24, 0.7)',
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
            background: '#F5EDE0',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: isCenter ? '480px' : '360px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(91, 45, 142, 0.15)',
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
                    ? '#FFB300'
                    : idx < currentStepIndex
                      ? 'rgba(91, 45, 142, 0.3)'
                      : 'rgba(91, 45, 142, 0.08)',
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>

          {/* 标题 */}
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#5B2D8E',
            marginBottom: '12px',
          }}>
            {currentStep.title}
          </h2>

          {/* 内容 */}
          <p style={{
            fontSize: '0.95rem',
            color: '#2A2018',
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
                  border: '1px solid rgba(91, 45, 142, 0.15)',
                  borderRadius: '8px',
                  color: '#8A7E6E',
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
                background: '#5B2D8E',
                border: 'none',
                borderRadius: '8px',
                color: '#FFFFFF',
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
              color: '#8A7E6E',
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
