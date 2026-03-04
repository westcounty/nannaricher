// client/src/components/MobileStatusBar.tsx
// Thin bar showing core player stats on mobile

import type { Player } from '@nannaricher/shared';
import '../styles/mobile-nav.css';

interface MobileStatusBarProps {
  player: Player | undefined;
}

export function MobileStatusBar({ player }: MobileStatusBarProps) {
  if (!player) return null;

  return (
    <div className="mobile-status-bar">
      <div className="mobile-status-bar__stat">
        <span className="mobile-status-bar__icon">💰</span>
        <span className={`mobile-status-bar__value ${player.money < 100 ? 'mobile-status-bar__value--low' : ''}`}>
          {player.money}
        </span>
      </div>
      <div className="mobile-status-bar__stat">
        <span className="mobile-status-bar__icon">📚</span>
        <span className="mobile-status-bar__value">{player.gpa.toFixed(1)}</span>
      </div>
      <div className="mobile-status-bar__stat">
        <span className="mobile-status-bar__icon">🗺️</span>
        <span className="mobile-status-bar__value">{player.exploration}</span>
      </div>
    </div>
  );
}
