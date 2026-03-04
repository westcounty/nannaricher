// client/src/components/VotePanel.tsx
// Voting UI for multi_vote card effects (e.g., 四校联动, 泳馆常客).
// Shows vote options, real-time tally, countdown timer, and voter avatars.

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PendingAction, Player } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

// ============================================
// Types
// ============================================

interface VotePanelProps {
  pendingAction: PendingAction;
  players: Player[];
  playerId: string;
  onVote: (actionId: string, choice: string) => void;
}

// ============================================
// Component
// ============================================

export function VotePanel({ pendingAction, players, playerId, onVote }: VotePanelProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(
    Math.ceil((pendingAction.timeoutMs || 30000) / 1000)
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if current player has already voted
  const hasVoted = pendingAction.responses
    ? Object.prototype.hasOwnProperty.call(pendingAction.responses, playerId)
    : false;

  // Tally votes from responses
  const voteTally = computeVoteTally(pendingAction);
  const totalVotes = Object.values(voteTally).reduce((sum, count) => sum + count, 0);

  // Determine which players have voted
  const votedPlayerIds = new Set(
    pendingAction.responses ? Object.keys(pendingAction.responses) : []
  );

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

  // Handle vote submission
  const handleVote = useCallback(
    (value: string) => {
      if (isSubmitted || hasVoted) return;
      setSelectedOption(value);
      setIsSubmitted(true);
      onVote(pendingAction.id, value);
    },
    [isSubmitted, hasVoted, onVote, pendingAction.id]
  );

  const timerPercentage = timeRemaining / Math.ceil((pendingAction.timeoutMs || 30000) / 1000);
  const isUrgent = timeRemaining <= 5;

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        {/* Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>投票进行中</h3>
          <div style={{
            ...styles.timerBadge,
            backgroundColor: isUrgent ? DESIGN_TOKENS.color.text.danger : 'rgba(94, 58, 141, 0.6)',
          }}>
            {timeRemaining}s
          </div>
        </div>

        {/* Timer bar */}
        <div style={styles.timerBarTrack}>
          <div
            style={{
              ...styles.timerBarFill,
              width: `${timerPercentage * 100}%`,
              backgroundColor: isUrgent
                ? DESIGN_TOKENS.color.text.danger
                : DESIGN_TOKENS.color.brand.primary,
            }}
          />
        </div>

        {/* Prompt */}
        <p style={styles.prompt}>{pendingAction.prompt}</p>

        {/* Vote options */}
        <div style={styles.optionsContainer}>
          {(pendingAction.options || []).map((option) => {
            const count = voteTally[option.value] || 0;
            const isSelected = selectedOption === option.value;
            const barWidth = totalVotes > 0 ? (count / players.length) * 100 : 0;

            return (
              <button
                key={option.value}
                style={{
                  ...styles.optionButton,
                  borderColor: isSelected
                    ? DESIGN_TOKENS.color.brand.accent
                    : 'rgba(139, 95, 191, 0.2)',
                  cursor: isSubmitted || hasVoted ? 'default' : 'pointer',
                  opacity: isSubmitted && !isSelected ? 0.6 : 1,
                }}
                onClick={() => handleVote(option.value)}
                disabled={isSubmitted || hasVoted}
              >
                <div style={styles.optionContent}>
                  <span style={styles.optionLabel}>{option.label}</span>
                  <span style={styles.optionCount}>{count}</span>
                </div>
                {/* Tally bar */}
                <div style={styles.tallyBarTrack}>
                  <div
                    style={{
                      ...styles.tallyBarFill,
                      width: `${barWidth}%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Tally summary */}
        <div style={styles.tallySummary}>
          已投票: {totalVotes} / {players.length}
        </div>

        {/* Player vote avatars */}
        <div style={styles.voterAvatars}>
          {players.map((player) => {
            const hasPlayerVoted = votedPlayerIds.has(player.id);
            return (
              <div
                key={player.id}
                style={{
                  ...styles.avatar,
                  borderColor: player.color,
                  opacity: hasPlayerVoted ? 1 : 0.4,
                }}
                title={`${player.name}${hasPlayerVoted ? ' (已投票)' : ''}`}
              >
                <span style={styles.avatarText}>
                  {player.name.charAt(0)}
                </span>
                {hasPlayerVoted && (
                  <span style={styles.checkmark}>✓</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Already voted message */}
        {(isSubmitted || hasVoted) && (
          <div style={styles.submittedMessage}>
            已投票，等待其他玩家...
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function computeVoteTally(action: PendingAction): Record<string, number> {
  const tally: Record<string, number> = {};
  if (action.responses) {
    for (const choice of Object.values(action.responses)) {
      tally[choice] = (tally[choice] || 0) + 1;
    }
  }
  return tally;
}

// ============================================
// Inline Styles (using design tokens)
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
    maxWidth: '420px',
    width: '90%',
    border: `1px solid rgba(139, 95, 191, 0.3)`,
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
  timerBarTrack: {
    width: '100%',
    height: '3px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    marginBottom: '16px',
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 1s linear, background-color 0.3s ease',
  },
  prompt: {
    margin: '0 0 16px 0',
    fontSize: '1rem',
    color: DESIGN_TOKENS.color.text.secondary,
    lineHeight: 1.5,
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    marginBottom: '16px',
  },
  optionButton: {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    background: DESIGN_TOKENS.color.bg.surface,
    border: `2px solid rgba(139, 95, 191, 0.2)`,
    borderRadius: DESIGN_TOKENS.radius.md,
    color: DESIGN_TOKENS.color.text.primary,
    textAlign: 'left' as const,
    fontSize: '1rem',
    transition: 'all 0.2s ease',
  },
  optionContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  optionLabel: {
    fontWeight: 600,
  },
  optionCount: {
    fontWeight: 700,
    color: DESIGN_TOKENS.color.brand.accent,
    fontSize: '1.1rem',
  },
  tallyBarTrack: {
    width: '100%',
    height: '4px',
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  tallyBarFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${DESIGN_TOKENS.color.brand.primary}, ${DESIGN_TOKENS.color.brand.accent})`,
    borderRadius: '2px',
    transition: 'width 0.5s ease-out',
  },
  tallySummary: {
    textAlign: 'center' as const,
    fontSize: '0.875rem',
    color: DESIGN_TOKENS.color.text.secondary,
    marginBottom: '12px',
  },
  voterAvatars: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  avatar: {
    position: 'relative' as const,
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: DESIGN_TOKENS.color.bg.elevated,
    transition: 'opacity 0.3s ease',
  },
  avatarText: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: DESIGN_TOKENS.color.text.primary,
  },
  checkmark: {
    position: 'absolute' as const,
    bottom: '-2px',
    right: '-2px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: DESIGN_TOKENS.color.text.success,
    color: '#000',
    fontSize: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  submittedMessage: {
    textAlign: 'center' as const,
    marginTop: '12px',
    padding: '8px',
    borderRadius: DESIGN_TOKENS.radius.md,
    background: 'rgba(94, 58, 141, 0.2)',
    color: DESIGN_TOKENS.color.text.secondary,
    fontSize: '0.875rem',
  },
};

export default VotePanel;
