// client/src/components/CompactPlayerCard.tsx
// Horizontal compact player display for the redesigned sidebar

import type { Player } from '@nannaricher/shared';
import '../styles/compact-player.css';

interface CompactPlayerCardProps {
  player: Player;
  isCurrentTurn?: boolean;
  isLocalPlayer?: boolean;
}

export function CompactPlayerCard({ player, isCurrentTurn = false, isLocalPlayer = false }: CompactPlayerCardProps) {
  const classNames = [
    'compact-player',
    isCurrentTurn && 'compact-player--current-turn',
    isLocalPlayer && 'compact-player--local',
    player.isBankrupt && 'compact-player--bankrupt',
    player.isInHospital && 'compact-player--hospital',
  ].filter(Boolean).join(' ');

  const initial = player.name.charAt(0);

  return (
    <div className={classNames} title={player.isBankrupt ? '已破产' : undefined}>
      <div
        className="compact-player__avatar"
        style={{ backgroundColor: player.color }}
      >
        {initial}
      </div>

      <div className="compact-player__info">
        <span className="compact-player__name">{player.name}</span>
      </div>

      <div className="compact-player__stats">
        <span className="compact-player__stat">
          <span className="compact-player__stat-icon">💰</span>
          <span className={`compact-player__stat-value ${player.money < 100 ? 'compact-player__stat-value--low' : ''}`}>
            {player.money}
          </span>
        </span>
        <span className="compact-player__stat">
          <span className="compact-player__stat-icon">📚</span>
          <span className="compact-player__stat-value">{player.gpa.toFixed(1)}</span>
        </span>
        <span className="compact-player__stat">
          <span className="compact-player__stat-icon">🗺️</span>
          <span className="compact-player__stat-value">{player.exploration}</span>
        </span>
        {player.heldCards.length > 0 && (
          <span className="compact-player__stat">
            <span className="compact-player__stat-icon">🃏</span>
            <span className="compact-player__stat-value">{player.heldCards.length}</span>
          </span>
        )}
      </div>

      {player.isBankrupt && <span className="compact-player__badge compact-player__badge--bankrupt">破产</span>}
      {player.isInHospital && <span className="compact-player__badge compact-player__badge--hospital">医院</span>}
      {player.isAtDing && <span className="compact-player__badge compact-player__badge--ding">鼎</span>}
    </div>
  );
}
