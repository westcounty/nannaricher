// client/src/components/MiniPlayerOverlay.tsx
// Small opponent indicator dots overlaid on the mobile/tablet board

import { useState } from 'react';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (others.length === 0) return null;

  const handleDotClick = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mini-player-overlay">
      {others.map((p) => {
        const isExpanded = expandedId === p.id;
        return (
          <div
            key={p.id}
            className={`mini-player-dot ${p.id === currentPlayerId ? 'active' : ''} ${p.isBankrupt ? 'bankrupt' : ''} ${isExpanded ? 'mini-player-dot--expanded' : ''}`}
            style={{ borderColor: p.color, '--player-color': p.color } as React.CSSProperties}
            onClick={() => handleDotClick(p.id)}
          >
            <span className="mini-player-initial">{p.name.charAt(0)}</span>
            <span className="mini-player-money">{p.money}</span>
            {isExpanded && (
              <span className="mini-player-stats-expanded">
                <span className="mini-player-stat">📚{p.gpa.toFixed(1)}</span>
                <span className="mini-player-stat">🗺️{p.exploration}</span>
                <span className="mini-player-stat">🃏{p.heldCards.length}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
