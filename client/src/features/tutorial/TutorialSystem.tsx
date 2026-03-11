// client/src/features/tutorial/TutorialSystem.tsx
// 非阻塞新手引导系统 — 基于游戏状态触发，显示定位提示气泡

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TUTORIAL_STEPS, type TutorialStep, type TutorialTrigger } from './TutorialSteps';
import { useGameStore } from '../../stores/gameStore';

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'nannaricher_tutorial_completed';
const FADE_DURATION_MS = 250;

// ============================================
// Persistence Helpers
// ============================================

function loadCompletedSteps(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      return new Set(arr);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveCompletedSteps(steps: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(steps)));
  } catch {
    // ignore
  }
}

// ============================================
// Position Calculation
// ============================================

interface TooltipPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
}

function computePosition(
  targetSelector: string,
  preferredSide: 'top' | 'bottom' | 'left' | 'right'
): TooltipPosition | null {
  // Try each selector separated by commas
  const selectors = targetSelector.split(',').map(s => s.trim());
  let targetEl: Element | null = null;
  for (const sel of selectors) {
    targetEl = document.querySelector(sel);
    if (targetEl) break;
  }
  if (!targetEl) return null;

  const rect = targetEl.getBoundingClientRect();
  const GAP = 12;
  const TOOLTIP_WIDTH = 320;
  const TOOLTIP_HEIGHT_ESTIMATE = 160;

  // The arrow points AT the target, so arrowSide is opposite to tooltip placement
  switch (preferredSide) {
    case 'top':
      return {
        bottom: window.innerHeight - rect.top + GAP,
        left: Math.max(8, Math.min(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 8)),
        arrowSide: 'bottom',
      };
    case 'bottom':
      return {
        top: rect.bottom + GAP,
        left: Math.max(8, Math.min(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 8)),
        arrowSide: 'top',
      };
    case 'left':
      return {
        top: Math.max(8, Math.min(rect.top + rect.height / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2, window.innerHeight - TOOLTIP_HEIGHT_ESTIMATE - 8)),
        right: window.innerWidth - rect.left + GAP,
        arrowSide: 'right',
      };
    case 'right':
      return {
        top: Math.max(8, Math.min(rect.top + rect.height / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2, window.innerHeight - TOOLTIP_HEIGHT_ESTIMATE - 8)),
        left: rect.right + GAP,
        arrowSide: 'left',
      };
  }
}

// ============================================
// Trigger Detection
// ============================================

function useActiveTrigger(): TutorialTrigger | null {
  const gameState = useGameStore(s => s.gameState);
  const drawnCard = useGameStore(s => s.drawnCard);

  if (!gameState) return null;

  // Pending action for roll_dice
  if (
    gameState.pendingAction &&
    gameState.pendingAction.type === 'roll_dice'
  ) {
    return 'first_dice';
  }

  // Pending action for draw_training_plan (plan confirm context)
  if (
    gameState.pendingAction &&
    gameState.pendingAction.type === 'draw_training_plan'
  ) {
    return 'plan_confirm';
  }

  // Card drawn
  if (drawnCard) {
    return 'first_card_draw';
  }

  // Player in a branch line
  const playerId = useGameStore.getState().playerId;
  if (playerId && gameState.players) {
    const player = gameState.players.find(p => p.id === playerId);
    if (player && player.position.type === 'line') {
      return 'first_branch';
    }
  }

  return null;
}

// ============================================
// TutorialSystem Component
// ============================================

export function TutorialSystem() {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(loadCompletedSteps);
  const [activeStep, setActiveStep] = useState<TutorialStep | null>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTrigger = useActiveTrigger();

  // Check if all steps are completed
  const allCompleted = completedSteps.size >= TUTORIAL_STEPS.length;

  // Find matching step for current trigger
  useEffect(() => {
    if (allCompleted || !activeTrigger) {
      // No trigger or all done
      if (activeStep) {
        setVisible(false);
        const timer = setTimeout(() => setActiveStep(null), FADE_DURATION_MS);
        return () => clearTimeout(timer);
      }
      return;
    }

    const matchingStep = TUTORIAL_STEPS.find(
      s => s.trigger === activeTrigger && !completedSteps.has(s.id)
    );

    if (matchingStep && matchingStep.id !== activeStep?.id) {
      setActiveStep(matchingStep);

      // Small delay to ensure DOM elements are rendered
      const timer = setTimeout(() => {
        const pos = computePosition(matchingStep.targetSelector, matchingStep.position);
        setPosition(pos);
        setVisible(true);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [activeTrigger, allCompleted, completedSteps, activeStep]);

  // Dismiss current step
  const dismissStep = useCallback(() => {
    if (!activeStep) return;

    setVisible(false);
    const newCompleted = new Set(completedSteps);
    newCompleted.add(activeStep.id);
    setCompletedSteps(newCompleted);
    saveCompletedSteps(newCompleted);

    dismissTimerRef.current = setTimeout(() => {
      setActiveStep(null);
    }, FADE_DURATION_MS);
  }, [activeStep, completedSteps]);

  // Skip all steps
  const skipAll = useCallback(() => {
    setVisible(false);
    const allIds = new Set(TUTORIAL_STEPS.map(s => s.id));
    setCompletedSteps(allIds);
    saveCompletedSteps(allIds);

    setTimeout(() => {
      setActiveStep(null);
    }, FADE_DURATION_MS);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // Don't render if nothing to show
  if (!activeStep || allCompleted) {
    return null;
  }

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 10000,
    maxWidth: 320,
    width: 'max-content',
    pointerEvents: 'auto',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(8px)',
    transition: `opacity ${FADE_DURATION_MS}ms ease, transform ${FADE_DURATION_MS}ms ease`,
    ...(position
      ? {
          top: position.top,
          bottom: position.bottom,
          left: position.left,
          right: position.right,
        }
      : {
          // Fallback center positioning
          top: '50%',
          left: '50%',
          transform: visible ? 'translate(-50%, -50%)' : 'translate(-50%, calc(-50% + 8px))',
        }),
  };

  return (
    <div
      className="tutorial-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}
    >
      <div style={tooltipStyle}>
        {/* Arrow */}
        {position && <Arrow side={position.arrowSide} />}

        {/* Tooltip body */}
        <div
          style={{
            background: 'linear-gradient(135deg, #3D1F66 0%, #5B2D8E 100%)',
            borderRadius: 12,
            padding: '16px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 12px rgba(94,58,141,0.3)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#FFFFFF',
            fontFamily: "'Noto Sans SC', system-ui, sans-serif",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 8,
              color: '#E8CC6E',
            }}
          >
            {activeStep.title}
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: '#E8E0F0',
              marginBottom: 14,
            }}
          >
            {activeStep.message}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={skipAll}
              style={{
                background: 'none',
                border: 'none',
                color: '#B0B0B0',
                fontSize: 12,
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              {'\u8DF3\u8FC7\u5168\u90E8'}
            </button>

            <button
              onClick={dismissStep}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                padding: '6px 16px',
                cursor: 'pointer',
              }}
            >
              {'\u77E5\u9053\u4E86'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Arrow sub-component
// ============================================

function Arrow({ side }: { side: 'top' | 'bottom' | 'left' | 'right' }) {
  const size = 8;
  const color = '#3D1F66';

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  };

  switch (side) {
    case 'top':
      return (
        <div
          style={{
            ...baseStyle,
            top: -size,
            left: '50%',
            marginLeft: -size,
            borderWidth: `0 ${size}px ${size}px ${size}px`,
            borderColor: `transparent transparent ${color} transparent`,
          }}
        />
      );
    case 'bottom':
      return (
        <div
          style={{
            ...baseStyle,
            bottom: -size,
            left: '50%',
            marginLeft: -size,
            borderWidth: `${size}px ${size}px 0 ${size}px`,
            borderColor: `${color} transparent transparent transparent`,
          }}
        />
      );
    case 'left':
      return (
        <div
          style={{
            ...baseStyle,
            left: -size,
            top: '50%',
            marginTop: -size,
            borderWidth: `${size}px ${size}px ${size}px 0`,
            borderColor: `transparent ${color} transparent transparent`,
          }}
        />
      );
    case 'right':
      return (
        <div
          style={{
            ...baseStyle,
            right: -size,
            top: '50%',
            marginTop: -size,
            borderWidth: `${size}px 0 ${size}px ${size}px`,
            borderColor: `transparent transparent transparent ${color}`,
          }}
        />
      );
  }
}

// ============================================
// Exports
// ============================================

export default TutorialSystem;
