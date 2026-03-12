// client/src/components/MobileBottomNav.tsx
// Mobile bottom navigation bar: dice (large) + cards + players + chat + log

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
  onOpenChat: () => void;
  onOpenLog: () => void;
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
  onOpenChat,
  onOpenLog,
  activePanel,
  hasUnreadChat = false,
}: MobileBottomNavProps) {
  const diceDisabled = isBankrupt || !canRollDice || isRolling;
  const diceText = isBankrupt
    ? '\uD83D\uDC41\uFE0F 观战中'
    : isRolling ? '掷骰中...' : '🎲 掷骰子';

  const handleDiceClick = () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    onRollDice();
  };

  return (
    <div className="mobile-bottom-nav">
      {/* Dice button (larger) */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--dice ${isMyTurn && !isBankrupt ? 'mobile-bottom-nav__btn--my-turn' : ''} ${isBankrupt ? 'mobile-bottom-nav__btn--bankrupt' : ''}`}
        onClick={handleDiceClick}
        disabled={diceDisabled}
      >
        {diceText}
      </button>

      {/* Cards */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--nav ${activePanel === 'hand' ? 'mobile-bottom-nav__btn--active' : ''}`}
        onClick={onOpenCards}
      >
        <span className="mobile-bottom-nav__icon">🃏</span>
        <span className="mobile-bottom-nav__label">手牌</span>
        {cardCount > 0 && (
          <span className="mobile-bottom-nav__badge">{cardCount}</span>
        )}
      </button>

      {/* Players */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--nav ${activePanel === 'players' ? 'mobile-bottom-nav__btn--active' : ''}`}
        onClick={onOpenPlayers}
      >
        <span className="mobile-bottom-nav__icon">👤</span>
        <span className="mobile-bottom-nav__label">玩家</span>
      </button>

      {/* Chat */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--nav ${activePanel === 'chat' ? 'mobile-bottom-nav__btn--active' : ''}`}
        onClick={onOpenChat}
      >
        <span className="mobile-bottom-nav__icon">💬</span>
        <span className="mobile-bottom-nav__label">聊天</span>
        {hasUnreadChat && <span className="mobile-bottom-nav__unread-dot" />}
      </button>

      {/* Log */}
      <button
        className={`mobile-bottom-nav__btn mobile-bottom-nav__btn--nav ${activePanel === 'log' ? 'mobile-bottom-nav__btn--active' : ''}`}
        onClick={onOpenLog}
      >
        <span className="mobile-bottom-nav__icon">📜</span>
        <span className="mobile-bottom-nav__label">日志</span>
      </button>
    </div>
  );
}
