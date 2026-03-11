// client/src/components/DiceRoller.tsx
// Dice rolling animation visible to ALL players.
// Shows rolling animation then final result with player name.

import React, { useState, useEffect, useRef } from 'react';
import { useAnimation, useShakeAnimation } from '../hooks/useAnimation';
import './DiceRoller.css';

interface DiceRollerProps {
  /** Number of dice */
  count: 1 | 2;
  /** Final dice values from server (null = still rolling) */
  values: number[] | null;
  /** Name of the player who is rolling */
  playerName?: string;
  /** Rolling animation duration in ms */
  rollDuration?: number;
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
          r="14"
          className="dice-dot"
        />
      ))}
    </svg>
  );
};

export function DiceRoller({
  count,
  values,
  playerName,
  rollDuration = 800,
}: DiceRollerProps) {
  const [displayValues, setDisplayValues] = useState<number[]>(() =>
    Array.from({ length: count }, () => 1)
  );
  const [settled, setSettled] = useState(false);
  const { isAnimating, animate } = useAnimation(rollDuration);
  const { startShake, transform } = useShakeAnimation(3);
  const startedRef = useRef(false);

  // Start rolling animation on mount
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      startShake(rollDuration);
      animate();
    }
  }, [rollDuration, startShake, animate]);

  // Randomize display values during rolling
  useEffect(() => {
    if (isAnimating && !values) {
      const interval = setInterval(() => {
        setDisplayValues(
          Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1)
        );
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isAnimating, count, values]);

  // When server result arrives, show final values
  useEffect(() => {
    if (values && values.length > 0) {
      setDisplayValues(values);
      setSettled(true);
    }
  }, [values]);

  const isRolling = !settled;
  const total = values ? values.reduce((sum, v) => sum + v, 0) : 0;

  return (
    <div className="dice-roller-container">
      {/* Player name */}
      {playerName && (
        <div className="dice-roller-player">
          {playerName} 掷骰子
        </div>
      )}

      <div
        className={`dice-roller ${isRolling ? 'animating' : ''}`}
        style={{ transform: isRolling ? transform : undefined }}
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={`dice-wrapper ${isRolling ? 'tumbling' : 'settled'}`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <DiceFace value={displayValues[i]} rolling={isRolling} />
          </div>
        ))}
      </div>

      {/* Result display after settling */}
      {settled && values && (
        <div className="dice-result">
          <div className="dice-total">
            <span className="total-number">{total}</span>
          </div>
        </div>
      )}

      {/* Rolling indicator */}
      {isRolling && (
        <div className="rolling-indicator">
          掷骰子中...
        </div>
      )}
    </div>
  );
}

export default DiceRoller;
