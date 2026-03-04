// client/src/components/ActionBar.tsx
// Bottom action hub: stats + cards + dice button (desktop layout)

import type { Player } from '@nannaricher/shared';
import { CardHand } from './CardHand';
import { playSound } from '../audio/AudioManager';
import '../styles/action-bar.css';

interface ActionBarProps {
  myPlayer: Player | undefined;
  isMyTurn: boolean;
  currentPlayerName?: string;
  useCard: (cardId: string, targetPlayerId?: string) => void;
  players?: Player[];
  canRollDice: boolean;
  isRolling: boolean;
  onRollDice: () => void;
}

export function ActionBar({ myPlayer, isMyTurn, currentPlayerName, useCard, players, canRollDice, isRolling, onRollDice }: ActionBarProps) {
  const needsToRoll = myPlayer && (myPlayer.isInHospital || myPlayer.isAtDing);

  const handleRollDice = () => {
    if (canRollDice || (isMyTurn && needsToRoll)) {
      playSound('button_click');
      onRollDice();
    }
  };

  const getRollButtonText = () => {
    if (isRolling) return '掷骰子中...';
    if (myPlayer?.isInHospital) return '🎲 投骰出院';
    if (myPlayer?.isAtDing) return '🎲 投骰移动';
    return '🎲 掷骰子';
  };

  const diceDisabled = (!canRollDice && !(isMyTurn && needsToRoll)) || isRolling;

  // Bankrupt spectator mode
  if (myPlayer?.isBankrupt) {
    return (
      <div className="action-bar action-bar--spectator">
        <span className="action-bar__spectator-text">
          {'\uD83D\uDC41\uFE0F \u89C2\u6218\u6A21\u5F0F \u2014 \u4F60\u5DF2\u7834\u4EA7\uFF0C\u53EF\u7EE7\u7EED\u89C2\u770B\u5176\u4ED6\u73A9\u5BB6\u7684\u6E38\u620F'}
        </span>
      </div>
    );
  }

  return (
    <div className="action-bar">
      {/* Left: my stats */}
      <div className="action-bar__stats">
        {myPlayer ? (
          <>
            <div className="action-bar__stat">
              <span className="action-bar__stat-icon">💰</span>
              <span className={`action-bar__stat-value ${myPlayer.money < 100 ? 'action-bar__stat-value--low' : ''}`}>
                {myPlayer.money}
              </span>
            </div>
            <div className="action-bar__stat">
              <span className="action-bar__stat-icon">📚</span>
              <span className="action-bar__stat-value">{myPlayer.gpa.toFixed(1)}</span>
            </div>
            <div className="action-bar__stat">
              <span className="action-bar__stat-icon">🗺️</span>
              <span className="action-bar__stat-value">{myPlayer.exploration}</span>
            </div>
          </>
        ) : (
          <span className="action-bar__wait-text">加载中...</span>
        )}
      </div>

      {/* Center: cards */}
      <div className="action-bar__cards">
        {myPlayer ? (
          <>
            <CardHand
              player={myPlayer}
              onUseCard={useCard}
              isCurrentPlayer={isMyTurn}
              players={players}
            />
            {myPlayer.heldCards.length === 0 && (
              <span className="action-bar__card-count">🃏 无手牌</span>
            )}
          </>
        ) : null}
      </div>

      {/* Right: dice button */}
      <div className="action-bar__dice">
        {isMyTurn || !currentPlayerName ? (
          <button
            className={`action-bar__dice-btn ${isMyTurn ? 'action-bar__dice-btn--my-turn' : ''}`}
            onClick={handleRollDice}
            disabled={diceDisabled}
          >
            {getRollButtonText()}
          </button>
        ) : (
          <span className="action-bar__wait-text">等待 {currentPlayerName}...</span>
        )}
      </div>
    </div>
  );
}
