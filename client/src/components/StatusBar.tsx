// client/src/components/StatusBar.tsx
import { getRoundName } from '@nannaricher/shared';
import type { GamePhase } from '@nannaricher/shared';
import { AudioControl } from './AudioControl';

interface StatusBarProps {
  roomId: string;
  turnNumber: number;
  roundNumber: number;
  currentPlayerName: string | undefined;
  phase: GamePhase;
}

const phaseLabels: Record<GamePhase, string> = {
  waiting: '等待中',
  playing: '游戏中',
  finished: '已结束',
  rolling_dice: '掷骰子',
  moving: '移动中',
  event_popup: '事件弹窗',
  making_choice: '做选择',
  waiting_others: '等待他人',
  multi_interaction: '多人互动',
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
        <span className="status-value">{turnNumber} <span className="round-info">· {getRoundName(roundNumber)}</span></span>
      </div>
      <div className="status-item">
        <span className="status-label">当前玩家</span>
        <span className="status-value current-player">{currentPlayerName || '-'}</span>
      </div>
      <div className="status-item">
        <span className="status-label">阶段</span>
        <span className={`status-value phase-${phase}`}>{phaseLabels[phase]}</span>
      </div>
      <div className="status-item" style={{ marginLeft: 'auto' }}>
        <AudioControl />
      </div>
    </div>
  );
}
