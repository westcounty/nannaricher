// client/src/components/StatusBar.tsx
import React from 'react';
import type { GamePhase } from '@nannaricher/shared';

interface StatusBarProps {
  roomId: string;
  turnNumber: number;
  roundNumber: number;
  currentPlayerName: string | undefined;
  phase: GamePhase;
}

const phaseLabels: Record<GamePhase, string> = {
  waiting: '等待中',
  setup_plans: '选择培养计划',
  playing: '游戏中',
  finished: '已结束',
};

export function StatusBar({ roomId, turnNumber, roundNumber, currentPlayerName, phase }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className="status-label">房间号</span>
        <span className="status-value room-id">{roomId}</span>
      </div>
      <div className="status-item">
        <span className="status-label">回合</span>
        <span className="status-value">{turnNumber} <span className="round-info">· 第{roundNumber}轮</span></span>
      </div>
      <div className="status-item">
        <span className="status-label">当前玩家</span>
        <span className="status-value current-player">{currentPlayerName || '-'}</span>
      </div>
      <div className="status-item">
        <span className="status-label">阶段</span>
        <span className={`status-value phase-${phase}`}>{phaseLabels[phase]}</span>
      </div>
    </div>
  );
}
