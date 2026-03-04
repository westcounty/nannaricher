import { useState, useCallback } from 'react';
import type { Player, TrainingPlan } from '@nannaricher/shared';
import { useGameStore } from '../stores/gameStore';
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
  const gameState = useGameStore((s) => s.gameState);
  const socketActions = useGameStore((s) => s.socketActions);
  const confirmPlan = socketActions?.confirmPlan ?? (() => {});
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

  /**
   * Best-effort progress estimation by parsing numeric targets from winCondition text.
   * Returns { current, target, pct } if parseable, or null otherwise.
   */
  const parseProgress = (plan: TrainingPlan): { label: string; current: number; target: number; pct: number } | null => {
    const text = plan.winCondition;

    // Pattern: 金钱数达到N / 金钱达到N
    const moneyMatch = text.match(/金钱[数]?达到(\d+)/);
    if (moneyMatch) {
      const target = parseInt(moneyMatch[1], 10);
      const current = player.money;
      return { label: '金钱', current, target, pct: Math.min(100, Math.round((current / target) * 100)) };
    }

    // Pattern: 探索值达到N
    const expMatch = text.match(/探索值达到(\d+)/);
    if (expMatch) {
      const target = parseInt(expMatch[1], 10);
      const current = player.exploration;
      return { label: '探索值', current, target, pct: Math.min(100, Math.round((current / target) * 100)) };
    }

    // Pattern: GPA达到N
    const gpaMatch = text.match(/GPA达到([\d.]+)/);
    if (gpaMatch) {
      const target = parseFloat(gpaMatch[1]);
      const current = player.gpa;
      return { label: 'GPA', current, target, pct: Math.min(100, Math.round((current / target) * 100)) };
    }

    // Pattern: 进入过N次医院
    const hospitalMatch = text.match(/进入过(\d+)次医院/);
    if (hospitalMatch) {
      const target = parseInt(hospitalMatch[1], 10);
      // We don't have hospital visit count, so skip
      return null;
    }

    return null;
  };

  const getProgressPercentage = (plan: TrainingPlan): number => {
    if (!player.confirmedPlans.includes(plan.id)) return 0;
    const progress = parseProgress(plan);
    if (progress) return progress.pct;
    // Confirmed but unparseable — show as indeterminate
    return 50;
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
                  {isConfirmed
                    ? (() => {
                        const p = parseProgress(plan);
                        return p
                          ? `${p.label}: ${p.current}/${p.target} (${p.pct}%)`
                          : '已确认';
                      })()
                    : '待确认'}
                </span>
              </div>

              {isConfirmed && plan.passiveAbility && (
                <div className="plan-passive-active">
                  生效中: {plan.passiveAbility}
                </div>
              )}

              {isConfirmed && !parseProgress(plan) && (
                <div className="plan-progress-hint">
                  当前进度: {plan.winCondition}
                </div>
              )}

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
