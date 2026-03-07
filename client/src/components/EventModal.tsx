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
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Use props or game context data
  const title = propTitle || currentEvent?.title || '事件';
  const description = propDescription || currentEvent?.description || '';
  const pendingAction = currentEvent?.pendingAction;
  const gameState = useGameStore((s) => s.gameState);
  const actingPlayerId = currentEvent?.playerId || pendingAction?.playerId;
  const actingPlayerName = actingPlayerId && gameState
    ? gameState.players.find(p => p.id === actingPlayerId)?.name
    : undefined;

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
      }, 3000);
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
    // Close the modal — for events with no options (info-only or non-interactive pendingActions)
    setIsClosing(true);
    timerRefs.current.push(setTimeout(() => {
      if (onConfirm) {
        onConfirm();
      }
      clearEvent();
    }, 150));
  }, [onConfirm, clearEvent]);

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

  // Group options by 'group' field for tab display
  const optionGroups = (() => {
    if (!hasOptions) return null;
    const opts = pendingAction!.options!;
    const groups = new Map<string, typeof opts>();
    const ungrouped: typeof opts = [];
    for (const opt of opts) {
      if (opt.group) {
        if (!groups.has(opt.group)) groups.set(opt.group, []);
        groups.get(opt.group)!.push(opt);
      } else {
        ungrouped.push(opt);
      }
    }
    if (groups.size < 2) return null; // No need for tabs
    return { groups, ungrouped };
  })();

  // Initialize active tab
  useEffect(() => {
    if (optionGroups && !activeTab) {
      setActiveTab([...optionGroups.groups.keys()][0]);
    }
  }, [optionGroups, activeTab]);

  // Determine sentiment from effects for visual theming
  const sentiment = (() => {
    if (!effects) return 'neutral';
    const score = (effects.money ?? 0) + (effects.gpa ?? 0) * 1000 + (effects.exploration ?? 0) * 100;
    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  })();

  if (!isVisible && !isClosing) return null;

  return (
    <div
      className={`event-modal-overlay ${isClosing ? 'closing' : ''} ${isReadOnly ? 'read-only' : ''}`}
      style={{ opacity: isClosing ? 0 : opacity, pointerEvents: 'auto' }}
      onClick={isReadOnly ? undefined : (hasOptions ? undefined : handleClose)}
      onPointerDown={e => e.stopPropagation()}
    >
      <div
        className={`event-modal ${isClosing ? 'closing' : ''} ${hasOptions ? 'has-options' : ''} ${isReadOnly ? 'read-only' : ''} event-modal--${sentiment}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {isReadOnly && (
            <span className="read-only-badge">
              {actingPlayerName ? `${actingPlayerName} 的事件` : '观战中'}
            </span>
          )}
          {showCloseButton && !isReadOnly && (
            <button className="modal-close" onClick={handleClose}>
              &times;
            </button>
          )}
        </div>

        <div className="modal-body">
          <p className="modal-description">{description}</p>

          {hasOptions && (() => {
            const renderOption = (option: typeof pendingAction!.options![0], index: number) => (
              <button
                key={option.value}
                className={`option-card ${selectedOption === option.value ? 'selected' : ''}`}
                onClick={() => handleOptionSelect(option.value)}
                disabled={isClosing}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="option-card__content">
                  <span className="option-card__label">{option.label}</span>
                  {option.description && (
                    <span className="option-card__description">{option.description}</span>
                  )}
                  {option.effectPreview && (
                    <div className="option-card__effects">
                      {option.effectPreview.money !== undefined && (
                        <span className={`option-card__effect ${
                          typeof option.effectPreview.money === 'number'
                            ? (option.effectPreview.money > 0 ? 'positive' : option.effectPreview.money < 0 ? 'negative' : '')
                            : ''
                        }`}>
                          {'\uD83D\uDCB0'}{typeof option.effectPreview.money === 'number'
                            ? `${option.effectPreview.money > 0 ? '+' : ''}${option.effectPreview.money}`
                            : option.effectPreview.money}
                        </span>
                      )}
                      {option.effectPreview.gpa !== undefined && (
                        <span className={`option-card__effect ${
                          typeof option.effectPreview.gpa === 'number'
                            ? (option.effectPreview.gpa > 0 ? 'positive' : option.effectPreview.gpa < 0 ? 'negative' : '')
                            : ''
                        }`}>
                          {'\uD83D\uDCDA'}{typeof option.effectPreview.gpa === 'number'
                            ? `${option.effectPreview.gpa > 0 ? '+' : ''}${option.effectPreview.gpa}`
                            : option.effectPreview.gpa}
                        </span>
                      )}
                      {option.effectPreview.exploration !== undefined && (
                        <span className={`option-card__effect ${
                          typeof option.effectPreview.exploration === 'number'
                            ? (option.effectPreview.exploration > 0 ? 'positive' : option.effectPreview.exploration < 0 ? 'negative' : '')
                            : ''
                        }`}>
                          {'\uD83D\uDDFA\uFE0F'}{typeof option.effectPreview.exploration === 'number'
                            ? `${option.effectPreview.exploration > 0 ? '+' : ''}${option.effectPreview.exploration}`
                            : option.effectPreview.exploration}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {selectedOption === option.value && (
                  <span className="option-checkmark">{'\u2713'}</span>
                )}
              </button>
            );

            if (optionGroups) {
              const tabOptions = activeTab ? (optionGroups.groups.get(activeTab) || []) : [];
              return (
                <div className="options-tabbed">
                  <div className="options-tabs">
                    {[...optionGroups.groups.keys()].map(group => (
                      <button
                        key={group}
                        className={`options-tab ${activeTab === group ? 'active' : ''}`}
                        onClick={() => setActiveTab(group)}
                      >
                        {group}
                        <span className="options-tab__count">{optionGroups.groups.get(group)!.length}</span>
                      </button>
                    ))}
                  </div>
                  <div className="options-container options-list options-tab-content">
                    {tabOptions.map((opt, i) => renderOption(opt, i))}
                  </div>
                  {optionGroups.ungrouped.length > 0 && (
                    <div className="options-container options-list options-ungrouped">
                      {optionGroups.ungrouped.map((opt, i) => renderOption(opt, i))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className={`options-container ${pendingAction!.options!.length <= 2 ? 'options-grid' : 'options-list'}`}>
                {pendingAction!.options!.map((opt, i) => renderOption(opt, i))}
              </div>
            );
          })()}

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

  // Key on pendingAction.id or title+description to force remount when event changes
  const eventKey = currentEvent.pendingAction?.id || `${currentEvent.title}_${currentEvent.description}`;

  return (
    <EventModal
      key={eventKey}
      title={currentEvent.title}
      description={currentEvent.description}
      effects={currentEvent.effects}
      onConfirm={clearEvent}
      showCloseButton={false}
    />
  );
}

export default EventModal;
