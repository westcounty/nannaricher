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
import { SettlementScreen } from './SettlementScreen';
import { playSound } from '../audio/AudioManager';
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
  const clearWinner = () => useGameStore.getState().setWinner(null);
  const { messages: chatMessages, sendMessage: sendChatMessage } = useChat();
  const layout = useLayout();

  // Mobile/tablet panel state
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  // Desktop sidebar tab
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  // Track if player finished plan selection
  const [planSelectionDone, setPlanSelectionDone] = useState(false);

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

  // Mobile panel toggle
  const handlePanelToggle = (panelId: PanelId) => {
    playSound('tab_switch');
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
                  diceResult={diceResult}
                  onCellClick={() => {}}
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
                diceResult={diceResult}
                onCellClick={() => {}}
              />
            </div>
            <MiniPlayerOverlay
              players={allPlayers}
              currentPlayerId={currentPlayer?.id || null}
              localPlayerId={playerId}
            />
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
            onRollDice={handleMobileRollDice}
            onOpenCards={() => handlePanelToggle('hand')}
            onOpenPlayers={() => handlePanelToggle('players')}
            onOpenMore={() => handlePanelToggle('more')}
            activePanel={activePanel}
          />
        </>
      )}

      {/* ============================================
         MODALS & OVERLAYS (all layouts)
         ============================================ */}

      {/* Turn Overlay */}
      <TurnOverlay isMyTurn={isMyTurn} />

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

      {/* Choice Dialog */}
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
                description: [
                  `胜利条件: ${plan.winCondition}`,
                  plan.passiveAbility ? `被动能力: ${plan.passiveAbility}` : null,
                ].filter(Boolean).join('\n'),
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

      {/* Tutorial System */}
      <TutorialSystem />
    </div>
  );
}
