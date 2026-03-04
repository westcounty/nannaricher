import React, { useState, useEffect, useCallback } from 'react';
import { useAnimation, useShakeAnimation } from '../hooks/useAnimation';
import { useGameStore } from '../stores/gameStore';
import './DiceRoller.css';

interface DiceRollerProps {
  count: 1 | 2;
  autoRoll?: boolean;
  rollDuration?: number;
  onComplete?: (values: number[]) => void;
}

// Dice face SVG patterns
const DiceFace: React.FC<{ value: number; rolling: boolean }> = ({ value, rolling }) => {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
  };

  const dots = dotPositions[value] || [];

  return (
    <svg viewBox="0 0 100 100" className={`dice-face ${rolling ? 'rolling' : ''}`}>
      <rect x="5" y="5" width="90" height="90" rx="15" ry="15" className="dice-body" />
      {dots.map(([cx, cy], index) => (
        <circle
          key={index}
          cx={cx}
          cy={cy}
          r="12"
          className="dice-dot"
        />
      ))}
    </svg>
  );
};

export function DiceRoller({
  count,
  autoRoll = false,
  rollDuration = 800,
  onComplete,
}: DiceRollerProps) {
  const diceResult = useGameStore((s) => s.diceResult);
  const isRolling = useGameStore((s) => s.isRolling);
  const playerId = useGameStore((s) => s.playerId);
  const isMyTurn = useGameStore((s) => {
    if (!s.gameState || !s.playerId) return false;
    return s.gameState.players[s.gameState.currentPlayerIndex]?.id === s.playerId;
  });
  const socketActions = useGameStore((s) => s.socketActions);
  const rollDice = socketActions?.rollDice ?? (() => {});
  const clearDiceResult = () => useGameStore.getState().setDiceResult(null);
  const [rolling, setRolling] = useState(false);
  const [displayValues, setDisplayValues] = useState<number[]>(() =>
    Array.from({ length: count }, () => 1)
  );
  const [finalValues, setFinalValues] = useState<number[]>([]);
  const { isAnimating, progress, animate } = useAnimation(rollDuration);
  const { startShake, transform } = useShakeAnimation(3);

  // Randomize display values during roll
  useEffect(() => {
    if (isAnimating) {
      const interval = setInterval(() => {
        setDisplayValues(
          Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)
        );
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isAnimating, count]);

  // Handle server dice result
  useEffect(() => {
    if (diceResult && diceResult.playerId === playerId) {
      setFinalValues(diceResult.values);
      setDisplayValues(diceResult.values);
      setRolling(false);

      if (onComplete) {
        onComplete(diceResult.values);
      }
    }
  }, [diceResult, playerId, onComplete]);

  // Start rolling animation when isRolling becomes true
  useEffect(() => {
    if (isRolling && !rolling) {
      setRolling(true);
      setFinalValues([]);
      startShake(rollDuration);
      animate();
    }
  }, [isRolling, rolling, rollDuration, startShake, animate]);

  // Handle animation completion (fallback if server doesn't respond)
  useEffect(() => {
    if (!isAnimating && progress === 1 && rolling && finalValues.length === 0) {
      // Wait for server response - don't generate local values
      // Server is authoritative
    }
  }, [isAnimating, progress, rolling, finalValues.length]);

  const handleManualRoll = useCallback(() => {
    if (!rolling && !isAnimating && isMyTurn && !isRolling) {
      clearDiceResult();
      rollDice();
    }
  }, [rolling, isAnimating, isMyTurn, isRolling, clearDiceResult, rollDice]);

  const total = finalValues.reduce((sum, v) => sum + v, 0);

  return (
    <div className="dice-roller-container">
      <div
        className={`dice-roller ${isAnimating ? 'animating' : ''}`}
        style={{ transform }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={`dice-wrapper ${isAnimating ? 'tumbling' : ''}`}
            style={{
              animationDelay: `${i * 0.1}s`,
            }}
          >
            <DiceFace value={displayValues[i]} rolling={isAnimating} />
          </div>
        ))}
      </div>

      {!autoRoll && !rolling && !isAnimating && finalValues.length === 0 && (
        <button
          className="roll-button"
          onClick={handleManualRoll}
          disabled={!isMyTurn || isRolling}
        >
          {isRolling ? '掷骰子中...' : '掷骰子'}
        </button>
      )}

      {!isAnimating && finalValues.length > 0 && (
        <div className="dice-result">
          <div className="dice-values">
            {finalValues.map((v, i) => (
              <span key={i} className="dice-value">{v}</span>
            ))}
          </div>
          {count === 2 && (
            <div className="dice-total">
              总计: <span className="total-number">{total}</span>
            </div>
          )}
        </div>
      )}

      {isAnimating && (
        <div className="rolling-indicator">
          掷骰子中...
        </div>
      )}
    </div>
  );
}

export default DiceRoller;
