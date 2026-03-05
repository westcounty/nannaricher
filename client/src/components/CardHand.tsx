// client/src/components/CardHand.tsx
import { useState } from 'react';
import type { Card, Player } from '@nannaricher/shared';
import { CardDetail } from './CardDetail';
import { playSound } from '../audio/AudioManager';

const STAT_ICONS: Record<string, string> = {
  money: '\uD83D\uDCB0',
  gpa: '\uD83D\uDCDA',
  exploration: '\uD83D\uDDFA\uFE0F',
};

/** Build a short 1-line effect summary for a card. */
function buildEffectSummary(card: Card): string {
  const parts: string[] = [];
  for (const eff of card.effects) {
    if (eff.stat && eff.delta != null && eff.delta !== 0) {
      const sign = eff.delta > 0 ? '+' : '';
      const icon = STAT_ICONS[eff.stat] ?? eff.stat;
      parts.push(`${sign}${eff.delta}${icon}`);
    } else if (eff.stat && eff.multiplier != null) {
      const sign = eff.multiplier > 0 ? '+' : '';
      const icon = STAT_ICONS[eff.stat] ?? eff.stat;
      parts.push(`${sign}${eff.multiplier}x\uD83C\uDFB2${icon}`);
    }
  }
  if (parts.length > 0) return parts.join(' ');
  // Fallback: truncate description
  if (card.description) {
    return card.description.length > 15
      ? card.description.slice(0, 15) + '\u2026'
      : card.description;
  }
  return '';
}

interface CardHandProps {
  player: Player;
  onUseCard: (cardId: string, targetPlayerId?: string) => void;
  isCurrentPlayer: boolean;
  players?: Player[];
}

export function CardHand({ player, onUseCard, isCurrentPlayer, players = [] }: CardHandProps) {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  if (player.heldCards.length === 0) {
    return (
      <div className="card-hand empty">
        <span className="no-cards">暂无手牌</span>
      </div>
    );
  }

  const handleCardClick = (card: Card) => {
    playSound('card_flip');
    setSelectedCard(card);
  };

  const handleCloseDetail = () => {
    setSelectedCard(null);
  };

  const handleUseCard = (cardId: string, targetPlayerId?: string) => {
    playSound('card_use');
    onUseCard(cardId, targetPlayerId);
    setSelectedCard(null);
  };

  return (
    <div className="card-hand">
      <div className="card-hand-header">
        <h3>手牌</h3>
        <span className="card-count">{player.heldCards.length}</span>
      </div>
      <div className="card-list">
        {player.heldCards.map((card) => {
          const summary = buildEffectSummary(card);
          return (
            <div
              key={card.id}
              className={`card-thumbnail ${card.deckType}`}
              onClick={() => handleCardClick(card)}
            >
              <div className="card-type-icon">
                {card.deckType === 'chance' ? '?' : '!'}
              </div>
              <div className="card-name">{card.name}</div>
              {summary && (
                <div className="card-effect-summary">{summary}</div>
              )}
              {card.holdable && <div className="holdable-indicator" title="可保留">H</div>}
            </div>
          );
        })}
      </div>
      {selectedCard && (
        <CardDetail
          card={selectedCard}
          onClose={handleCloseDetail}
          onUse={handleUseCard}
          canUse={selectedCard?.useTiming === 'any_turn' || isCurrentPlayer}
          players={players}
        />
      )}
    </div>
  );
}
