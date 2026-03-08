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
import { GameCanvas, type GameCanvasHandle } from '../game/GameCanvas';
import { GameEventModal } from './EventModal';
import { ChoiceDialog, pendingActionToChoices, MultiSelectDialog } from './ChoiceDialog';
import { VotePanel } from './VotePanel';
import { VoteResultModal } from './VoteResultModal';
import { EventDiceOverlay } from './EventDiceOverlay';
import { ChainActionPanel } from './ChainActionPanel';
import { DiceRoller } from './DiceRoller';
import { TrainingPlanView } from './TrainingPlanView';
import { useChat } from '../hooks/useChat';
import { useLayout } from '../hooks/useLayout';
import { TutorialSystem } from '../features/tutorial/TutorialSystem';
import { CardDrawModal } from './CardDrawModal';
import { LoadingScreen } from './LoadingScreen';
import { MobileSheetContent } from './MobileSheetContent';
import { MiniPlayerOverlay } from './MiniPlayerOverlay';
import { ActionPromptBar } from './ActionPromptBar';
import { TurnOverlay } from './TurnOverlay';
import { ZoomHint } from './ZoomHint';
import { SettlementScreen } from './SettlementScreen';
import { NotificationFeed } from './NotificationFeed';
import { EpicEventModal } from './EpicEventModal';
import { playSound } from '../audio/AudioManager';
import type { CellHoverInfo } from '../game/layers/StationLayer';
import { CellTooltip } from './CellTooltip';
import type { BoardCell, BoardLine, Player } from '@nannaricher/shared';
import { getRoundName, LINE_CONFIGS } from '@nannaricher/shared';
// getPlayerPlanIds import removed — plan selection now server-driven
import { boardData } from '../data/board';
import './ChatPanel.css';
import '../styles/game.css';
import '../styles/mobile.css';
import '../styles/training-plan.css';

// Mobile panel definitions
type PanelId = 'hand' | 'players' | 'more';

// Sidebar tab for desktop
type SidebarTab = 'chat' | 'log';

function formatPositionShort(player: Player): string {
  if (player.isInHospital) return '\u533B\u9662';
  if (player.isAtDing) return '\u9F0E';
  const pos = player.position;
  if (pos.type === 'line') {
    const lineConfig = LINE_CONFIGS.find(l => l.id === pos.lineId);
    return lineConfig ? lineConfig.name : pos.lineId;
  }
  return `\u4E3B\u73AF #${pos.index}`;
}

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
  const drawnCard = useGameStore((s) => s.drawnCard);
  const socketActions = useGameStore((s) => s.socketActions);
  const readyPlayerIds = useGameStore((s) => s.readyPlayerIds);

  const chooseAction = socketActions?.chooseAction ?? (() => {});
  // confirmPlan removed — plan selection is now server-driven via pendingAction
  const rawUseCard = socketActions?.useCard ?? (() => {});
  // Wrap useCard to close mobile sheet when card is used (prevents sheet blocking EventModal)
  const useCard = (cardId: string, targetPlayerId?: string) => {
    rawUseCard(cardId, targetPlayerId);
    setActivePanel(null);
  };
  const rollDice = socketActions?.rollDice ?? (() => {});
  const { messages: chatMessages, sendMessage: sendChatMessage } = useChat();
  const layout = useLayout();
  const canvasRef = useRef<GameCanvasHandle>(null);

  // Mobile/tablet panel state
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  // Desktop sidebar tab
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  // Track if player finished plan selection
  // planSelectionDone state removed — plan selection is now server-driven

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
      }, 2000);
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

  // Auto-dismiss tooltip after 2s on touch devices to prevent accidental trigger on mobile
  useEffect(() => {
    if (!hoveredCell) return;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;
    const timer = setTimeout(() => setHoveredCell(null), 2000);
    return () => clearTimeout(timer);
  }, [hoveredCell]);

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

  // Focus viewport on a specific player's position
  const handlePlayerCardClick = (targetPlayerId: string) => {
    canvasRef.current?.focusOnPlayer(targetPlayerId);
  };

  // Reset viewport to default zoom centered on local player
  const handleResetViewport = () => {
    canvasRef.current?.focusOnSelf();
  };

  // Detect if any modal/overlay is active (to disable canvas interactions)
  const hasModalOverlay = !!(
    currentEvent ||
    drawnCard ||
    (hasPendingAction && !isVoting && !isChainAction && gameState.pendingAction?.options?.length) ||
    isVoting ||
    isChainAction ||
    winner
  );

  // Disable canvas interactions when modals are open
  useEffect(() => {
    canvasRef.current?.setInteractionEnabled(!hasModalOverlay);
  }, [hasModalOverlay]);

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
            <div className="board-area" style={{ position: 'relative' }}>
              <div className="board-canvas-container">
                <GameCanvas
                  ref={canvasRef}
                  gameState={gameState}
                  currentPlayerId={currentPlayer?.id || null}
                  localPlayerId={playerId}
                  onCellClick={() => {}}
                  onCellHover={handleCellHover}
                />
              </div>
              {/* Reset viewport button */}
              <button
                onClick={handleResetViewport}
                title="复位视角"
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 10,
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(15,10,26,0.8)',
                  backdropFilter: 'blur(8px)',
                  color: '#e2e8f0',
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                ⌂
              </button>
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
                    onClick={handlePlayerCardClick}
                  />
                ))}
              </div>

              {/* Training Plan */}
              {myPlayer && (myPlayer.trainingPlans.length > 0 || gameState.roundNumber === 1) && (
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
                ref={canvasRef}
                gameState={gameState}
                currentPlayerId={currentPlayer?.id || null}
                localPlayerId={playerId}
                onCellClick={() => {}}
                onCellHover={handleCellHover}
              />
            </div>
            {/* Reset viewport button */}
            <button
              onClick={handleResetViewport}
              title="复位视角"
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                zIndex: 10,
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(15,10,26,0.8)',
                backdropFilter: 'blur(8px)',
                color: '#e2e8f0',
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              ⌂
            </button>
            <MiniPlayerOverlay
              players={allPlayers}
              currentPlayerId={currentPlayer?.id || null}
              localPlayerId={playerId}
              onPlayerClick={handlePlayerCardClick}
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
                onPlayerClick={handlePlayerCardClick}
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
      <TurnOverlay
        isMyTurn={isMyTurn}
        playerPosition={myPlayer ? formatPositionShort(myPlayer) : undefined}
        roundInfo={gameState ? `${getRoundName(gameState.roundNumber)} \u7B2C${((gameState.turnNumber - 1) % 6) + 1}\u56DE\u5408` : undefined}
      />

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

      {/* Card Draw Modal (higher z-index, shows before EventModal) */}
      {drawnCard && <CardDrawModal />}

      {/* Event Modal - routed by severity */}
      {currentEvent && (
        currentEvent.severity === 'epic'
          ? <EpicEventModal />
          : <GameEventModal />
      )}

      {/* Multi-Select Choice Dialog (e.g. plan redraw) */}
      {hasPendingAction &&
        !isVoting &&
        !isChainAction &&
        !currentEvent &&
        gameState.pendingAction?.options &&
        gameState.pendingAction.options.length > 0 &&
        (gameState.pendingAction.maxSelections ?? 1) > 1 && (
          <MultiSelectDialog
            key={gameState.pendingAction.id}
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
            key={gameState.pendingAction.id}
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

      {/* Announcement Toast (legacy) */}
      {announcement && (
        <div className={`announcement-toast ${announcement.type}`}>
          {announcement.message}
        </div>
      )}

      {/* Stacked Notification Feed */}
      <NotificationFeed />

      {/* Vote Result overlay */}
      <VoteResultModal />
      <EventDiceOverlay />


      {/* Settlement Screen (replaces old Winner Modal) */}
      {winner && (
        <SettlementScreen
          winner={winner}
          gameState={gameState}
          playerId={playerId}
          onReturnToLobby={() => {
            useGameStore.getState().resetToLobby();
          }}
          readyPlayerIds={readyPlayerIds}
          isHost={gameState.players[0]?.id === playerId}
        />
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
