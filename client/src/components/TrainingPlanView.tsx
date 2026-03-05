import type { Player, TrainingPlan } from '@nannaricher/shared';
import { useGameStore } from '../stores/gameStore';
import { getPlayerPlanIds } from '@nannaricher/shared';

interface TrainingPlanViewProps {
  player: Player;
  turnNumber: number;
  isCurrentPlayer: boolean;
}

export function TrainingPlanView({
  player,
  turnNumber: _turnNumber,
  isCurrentPlayer: _isCurrentPlayer
}: TrainingPlanViewProps) {
  const gameState = useGameStore((s) => s.gameState);
  const playerPlanIds = getPlayerPlanIds(player);
  const hasPlan = player.majorPlan != null;
  const isFreshman = gameState?.roundNumber === 1;

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

    return null;
  };

  const getProgressPercentage = (plan: TrainingPlan): number => {
    if (!playerPlanIds.includes(plan.id)) return 0;
    const progress = parseProgress(plan);
    if (progress) return progress.pct;
    // Confirmed but unparseable — show as indeterminate
    return 50;
  };

  return (
    <div className="training-plans">
      <div className="training-plans-header">
        <h3>培养计划</h3>
        <span className="plans-count">{playerPlanIds.length}/{player.planSlotLimit}</span>
      </div>

      {/* 大一buff展示 */}
      {isFreshman && (
        <div className="freshman-buffs" style={{
          display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap'
        }}>
          <div className="buff-card" style={{
            background: 'rgba(76, 175, 80, 0.15)',
            border: '1px solid rgba(76, 175, 80, 0.3)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '12px',
            color: '#4CAF50',
          }}>
            GPA增加翻倍
          </div>
          <div className="buff-card" style={{
            background: 'rgba(255, 152, 0, 0.15)',
            border: '1px solid rgba(255, 152, 0, 0.3)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '12px',
            color: '#FF9800',
          }}>
            鼓楼线收益翻倍
          </div>
        </div>
      )}

      {/* 无计划时显示 */}
      {!hasPlan && !isFreshman && (
        <p className="no-plans">暂无培养计划</p>
      )}
      {!hasPlan && isFreshman && player.trainingPlans.length === 0 && (
        <p className="no-plans" style={{ color: '#999', fontSize: '12px' }}>
          大一阶段无培养计划抽取，大二起开始选择
        </p>
      )}

      {/* 计划列表 */}
      {player.trainingPlans.length > 0 && (
        <div className="plans-list">
          {player.trainingPlans.map((plan) => {
            const isMajor = plan.id === player.majorPlan;
            const isMinor = player.minorPlans.includes(plan.id);
            const isInPlan = isMajor || isMinor;

            return (
              <div
                key={plan.id}
                className={`plan-item ${isMajor ? 'confirmed major' : isMinor ? 'confirmed minor' : 'unconfirmed'}`}
                style={{
                  opacity: isInPlan ? 1 : 0.6,
                  borderLeft: isMajor ? '3px solid #2196F3' : isMinor ? '3px solid #9E9E9E' : undefined,
                }}
              >
                <div className="plan-header">
                  <h4 className="plan-name">{plan.name}</h4>
                  {isMajor && (
                    <span className="confirmed-badge" style={{
                      background: '#2196F3',
                      color: 'white',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                    }}>主修</span>
                  )}
                  {isMinor && (
                    <span className="confirmed-badge" style={{
                      background: '#9E9E9E',
                      color: 'white',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                    }}>辅修</span>
                  )}
                </div>

                <div className="plan-details">
                  <div className="plan-condition">
                    <span className="plan-label">胜利条件:</span>
                    <span className="plan-value">{plan.winCondition}</span>
                  </div>
                  {/* 被动能力只在主修时显示 */}
                  {isMajor && plan.passiveAbility && (
                    <div className="plan-ability">
                      <span className="plan-label">被动能力:</span>
                      <span className="plan-value">{plan.passiveAbility}</span>
                    </div>
                  )}
                  {isMinor && plan.passiveAbility && (
                    <div className="plan-ability" style={{ opacity: 0.5 }}>
                      <span className="plan-label">被动能力:</span>
                      <span className="plan-value" style={{ textDecoration: 'line-through' }}>{plan.passiveAbility}</span>
                      <span style={{ fontSize: '10px', color: '#999' }}> (仅主修生效)</span>
                    </div>
                  )}
                </div>

                {isInPlan && (
                  <div className="plan-progress">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${getProgressPercentage(plan)}%` }}
                      />
                    </div>
                    <span className="progress-text">
                      {(() => {
                        const p = parseProgress(plan);
                        return p
                          ? `${p.label}: ${p.current}/${p.target} (${p.pct}%)`
                          : plan.winCondition;
                      })()}
                    </span>
                  </div>
                )}

                {isMajor && plan.passiveAbility && (
                  <div className="plan-passive-active">
                    生效中: {plan.passiveAbility}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TrainingPlanView;
