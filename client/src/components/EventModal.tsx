import { useEffect, useState } from 'react';
import { useFadeAnimation } from '../hooks/useAnimation';
import './EventModal.css';

interface EffectPreview {
  money?: number;
  gpa?: number;
  exploration?: number;
  cards?: { name: string; deckType: string }[];
  status?: string;
}

interface EventModalProps {
  title: string;
  description: string;
  effects?: EffectPreview;
  onConfirm: () => void;
  onClose?: () => void;
  confirmText?: string;
  showCloseButton?: boolean;
}

export function EventModal({
  title,
  description,
  effects,
  onConfirm,
  onClose,
  confirmText = '确定',
  showCloseButton = false,
}: EventModalProps) {
  const { isVisible, opacity, fadeIn } = useFadeAnimation(300);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    fadeIn();
  }, [fadeIn]);

  const handleConfirm = () => {
    setIsClosing(true);
    // Small delay for visual feedback
    setTimeout(() => {
      onConfirm();
    }, 150);
  };

  const handleClose = () => {
    if (onClose) {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 150);
    }
  };

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

  if (!isVisible && !isClosing) return null;

  return (
    <div
      className={`event-modal-overlay ${isClosing ? 'closing' : ''}`}
      style={{ opacity: isClosing ? 0 : opacity }}
      onClick={handleClose}
    >
      <div
        className={`event-modal ${isClosing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          {showCloseButton && (
            <button className="modal-close" onClick={handleClose}>
              &times;
            </button>
          )}
        </div>

        <div className="modal-body">
          <p className="modal-description">{description}</p>

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

        <div className="modal-footer">
          <button
            className="confirm-button"
            onClick={handleConfirm}
            disabled={isClosing}
          >
            {confirmText}
          </button>
        </div>
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

export default EventModal;
