// client/src/components/CompactHeader.tsx
// Slim 48px header replacing StatusBar for commercial-grade UI

import { useEffect, useRef, useState } from 'react';
import { getRoundName } from '@nannaricher/shared';
import type { GameState } from '@nannaricher/shared';
import { AudioControl } from './AudioControl';
import { SettingsPanel } from './SettingsPanel';
import '../styles/compact-header.css';

interface CompactHeaderProps {
  gameState: GameState;
  playerId: string | null;
  isMyTurn: boolean;
  currentPlayerName?: string;
}

export function CompactHeader({ gameState, playerId: _playerId, isMyTurn, currentPlayerName }: CompactHeaderProps) {
  const statusText = getStatusText(gameState, isMyTurn, currentPlayerName);
  const statusVariant = isMyTurn ? 'action' : 'waiting';

  // Show a brief "your turn" banner when turn starts
  const [showBanner, setShowBanner] = useState(false);
  const prevMyTurn = useRef(isMyTurn);
  useEffect(() => {
    if (isMyTurn && !prevMyTurn.current) {
      setShowBanner(true);
      const timer = setTimeout(() => setShowBanner(false), 2000);
      return () => clearTimeout(timer);
    }
    prevMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  return (
    <div className={`compact-header ${isMyTurn ? 'compact-header--my-turn' : ''}`}>
      {showBanner && <div className="compact-header__turn-banner">轮到你了!</div>}
      <div className="compact-header__brand">
        <span className="compact-header__title">菜根人生</span>
      </div>

      <div className="compact-header__center">
        <span className="compact-header__round">
          {getRoundName(gameState.roundNumber)} · 第{gameState.turnNumber}回合
          {gameState.roundNumber === 1 && (
            <span className="compact-header__buff-indicator" title="大一通用Buff生效中" style={{
              marginLeft: '4px',
              color: '#FFD700',
              fontSize: '14px',
            }}>&#9889;</span>
          )}
        </span>
        {statusText && (
          <>
            <span className="compact-header__separator">—</span>
            <span className={`compact-header__status compact-header__status--${statusVariant}`}>
              {statusText}
            </span>
          </>
        )}
      </div>

      <div className="compact-header__right">
        <AudioControl />
        <SettingsPanel />
      </div>
    </div>
  );
}

function getStatusText(
  gameState: GameState,
  isMyTurn: boolean,
  currentPlayerName?: string,
): string {
  const { phase, pendingAction } = gameState;

  if (phase === 'finished') return '游戏结束';
  if (phase === 'waiting') return '等待开始';

  if (pendingAction?.type === 'multi_vote') return '投票中';
  if (pendingAction?.type === 'chain_action') return '连锁行动';

  // Plan selection phase
  if (pendingAction?.id?.startsWith('plan_')) {
    const selectingPlayer = gameState.players.find(p => p.id === pendingAction.playerId);
    const name = selectingPlayer?.name || '玩家';
    if (pendingAction.playerId === gameState.players[gameState.currentPlayerIndex]?.id && isMyTurn) {
      return '升学选择 — 请选择培养计划';
    }
    return `升学选择 — 等待 ${name} 选择培养计划`;
  }

  if (isMyTurn) return '你的回合 — 请操作';
  if (currentPlayerName) return `等待 ${currentPlayerName} 操作`;

  return '';
}
