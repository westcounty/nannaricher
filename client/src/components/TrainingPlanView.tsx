import { useState, useCallback } from 'react';
import type { Player, TrainingPlan } from '@nannaricher/shared';
import { useGameState } from '../context/GameContext';
import { PLAN_CONFIRM_INTERVAL, MAX_TRAINING_PLANS } from '@nannaricher/shared';

interface TrainingPlanViewProps {
  player: Player;
  turnNumber: number;
  isCurrentPlayer: boolean;
}

export function TrainingPlanView({
  player,
  turnNumber,
  isCurrentPlayer
}: TrainingPlanViewProps) {
  const { confirmPlan, gameState } = useGameState();
  const [confirmingPlanId, setConfirmingPlanId] = useState<string | null>(null);

  // Check if confirmation is available (every PLAN_CONFIRM_INTERVAL turns)
  const canConfirmPlan = gameState?.phase === 'setup_plans' ||
    (turnNumber % PLAN_CONFIRM_INTERVAL === 0 && turnNumber > 0);
  const hasUnconfirmedPlans = player.trainingPlans.some(plan => !plan.confirmed);
  const hasReachedMaxPlans = player.confirmedPlans.length >= MAX_TRAINING_PLANS;

  const handleConfirmPlan = useCallback((planId: string) => {
    if (!isCurrentPlayer || confirmingPlanId) return;

    setConfirmingPlanId(planId);
    confirmPlan(planId);

    // Reset confirming state after a delay
    setTimeout(() => {
      setConfirmingPlanId(null);
    }, 1000);
  }, [isCurrentPlayer, confirmingPlanId, confirmPlan]);

  if (player.trainingPlans.length === 0) {
    return (
      <div className="training-plans empty">
        <h3>培养计划</h3>
        <p className="no-plans">暂无培养计划</p>
      </div>
    );
  }

  const getProgressPercentage = (plan: TrainingPlan): number => {
    // Progress is based on whether the plan is confirmed
    // In a more complex implementation, this would track actual progress toward win condition
    return plan.confirmed ? 100 : 50;
  };

  return (
    <div className="training-plans">
      <div className="training-plans-header">
        <h3>培养计划</h3>
        <span className="plans-count">{player.confirmedPlans.length}/{MAX_TRAINING_PLANS}</span>
        {canConfirmPlan && hasUnconfirmedPlans && isCurrentPlayer && !hasReachedMaxPlans && (
          <span className="confirm-available" title="可确认计划">!</span>
        )}
      </div>

      <div className="plans-list">
        {player.trainingPlans.map((plan) => {
          const isConfirmed = player.confirmedPlans.includes(plan.id);
          const isConfirming = confirmingPlanId === plan.id;

          return (
            <div
              key={plan.id}
              className={`plan-item ${isConfirmed ? 'confirmed' : 'unconfirmed'}`}
            >
              <div className="plan-header">
                <h4 className="plan-name">{plan.name}</h4>
                {isConfirmed && (
                  <span className="confirmed-badge">已确认</span>
                )}
              </div>

              <div className="plan-details">
                <div className="plan-condition">
                  <span className="plan-label">胜利条件:</span>
                  <span className="plan-value">{plan.winCondition}</span>
                </div>
                <div className="plan-ability">
                  <span className="plan-label">被动能力:</span>
                  <span className="plan-value">{plan.passiveAbility}</span>
                </div>
              </div>

              <div className="plan-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage(plan)}%` }}
                  />
                </div>
                <span className="progress-text">
                  {isConfirmed ? '已确认' : '待确认'}
                </span>
              </div>

              {/* Confirm button for setup phase or during confirmation turns */}
              {!isConfirmed && isCurrentPlayer && canConfirmPlan && !hasReachedMaxPlans && (
                <button
                  className="confirm-plan-btn"
                  onClick={() => handleConfirmPlan(plan.id)}
                  disabled={isConfirming}
                >
                  {isConfirming ? '确认中...' : '确认计划'}
                </button>
              )}

              {/* Show hint when can't confirm */}
              {!isConfirmed && isCurrentPlayer && !canConfirmPlan && gameState?.phase === 'playing' && (
                <div className="confirm-hint">
                  下次确认: 第{Math.ceil(turnNumber / PLAN_CONFIRM_INTERVAL) * PLAN_CONFIRM_INTERVAL || PLAN_CONFIRM_INTERVAL}回合
                </div>
              )}

              {/* Show max plans reached message */}
              {!isConfirmed && hasReachedMaxPlans && (
                <div className="confirm-hint max-reached">
                  已达到最大确认计划数
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Setup phase instruction */}
      {gameState?.phase === 'setup_plans' && isCurrentPlayer && (
        <div className="setup-instruction">
          <p>请选择1-2项培养计划确认</p>
        </div>
      )}
    </div>
  );
}

export default TrainingPlanView;
