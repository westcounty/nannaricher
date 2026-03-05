import { useEffect, useRef, useState, useCallback } from 'react';
import { useFadeAnimation } from '../hooks/useAnimation';
import { useGameStore } from '../stores/gameStore';
import './EventModal.css';

interface EffectPreview {
  money?: number;
  gpa?: number;
  exploration?: number;
  cards?: { name: string; deckType: string }[];
  status?: string;
}

interface EventModalProps {
  title?: string;
  description?: string;
  effects?: EffectPreview;
  onConfirm?: () => void;
  onClose?: () => void;
  confirmText?: string;
  showCloseButton?: boolean;
}

export function EventModal({
  title: propTitle,
  description: propDescription,
  effects,
  onConfirm,
  onClose,
  confirmText = '确定',
  showCloseButton = false,
}: EventModalProps) {
  const currentEvent = useGameStore((s) => s.currentEvent);
  const playerId = useGameStore((s) => s.playerId);
  const socketActions = useGameStore((s) => s.socketActions);
  const chooseAction = socketActions?.chooseAction ?? (() => {});
  const clearEvent = () => useGameStore.getState().setCurrentEvent(null);
  const { isVisible, opacity, fadeIn } = useFadeAnimation(300);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Use props or game context data
  const title = propTitle || currentEvent?.title || '事件';
  const description = propDescription || currentEvent?.description || '';
  const pendingAction = currentEvent?.pendingAction;

  // Determine if this is read-only (event is for another player)
  const isReadOnly = pendingAction
    ? pendingAction.playerId !== playerId && pendingAction.playerId !== 'all'
    : false;

  useEffect(() => {
    fadeIn();
  }, [fadeIn]);

  // Clear all pending timers on unmount
  useEffect(() => {
    return () => {
      for (const id of timerRefs.current) {
        clearTimeout(id);
      }
      timerRefs.current = [];
    };
  }, []);

  // Auto-dismiss read-only events after 4 seconds
  useEffect(() => {
    if (isReadOnly && !isClosing) {
      const timer = setTimeout(() => {
        setIsClosing(true);
        timerRefs.current.push(setTimeout(() => {
          clearEvent();
        }, 150));
      }, 4000);
      timerRefs.current.push(timer);
    }
  }, [isReadOnly, isClosing, clearEvent]);

  const handleOptionSelect = useCallback((value: string) => {
    if (isClosing) return;
    setSelectedOption(value);
    setIsClosing(true);

    // If there's a pending action, send the choice to server
    if (pendingAction) {
      chooseAction(pendingAction.id, value);
    }

    timerRefs.current.push(setTimeout(() => {
      if (onConfirm) {
        onConfirm();
      }
      clearEvent();
    }, 200));
  }, [isClosing, pendingAction, chooseAction, onConfirm, clearEvent]);

  const handleConfirm = useCallback(() => {
    if (!pendingAction) {
      // No pending action, just confirm and close
      setIsClosing(true);
      timerRefs.current.push(setTimeout(() => {
        if (onConfirm) {
          onConfirm();
        }
        clearEvent();
      }, 150));
    }
  }, [pendingAction, onConfirm, clearEvent]);

  const handleClose = useCallback(() => {
    if (onClose) {
      setIsClosing(true);
      timerRefs.current.push(setTimeout(() => {
        onClose();
        clearEvent();
      }, 150));
    }
  }, [onClose, clearEvent]);

  const formatEffect = (value: number | undefined, label: string, icon: string) => {
    if (value === undefined || value === 0) return null;
    const isPositive = value > 0;
    const colorClass = isPositive ? 'positive' : 'negative';
    const sign = isPositive ? '+' : '';
    return (
      <div className={`effect-item ${colorClass}`}>
        <span className="effect-icon">{icon}</span>
        <span className="effect-label">{label}</span>
        <span className="effect-value">
          {sign}{value}
        </span>
      </div>
    );
  };

  const hasEffects = effects && (
    (effects.money !== undefined && effects.money !== 0) ||
    (effects.gpa !== undefined && effects.gpa !== 0) ||
    (effects.exploration !== undefined && effects.exploration !== 0) ||
    (effects.cards && effects.cards.length > 0) ||
    effects.status
  );

  const hasOptions = !isReadOnly && pendingAction?.options && pendingAction.options.length > 0;

  if (!isVisible && !isClosing) return null;

  return (
    <div
      className={`event-modal-overlay ${isClosing ? 'closing' : ''} ${isReadOnly ? 'read-only' : ''}`}
      style={{ opacity: isClosing ? 0 : opacity, pointerEvents: 'auto' }}
      onClick={isReadOnly ? undefined : (hasOptions ? undefined : handleClose)}
      onPointerDown={e => e.stopPropagation()}
    >
      <div
        className={`event-modal ${isClosing ? 'closing' : ''} ${hasOptions ? 'has-options' : ''} ${isReadOnly ? 'read-only' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {isReadOnly && (
            <span className="read-only-badge">观战中</span>
          )}
          {showCloseButton && !isReadOnly && (
            <button className="modal-close" onClick={handleClose}>
              &times;
            </button>
          )}
        </div>

        <div className="modal-body">
          <p className="modal-description">{description}</p>

          {hasOptions && (
            <div className="options-container">
              {pendingAction!.options!.map((option, index) => (
                <button
                  key={option.value}
                  className={`option-button ${selectedOption === option.value ? 'selected' : ''}`}
                  onClick={() => handleOptionSelect(option.value)}
                  disabled={isClosing}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="option-content">
                    <span className="option-label">{option.label}</span>
                    {'description' in option && (option as { description?: string }).description && (
                      <span className="option-description">
                        {(option as { description?: string }).description}
                      </span>
                    )}
                  </div>
                  {selectedOption === option.value && (
                    <span className="option-checkmark">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {hasEffects && (
            <div className="effects-preview">
              <h3 className="effects-title">效果预览</h3>
              <div className="effects-list">
                {formatEffect(effects?.money, '资金', '💰')}
                {formatEffect(effects?.gpa, 'GPA', '📚')}
                {formatEffect(effects?.exploration, '探索值', '🔍')}

                {effects?.cards && effects.cards.length > 0 && (
                  <div className="effect-item cards-effect">
                    <span className="effect-icon">🃏</span>
                    <span className="effect-label">获得卡牌</span>
                    <span className="effect-value card-names">
                      {effects.cards.map(c => c.name).join(', ')}
                    </span>
                  </div>
                )}

                {effects?.status && (
                  <div className="effect-item status-effect">
                    <span className="effect-icon">⚡</span>
                    <span className="effect-label">状态变化</span>
                    <span className="effect-value">{effects.status}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!hasOptions && !isReadOnly && (
          <div className="modal-footer">
            <button
              className="confirm-button"
              onClick={handleConfirm}
              disabled={isClosing}
            >
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to create effect preview from event data
export function createEffectPreview(
  eventData: Partial<{
    moneyChange: number;
    gpaChange: number;
    explorationChange: number;
    cards: { name: string; deckType: string }[];
    statusEffect: string;
  }>
): EffectPreview {
  return {
    money: eventData.moneyChange,
    gpa: eventData.gpaChange,
    exploration: eventData.explorationChange,
    cards: eventData.cards,
    status: eventData.statusEffect,
  };
}

// Container component that automatically shows events from game context
export function GameEventModal() {
  const currentEvent = useGameStore((s) => s.currentEvent);
  const clearEvent = () => useGameStore.getState().setCurrentEvent(null);

  if (!currentEvent) return null;

  return (
    <EventModal
      title={currentEvent.title}
      description={currentEvent.description}
      effects={currentEvent.effects}
      onConfirm={clearEvent}
      showCloseButton={false}
    />
  );
}

export default EventModal;
