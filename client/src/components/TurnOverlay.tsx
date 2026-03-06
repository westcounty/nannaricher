// client/src/components/TurnOverlay.tsx
// Card-style turn prompt: starts centered, shrinks to bottom after 2s.

import { useEffect, useRef, useState } from 'react';
import '../styles/turn-overlay.css';

interface TurnOverlayProps {
  isMyTurn: boolean;
  playerPosition?: string;
  roundInfo?: string;
}

export function TurnOverlay({ isMyTurn, playerPosition, roundInfo }: TurnOverlayProps) {
  const [phase, setPhase] = useState<'hidden' | 'center' | 'shrinking'>('hidden');
  const prevIsMyTurn = useRef(isMyTurn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current) {
      setPhase('center');
      timerRef.current = setTimeout(() => {
        setPhase('shrinking');
        setTimeout(() => setPhase('hidden'), 500);
      }, 2000);
    }
    prevIsMyTurn.current = isMyTurn;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isMyTurn]);

  const dismiss = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPhase('shrinking');
    setTimeout(() => setPhase('hidden'), 500);
  };

  if (phase === 'hidden') return null;

  return (
    <div
      className={`turn-overlay turn-overlay--${phase}`}
      onClick={dismiss}
    >
      <div className={`turn-card turn-card--${phase}`}>
        <div className="turn-card__title">{'\u8F6E\u5230\u4F60\u4E86\uFF01'}</div>
        <div className="turn-card__subtitle">{'\uD83C\uDFB2 \u8BF7\u6295\u9AB0\u5B50'}</div>
        {(playerPosition || roundInfo) && (
          <div className="turn-card__info">
            {roundInfo && <span>{roundInfo}</span>}
            {playerPosition && <span>{playerPosition}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
