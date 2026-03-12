import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { DESIGN_TOKENS, hexToRgba } from '../styles/tokens';

export function VoteResultModal() {
  const voteResult = useGameStore((s) => s.voteResult);
  const gameState = useGameStore((s) => s.gameState);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (voteResult) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 4500);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [voteResult]);

  if (!visible || !voteResult || !gameState) return null;

  const getPlayerName = (id: string) =>
    gameState.players.find((p) => p.id === id)?.name || id;

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: hexToRgba(DESIGN_TOKENS.color.white, 0.95),
      borderRadius: '12px',
      padding: '20px 24px',
      zIndex: 1100,
      pointerEvents: 'none' as const,
      minWidth: '280px',
      maxWidth: '400px',
      color: DESIGN_TOKENS.color.text.primary,
      boxShadow: `0 8px 32px ${hexToRgba(DESIGN_TOKENS.color.brand.primary, 0.15)}`,
      animation: 'fadeIn 0.3s ease',
    }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '16px', textAlign: 'center' }}>
        投票结果
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(voteResult.results).map(([option, playerIds]) => (
          <div key={option} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 10px',
            borderRadius: '6px',
            background: option === voteResult.winnerOption
              ? hexToRgba(DESIGN_TOKENS.color.semantic.success, 0.15)
              : hexToRgba(DESIGN_TOKENS.color.brand.primary, 0.05),
            border: option === voteResult.winnerOption
              ? `1px solid ${hexToRgba(DESIGN_TOKENS.color.semantic.success, 0.4)}`
              : `1px solid ${hexToRgba(DESIGN_TOKENS.color.brand.primary, 0.1)}`,
          }}>
            <span style={{ fontSize: '13px', fontWeight: option === voteResult.winnerOption ? 600 : 400 }}>
              {voteResult.optionLabels?.[option] || option}
              {option === voteResult.winnerOption && (voteResult.isTie ? ' (平局)' : ' (多数)')}
            </span>
            <span style={{ fontSize: '12px', color: DESIGN_TOKENS.color.text.muted }}>
              {(playerIds as string[]).map(getPlayerName).join(', ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
