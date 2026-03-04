// client/src/components/MorePanel.tsx
// Tabbed chat/log panel for mobile and tablet layouts

import { useState } from 'react';
import { ChatPanel } from './ChatPanel';
import { GameLog } from './GameLog';
import type { useGameStore } from '../stores/gameStore';

export type MoreTab = 'chat' | 'log';

export interface MorePanelProps {
  chatMessages: Array<{ id: string; playerName: string; playerColor: string; text: string; timestamp: number }>;
  sendChatMessage: (message: string) => void;
  gameState: NonNullable<ReturnType<typeof useGameStore.getState>['gameState']>;
}

export function MorePanel({
  chatMessages,
  sendChatMessage,
  gameState,
}: MorePanelProps) {
  const [tab, setTab] = useState<MoreTab>('chat');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="more-panel-tabs">
        <button
          className={`more-panel-tab ${tab === 'chat' ? 'more-panel-tab--active' : ''}`}
          onClick={() => setTab('chat')}
        >
          💬 聊天
        </button>
        <button
          className={`more-panel-tab ${tab === 'log' ? 'more-panel-tab--active' : ''}`}
          onClick={() => setTab('log')}
        >
          📜 日志
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {tab === 'chat' ? (
          <ChatPanel messages={chatMessages} onSend={sendChatMessage} />
        ) : (
          <GameLog entries={gameState.log} players={gameState.players} />
        )}
      </div>
    </div>
  );
}
