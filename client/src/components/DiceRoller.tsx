import React, { useState, useEffect, useCallback } from 'react';
import { useAnimation, useShakeAnimation } from '../hooks/useAnimation';
import './DiceRoller.css';

interface DiceRollerProps {
  count: 1 | 2;
  onComplete: (values: number[]) => void;
  autoRoll?: boolean;
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
          r="12"
          className="dice-dot"
        />
      ))}
    </svg>
  );
};

export function DiceRoller({
  count,
  onComplete,
  autoRoll = true,
  rollDuration = 800
}: DiceRollerProps) {
  const [rolling, setRolling] = useState(autoRoll);
  const [values, setValues] = useState<number[]>([]);
  const [displayValues, setDisplayValues] = useState<number[]>(() =>
    Array.from({ length: count }, () => 1)
  );
  const { isAnimating, progress, animate } = useAnimation(rollDuration);
  const { offset, startShake, transform } = useShakeAnimation(3);

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

  // Start rolling animation
  useEffect(() => {
    if (autoRoll) {
      startShake(rollDuration);
      animate();
    }
  }, [autoRoll, rollDuration, animate, startShake]);

  // Handle animation completion
  useEffect(() => {
    if (!isAnimating && progress === 1 && rolling) {
      const finalValues = Array.from({ length: count }, () =>
        Math.floor(Math.random() * 6) + 1
      );
      setValues(finalValues);
      setDisplayValues(finalValues);
      setRolling(false);
      onComplete(finalValues);
    }
  }, [isAnimating, progress, rolling, count, onComplete]);

  const handleManualRoll = useCallback(() => {
    if (!rolling && !isAnimating) {
      setRolling(true);
      startShake(rollDuration);
      animate();
    }
  }, [rolling, isAnimating, rollDuration, startShake, animate]);

  const total = values.reduce((sum, v) => sum + v, 0);

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

      {!autoRoll && !rolling && !isAnimating && values.length === 0 && (
        <button className="roll-button" onClick={handleManualRoll}>
          掷骰子
        </button>
      )}

      {!isAnimating && values.length > 0 && (
        <div className="dice-result">
          <div className="dice-values">
            {values.map((v, i) => (
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
