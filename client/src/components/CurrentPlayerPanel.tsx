// client/src/components/CurrentPlayerPanel.tsx
import React from 'react';
import type { Player } from '@nannaricher/shared';

interface CurrentPlayerPanelProps {
  player: Player | undefined;
  isMyTurn: boolean;
  onRollDice?: () => void;
  isRolling?: boolean;
}

export function CurrentPlayerPanel({
  player,
  isMyTurn,
  onRollDice,
  isRolling = false,
}: CurrentPlayerPanelProps) {
  if (!player) {
    return (
      <div className="current-player-panel">
        <div className="panel-loading">加载中...</div>
      </div>
    );
  }

  const getPositionText = () => {
    if (player.position.type === 'main') {
      return `主路 ${player.position.index}`;
    }
    return `${player.position.lineId} ${player.position.index}`;
  };

  const canRollDice = isMyTurn && !player.isBankrupt && !player.isInHospital;

  return (
    <div className={`current-player-panel ${isMyTurn ? 'my-turn' : ''}`}>
      <div className="panel-header">
        <div
          className="player-color-indicator"
          style={{ backgroundColor: player.color }}
        />
        <span className="player-name">{player.name}</span>
        {isMyTurn && <span className="your-turn-badge">你的回合</span>}
      </div>

      <div className="player-stats-detailed">
        <div className="stat-group">
          <div className="stat-item">
            <span className="stat-icon">💰</span>
            <span className="stat-label">金钱</span>
            <span className={`stat-value ${player.money < 100 ? 'low' : ''}`}>
              ${player.money}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">📚</span>
            <span className="stat-label">GPA</span>
            <span className="stat-value">{player.gpa.toFixed(1)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">🗺️</span>
            <span className="stat-label">探索</span>
            <span className="stat-value">{player.exploration}</span>
          </div>
        </div>

        <div className="stat-extra">
          <div className="extra-item">
            <span className="extra-label">骰子:</span>
            <span className="extra-value">{player.diceCount}个</span>
          </div>
          <div className="extra-item">
            <span className="extra-label">位置:</span>
            <span className="extra-value">{getPositionText()}</span>
          </div>
        </div>
      </div>

      {player.trainingPlans.length > 0 && (
        <div className="training-plans-section">
          <h4>培养计划</h4>
          <div className="plans-list">
            {player.trainingPlans.map((plan) => {
              const isConfirmed = player.confirmedPlans.includes(plan.id);
              return (
                <div
                  key={plan.id}
                  className={`plan-item ${isConfirmed ? 'confirmed' : ''}`}
                >
                  <span className="plan-name">{plan.name}</span>
                  {isConfirmed && <span className="confirmed-badge">已确认</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {player.heldCards.length > 0 && (
        <div className="held-cards-section">
          <h4>手牌 ({player.heldCards.length})</h4>
          <div className="cards-preview">
            {player.heldCards.map((card) => (
              <div key={card.id} className="card-preview" title={card.description}>
                <span className="card-name">{card.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {player.effects.length > 0 && (
        <div className="effects-section">
          <h4>持续效果</h4>
          <div className="effects-list">
            {player.effects.map((effect) => (
              <div key={effect.id} className="effect-item">
                <span className="effect-type">{effect.type}</span>
                <span className="effect-turns">{effect.turnsRemaining}回合</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="action-buttons">
        <button
          className="roll-dice-btn"
          onClick={onRollDice}
          disabled={!canRollDice || isRolling}
        >
          {isRolling ? '掷骰子中...' : '掷骰子'}
        </button>
      </div>

      {player.isBankrupt && (
        <div className="status-overlay bankrupt">
          <span>已破产</span>
        </div>
      )}
      {player.isInHospital && (
        <div className="status-overlay hospital">
          <span>校医院 - 需掷出{3}点以上出院</span>
        </div>
      )}
      {player.isAtDing && (
        <div className="status-overlay ding">
          <span>在鼎 - 掷骰移动</span>
        </div>
      )}
    </div>
  );
}
