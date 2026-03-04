// client/src/components/PlayerPanel.tsx
import React from 'react';
import type { Player } from '@nannaricher/shared';
import { PLAYER_COLORS } from '@nannaricher/shared';
import { boardData } from '../data/board';

interface PlayerPanelProps {
  player: Player;
  isCurrentTurn?: boolean;
}

export function PlayerPanel({ player, isCurrentTurn = false }: PlayerPanelProps) {
  const getStatusBadge = () => {
    if (player.isBankrupt) {
      return <span className="status-badge bankrupt">破产</span>;
    }
    if (player.isInHospital) {
      return <span className="status-badge hospital">校医院</span>;
    }
    if (player.isAtDing) {
      return <span className="status-badge ding">鼎</span>;
    }
    return null;
  };

  const getPositionText = () => {
    if (player.position.type === 'main') {
      const cell = boardData.mainBoard[player.position.index];
      return cell?.name || `主路 ${player.position.index}`;
    }
    const line = boardData.lines[player.position.lineId];
    const cell = line?.cells[player.position.index];
    const lineName = line?.name?.split(' - ')[0] || player.position.lineId;
    return cell?.name ? `${lineName} · ${cell.name}` : `${lineName} 第${player.position.index + 1}格`;
  };

  return (
    <div
      className={`player-panel ${isCurrentTurn ? 'current-turn' : ''} ${player.isBankrupt ? 'bankrupt' : ''}`}
    >
      <div className="player-header">
        <div
          className="player-color-indicator"
          style={{ backgroundColor: player.color }}
        />
        <span className="player-name">{player.name}</span>
        {getStatusBadge()}
      </div>

      <div className="player-stats">
        <div className="stat-row">
          <span className="stat-label">金钱</span>
          <span className={`stat-value ${player.money < 100 ? 'low' : ''}`}>
            ${player.money}
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-label">GPA</span>
          <span className="stat-value">{player.gpa.toFixed(1)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">探索</span>
          <span className="stat-value">{player.exploration}</span>
        </div>
      </div>

      <div className="player-position">
        <span className="position-label">位置:</span>
        <span className="position-value">{getPositionText()}</span>
      </div>

      {player.trainingPlans.length > 0 && (
        <div className="player-plans">
          <span className="plans-label">培养计划:</span>
          <span className="plans-count">{player.trainingPlans.length}</span>
          {player.confirmedPlans.length > 0 && (
            <span className="confirmed-count">({player.confirmedPlans.length} 已确认)</span>
          )}
        </div>
      )}

      {player.heldCards.length > 0 && (
        <div className="player-cards">
          <span className="cards-label">手牌:</span>
          <span className="cards-count">{player.heldCards.length}</span>
        </div>
      )}
    </div>
  );
}
