import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import type { PendingAction } from '@nannaricher/shared';
import { getPlanDifficulty, DIFFICULTY_LABEL, DIFFICULTY_COLOR } from '@nannaricher/shared';
import '../styles/plan-selection.css';
import { DESIGN_TOKENS } from '../styles/tokens';

interface Props {
  action: PendingAction;
}

export function PlanSelectionPanel({ action }: Props) {
  const playerId = useGameStore(s => s.playerId);
  const gameState = useGameStore(s => s.gameState);
  const socketActions = useGameStore(s => s.socketActions);
  const myData = action.planSelectionData?.perPlayer[playerId || ''];

  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>(
    () => myData?.existingPlanIds || []
  );
  const [majorId, setMajorId] = useState<string | null>(
    () => myData?.currentMajor || null
  );
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const startTimeRef = useRef(Date.now());

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setCountdown(Math.max(0, 60 - elapsed));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get all available plans (existing + drawn)
  const allPlans = useMemo(() => {
    if (!myData || !gameState) return [];
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return [];

    // Existing confirmed plans
    const existingPlans = player.trainingPlans
      .filter(p => myData.existingPlanIds.includes(p.id))
      .map(p => ({ plan: p, isNew: false }));

    // Newly drawn plans
    const drawnPlans = myData.drawnPlans
      .map(p => ({ plan: p, isNew: true }));

    return [...existingPlans, ...drawnPlans];
  }, [myData, gameState, playerId]);

  const togglePlan = useCallback((planId: string) => {
    if (submitted) return;
    setSelectedPlanIds(prev => {
      if (prev.includes(planId)) {
        const next = prev.filter(id => id !== planId);
        if (majorId === planId) setMajorId(next[0] || null);
        return next;
      }
      if (prev.length >= (myData?.planSlotLimit || 2)) return prev;
      return [...prev, planId];
    });
  }, [submitted, majorId, myData?.planSlotLimit]);

  const selectMajor = useCallback((planId: string) => {
    if (submitted) return;
    if (selectedPlanIds.includes(planId)) {
      setMajorId(planId);
    }
  }, [submitted, selectedPlanIds]);

  // Emit directly to avoid store's chooseAction clearing currentEvent
  const emitChoice = useCallback((choice: string) => {
    socketActions?.chooseAction?.(action.id, choice);
  }, [action.id, socketActions]);

  const handleKeep = useCallback(() => {
    if (submitted) return;
    setSubmitted(true);
    emitChoice(JSON.stringify({ action: 'keep' }));
  }, [submitted, emitChoice]);

  const handleAdjust = useCallback(() => {
    if (submitted || !majorId || selectedPlanIds.length === 0) return;
    setSubmitted(true);
    emitChoice(JSON.stringify({
      action: 'adjust',
      keepPlanIds: selectedPlanIds,
      majorId,
    }));
  }, [submitted, emitChoice, selectedPlanIds, majorId]);

  // Other players' status
  const otherStatus = useMemo(() => {
    if (!action.targetPlayerIds || !gameState) return [];
    return action.targetPlayerIds
      .filter(id => id !== playerId)
      .map(id => ({
        name: gameState.players.find(p => p.id === id)?.name || '???',
        submitted: !!action.responses?.[id],
      }));
  }, [action, gameState, playerId]);

  if (!myData) return null;

  return (
    <div className="plan-selection-overlay">
      <div className="plan-selection">
        <div className="plan-selection__header">
          <h3>升学阶段 — 选择培养计划</h3>
          <span className={`plan-selection__timer ${countdown <= 10 ? 'urgent' : ''}`}>
            {countdown}s
          </span>
        </div>

        {submitted ? (
          <div className="plan-selection__submitted">
            <p>已提交，等待其他玩家...</p>
            <div className="plan-selection__others">
              {otherStatus.map(s => (
                <span key={s.name} className={`plan-selection__other ${s.submitted ? 'done' : ''}`}>
                  {s.name} {s.submitted ? '\u2713' : '...'}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <>
          <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
            {allPlans.filter(p => !p.isNew).length > 0 && (
              <div className="plan-selection__section">
                <h4>当前计划</h4>
                {allPlans.filter(p => !p.isNew).map(({ plan }) => (
                  <div
                    key={plan.id}
                    className={`plan-selection__item ${selectedPlanIds.includes(plan.id) ? 'selected' : ''}`}
                    onClick={() => togglePlan(plan.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlanIds.includes(plan.id)}
                      readOnly
                    />
                    <span className="plan-selection__name">{plan.name}</span>
                    {getPlanDifficulty(plan.id, gameState?.players.length) && (
                      <span
                        className="plan-difficulty-badge"
                        style={{
                          color: DIFFICULTY_COLOR[getPlanDifficulty(plan.id, gameState?.players.length)],
                          borderColor: DIFFICULTY_COLOR[getPlanDifficulty(plan.id, gameState?.players.length)],
                        }}
                      >
                        {DIFFICULTY_LABEL[getPlanDifficulty(plan.id, gameState?.players.length)]}
                      </span>
                    )}
                    {majorId === plan.id && <span className="plan-selection__major-badge">{'\u2605'}主修</span>}
                    {selectedPlanIds.includes(plan.id) && majorId !== plan.id && (
                      <button
                        className="plan-selection__set-major"
                        onClick={(e) => { e.stopPropagation(); selectMajor(plan.id); }}
                      >
                        设为主修
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="plan-selection__section">
              <h4>新抽取</h4>
              {allPlans.filter(p => p.isNew).map(({ plan }) => (
                <div
                  key={plan.id}
                  className={`plan-selection__item ${selectedPlanIds.includes(plan.id) ? 'selected' : ''}`}
                  onClick={() => togglePlan(plan.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedPlanIds.includes(plan.id)}
                    readOnly
                  />
                  <div className="plan-selection__plan-info">
                    <span className="plan-selection__name">{plan.name}</span>
                    {getPlanDifficulty(plan.id, gameState?.players.length) && (
                      <span
                        className="plan-difficulty-badge"
                        style={{
                          color: DIFFICULTY_COLOR[getPlanDifficulty(plan.id, gameState?.players.length)],
                          borderColor: DIFFICULTY_COLOR[getPlanDifficulty(plan.id, gameState?.players.length)],
                        }}
                      >
                        {DIFFICULTY_LABEL[getPlanDifficulty(plan.id, gameState?.players.length)]}
                      </span>
                    )}
                    <span className="plan-selection__desc">{plan.winCondition}</span>
                    {plan.passiveAbility && (
                      <div style={{ fontSize: '12px', color: DESIGN_TOKENS.color.text.secondary, marginTop: '4px' }}>
                        ⚡ 被动: {plan.passiveAbility}
                      </div>
                    )}
                  </div>
                  {majorId === plan.id && <span className="plan-selection__major-badge">{'\u2605'}主修</span>}
                  {selectedPlanIds.includes(plan.id) && majorId !== plan.id && (
                    <button
                      className="plan-selection__set-major"
                      onClick={(e) => { e.stopPropagation(); selectMajor(plan.id); }}
                    >
                      设为主修
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

            <div className="plan-selection__summary">
              已选 {selectedPlanIds.length}/{myData.planSlotLimit}
              {majorId && ` | 主修: ${allPlans.find(p => p.plan.id === majorId)?.plan.name || '未知'}`}
            </div>

            <div className="plan-selection__actions">
              {myData.currentMajor && (
                <button className="plan-selection__btn plan-selection__btn--secondary" onClick={handleKeep}>
                  不调整
                </button>
              )}
              <button
                className="plan-selection__btn plan-selection__btn--primary"
                onClick={handleAdjust}
                disabled={!majorId || selectedPlanIds.length === 0}
              >
                确认调整
              </button>
            </div>

            <div className="plan-selection__others">
              {otherStatus.map(s => (
                <span key={s.name} className={`plan-selection__other ${s.submitted ? 'done' : ''}`}>
                  {s.name} {s.submitted ? '\u2713已提交' : '等待中'}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
