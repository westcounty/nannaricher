// client/src/components/ChainActionPanel.tsx
// Chain reaction card effects UI (e.g., 八卦秘闻, 南行玫瑰).
// Shows chain propagation visualization, highlights current player, provides action button.

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PendingAction, Player } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

// ============================================
// Types
// ============================================

interface ChainActionPanelProps {
  pendingAction: PendingAction;
  players: Player[];
  playerId: string;
  onAction: (actionId: string, choice: string) => void;
}

// ============================================
// Component
// ============================================

export function ChainActionPanel({
  pendingAction,
  players,
  playerId,
  onAction,
}: ChainActionPanelProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(
    Math.ceil((pendingAction.timeoutMs || 30000) / 1000)
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chain order from the pending action
  const chainOrder = pendingAction.chainOrder || [];
  const currentChainPlayerId = pendingAction.playerId;
  const isMyTurn = currentChainPlayerId === playerId;

  // Build player lookup
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Determine completed responses
  const completedPlayerIds = new Set(
    pendingAction.responses ? Object.keys(pendingAction.responses) : []
  );

  // Current chain index (the player who needs to act)
  const currentChainIndex = chainOrder.findIndex((pid) => pid === currentChainPlayerId);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Reset submit state when chain player changes
  useEffect(() => {
    setIsSubmitted(false);
  }, [currentChainPlayerId]);

  // Handle action choice
  const handleAction = useCallback(
    (value: string) => {
      if (isSubmitted || !isMyTurn) return;
      setIsSubmitted(true);
      onAction(pendingAction.id, value);
    },
    [isSubmitted, isMyTurn, onAction, pendingAction.id]
  );

  const isUrgent = timeRemaining <= 5;

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>连锁行动</h3>
          <div
            style={{
              ...styles.timerBadge,
              backgroundColor: isUrgent
                ? DESIGN_TOKENS.color.text.danger
                : 'rgba(94, 58, 141, 0.6)',
            }}
          >
            {timeRemaining}s
          </div>
        </div>

        {/* Prompt */}
        <p style={styles.prompt}>{pendingAction.prompt}</p>

        {/* Chain visualization */}
        <div style={styles.chainContainer}>
          {chainOrder.map((pid, index) => {
            const player = playerMap.get(pid);
            if (!player) return null;

            const isCompleted = completedPlayerIds.has(pid);
            const isCurrent = index === currentChainIndex;
            const isPending = !isCompleted && !isCurrent;

            return (
              <div key={pid} style={styles.chainItem}>
                {/* Player node */}
                <div
                  style={{
                    ...styles.chainNode,
                    borderColor: player.color,
                    backgroundColor: isCompleted
                      ? player.color
                      : isCurrent
                        ? 'rgba(201, 162, 39, 0.3)'
                        : DESIGN_TOKENS.color.bg.elevated,
                    boxShadow: isCurrent
                      ? `0 0 16px ${player.color}80, 0 0 4px ${DESIGN_TOKENS.color.brand.accent}60`
                      : 'none',
                    transform: isCurrent ? 'scale(1.15)' : 'scale(1)',
                  }}
                >
                  <span
                    style={{
                      ...styles.chainNodeText,
                      color: isCompleted ? '#000' : DESIGN_TOKENS.color.text.primary,
                    }}
                  >
                    {player.name.charAt(0)}
                  </span>
                  {isCompleted && <span style={styles.completedMark}>✓</span>}
                  {isCurrent && <span style={styles.currentIndicator} />}
                </div>

                {/* Player name */}
                <span
                  style={{
                    ...styles.chainNodeName,
                    color: isCurrent
                      ? DESIGN_TOKENS.color.brand.accent
                      : isPending
                        ? DESIGN_TOKENS.color.text.muted
                        : DESIGN_TOKENS.color.text.primary,
                    fontWeight: isCurrent ? 700 : 400,
                  }}
                >
                  {player.name}
                </span>

                {/* Arrow connector (except last) */}
                {index < chainOrder.length - 1 && (
                  <div
                    style={{
                      ...styles.arrow,
                      color: isCompleted
                        ? DESIGN_TOKENS.color.text.success
                        : DESIGN_TOKENS.color.text.muted,
                    }}
                  >
                    →
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons for current player */}
        {isMyTurn && !isSubmitted && (
          <div style={styles.actionsContainer}>
            {(pendingAction.options || []).map((option) => (
              <button
                key={option.value}
                style={styles.actionButton}
                onClick={() => handleAction(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Waiting message */}
        {!isMyTurn && (
          <div style={styles.waitingMessage}>
            等待 {playerMap.get(currentChainPlayerId)?.name || '玩家'} 操作...
          </div>
        )}

        {/* Submitted message */}
        {isMyTurn && isSubmitted && (
          <div style={styles.waitingMessage}>已选择，等待链中下一位玩家...</div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Inline Styles
// ============================================

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
    animation: 'fadeIn 0.3s ease-out',
  },
  panel: {
    background: `linear-gradient(135deg, ${DESIGN_TOKENS.color.bg.surface} 0%, ${DESIGN_TOKENS.color.bg.elevated} 100%)`,
    borderRadius: DESIGN_TOKENS.radius.xl,
    padding: '24px',
    maxWidth: '480px',
    width: '92%',
    border: '1px solid rgba(139, 95, 191, 0.3)',
    boxShadow: DESIGN_TOKENS.shadow.lg,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: DESIGN_TOKENS.color.text.primary,
  },
  timerBadge: {
    padding: '4px 10px',
    borderRadius: DESIGN_TOKENS.radius.pill,
    fontSize: '0.875rem',
    fontWeight: 600,
    color: DESIGN_TOKENS.color.text.primary,
    transition: 'background-color 0.3s ease',
  },
  prompt: {
    margin: '0 0 20px 0',
    fontSize: '1rem',
    color: DESIGN_TOKENS.color.text.secondary,
    lineHeight: 1.5,
  },
  chainContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    flexWrap: 'wrap' as const,
    marginBottom: '20px',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: DESIGN_TOKENS.radius.lg,
  },
  chainItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  chainNode: {
    position: 'relative' as const,
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
  },
  chainNodeText: {
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  chainNodeName: {
    fontSize: '0.75rem',
    maxWidth: '48px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    textAlign: 'center' as const,
  },
  completedMark: {
    position: 'absolute' as const,
    bottom: '-2px',
    right: '-2px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: DESIGN_TOKENS.color.text.success,
    color: '#000',
    fontSize: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  currentIndicator: {
    position: 'absolute' as const,
    top: '-4px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: DESIGN_TOKENS.color.brand.accent,
    animation: 'pulse 1.5s infinite',
  },
  arrow: {
    fontSize: '1.2rem',
    fontWeight: 700,
    margin: '0 2px',
    transition: 'color 0.3s ease',
  },
  actionsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  actionButton: {
    width: '100%',
    padding: '12px 16px',
    background: `linear-gradient(135deg, ${DESIGN_TOKENS.color.brand.primary}, ${DESIGN_TOKENS.color.brand.primaryLight})`,
    border: 'none',
    borderRadius: DESIGN_TOKENS.radius.md,
    color: DESIGN_TOKENS.color.text.primary,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  waitingMessage: {
    textAlign: 'center' as const,
    padding: '12px',
    borderRadius: DESIGN_TOKENS.radius.md,
    background: 'rgba(94, 58, 141, 0.15)',
    color: DESIGN_TOKENS.color.text.secondary,
    fontSize: '0.875rem',
  },
};

export default ChainActionPanel;
