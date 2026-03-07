// client/src/components/CardDetail.tsx
import { useState } from 'react';
import type { Card, CardEffect, Player } from '@nannaricher/shared';
import '../styles/cards.css';

interface CardDetailProps {
  card: Card;
  onClose: () => void;
  onUse: (cardId: string, targetPlayerId?: string) => void;
  canUse: boolean;
  players?: Player[];
}

const STAT_NAMES: Record<string, string> = {
  money: '金钱',
  gpa: 'GPA',
  exploration: '探索',
};

const STAT_ICONS: Record<string, string> = {
  money: '\uD83D\uDCB0',
  gpa: '\uD83D\uDCDA',
  exploration: '\uD83D\uDD2D',
};

const TARGET_NAMES: Record<string, string> = {
  self: '自己',
  all: '所有玩家',
  choose_player: '选择玩家',
  richest: '最富有',
  poorest: '最穷',
  highest_gpa: 'GPA最高',
  lowest_gpa: 'GPA最低',
  highest_exp: '探索最高',
  lowest_exp: '探索最低',
};

function getEffectPillClass(effect: CardEffect): string {
  if (effect.stat) return `effect-pill effect-pill--${effect.stat}`;
  return 'effect-pill effect-pill--special';
}

function formatDelta(effect: CardEffect): string {
  if (effect.delta !== undefined) {
    return effect.delta >= 0 ? `+${effect.delta}` : `${effect.delta}`;
  }
  if (effect.multiplier !== undefined) {
    return `x${effect.multiplier} (骰)`;
  }
  return '';
}

export function CardDetail({ card, onClose, onUse, canUse, players = [] }: CardDetailProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | undefined>(undefined);
  const [confirmingUse, setConfirmingUse] = useState(false);

  const needsTargetSelection = card.effects.some(e => e.target === 'choose_player');
  const selectablePlayers = players.filter(p => !p.isBankrupt);

  const handleUse = () => {
    if (needsTargetSelection && !selectedTarget) return;
    if (!confirmingUse) {
      setConfirmingUse(true);
      return;
    }
    onUse(card.id, selectedTarget);
  };

  const cancelUse = () => setConfirmingUse(false);

  const deckLabel = card.deckType === 'chance' ? '机遇卡' : '命运卡';
  const hasEffects = card.effects.length > 0 && card.effects.some(e => e.stat);

  return (
    <div className="card-detail-overlay" onClick={onClose}>
      <div className="card-detail" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>&times;</button>

        {/* Header band */}
        <div className={`card-header ${card.deckType}`}>
          <span className="card-type">{deckLabel}</span>
          <h2 className="card-title">{card.name}</h2>
          <div className="card-badges">
            {card.holdable && <span className="card-badge card-badge--holdable">可保留</span>}
            {card.singleUse && <span className="card-badge card-badge--single-use">一次性</span>}
            {card.useTiming === 'any_turn' && <span className="card-badge card-badge--any-turn">任意回合</span>}
            {card.useTiming === 'own_turn' && <span className="card-badge card-badge--own-turn">本回合</span>}
          </div>
        </div>

        {/* Body */}
        <div className="card-body">
          {/* Description */}
          <div className="card-description">
            <p>{card.description}</p>
          </div>

          {/* Effects as pills */}
          {hasEffects && (
            <>
              <hr className="card-divider" />
              <div className="card-effects">
                <span className="card-effects-label">效果</span>
                {card.effects.map((effect, index) => (
                  <div key={index} className={getEffectPillClass(effect)}>
                    <span className="effect-icon">{STAT_ICONS[effect.stat || ''] || '\u2728'}</span>
                    <span className="effect-delta">{STAT_NAMES[effect.stat || ''] || '特殊'} {formatDelta(effect)}</span>
                    {effect.target && (
                      <span className="effect-target">({TARGET_NAMES[effect.target] || effect.target})</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="card-detail__tags">
              {card.tags.map((tag: string) => (
                <span key={tag} className="card-detail__tag">{tag}</span>
              ))}
            </div>
          )}

          {/* Target selection */}
          {needsTargetSelection && canUse && (
            <div className="target-selection">
              <h4>选择目标</h4>
              <div className="target-list">
                {selectablePlayers.map((player) => (
                  <button
                    key={player.id}
                    className={`target-player ${selectedTarget === player.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTarget(player.id)}
                  >
                    <span className="player-color-dot" style={{ backgroundColor: player.color }} />
                    {player.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="card-actions">
          {canUse ? (
            confirmingUse ? (
              <div className="confirm-use-group">
                <button className="use-card-btn use-card-btn--confirm" onClick={handleUse}>
                  确认使用
                </button>
                <button className="cancel-btn" onClick={cancelUse}>
                  取消
                </button>
              </div>
            ) : (
              <button
                className="use-card-btn"
                onClick={handleUse}
                disabled={needsTargetSelection && !selectedTarget}
              >
                使用卡牌
              </button>
            )
          ) : (
            <span className="not-your-turn">非你的回合</span>
          )}
          <button className="cancel-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
