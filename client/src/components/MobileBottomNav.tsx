// client/src/components/MobileBottomNav.tsx
// Mobile bottom navigation bar: dice + cards + players + more

import '../styles/mobile-nav.css';

interface MobileBottomNavProps {
  isMyTurn: boolean;
  isRolling: boolean;
  canRollDice: boolean;
  cardCount: number;
  isBankrupt?: boolean;
  onRollDice: () => void;
  onOpenCards: () => void;
  onOpenPlayers: () => void;
  onOpenMore: () => void;
  activePanel?: string | null;
  hasUnreadChat?: boolean;
}

export function MobileBottomNav({
  isMyTurn,
  isRolling,
  canRollDice,
  cardCount,
  isBankrupt = false,
  onRollDice,
  onOpenCards,
  onOpenPlayers,
  onOpenMore,
  activePanel,
  hasUnreadChat = false,
}: MobileBottomNavProps) {
  const diceDisabled = isBankrupt || !canRollDice || isRolling;
  const diceText = isBankrupt
    ? '\uD83D\uDC41\uFE0F \u89C2\u6218\u4E2D'
    : isRolling ? '掷骰中...' : '🎲 掷骰子';

  const handleDiceClick = () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    onRollDice();
  };

  return (
    <div className="mobile-bottom-nav">
      {/* Dice button (2x width) */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--dice ${isMyTurn && !isBankrupt ? 'mobile-bottom-nav__btn--my-turn' : ''} ${isBankrupt ? 'mobile-bottom-nav__btn--bankrupt' : ''}`}
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
        <span className="mobile-bottom-nav__icon">{'\uD83C\uDCCF'}</span>
        <span className="mobile-bottom-nav__label">{'\u624B\u724C'}</span>
        {cardCount > 0 && (
          <span className="mobile-bottom-nav__badge">{cardCount}</span>
        )}
      </button>

      {/* Players button */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--nav ${activePanel === 'players' ? 'mobile-bottom-nav__btn--active' : ''}`}
        onClick={onOpenPlayers}
      >
        <span className="mobile-bottom-nav__icon">{'\uD83D\uDC64'}</span>
        <span className="mobile-bottom-nav__label">{'\u73A9\u5BB6'}</span>
      </button>

      {/* Chat / More button */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--nav ${activePanel === 'more' ? 'mobile-bottom-nav__btn--active' : ''}`}
        onClick={onOpenMore}
      >
        <span className="mobile-bottom-nav__icon">{'\uD83D\uDCAC'}</span>
        <span className="mobile-bottom-nav__label">{'\u804A\u5929'}</span>
        {hasUnreadChat && <span className="mobile-bottom-nav__unread-dot" />}
      </button>
    </div>
  );
}
