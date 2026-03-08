// client/src/components/CompactPlayerCard.tsx
// Horizontal compact player display for the redesigned sidebar

import type { Player } from '@nannaricher/shared';
import { boardData } from '../data/board';
import { describeEffect } from '../utils/effectDescriptions';
import '../styles/compact-player.css';

function formatPosition(player: Player): string {
  if (player.isBankrupt) return '';
  if (player.isInHospital) return '医院';
  if (player.position.type === 'line') {
    const line = boardData.lines[player.position.lineId];
    const cell = line?.cells[player.position.index];
    const lineName = line?.name?.split(' - ')[0] || player.position.lineId;
    return cell?.name ? `${lineName} · ${cell.name}` : `${lineName} 第${player.position.index + 1}格`;
  }
  const cell = boardData.mainBoard[player.position.index];
  return cell?.name || `主环 第${player.position.index + 1}格`;
}

interface CompactPlayerCardProps {
  player: Player;
  isCurrentTurn?: boolean;
  isLocalPlayer?: boolean;
  onClick?: (playerId: string) => void;
}

export function CompactPlayerCard({ player, isCurrentTurn = false, isLocalPlayer = false, onClick }: CompactPlayerCardProps) {
  const classNames = [
    'compact-player',
    isCurrentTurn && 'compact-player--current-turn',
    isLocalPlayer && 'compact-player--local',
    player.isBankrupt && 'compact-player--bankrupt',
    player.isInHospital && 'compact-player--hospital',
  ].filter(Boolean).join(' ');

  const initial = player.name.charAt(0);

  return (
    <div
      className={classNames}
      title={player.isBankrupt ? '已破产' : undefined}
      onClick={() => onClick?.(player.id)}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      {/* Row 1: avatar + name/position + stats */}
      <div className="compact-player__row1">
        <div
          className="compact-player__avatar"
          style={{ backgroundColor: player.color }}
        >
          {initial}
        </div>

        <div className="compact-player__info">
          <span className="compact-player__name">{player.name}</span>
          {!player.isBankrupt && (
            <span className="compact-player__position">{formatPosition(player)}</span>
          )}
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
      </div>

      {/* Row 2: badges + effects + training plans */}
      <div className="compact-player__row2">
        {player.isBankrupt && <span className="compact-player__badge compact-player__badge--bankrupt">破产</span>}
        {player.isInHospital && <span className="compact-player__badge compact-player__badge--hospital">医院</span>}
        {player.isAtDing && <span className="compact-player__badge compact-player__badge--ding">鼎</span>}
        {player.effects.length > 0 && (
          <div className="compact-player__effects" title={player.effects.map(e => describeEffect(e)).join('\n')}>
            <span className="compact-player__effect-count">{player.effects.length}效果</span>
          </div>
        )}
        {player.trainingPlans.length > 0 && (
          player.trainingPlans.map(plan => {
            const isMajor = plan.id === player.majorPlan;
            return (
              <span
                key={plan.id}
                className={`compact-player__plan-tag ${isMajor ? 'compact-player__plan-tag--major' : ''}`}
                title={`${isMajor ? '[主修]' : '[辅修]'} ${plan.name}: ${plan.winCondition}`}
              >
                {isMajor ? '\u2605' : '\u2606'}{plan.name.slice(0, 4)}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
