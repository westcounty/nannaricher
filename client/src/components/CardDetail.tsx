// client/src/components/CardDetail.tsx
import React, { useState } from 'react';
import type { Card, CardEffect, Player } from '@nannaricher/shared';

interface CardDetailProps {
  card: Card;
  onClose: () => void;
  onUse: (cardId: string, targetPlayerId?: string) => void;
  canUse: boolean;
  players?: Player[];
}

export function CardDetail({ card, onClose, onUse, canUse, players = [] }: CardDetailProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | undefined>(undefined);

  const getEffectText = (effect: CardEffect): string => {
    if (!effect.stat) return '特殊效果';

    const statName = {
      money: '金钱',
      gpa: 'GPA',
      exploration: '探索'
    }[effect.stat] || effect.stat;

    let deltaText = '';
    if (effect.delta !== undefined) {
      deltaText = effect.delta >= 0 ? `+${effect.delta}` : `${effect.delta}`;
    } else if (effect.multiplier !== undefined) {
      deltaText = `x${effect.multiplier}`;
    }

    const targetName = effect.target ? {
      self: '自己',
      all: '所有玩家',
      choose_player: '选择玩家',
      richest: '最富有的玩家',
      poorest: '最穷的玩家',
      highest_gpa: 'GPA最高',
      lowest_gpa: 'GPA最低',
      highest_exp: '探索最高',
      lowest_exp: '探索最低'
    }[effect.target] || effect.target : '目标';

    return `${statName} ${deltaText} (${targetName})`;
  };

  const getDeckTypeLabel = (deckType: 'chance' | 'destiny'): string => {
    return deckType === 'chance' ? '机遇卡' : '命运卡';
  };

  const needsTargetSelection = card.effects.some(e => e.target === 'choose_player');
  const selectablePlayers = players.filter(p => !p.isBankrupt);

  const handleUse = () => {
    if (needsTargetSelection && !selectedTarget) {
      return;
    }
    onUse(card.id, selectedTarget);
  };

  return (
    <div className="card-detail-overlay" onClick={onClose}>
      <div className="card-detail" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>x</button>

        <div className={`card-header ${card.deckType}`}>
          <span className="card-type">{getDeckTypeLabel(card.deckType)}</span>
          <h2 className="card-title">{card.name}</h2>
          {card.holdable && <span className="holdable-badge">可保留</span>}
          {card.singleUse && <span className="single-use-badge">一次性</span>}
        </div>

        <div className="card-body">
          <div className="card-description">
            <p>{card.description}</p>
          </div>

          <div className="card-effects">
            <h4>效果:</h4>
            <ul>
              {card.effects.map((effect, index) => (
                <li key={index} className="effect-item">
                  {getEffectText(effect)}
                </li>
              ))}
            </ul>
          </div>

          {needsTargetSelection && canUse && (
            <div className="target-selection">
              <h4>选择目标玩家:</h4>
              <div className="target-list">
                {selectablePlayers.map((player) => (
                  <button
                    key={player.id}
                    className={`target-player ${selectedTarget === player.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTarget(player.id)}
                  >
                    <span
                      className="player-color-dot"
                      style={{ backgroundColor: player.color }}
                    />
                    {player.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card-actions">
          {canUse ? (
            <button
              className="use-card-btn"
              onClick={handleUse}
              disabled={needsTargetSelection && !selectedTarget}
            >
              使用卡牌
            </button>
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
