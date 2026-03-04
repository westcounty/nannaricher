// client/src/components/GameScreen.tsx
// Three-layout responsive game screen: desktop (>=1024), tablet (768-1023), mobile (<768)
// Integrates StatusIndicator, references VotePanel and ChainActionPanel.

import { useEffect, useState } from 'react';
import { useGameState } from '../context/GameContext';
import { StatusBar } from './StatusBar';
import { PlayerPanel } from './PlayerPanel';
import { CurrentPlayerPanel } from './CurrentPlayerPanel';
import { ChatPanel } from './ChatPanel';
import { GameLog } from './GameLog';
import { GameCanvas } from '../game/GameCanvas';
import { GameEventModal } from './EventModal';
import { ChoiceDialog, pendingActionToChoices, MultiSelectDialog } from './ChoiceDialog';
import { StatusIndicator } from './StatusIndicator';
import { VotePanel } from './VotePanel';
import { ChainActionPanel } from './ChainActionPanel';
import { useChat } from '../hooks/useChat';
import { TutorialSystem } from '../features/tutorial/TutorialSystem';
import type { Player } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';
import './ChatPanel.css';
import '../styles/game.css';
import '../styles/mobile.css';

// ============================================
// Layout Types & Breakpoints
// ============================================

type LayoutMode = 'desktop' | 'tablet' | 'mobile';

const BREAKPOINT_MOBILE = DESIGN_TOKENS.breakpoint.mobile;  // 768
const BREAKPOINT_TABLET = DESIGN_TOKENS.breakpoint.tablet;   // 1024

// Mobile tab definitions
type TabId = 'hand' | 'plans' | 'log' | 'chat';

interface TabDefinition {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDefinition[] = [
  { id: 'hand', label: '手牌', icon: '🃏' },
  { id: 'plans', label: '计划', icon: '📋' },
  { id: 'log', label: '日志', icon: '📜' },
  { id: 'chat', label: '聊天', icon: '💬' },
];

// ============================================
// Layout Detection Hook
// ============================================

function useLayout(): LayoutMode {
  const [layout, setLayout] = useState<LayoutMode>(() => getLayout(window.innerWidth));

  useEffect(() => {
    const handleResize = () => {
      setLayout(getLayout(window.innerWidth));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return layout;
}

function getLayout(width: number): LayoutMode {
  if (width >= BREAKPOINT_TABLET) return 'desktop';
  if (width >= BREAKPOINT_MOBILE) return 'tablet';
  return 'mobile';
}

// ============================================
// GameScreen Component
// ============================================

export function GameScreen() {
  const {
    gameState,
    playerId,
    chooseAction,
    confirmPlan,
    currentEvent,
    announcement,
    winner,
    clearWinner,
  } = useGameState();
  const { messages: chatMessages, sendMessage: sendChatMessage } = useChat();
  const layout = useLayout();

  // Tab state for tablet/mobile
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);

  // Close sheets when switching layout
  useEffect(() => {
    setActiveTab(null);
    setShowSidePanel(false);
  }, [layout]);

  // Loading state
  if (!gameState) {
    return <div className="game-screen loading">Loading game...</div>;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const otherPlayers = gameState.players.filter((p) => p.id !== playerId);
  const myPlayer = gameState.players.find((p) => p.id === playerId);

  // Pending action checks
  const hasPendingAction =
    gameState.pendingAction &&
    (gameState.pendingAction.playerId === playerId ||
      gameState.pendingAction.playerId === 'all');

  const isVoting = gameState.pendingAction?.type === 'multi_vote';
  const isChainAction = gameState.pendingAction?.type === 'chain_action';

  // Tab toggle handler
  const handleTabClick = (tabId: TabId) => {
    setActiveTab((prev) => (prev === tabId ? null : tabId));
  };

  // Close sheet
  const closeSheet = () => setActiveTab(null);

  return (
    <div className={`game-screen layout-${layout}`}>
      {/* Status Bar */}
      <StatusBar
        roomId={gameState.roomId}
        turnNumber={gameState.turnNumber}
        roundNumber={gameState.roundNumber}
        currentPlayerName={currentPlayer?.name}
        phase={gameState.phase}
      />

      {/* Status Indicator (top-center contextual message) */}
      <StatusIndicator
        gameState={gameState}
        playerId={playerId || ''}
        isMyTurn={isMyTurn}
      />

      {/* Main Content Area */}
      <div className="game-main">
        {/* Board Area */}
        <div className="board-area">
          <div className="board-canvas-container">
            <GameCanvas
              gameState={gameState}
              currentPlayerId={currentPlayer?.id || null}
              onCellClick={(cellId, position) => {
                console.log('Cell clicked:', cellId, position);
              }}
            />
          </div>
        </div>

        {/* Desktop: Side Panel (always visible) */}
        {layout === 'desktop' && (
          <div className="side-panel">
            <div className="other-players">
              {otherPlayers.map((player) => (
                <PlayerPanel
                  key={player.id}
                  player={player}
                  isCurrentTurn={player.id === currentPlayer?.id}
                />
              ))}
            </div>
            <CurrentPlayerPanel player={myPlayer} isMyTurn={isMyTurn} />
          </div>
        )}

        {/* Tablet: Collapsible Side Panel (overlay) */}
        {layout === 'tablet' && (
          <>
            <div
              className={`side-panel-backdrop ${showSidePanel ? 'side-panel-backdrop--visible' : ''}`}
              onClick={() => setShowSidePanel(false)}
            />
            <div className={`side-panel ${showSidePanel ? 'side-panel--open' : ''}`}>
              <div className="other-players">
                {otherPlayers.map((player) => (
                  <PlayerPanel
                    key={player.id}
                    player={player}
                    isCurrentTurn={player.id === currentPlayer?.id}
                  />
                ))}
              </div>
              <CurrentPlayerPanel player={myPlayer} isMyTurn={isMyTurn} />
            </div>
          </>
        )}
      </div>

      {/* Desktop: Bottom Bar */}
      {layout === 'desktop' && (
        <div className="bottom-bar">
          <div className="bottom-section hand-section">
            <span className="section-title">手牌</span>
            <div className="hand-cards">
              {myPlayer?.heldCards?.map((card) => (
                <div key={card.id} className="hand-card" title={card.description}>
                  {card.name}
                </div>
              )) || <span className="empty-hand">无手牌</span>}
            </div>
          </div>

          <div className="bottom-section chat-section">
            <ChatPanel messages={chatMessages} onSend={sendChatMessage} />
          </div>

          <div className="bottom-section log-section">
            <GameLog entries={gameState.log} players={gameState.players} />
          </div>
        </div>
      )}

      {/* Tablet: Tab Bar + Sheet Panels */}
      {layout === 'tablet' && (
        <>
          {/* Sheet backdrop */}
          <div
            className={`mobile-sheet-backdrop ${activeTab ? 'mobile-sheet-backdrop--visible' : ''}`}
            onClick={closeSheet}
          />

          {/* Tab content sheet */}
          <div className={`tab-content-sheet ${activeTab ? 'tab-content-sheet--open' : ''}`}>
            <div className="sheet-drag-handle" />
            <TabSheetContent
              activeTab={activeTab}
              myPlayer={myPlayer}
              gameState={gameState}
              chatMessages={chatMessages}
              sendChatMessage={sendChatMessage}
              otherPlayers={otherPlayers}
              currentPlayer={currentPlayer}
              isMyTurn={isMyTurn}
              onClose={closeSheet}
            />
          </div>

          {/* Tab bar */}
          <div className="tablet-tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`tab-item ${activeTab === tab.id ? 'tab-item--active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
                {tab.id === 'hand' && myPlayer?.heldCards && myPlayer.heldCards.length > 0 && (
                  <span className="tab-badge" />
                )}
              </button>
            ))}
            <button
              className="tab-item"
              onClick={() => setShowSidePanel((prev) => !prev)}
            >
              <span className="tab-icon">👥</span>
              <span className="tab-label">玩家</span>
            </button>
          </div>
        </>
      )}

      {/* Mobile: Tab Bar + Sheet Panels */}
      {layout === 'mobile' && (
        <>
          {/* Sheet backdrop */}
          <div
            className={`mobile-sheet-backdrop ${activeTab ? 'mobile-sheet-backdrop--visible' : ''}`}
            onClick={closeSheet}
          />

          {/* Mobile sheet */}
          <div className={`mobile-sheet ${activeTab ? 'mobile-sheet--open' : ''}`}>
            <div className="mobile-sheet-header">
              <h3 className="mobile-sheet-title">
                {activeTab ? TABS.find((t) => t.id === activeTab)?.label || '' : ''}
              </h3>
              <button className="mobile-sheet-close" onClick={closeSheet}>
                ✕
              </button>
            </div>
            <div className="mobile-sheet-body">
              <TabSheetContent
                activeTab={activeTab}
                myPlayer={myPlayer}
                gameState={gameState}
                chatMessages={chatMessages}
                sendChatMessage={sendChatMessage}
                otherPlayers={otherPlayers}
                currentPlayer={currentPlayer}
                isMyTurn={isMyTurn}
                onClose={closeSheet}
              />
            </div>
          </div>

          {/* Mobile tab bar */}
          <div className="mobile-tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`tab-item ${activeTab === tab.id ? 'tab-item--active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
                {tab.id === 'hand' && myPlayer?.heldCards && myPlayer.heldCards.length > 0 && (
                  <span className="tab-badge" />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ============================================
         MODALS & OVERLAYS (all layouts)
         ============================================ */}

      {/* Vote Panel */}
      {isVoting && gameState.pendingAction && playerId && (
        <VotePanel
          pendingAction={gameState.pendingAction}
          players={gameState.players}
          playerId={playerId}
          onVote={(actionId, choice) => chooseAction(actionId, choice)}
        />
      )}

      {/* Chain Action Panel */}
      {isChainAction && gameState.pendingAction && playerId && (
        <ChainActionPanel
          pendingAction={gameState.pendingAction}
          players={gameState.players}
          playerId={playerId}
          onAction={(actionId, choice) => chooseAction(actionId, choice)}
        />
      )}

      {/* Event Modal */}
      {currentEvent && <GameEventModal />}

      {/* Choice Dialog (standard choices, not vote/chain) */}
      {hasPendingAction &&
        !isVoting &&
        !isChainAction &&
        gameState.pendingAction?.options &&
        gameState.pendingAction.options.length > 0 && (
          <ChoiceDialog
            title={pendingActionToChoices(gameState.pendingAction).title}
            prompt={gameState.pendingAction.prompt}
            options={pendingActionToChoices(gameState.pendingAction).options}
            onSelect={(choice) => {
              if (gameState.pendingAction) {
                chooseAction(gameState.pendingAction.id, choice);
              }
            }}
            timeout={gameState.pendingAction.timeoutMs}
          />
        )}

      {/* Training Plan Multi-Select Dialog */}
      {gameState?.phase === 'setup_plans' &&
        myPlayer &&
        myPlayer.trainingPlans.length > 0 && (
          <MultiSelectDialog
            title="选择培养计划"
            prompt={`${myPlayer.name}，请选择1-2项培养计划确认（已确认 ${myPlayer.confirmedPlans.length}/2）`}
            options={myPlayer.trainingPlans.map((plan) => ({
              label: plan.name,
              value: plan.id,
              description: `胜利条件: ${plan.winCondition}`,
              selected: myPlayer.confirmedPlans.includes(plan.id),
            }))}
            minSelections={1}
            maxSelections={2}
            onConfirm={(selectedIds) => {
              selectedIds.forEach((planId) => {
                if (!myPlayer.confirmedPlans.includes(planId)) {
                  confirmPlan(planId);
                }
              });
            }}
            timeout={120000}
          />
        )}

      {/* Announcement Toast */}
      {announcement && (
        <div className={`announcement-toast ${announcement.type}`}>
          {announcement.message}
        </div>
      )}

      {/* Winner Modal */}
      {winner && (
        <div className="winner-modal-overlay" onClick={clearWinner}>
          <div className="winner-modal" onClick={(e) => e.stopPropagation()}>
            <h1 className="winner-title">🎉 游戏结束 🎉</h1>
            <div className="winner-info">
              <div className="winner-name">{winner.playerName}</div>
              <div className="winner-condition">{winner.condition}</div>
            </div>
            <button className="winner-close-btn" onClick={clearWinner}>
              确定
            </button>
          </div>
        </div>
      )}

      {/* Tutorial System */}
      <TutorialSystem />
    </div>
  );
}

// ============================================
// TabSheetContent — shared between tablet/mobile
// ============================================

interface TabSheetContentProps {
  activeTab: TabId | null;
  myPlayer: Player | undefined;
  gameState: NonNullable<ReturnType<typeof useGameState>['gameState']>;
  chatMessages: Array<{ id: string; playerName: string; playerColor: string; text: string; timestamp: number }>;
  sendChatMessage: (message: string) => void;
  otherPlayers: Player[];
  currentPlayer: Player | undefined;
  isMyTurn: boolean;
  onClose: () => void;
}

function TabSheetContent({
  activeTab,
  myPlayer,
  gameState,
  chatMessages,
  sendChatMessage,
  otherPlayers,
  currentPlayer,
  isMyTurn,
  onClose: _onClose,
}: TabSheetContentProps) {
  switch (activeTab) {
    case 'hand':
      return (
        <div className="mobile-hand-cards">
          {myPlayer?.heldCards && myPlayer.heldCards.length > 0 ? (
            myPlayer.heldCards.map((card) => (
              <div key={card.id} className="mobile-hand-card" title={card.description}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{card.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {card.description}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '12px' }}>
              无手牌
            </div>
          )}
        </div>
      );

    case 'plans':
      return (
        <div className="mobile-players-list">
          {myPlayer && (
            <CurrentPlayerPanel player={myPlayer} isMyTurn={isMyTurn} />
          )}
          {otherPlayers.map((player) => (
            <PlayerPanel
              key={player.id}
              player={player}
              isCurrentTurn={player.id === currentPlayer?.id}
            />
          ))}
        </div>
      );

    case 'log':
      return <GameLog entries={gameState.log} players={gameState.players} />;

    case 'chat':
      return <ChatPanel messages={chatMessages} onSend={sendChatMessage} />;

    default:
      return null;
  }
}
