// client/src/components/CardHand.tsx
import React, { useState } from 'react';
import type { Card, Player } from '@nannaricher/shared';
import { CardDetail } from './CardDetail';

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
    setSelectedCard(card);
  };

  const handleCloseDetail = () => {
    setSelectedCard(null);
  };

  const handleUseCard = (cardId: string, targetPlayerId?: string) => {
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
        {player.heldCards.map((card) => (
          <div
            key={card.id}
            className={`card-thumbnail ${card.deckType}`}
            onClick={() => handleCardClick(card)}
          >
            <div className="card-type-icon">
              {card.deckType === 'chance' ? '?' : '!'}
            </div>
            <div className="card-name">{card.name}</div>
            {card.holdable && <div className="holdable-indicator" title="可保留">H</div>}
          </div>
        ))}
      </div>
      {selectedCard && (
        <CardDetail
          card={selectedCard}
          onClose={handleCloseDetail}
          onUse={handleUseCard}
          canUse={isCurrentPlayer}
          players={players}
        />
      )}
    </div>
  );
}
