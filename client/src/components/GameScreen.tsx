// client/src/components/GameScreen.tsx
// Three-layout responsive game screen: desktop (>=1024), tablet (768-1023), mobile (<768)
// Integrates StatusIndicator, references VotePanel and ChainActionPanel.

import { useEffect, useRef, useState } from 'react';
import { useGameState } from '../context/GameContext';
import { StatusBar } from './StatusBar';
import { PlayerPanel } from './PlayerPanel';
import { CurrentPlayerPanel } from './CurrentPlayerPanel';
import { ChatPanel } from './ChatPanel';
import { GameLog } from './GameLog';
import { GameCanvas } from '../game/GameCanvas';
import type { CellHoverInfo } from '../game/layers/StationLayer';
import { CellTooltip } from './CellTooltip';
import { GameEventModal } from './EventModal';
import { ChoiceDialog, pendingActionToChoices, MultiSelectDialog } from './ChoiceDialog';
import { StatusIndicator } from './StatusIndicator';
import { VotePanel } from './VotePanel';
import { ChainActionPanel } from './ChainActionPanel';
import { DiceRoller } from './DiceRoller';
import { CardHand } from './CardHand';
import { useChat } from '../hooks/useChat';
import { TutorialSystem } from '../features/tutorial/TutorialSystem';
import type { Player, BoardCell, BoardLine } from '@nannaricher/shared';
import { boardData } from '../data/board';
import { MAIN_BOARD_CELLS } from '@nannaricher/shared';
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
    useCard,
    currentEvent,
    announcement,
    winner,
    clearWinner,
    isRolling,
    diceResult,
  } = useGameState();
  const { messages: chatMessages, sendMessage: sendChatMessage } = useChat();
  const layout = useLayout();

  // Tab state for tablet/mobile
  const [activeTab, setActiveTab] = useState<TabId | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  // Track if player finished plan selection (chose to skip additional plans)
  const [planSelectionDone, setPlanSelectionDone] = useState(false);

  // Tooltip hover state
  const [hoveredCell, setHoveredCell] = useState<{ cell: BoardCell; lineData?: BoardLine | null; x: number; y: number } | null>(null);

  // Dice overlay state
  const [showDiceOverlay, setShowDiceOverlay] = useState(false);
  const diceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show dice overlay when rolling starts, hide 2.5s after result arrives
  useEffect(() => {
    if (isRolling) {
      setShowDiceOverlay(true);
    }
  }, [isRolling]);

  useEffect(() => {
    if (diceResult) {
      diceTimerRef.current = setTimeout(() => {
        setShowDiceOverlay(false);
      }, 2500);
    }
    return () => {
      if (diceTimerRef.current) {
        clearTimeout(diceTimerRef.current);
        diceTimerRef.current = null;
      }
    };
  }, [diceResult]);

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

  // Cell hover handler for tooltip
  const handleCellHover = (info: CellHoverInfo | null) => {
    if (!info) {
      setHoveredCell(null);
      return;
    }
    const { cellId, position, screenX, screenY } = info;
    if (position.type === 'main') {
      const cell = boardData.mainBoard[position.index];
      if (cell) {
        const lineData = cell.lineId ? boardData.lines[cell.lineId] ?? null : null;
        setHoveredCell({ cell: cell as BoardCell, lineData, x: screenX, y: screenY });
      }
    } else {
      // Branch line station — build a synthetic BoardCell for the tooltip
      const lineData = boardData.lines[position.lineId];
      if (lineData) {
        const isExperience = position.index === lineData.cells.length;
        const lineCell = isExperience ? lineData.experienceCard : lineData.cells[position.index];
        if (lineCell) {
          const syntheticCell: BoardCell = {
            index: position.index,
            id: lineCell.id,
            name: lineCell.name,
            type: 'line_entry' as BoardCell['type'],
          };
          setHoveredCell({ cell: syntheticCell, lineData, x: screenX, y: screenY });
        }
      }
    }
  };

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
        {/* Desktop: Left column (board + log) */}
        {layout === 'desktop' ? (
          <div className="left-column">
            <div className="board-area">
              <div className="board-canvas-container">
                <GameCanvas
                  gameState={gameState}
                  currentPlayerId={currentPlayer?.id || null}
                  diceResult={diceResult}
                  onCellClick={(cellId, position) => {
                    console.log('Cell clicked:', cellId, position);
                  }}
                  onCellHover={handleCellHover}
                />
              </div>
            </div>
            <div className="desktop-log-area">
              <GameLog entries={gameState.log} players={gameState.players} />
            </div>
          </div>
        ) : (
          <div className="board-area">
            <div className="board-canvas-container">
              <GameCanvas
                gameState={gameState}
                currentPlayerId={currentPlayer?.id || null}
                diceResult={diceResult}
                onCellClick={(cellId, position) => {
                  console.log('Cell clicked:', cellId, position);
                }}
              />
            </div>
          </div>
        )}

        {/* Desktop: Side Panel (players + hand + chat) */}
        {layout === 'desktop' && (
          <div className="side-panel">
            <CurrentPlayerPanel player={myPlayer} isMyTurn={isMyTurn} />
            <div className="other-players">
              {otherPlayers.map((player) => (
                <PlayerPanel
                  key={player.id}
                  player={player}
                  isCurrentTurn={player.id === currentPlayer?.id}
                />
              ))}
            </div>
            {myPlayer && (
              <CardHand
                player={myPlayer}
                onUseCard={useCard}
                isCurrentPlayer={isMyTurn}
                players={gameState?.players}
              />
            )}
            <div className="side-panel-section">
              <ChatPanel messages={chatMessages} onSend={sendChatMessage} />
            </div>
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
              useCard={useCard}
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
                useCard={useCard}
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

      {/* Dice Roller Overlay */}
      {showDiceOverlay && (
        <div className="dice-overlay">
          <DiceRoller
            count={myPlayer?.diceCount === 2 ? 2 : 1}
            autoRoll={true}
          />
        </div>
      )}

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

      {/* Choice Dialog (standard choices, not vote/chain, not when event modal is showing) */}
      {hasPendingAction &&
        !isVoting &&
        !isChainAction &&
        !currentEvent &&
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
        myPlayer.trainingPlans.length > 0 &&
        myPlayer.confirmedPlans.length < 2 &&
        !planSelectionDone && (
          <MultiSelectDialog
            key={`plan-select-${myPlayer.confirmedPlans.length}`}
            title="选择培养计划"
            prompt={`${myPlayer.name}，请选择${myPlayer.confirmedPlans.length === 0 ? '1-2' : '0-1'}项培养计划确认（已确认 ${myPlayer.confirmedPlans.length}/2）`}
            options={myPlayer.trainingPlans
              .filter((plan) => !myPlayer.confirmedPlans.includes(plan.id))
              .map((plan) => ({
                label: plan.name,
                value: plan.id,
                description: `胜利条件: ${plan.winCondition}${plan.passiveAbility ? `\n特殊能力: ${plan.passiveAbility}` : ''}`,
              }))}
            minSelections={myPlayer.confirmedPlans.length >= 1 ? 0 : 1}
            maxSelections={2 - myPlayer.confirmedPlans.length}
            onConfirm={(selectedIds) => {
              if (selectedIds.length === 0) {
                setPlanSelectionDone(true);
              } else {
                selectedIds.forEach((planId) => {
                  confirmPlan(planId);
                });
              }
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

      {/* Cell Tooltip */}
      <CellTooltip
        cell={hoveredCell?.cell ?? null}
        lineData={hoveredCell?.lineData}
        position={{ x: hoveredCell?.x ?? 0, y: hoveredCell?.y ?? 0 }}
        visible={!!hoveredCell}
      />

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
  useCard: (cardId: string, targetPlayerId?: string) => void;
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
  useCard: onUseCard,
  onClose: _onClose,
}: TabSheetContentProps) {
  switch (activeTab) {
    case 'hand':
      return myPlayer ? (
        <CardHand
          player={myPlayer}
          onUseCard={onUseCard}
          isCurrentPlayer={isMyTurn}
          players={gameState?.players}
        />
      ) : null;

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
