import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useShakeAnimation } from '../hooks/useAnimation';
import { useGameState } from '../context/GameContext';
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
  const { diceResult, isRolling, rollDice, clearDiceResult, isMyTurn, playerId } = useGameState();
  const [rolling, setRolling] = useState(false);
  const [displayValues, setDisplayValues] = useState<number[]>(() =>
    Array.from({ length: count }, () => 1)
  );
  const [finalValues, setFinalValues] = useState<number[]>([]);
  const { startShake, transform } = useShakeAnimation(3);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep randomizing display values while rolling (until server result arrives)
  useEffect(() => {
    if (rolling && finalValues.length === 0) {
      const interval = setInterval(() => {
        setDisplayValues(
          Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)
        );
      }, 50);
      return () => clearInterval(interval);
    }
  }, [rolling, finalValues.length, count]);

  // Handle server dice result — this stops the animation
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

      // Re-trigger shake periodically if server hasn't responded yet
      shakeTimerRef.current = setInterval(() => {
        startShake(rollDuration);
      }, rollDuration);
    }

    return () => {
      if (shakeTimerRef.current) {
        clearInterval(shakeTimerRef.current);
        shakeTimerRef.current = null;
      }
    };
  }, [isRolling, rolling, rollDuration, startShake]);

  // Clean up shake timer when rolling stops
  useEffect(() => {
    if (!rolling && shakeTimerRef.current) {
      clearInterval(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
  }, [rolling]);

  const handleManualRoll = useCallback(() => {
    if (!rolling && isMyTurn && !isRolling) {
      clearDiceResult();
      rollDice();
    }
  }, [rolling, isMyTurn, isRolling, clearDiceResult, rollDice]);

  const total = finalValues.reduce((sum, v) => sum + v, 0);
  const showRolling = rolling && finalValues.length === 0;

  return (
    <div className="dice-roller-container">
      <div
        className={`dice-roller ${showRolling ? 'animating' : ''}`}
        style={{ transform }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={`dice-wrapper ${showRolling ? 'tumbling' : ''}`}
            style={{
              animationDelay: `${i * 0.1}s`,
            }}
          >
            <DiceFace value={displayValues[i]} rolling={showRolling} />
          </div>
        ))}
      </div>

      {!autoRoll && !rolling && finalValues.length === 0 && (
        <button
          className="roll-button"
          onClick={handleManualRoll}
          disabled={!isMyTurn || isRolling}
        >
          {isRolling ? '掷骰子中...' : '掷骰子'}
        </button>
      )}

      {!showRolling && finalValues.length > 0 && (
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

      {showRolling && (
        <div className="rolling-indicator">
          掷骰子中...
        </div>
      )}
    </div>
  );
}

export default DiceRoller;
