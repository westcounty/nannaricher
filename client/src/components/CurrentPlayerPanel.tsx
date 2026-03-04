// client/src/components/CurrentPlayerPanel.tsx
import React, { useState, useCallback } from 'react';
import type { Player } from '@nannaricher/shared';
import { useGameState } from '../context/GameContext';
import { PLAN_CONFIRM_INTERVAL, MAX_TRAINING_PLANS } from '@nannaricher/shared';
import { boardData } from '../data/board';

interface CurrentPlayerPanelProps {
  player: Player | undefined;
  isMyTurn: boolean;
}

export function CurrentPlayerPanel({
  player,
  isMyTurn,
}: CurrentPlayerPanelProps) {
  const { rollDice, isRolling, diceResult, gameState, confirmPlan } = useGameState();
  const [confirmingPlanId, setConfirmingPlanId] = useState<string | null>(null);

  if (!player) {
    return (
      <div className="current-player-panel">
        <div className="panel-loading">加载中...</div>
      </div>
    );
  }

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

  // Check if confirmation is available (every PLAN_CONFIRM_INTERVAL turns)
  // In setup_plans phase, all players can confirm (not just current player)
  const isSetupPhase = gameState?.phase === 'setup_plans';
  const canConfirmPlan = isSetupPhase ||
    (gameState && gameState.turnNumber % PLAN_CONFIRM_INTERVAL === 0 && gameState.turnNumber > 0);
  const hasUnconfirmedPlans = player.trainingPlans.some(plan => !plan.confirmed);
  const hasReachedMaxPlans = player.confirmedPlans.length >= MAX_TRAINING_PLANS;
  // In setup phase, all players can confirm; in playing phase, only current player can confirm
  const canPlayerConfirm = isSetupPhase ? true : isMyTurn;

  const handleConfirmPlan = useCallback((planId: string) => {
    if (!canPlayerConfirm || confirmingPlanId) return;

    setConfirmingPlanId(planId);
    confirmPlan(planId);

    // Reset confirming state after a delay
    setTimeout(() => {
      setConfirmingPlanId(null);
    }, 1000);
  }, [isMyTurn, confirmingPlanId, confirmPlan]);

  // Determine if player can roll dice
  const canRollDice = isMyTurn &&
    !player.isBankrupt &&
    !isRolling &&
    gameState?.phase === 'playing' &&
    !gameState?.pendingAction ||
    gameState?.pendingAction?.type === 'roll_dice';

  // For hospital/ding, player still needs to roll
  const needsToRoll = player.isInHospital || player.isAtDing;

  const handleRollDice = () => {
    if (canRollDice || (isMyTurn && needsToRoll)) {
      rollDice();
    }
  };

  // Get roll button text
  const getRollButtonText = () => {
    if (isRolling) return '掷骰子中...';
    if (player.isInHospital) return '投骰子出院';
    if (player.isAtDing) return '投骰子移动';
    return '掷骰子';
  };

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
          <h4>培养计划 ({player.confirmedPlans.length}/{MAX_TRAINING_PLANS})</h4>
          <div className="plans-list">
            {player.trainingPlans.map((plan) => {
              const isConfirmed = player.confirmedPlans.includes(plan.id);
              const isConfirming = confirmingPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`plan-item ${isConfirmed ? 'confirmed' : ''}`}
                >
                  <div className="plan-header">
                    <span className="plan-name">{plan.name}</span>
                    {isConfirmed && <span className="confirmed-badge">已确认</span>}
                  </div>
                  <div className="plan-details">
                    <span className="plan-condition">胜利条件: {plan.winCondition}</span>
                    {plan.passiveAbility && (
                      <span className="plan-ability">特殊能力: {plan.passiveAbility}</span>
                    )}
                  </div>
                  {!isConfirmed && canPlayerConfirm && canConfirmPlan && !hasReachedMaxPlans && (
                    <button
                      className="confirm-plan-btn"
                      onClick={() => handleConfirmPlan(plan.id)}
                      disabled={isConfirming}
                    >
                      {isConfirming ? '确认中...' : '确认计划'}
                    </button>
                  )}
                  {!isConfirmed && canPlayerConfirm && !canConfirmPlan && gameState?.phase === 'playing' && (
                    <div className="confirm-hint">
                      下次确认: 第{(Math.ceil((gameState?.turnNumber || 1) / PLAN_CONFIRM_INTERVAL) * PLAN_CONFIRM_INTERVAL) || PLAN_CONFIRM_INTERVAL}回合
                    </div>
                  )}
                  {!isConfirmed && hasReachedMaxPlans && (
                    <div className="confirm-hint max-reached">
                      已达到最大确认计划数
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {gameState?.phase === 'setup_plans' && (
            <div className="setup-instruction">
              <p>请选择1-2项培养计划确认</p>
            </div>
          )}
        </div>
      )}

      {player.trainingPlans.length === 0 && gameState?.phase === 'setup_plans' && (
        <div className="training-plans-section empty">
          <h4>培养计划</h4>
          <p className="no-plans">正在抽取培养计划...</p>
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
          onClick={handleRollDice}
          disabled={!canRollDice && !(isMyTurn && needsToRoll) || isRolling}
        >
          {getRollButtonText()}
        </button>
      </div>

      {/* Show last dice result */}
      {diceResult && diceResult.playerId === player.id && !isRolling && (
        <div className="last-dice-result">
          上次投掷: {diceResult.values.join(' + ')} = {diceResult.total}
        </div>
      )}

      {player.isBankrupt && (
        <div className="status-overlay bankrupt">
          <span>已破产</span>
        </div>
      )}
      {player.isInHospital && (
        <div className="status-overlay hospital">
          <span>校医院 - 需掷出3点以上出院</span>
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
