// client/src/components/TrainingPlanView.tsx
import React from 'react';
import type { Player, TrainingPlan } from '@nannaricher/shared';

interface TrainingPlanViewProps {
  player: Player;
  onConfirmPlan: (planId: string) => void;
  turnNumber: number;
  isCurrentPlayer: boolean;
}

export function TrainingPlanView({
  player,
  onConfirmPlan,
  turnNumber,
  isCurrentPlayer
}: TrainingPlanViewProps) {
  // Check if confirmation is available (every 6 turns)
  const canConfirmPlan = turnNumber % 6 === 0 && turnNumber > 0;
  const hasUnconfirmedPlans = player.trainingPlans.some(plan => !plan.confirmed);

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
        <span className="plans-count">{player.trainingPlans.length}/2</span>
        {canConfirmPlan && hasUnconfirmedPlans && isCurrentPlayer && (
          <span className="confirm-available" title="可确认计划">!</span>
        )}
      </div>

      <div className="plans-list">
        {player.trainingPlans.map((plan) => (
          <div
            key={plan.id}
            className={`plan-item ${plan.confirmed ? 'confirmed' : 'unconfirmed'}`}
          >
            <div className="plan-header">
              <h4 className="plan-name">{plan.name}</h4>
              {plan.confirmed && (
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
                {plan.confirmed ? '已确认' : '待确认'}
              </span>
            </div>

            {!plan.confirmed && isCurrentPlayer && canConfirmPlan && (
              <button
                className="confirm-plan-btn"
                onClick={() => onConfirmPlan(plan.id)}
              >
                确认计划
              </button>
            )}

            {!plan.confirmed && isCurrentPlayer && !canConfirmPlan && (
              <div className="confirm-hint">
                下次确认: 第{Math.ceil(turnNumber / 6) * 6 || 6}回合
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
