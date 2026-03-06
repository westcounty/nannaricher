import { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import './EpicEventModal.css';

export function EpicEventModal() {
  const currentEvent = useGameStore((s) => s.currentEvent);
  const playerId = useGameStore((s) => s.playerId);
  const socketActions = useGameStore((s) => s.socketActions);
  const chooseAction = socketActions?.chooseAction ?? (() => {});
  const clearEvent = () => useGameStore.getState().setCurrentEvent(null);

  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingAction = currentEvent?.pendingAction;
  const isReadOnly = pendingAction
    ? pendingAction.playerId !== playerId && pendingAction.playerId !== 'all'
    : false;
  const hasOptions = !isReadOnly && pendingAction?.options && pendingAction.options.length > 0;

  useEffect(() => {
    timerRef.current = setTimeout(() => setPhase('visible'), 50);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Auto-dismiss read-only after 4s
  useEffect(() => {
    if (isReadOnly) {
      const t = setTimeout(() => handleClose(), 3000);
      return () => clearTimeout(t);
    }
  }, [isReadOnly]);

  const handleClose = useCallback(() => {
    setPhase('exiting');
    setTimeout(() => clearEvent(), 400);
  }, []);

  const handleOptionSelect = useCallback((value: string) => {
    setSelectedOption(value);
    if (pendingAction) {
      chooseAction(pendingAction.id, value);
    }
    setTimeout(() => handleClose(), 300);
  }, [pendingAction, chooseAction, handleClose]);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) handleClose();
  }, [pendingAction, handleClose]);

  if (!currentEvent) return null;

  const effects = currentEvent.effects;
  const sentiment = (() => {
    if (!effects) return 'neutral';
    const score = (effects.money ?? 0) + (effects.gpa ?? 0) * 1000 + (effects.exploration ?? 0) * 100;
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  })();

  return (
    <div className={`epic-overlay epic-overlay--${phase} epic-overlay--${sentiment}`}>
      <div className="epic-backdrop" />
      <div className={`epic-card epic-card--${phase}`}>
        <h1 className="epic-card__title">{currentEvent.title}</h1>
        <p className="epic-card__description">{currentEvent.description}</p>

        {effects && (effects.money || effects.gpa || effects.exploration) && (
          <div className="epic-card__effects">
            {effects.money !== undefined && effects.money !== 0 && (
              <span className={`epic-effect ${effects.money > 0 ? 'positive' : 'negative'}`}>
                {'\uD83D\uDCB0'}{effects.money > 0 ? '+' : ''}{effects.money}
              </span>
            )}
            {effects.gpa !== undefined && effects.gpa !== 0 && (
              <span className={`epic-effect ${effects.gpa > 0 ? 'positive' : 'negative'}`}>
                {'\uD83D\uDCDA'}{effects.gpa > 0 ? '+' : ''}{effects.gpa}
              </span>
            )}
            {effects.exploration !== undefined && effects.exploration !== 0 && (
              <span className={`epic-effect ${effects.exploration > 0 ? 'positive' : 'negative'}`}>
                {'\uD83D\uDDFA\uFE0F'}{effects.exploration > 0 ? '+' : ''}{effects.exploration}
              </span>
            )}
          </div>
        )}

        {hasOptions && (
          <div className="epic-card__options">
            {pendingAction!.options!.map((opt) => (
              <button
                key={opt.value}
                className={`epic-option ${selectedOption === opt.value ? 'epic-option--selected' : ''}`}
                onClick={() => handleOptionSelect(opt.value)}
                disabled={!!selectedOption}
              >
                <span className="epic-option__label">{opt.label}</span>
                {opt.description && (
                  <span className="epic-option__desc">{opt.description}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {!hasOptions && !isReadOnly && (
          <button className="epic-card__confirm" onClick={handleConfirm}>
            {'\u786E\u5B9A'}
          </button>
        )}

        {isReadOnly && (
          <div className="epic-card__readonly">
            {'\u89C2\u6218\u4E2D'}
          </div>
        )}
      </div>
    </div>
  );
}
