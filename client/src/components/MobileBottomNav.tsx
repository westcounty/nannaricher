// client/src/components/MobileBottomNav.tsx
// Mobile bottom navigation bar: dice + cards + players + more

import '../styles/mobile-nav.css';

interface MobileBottomNavProps {
  isMyTurn: boolean;
  isRolling: boolean;
  canRollDice: boolean;
  cardCount: number;
  onRollDice: () => void;
  onOpenCards: () => void;
  onOpenPlayers: () => void;
  onOpenMore: () => void;
  activePanel?: string | null;
}

export function MobileBottomNav({
  isMyTurn,
  isRolling,
  canRollDice,
  cardCount,
  onRollDice,
  onOpenCards,
  onOpenPlayers,
  onOpenMore,
  activePanel,
}: MobileBottomNavProps) {
  const diceDisabled = !canRollDice || isRolling;
  const diceText = isRolling ? '掷骰中...' : '🎲 掷骰子';

  const handleDiceClick = () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    onRollDice();
  };

  return (
    <div className="mobile-bottom-nav">
      {/* Dice button (2x width) */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--dice ${isMyTurn ? 'mobile-bottom-nav__btn--my-turn' : ''}`}
        onClick={handleDiceClick}
        disabled={diceDisabled}
      >
        {diceText}
      </button>

      {/* Cards button */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--nav ${activePanel === 'hand' ? 'mobile-bottom-nav__btn--active' : ''}`}
        onClick={onOpenCards}
      >
        <span className="mobile-bottom-nav__icon">🃏</span>
        {cardCount > 0 && (
          <span className="mobile-bottom-nav__badge">{cardCount}</span>
        )}
      </button>

      {/* Players button */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--nav ${activePanel === 'players' ? 'mobile-bottom-nav__btn--active' : ''}`}
        onClick={onOpenPlayers}
      >
        <span className="mobile-bottom-nav__icon">👥</span>
      </button>

      {/* More button */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--nav ${activePanel === 'more' ? 'mobile-bottom-nav__btn--active' : ''}`}
        onClick={onOpenMore}
      >
        <span className="mobile-bottom-nav__icon">⋯</span>
      </button>
    </div>
  );
}
