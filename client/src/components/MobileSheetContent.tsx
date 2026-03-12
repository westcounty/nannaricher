// client/src/components/MobileSheetContent.tsx
// Content renderer for the mobile/tablet bottom sheet panels

import { CompactPlayerCard } from './CompactPlayerCard';
import { CardHand } from './CardHand';
import { TrainingPlanView } from './TrainingPlanView';
import { MorePanel } from './MorePanel';
import { ChatPanel } from './ChatPanel';
import { GameLog } from './GameLog';
import type { Player } from '@nannaricher/shared';
import type { useGameStore } from '../stores/gameStore';

type PanelId = 'hand' | 'players' | 'more' | 'chat' | 'log';

export interface MobileSheetContentProps {
  activePanel: PanelId | null;
  myPlayer: Player | undefined;
  gameState: NonNullable<ReturnType<typeof useGameStore.getState>['gameState']>;
  chatMessages: Array<{ id: string; playerName: string; playerColor: string; text: string; timestamp: number }>;
  sendChatMessage: (message: string) => void;
  allPlayers: Player[];
  currentPlayer: Player | undefined;
  playerId: string | null;
  isMyTurn: boolean;
  useCard: (cardId: string, targetPlayerId?: string) => void;
  onPlayerClick?: (playerId: string) => void;
  onClose?: () => void;
}

export function MobileSheetContent({
  activePanel,
  myPlayer,
  gameState,
  chatMessages,
  sendChatMessage,
  allPlayers,
  currentPlayer,
  playerId,
  isMyTurn,
  useCard: onUseCard,
  onPlayerClick,
  onClose,
}: MobileSheetContentProps) {
  switch (activePanel) {
    case 'hand':
      return myPlayer ? (
        <div className="action-bar__cards">
          <CardHand
            player={myPlayer}
            onUseCard={onUseCard}
            isCurrentPlayer={isMyTurn}
            players={gameState?.players}
          />
        </div>
      ) : null;

    case 'players':
      return (
        <div className="mobile-players-list">
          {allPlayers.map((player) => (
            <CompactPlayerCard
              key={player.id}
              player={player}
              isCurrentTurn={player.id === currentPlayer?.id}
              isLocalPlayer={player.id === playerId}
              onClick={onPlayerClick}
            />
          ))}
          {/* Training plan in players panel for mobile */}
          {myPlayer && myPlayer.trainingPlans.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <TrainingPlanView
                player={myPlayer}
                turnNumber={gameState.turnNumber}
                isCurrentPlayer={isMyTurn}
              />
            </div>
          )}
        </div>
      );

    case 'more':
      return (
        <MorePanel
          chatMessages={chatMessages}
          sendChatMessage={sendChatMessage}
          gameState={gameState}
          onClose={onClose}
        />
      );

    case 'chat':
      return (
        <ChatPanel messages={chatMessages} onSend={sendChatMessage} alwaysExpanded />
      );

    case 'log':
      return (
        <GameLog entries={gameState.log} players={gameState.players} alwaysExpanded />
      );

    default:
      return null;
  }
}
