// client/src/components/ChainActionPanel.tsx
// Chain reaction card effects UI (e.g., 八卦秘闻, 南行玫瑰).
// Shows chain propagation visualization, highlights current player, provides action button.

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PendingAction, Player } from '@nannaricher/shared';
import '../styles/chain-action.css';

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
    <div className="chain-action__overlay">
      <div className="chain-action__panel">
        {/* Header */}
        <div className="chain-action__header">
          <h3 className="chain-action__title">连锁行动</h3>
          <div className={`chain-action__timer-badge${isUrgent ? ' chain-action__timer-badge--urgent' : ''}`}>
            {timeRemaining}s
          </div>
        </div>

        {/* Prompt */}
        <p className="chain-action__prompt">{pendingAction.prompt}</p>

        {/* Chain visualization */}
        <div className="chain-action__chain-container">
          {chainOrder.map((pid, index) => {
            const player = playerMap.get(pid);
            if (!player) return null;

            const isCompleted = completedPlayerIds.has(pid);
            const isCurrent = index === currentChainIndex;
            const isPending = !isCompleted && !isCurrent;

            const nodeClass = [
              'chain-action__chain-node',
              isCurrent ? 'chain-action__chain-node--current' : '',
            ]
              .filter(Boolean)
              .join(' ');

            // Dynamic styles: player color border, completed bg, current glow
            const nodeStyle: React.CSSProperties = {
              borderColor: player.color,
              ...(isCompleted
                ? { backgroundColor: player.color }
                : {}),
              ...(isCurrent
                ? { boxShadow: `0 0 16px ${player.color}80, 0 0 4px rgba(201, 162, 39, 0.38)` }
                : {}),
            };

            const nameClass = [
              'chain-action__chain-node-name',
              isCurrent ? 'chain-action__chain-node-name--current' : '',
              isPending ? 'chain-action__chain-node-name--pending' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div key={pid} className="chain-action__chain-item">
                {/* Player node */}
                <div className={nodeClass} style={nodeStyle}>
                  <span
                    className={`chain-action__chain-node-text${isCompleted ? ' chain-action__chain-node-text--completed' : ''}`}
                  >
                    {player.name.charAt(0)}
                  </span>
                  {isCompleted && <span className="chain-action__completed-mark">✓</span>}
                  {isCurrent && <span className="chain-action__current-indicator" />}
                </div>

                {/* Player name */}
                <span className={nameClass}>
                  {player.name}
                </span>

                {/* Arrow connector (except last) */}
                {index < chainOrder.length - 1 && (
                  <div className={`chain-action__arrow${isCompleted ? ' chain-action__arrow--completed' : ''}`}>
                    →
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons for current player */}
        {isMyTurn && !isSubmitted && (
          <div className="chain-action__actions">
            {(pendingAction.options || []).map((option) => (
              <button
                key={option.value}
                className="chain-action__action-btn"
                onClick={() => handleAction(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Waiting message */}
        {!isMyTurn && (
          <div className="chain-action__waiting-message">
            等待 {playerMap.get(currentChainPlayerId)?.name || '玩家'} 操作...
          </div>
        )}

        {/* Submitted message */}
        {isMyTurn && isSubmitted && (
          <div className="chain-action__waiting-message">已选择，等待链中下一位玩家...</div>
        )}
      </div>
    </div>
  );
}

export default ChainActionPanel;
