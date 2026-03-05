// client/src/components/GameScreen.tsx
// Three-layout responsive game screen: desktop (>=1024), tablet (768-1023), mobile (<768)
// Redesigned with CompactHeader, ActionBar, CompactPlayerCard, MobileStatusBar, MobileBottomNav

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { CompactHeader } from './CompactHeader';
import { CompactPlayerCard } from './CompactPlayerCard';
import { ActionBar } from './ActionBar';
import { MobileStatusBar } from './MobileStatusBar';
import { MobileBottomNav } from './MobileBottomNav';
import { ChatPanel } from './ChatPanel';
import { GameLog } from './GameLog';
import { GameCanvas } from '../game/GameCanvas';
import { GameEventModal } from './EventModal';
import { ChoiceDialog, pendingActionToChoices, MultiSelectDialog } from './ChoiceDialog';
import { VotePanel } from './VotePanel';
import { ChainActionPanel } from './ChainActionPanel';
import { DiceRoller } from './DiceRoller';
import { TrainingPlanView } from './TrainingPlanView';
import { useChat } from '../hooks/useChat';
import { useLayout } from '../hooks/useLayout';
import { TutorialSystem } from '../features/tutorial/TutorialSystem';
import { LoadingScreen } from './LoadingScreen';
import { MobileSheetContent } from './MobileSheetContent';
import { MiniPlayerOverlay } from './MiniPlayerOverlay';
import { ActionPromptBar } from './ActionPromptBar';
import { TurnOverlay } from './TurnOverlay';
import { MissedEventsPanel } from './MissedEventsPanel';
import { ZoomHint } from './ZoomHint';
import { SettlementScreen } from './SettlementScreen';
import { OpponentToast } from './OpponentToast';
import { playSound } from '../audio/AudioManager';
import type { CellHoverInfo } from '../game/layers/StationLayer';
import { CellTooltip } from './CellTooltip';
import type { BoardCell, BoardLine } from '@nannaricher/shared';
import { getPlayerPlanIds } from '@nannaricher/shared';
import { boardData } from '../data/board';
import './ChatPanel.css';
import '../styles/game.css';
import '../styles/mobile.css';
import '../styles/training-plan.css';

// Mobile panel definitions
type PanelId = 'hand' | 'players' | 'more';

// Sidebar tab for desktop
type SidebarTab = 'chat' | 'log';

// ============================================
// GameScreen Component
// ============================================

export function GameScreen() {
  const gameState = useGameStore((s) => s.gameState);
  const playerId = useGameStore((s) => s.playerId);
  const currentEvent = useGameStore((s) => s.currentEvent);
  const announcement = useGameStore((s) => s.announcement);
  const winner = useGameStore((s) => s.winner);
  const isRolling = useGameStore((s) => s.isRolling);
  const diceResult = useGameStore((s) => s.diceResult);
  const socketActions = useGameStore((s) => s.socketActions);

  const chooseAction = socketActions?.chooseAction ?? (() => {});
  const confirmPlan = socketActions?.confirmPlan ?? (() => {});
  const useCard = socketActions?.useCard ?? (() => {});
  const rollDice = socketActions?.rollDice ?? (() => {});
  const { messages: chatMessages, sendMessage: sendChatMessage } = useChat();
  const layout = useLayout();

  // Mobile/tablet panel state
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  // Desktop sidebar tab
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  // Track if player finished plan selection
  const [planSelectionDone, setPlanSelectionDone] = useState(false);

  // Unread chat tracking
  const lastSeenChatCountRef = useRef(0);
  const hasUnreadChat =
    (layout === 'mobile' || layout === 'tablet') &&
    activePanel !== 'more' &&
    chatMessages.length > lastSeenChatCountRef.current;

  // Dice overlay state — visible to ALL players
  const [showDiceOverlay, setShowDiceOverlay] = useState(false);
  const diceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show overlay when local player starts rolling
  useEffect(() => {
    if (isRolling) {
      setShowDiceOverlay(true);
    }
  }, [isRolling]);

  // Show overlay when ANY player's dice result arrives, hold for 4s
  useEffect(() => {
    if (diceResult) {
      setShowDiceOverlay(true);
      if (diceTimerRef.current) clearTimeout(diceTimerRef.current);
      diceTimerRef.current = setTimeout(() => {
        setShowDiceOverlay(false);
      }, 4000);
    }
    return () => {
      if (diceTimerRef.current) {
        clearTimeout(diceTimerRef.current);
        diceTimerRef.current = null;
      }
    };
  }, [diceResult]);

  // Close panels when switching layout
  useEffect(() => {
    setActivePanel(null);
  }, [layout]);

  // Loading state
  if (!gameState) {
    return <LoadingScreen type="waiting" />;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const allPlayers = gameState.players;
  // Note: otherPlayers can be derived from allPlayers.filter(p => p.id !== playerId) if needed
  const myPlayer = allPlayers.find((p) => p.id === playerId);

  // Pending action checks
  const hasPendingAction =
    gameState.pendingAction &&
    (gameState.pendingAction.playerId === playerId ||
      gameState.pendingAction.playerId === 'all');

  const isVoting = gameState.pendingAction?.type === 'multi_vote';
  const isChainAction = gameState.pendingAction?.type === 'chain_action';

  // Can roll dice check
  const canRollDice = isMyTurn &&
    myPlayer != null &&
    !myPlayer.isBankrupt &&
    !isRolling &&
    gameState.phase === 'playing' &&
    (!gameState.pendingAction || gameState.pendingAction.type === 'roll_dice');

  const needsToRoll = myPlayer && (myPlayer.isInHospital || myPlayer.isAtDing);

  // Cell hover state for tooltip
  const [hoveredCell, setHoveredCell] = useState<{ cell: BoardCell; lineData?: BoardLine | null; x: number; y: number } | null>(null);

  const handleCellHover = (info: CellHoverInfo | null) => {
    if (!info) {
      setHoveredCell(null);
      return;
    }
    const { position, screenX, screenY } = info;
    if (position.type === 'main') {
      const cell = boardData.mainBoard[position.index];
      if (cell) {
        const lineData = cell.lineId ? boardData.lines[cell.lineId] ?? null : null;
        setHoveredCell({ cell: cell as BoardCell, lineData, x: screenX, y: screenY });
      }
    } else {
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

  // Mobile panel toggle
  const handlePanelToggle = (panelId: PanelId) => {
    playSound('tab_switch');
    if (panelId === 'more') {
      lastSeenChatCountRef.current = chatMessages.length;
    }
    setActivePanel((prev) => (prev === panelId ? null : panelId));
  };

  const closePanel = () => setActivePanel(null);

  const handleMobileRollDice = () => {
    if (canRollDice || (isMyTurn && needsToRoll)) {
      playSound('button_click');
      rollDice();
    }
  };

  return (
    <div className={`game-screen layout-${layout}`}>
      {/* ============ HEADER ============ */}
      <CompactHeader
        gameState={gameState}
        playerId={playerId}
        isMyTurn={isMyTurn}
        currentPlayerName={currentPlayer?.name}
      />

      {/* ============ DESKTOP LAYOUT ============ */}
      {layout === 'desktop' && (
        <>
          <div className="game-main layout-desktop">
            {/* Board area */}
            <div className="board-area">
              <div className="board-canvas-container">
                <GameCanvas
                  gameState={gameState}
                  currentPlayerId={currentPlayer?.id || null}
                  onCellClick={() => {}}
                  onCellHover={handleCellHover}
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="game-sidebar">
              {/* Player cards */}
              <div className="game-sidebar__section">
                {allPlayers.map((player) => (
                  <CompactPlayerCard
                    key={player.id}
                    player={player}
                    isCurrentTurn={player.id === currentPlayer?.id}
                    isLocalPlayer={player.id === playerId}
                  />
                ))}
              </div>

              {/* Training Plan */}
              {myPlayer && myPlayer.trainingPlans.length > 0 && (
                <div className="game-sidebar__section">
                  <TrainingPlanView
                    player={myPlayer}
                    turnNumber={gameState.turnNumber}
                    isCurrentPlayer={isMyTurn}
                  />
                </div>
              )}

              {/* Chat/Log tabs */}
              <div className="game-sidebar__section" style={{ flex: 1, minHeight: 0 }}>
                <div className="game-sidebar__tabs">
                  <button
                    className={`game-sidebar__tab ${sidebarTab === 'chat' ? 'game-sidebar__tab--active' : ''}`}
                    onClick={() => setSidebarTab('chat')}
                  >
                    💬 聊天
                  </button>
                  <button
                    className={`game-sidebar__tab ${sidebarTab === 'log' ? 'game-sidebar__tab--active' : ''}`}
                    onClick={() => setSidebarTab('log')}
                  >
                    📜 日志
                  </button>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  {sidebarTab === 'chat' ? (
                    <ChatPanel messages={chatMessages} onSend={sendChatMessage} />
                  ) : (
                    <GameLog entries={gameState.log} players={gameState.players} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Prompt Bar (above action bar) */}
          <ActionPromptBar
            gameState={gameState}
            playerId={playerId}
            isMyTurn={isMyTurn}
            canRollDice={canRollDice || (isMyTurn && !!needsToRoll)}
            currentPlayerName={currentPlayer?.name}
          />

          {/* Action Bar (bottom) */}
          <ActionBar
            myPlayer={myPlayer}
            isMyTurn={isMyTurn}
            currentPlayerName={currentPlayer?.name}
            useCard={useCard}
            players={allPlayers}
            canRollDice={canRollDice || (isMyTurn && !!needsToRoll)}
            isRolling={isRolling}
            onRollDice={rollDice}
          />
        </>
      )}

      {/* ============ TABLET / MOBILE LAYOUT ============ */}
      {(layout === 'tablet' || layout === 'mobile') && (
        <>
          {/* Board area */}
          <div className="board-area" style={{ position: 'relative' }}>
            <div className="board-canvas-container">
              <GameCanvas
                gameState={gameState}
                currentPlayerId={currentPlayer?.id || null}
                onCellClick={() => {}}
                onCellHover={handleCellHover}
              />
            </div>
            <MiniPlayerOverlay
              players={allPlayers}
              currentPlayerId={currentPlayer?.id || null}
              localPlayerId={playerId}
            />
            <ZoomHint />
          </div>

          {/* Action Prompt Bar (above mobile status bar) */}
          <ActionPromptBar
            gameState={gameState}
            playerId={playerId}
            isMyTurn={isMyTurn}
            canRollDice={canRollDice || (isMyTurn && !!needsToRoll)}
            currentPlayerName={currentPlayer?.name}
          />

          {/* Mobile status bar */}
          <MobileStatusBar player={myPlayer} />

          {/* Sheet backdrop */}
          <div
            className={`mobile-sheet-backdrop ${activePanel ? 'mobile-sheet-backdrop--visible' : ''}`}
            onClick={closePanel}
          />

          {/* Bottom sheet for panels */}
          <div className={`mobile-sheet ${activePanel ? 'mobile-sheet--open' : ''}`}>
            <div className="mobile-sheet-header">
              <h3 className="mobile-sheet-title">
                {activePanel === 'hand' ? '手牌' : activePanel === 'players' ? '玩家' : '更多'}
              </h3>
              <button className="mobile-sheet-close" onClick={closePanel}>
                ✕
              </button>
            </div>
            <div className="mobile-sheet-body">
              <MobileSheetContent
                activePanel={activePanel}
                myPlayer={myPlayer}
                gameState={gameState}
                chatMessages={chatMessages}
                sendChatMessage={sendChatMessage}
                allPlayers={allPlayers}
                currentPlayer={currentPlayer}
                playerId={playerId}
                isMyTurn={isMyTurn}
                useCard={useCard}
              />
            </div>
          </div>

          {/* Mobile Bottom Nav */}
          <MobileBottomNav
            isMyTurn={isMyTurn}
            isRolling={isRolling}
            canRollDice={canRollDice || (isMyTurn && !!needsToRoll)}
            cardCount={myPlayer?.heldCards.length || 0}
            isBankrupt={myPlayer?.isBankrupt}
            onRollDice={handleMobileRollDice}
            onOpenCards={() => handlePanelToggle('hand')}
            onOpenPlayers={() => handlePanelToggle('players')}
            onOpenMore={() => handlePanelToggle('more')}
            activePanel={activePanel}
            hasUnreadChat={hasUnreadChat}
          />
        </>
      )}

      {/* ============================================
         MODALS & OVERLAYS (all layouts)
         ============================================ */}

      {/* Turn Overlay */}
      <TurnOverlay isMyTurn={isMyTurn} />

      {/* Dice Roller Overlay — visible to ALL players */}
      {showDiceOverlay && (() => {
        const rollingPlayer = diceResult
          ? allPlayers.find(p => p.id === diceResult.playerId)
          : null;
        const diceCount = diceResult
          ? (diceResult.values.length as 1 | 2)
          : (myPlayer?.diceCount === 2 ? 2 : 1);
        return (
          <div className="dice-overlay">
            <DiceRoller
              count={diceCount}
              values={diceResult?.values ?? null}
              playerName={rollingPlayer?.name}
            />
          </div>
        );
      })()}

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

      {/* Multi-Select Choice Dialog (e.g. plan redraw) */}
      {hasPendingAction &&
        !isVoting &&
        !isChainAction &&
        !currentEvent &&
        gameState.pendingAction?.options &&
        gameState.pendingAction.options.length > 0 &&
        (gameState.pendingAction.maxSelections ?? 1) > 1 && (
          <MultiSelectDialog
            title="选择培养计划"
            prompt={gameState.pendingAction.prompt}
            options={gameState.pendingAction.options.map(opt => ({
              label: opt.label,
              value: opt.value,
              description: opt.description,
            }))}
            minSelections={gameState.pendingAction.minSelections ?? 0}
            maxSelections={gameState.pendingAction.maxSelections!}
            onConfirm={(selectedIds) => {
              if (gameState.pendingAction) {
                const choice = selectedIds.length > 0 ? selectedIds.join(',') : 'skip';
                chooseAction(gameState.pendingAction.id, choice);
              }
            }}
            timeout={gameState.pendingAction.timeoutMs}
          />
        )}

      {/* Choice Dialog (single select) */}
      {hasPendingAction &&
        !isVoting &&
        !isChainAction &&
        !currentEvent &&
        gameState.pendingAction?.options &&
        gameState.pendingAction.options.length > 0 &&
        (gameState.pendingAction.maxSelections ?? 1) <= 1 && (
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
        getPlayerPlanIds(myPlayer).length < 2 &&
        !planSelectionDone && (
          <MultiSelectDialog
            key={`plan-select-${getPlayerPlanIds(myPlayer).length}`}
            title="选择培养计划"
            prompt={`${myPlayer.name}，请选择${getPlayerPlanIds(myPlayer).length === 0 ? '1-2' : '0-1'}项培养计划确认（已确认 ${getPlayerPlanIds(myPlayer).length}/2）`}
            options={myPlayer.trainingPlans
              .filter((plan) => !getPlayerPlanIds(myPlayer).includes(plan.id))
              .map((plan) => ({
                label: plan.name,
                value: plan.id,
                description: [
                  `胜利条件: ${plan.winCondition}`,
                  plan.passiveAbility ? `被动能力: ${plan.passiveAbility}` : null,
                ].filter(Boolean).join('\n'),
              }))}
            minSelections={getPlayerPlanIds(myPlayer).length >= 1 ? 0 : 1}
            maxSelections={2 - getPlayerPlanIds(myPlayer).length}
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

      {/* Opponent event toasts */}
      <OpponentToast />

      {/* Settlement Screen (replaces old Winner Modal) */}
      {winner && (
        <SettlementScreen
          winner={winner}
          gameState={gameState}
          playerId={playerId}
          onReturnToLobby={() => {
            useGameStore.getState().resetToLobby();
          }}
        />
      )}

      {/* Missed Events Panel */}
      <MissedEventsPanel />

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
