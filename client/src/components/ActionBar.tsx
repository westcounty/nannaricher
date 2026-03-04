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
        {myPlayer && (
          <CardHand
            player={myPlayer}
            onUseCard={useCard}
            isCurrentPlayer={isMyTurn}
            players={players}
          />
        )}
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
