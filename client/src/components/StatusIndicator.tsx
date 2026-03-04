// client/src/components/StatusIndicator.tsx
// Game phase status indicator — shows contextual messages based on game state.
// Positioned at top-center below status bar with animated entrance and auto-dismiss.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

// ============================================
// Types
// ============================================

interface StatusIndicatorProps {
  gameState: GameState;
  playerId: string;
  isMyTurn: boolean;
}

interface StatusMessage {
  text: string;
  variant: 'action' | 'waiting' | 'info';
  key: string; // unique key to detect changes
}

// ============================================
// Auto-dismiss duration
// ============================================

const DISMISS_DURATION = 3000; // 3 seconds
const ANIMATION_DURATION = 300; // entrance/exit animation

// ============================================
// Component
// ============================================

export function StatusIndicator({ gameState, playerId, isMyTurn }: StatusIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<StatusMessage | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevKeyRef = useRef<string>('');

  // Compute the status message based on game state
  const computeMessage = useCallback((): StatusMessage | null => {
    const { pendingAction, phase, players, currentPlayerIndex } = gameState;
    const currentPlayer = players[currentPlayerIndex];

    // Voting in progress
    if (pendingAction?.type === 'multi_vote') {
      return { text: '投票进行中...', variant: 'info', key: `vote-${pendingAction.id}` };
    }

    // Chain action in progress
    if (pendingAction?.type === 'chain_action') {
      return { text: '连锁行动进行中...', variant: 'info', key: `chain-${pendingAction.id}` };
    }

    // My turn - roll dice
    if (isMyTurn && pendingAction?.type === 'roll_dice') {
      return { text: '轮到你了！掷骰子开始', variant: 'action', key: 'my-roll' };
    }

    // My turn - make a choice
    if (isMyTurn && pendingAction?.type === 'choose_option') {
      return { text: '选择行动...', variant: 'action', key: `my-choice-${pendingAction.id}` };
    }

    // My turn - choose player
    if (isMyTurn && pendingAction?.type === 'choose_player') {
      return { text: '选择目标玩家...', variant: 'action', key: `my-player-${pendingAction.id}` };
    }

    // My turn - choose line
    if (isMyTurn && pendingAction?.type === 'choose_line') {
      return { text: '选择路线...', variant: 'action', key: `my-line-${pendingAction.id}` };
    }

    // Waiting for someone else
    if (!isMyTurn && phase === 'playing' && currentPlayer) {
      return {
        text: `等待 ${currentPlayer.name} 操作...`,
        variant: 'waiting',
        key: `waiting-${currentPlayer.id}-${gameState.turnNumber}`,
      };
    }

    // Rolling dice phase
    if (phase === 'rolling_dice') {
      return { text: '骰子滚动中...', variant: 'info', key: 'rolling' };
    }

    // Moving phase
    if (phase === 'moving') {
      return { text: '移动中...', variant: 'info', key: 'moving' };
    }

    // Event popup phase
    if (phase === 'event_popup') {
      return { text: '事件触发！', variant: 'info', key: 'event' };
    }

    // Setup plans
    if (phase === 'setup_plans') {
      return { text: '选择培养计划...', variant: 'action', key: 'setup-plans' };
    }

    return null;
  }, [gameState, isMyTurn, playerId]);

  // Show/hide logic with auto-dismiss
  useEffect(() => {
    const message = computeMessage();

    if (!message) {
      if (visible) {
        setExiting(true);
        const exitTimer = setTimeout(() => {
          setVisible(false);
          setExiting(false);
          setCurrentMessage(null);
        }, ANIMATION_DURATION);
        return () => clearTimeout(exitTimer);
      }
      return;
    }

    // Only update if message changed
    if (message.key !== prevKeyRef.current) {
      prevKeyRef.current = message.key;
      setCurrentMessage(message);
      setExiting(false);
      setVisible(true);

      // Clear previous dismiss timer
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }

      // Auto-dismiss for non-waiting states
      if (message.variant !== 'waiting') {
        dismissTimerRef.current = setTimeout(() => {
          setExiting(true);
          setTimeout(() => {
            setVisible(false);
            setExiting(false);
          }, ANIMATION_DURATION);
        }, DISMISS_DURATION);
      }
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [computeMessage, visible]);

  if (!visible || !currentMessage) return null;

  const variantStyles = getVariantStyle(currentMessage.variant);

  return (
    <div
      style={{
        ...styles.container,
        ...variantStyles,
        opacity: exiting ? 0 : 1,
        transform: exiting
          ? 'translateX(-50%) translateY(-10px)'
          : 'translateX(-50%) translateY(0)',
      }}
      role="status"
      aria-live="polite"
    >
      {currentMessage.variant === 'action' && <span style={styles.actionDot} />}
      <span style={styles.text}>{currentMessage.text}</span>
    </div>
  );
}

// ============================================
// Variant Styles
// ============================================

function getVariantStyle(variant: StatusMessage['variant']): React.CSSProperties {
  switch (variant) {
    case 'action':
      return {
        background: `linear-gradient(135deg, ${DESIGN_TOKENS.color.brand.primary}E6, ${DESIGN_TOKENS.color.brand.primaryLight}E6)`,
        borderColor: DESIGN_TOKENS.color.brand.accent,
      };
    case 'waiting':
      return {
        background: 'rgba(37, 32, 64, 0.9)',
        borderColor: 'rgba(139, 95, 191, 0.3)',
      };
    case 'info':
      return {
        background: 'rgba(26, 18, 48, 0.9)',
        borderColor: 'rgba(139, 95, 191, 0.2)',
      };
  }
}

// ============================================
// Inline Styles
// ============================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '64px',
    left: '50%',
    transform: 'translateX(-50%) translateY(0)',
    padding: '8px 20px',
    borderRadius: DESIGN_TOKENS.radius.pill,
    border: '1px solid',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backdropFilter: 'blur(12px)',
    boxShadow: DESIGN_TOKENS.shadow.md,
    transition: `opacity ${ANIMATION_DURATION}ms ease, transform ${ANIMATION_DURATION}ms ease`,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    maxWidth: '90vw',
  },
  text: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: DESIGN_TOKENS.color.text.primary,
  },
  actionDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: DESIGN_TOKENS.color.brand.accent,
    flexShrink: 0,
    animation: 'pulse 1.5s infinite',
  },
};

export default StatusIndicator;
