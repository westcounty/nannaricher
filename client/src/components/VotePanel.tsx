// client/src/components/VotePanel.tsx
// Voting UI for multi_vote card effects (e.g., 四校联动, 泳馆常客).
// Shows vote options, real-time tally, countdown timer, and voter avatars.

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PendingAction, Player } from '@nannaricher/shared';
import { playSound } from '../audio/AudioManager';
import '../styles/vote-panel.css';

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
      playSound('vote_cast');
      setSelectedOption(value);
      setIsSubmitted(true);
      onVote(pendingAction.id, value);
    },
    [isSubmitted, hasVoted, onVote, pendingAction.id]
  );

  const timerPercentage = timeRemaining / Math.ceil((pendingAction.timeoutMs || 30000) / 1000);
  const isUrgent = timeRemaining <= 5;

  return (
    <div className="vote-panel__overlay">
      <div className="vote-panel__panel">
        {/* Header */}
        <div className="vote-panel__header">
          <h3 className="vote-panel__title">投票进行中</h3>
          <div className={`vote-panel__timer-badge${isUrgent ? ' vote-panel__timer-badge--urgent' : ''}`}>
            {timeRemaining}s
          </div>
        </div>

        {/* Timer bar */}
        <div className="vote-panel__timer-bar-track">
          <div
            className={`vote-panel__timer-bar-fill${isUrgent ? ' vote-panel__timer-bar-fill--urgent' : ''}`}
            style={{ width: `${timerPercentage * 100}%` }}
          />
        </div>

        {/* Prompt */}
        <p className="vote-panel__prompt">{pendingAction.prompt}</p>

        {/* Vote options */}
        <div className="vote-panel__options">
          {(pendingAction.options || []).map((option) => {
            const count = voteTally[option.value] || 0;
            const isSelected = selectedOption === option.value;
            const barWidth = totalVotes > 0 ? (count / players.length) * 100 : 0;

            const btnClass = [
              'vote-panel__option-btn',
              isSelected ? 'vote-panel__option-btn--selected' : '',
              isSubmitted && !isSelected ? 'vote-panel__option-btn--dimmed' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={option.value}
                className={btnClass}
                onClick={() => handleVote(option.value)}
                disabled={isSubmitted || hasVoted}
              >
                <div className="vote-panel__option-content">
                  <span className="vote-panel__option-label">{option.label}</span>
                  <span className="vote-panel__option-count">{count}</span>
                </div>
                {/* Tally bar */}
                <div className="vote-panel__tally-bar-track">
                  <div
                    className="vote-panel__tally-bar-fill"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Tally summary */}
        <div className="vote-panel__tally-summary">
          已投票: {totalVotes} / {players.length}
        </div>

        {/* Player vote avatars */}
        <div className="vote-panel__voter-avatars">
          {players.map((player) => {
            const hasPlayerVoted = votedPlayerIds.has(player.id);
            return (
              <div
                key={player.id}
                className={`vote-panel__avatar${!hasPlayerVoted ? ' vote-panel__avatar--pending' : ''}`}
                style={{ borderColor: player.color }}
                title={`${player.name}${hasPlayerVoted ? ' (已投票)' : ''}`}
              >
                <span className="vote-panel__avatar-text">
                  {player.name.charAt(0)}
                </span>
                {hasPlayerVoted && (
                  <span className="vote-panel__checkmark">✓</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Already voted message */}
        {(isSubmitted || hasVoted) && (
          <div className="vote-panel__submitted-message">
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

export default VotePanel;
