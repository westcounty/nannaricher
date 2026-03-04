// client/src/components/TurnOverlay.tsx
// Full-screen overlay shown when it becomes the player's turn.

import { useEffect, useRef, useState } from 'react';
import '../styles/turn-overlay.css';

interface TurnOverlayProps {
  isMyTurn: boolean;
}

export function TurnOverlay({ isMyTurn }: TurnOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const prevIsMyTurn = useRef(isMyTurn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Trigger only on false -> true transition
    if (isMyTurn && !prevIsMyTurn.current) {
      setVisible(true);
      setFading(false);

      // Auto-dismiss after 2 seconds
      timerRef.current = setTimeout(() => {
        dismiss();
      }, 2000);
    }
    prevIsMyTurn.current = isMyTurn;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [isMyTurn]);

  const dismiss = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFading(true);
    fadeTimerRef.current = setTimeout(() => {
      setVisible(false);
      setFading(false);
    }, 400); // match fade-out animation duration
  };

  if (!visible) return null;

  return (
    <div
      className={`turn-overlay ${fading ? 'turn-overlay--fading' : ''}`}
      onClick={dismiss}
    >
      <div className="turn-overlay__text">{'\u8F6E\u5230\u4F60\u4E86\uFF01'}</div>
    </div>
  );
}
