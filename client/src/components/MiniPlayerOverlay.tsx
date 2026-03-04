// client/src/components/MiniPlayerOverlay.tsx
// Small opponent indicator dots overlaid on the mobile/tablet board

import type React from 'react';
import type { Player } from '@nannaricher/shared';
import '../styles/mobile.css';

export interface MiniPlayerOverlayProps {
  players: Player[];
  currentPlayerId: string | null;
  localPlayerId: string | null;
}

export function MiniPlayerOverlay({
  players,
  currentPlayerId,
  localPlayerId,
}: MiniPlayerOverlayProps) {
  const others = players.filter((p) => p.id !== localPlayerId);
  if (others.length === 0) return null;

  return (
    <div className="mini-player-overlay">
      {others.map((p) => (
        <div
          key={p.id}
          className={`mini-player-dot ${p.id === currentPlayerId ? 'active' : ''} ${p.isBankrupt ? 'bankrupt' : ''}`}
          style={{ borderColor: p.color, '--player-color': p.color } as React.CSSProperties}
        >
          <span className="mini-player-initial">{p.name.charAt(0)}</span>
          <span className="mini-player-money">{p.money}</span>
        </div>
      ))}
    </div>
  );
}
