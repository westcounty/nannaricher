// client/src/components/GameScreen.tsx
// Three-layout responsive game screen: desktop (>=1024), tablet (768-1023), mobile (<768)
// Redesigned with CompactHeader, ActionBar, CompactPlayerCard, MobileStatusBar, MobileBottomNav

import { useEffect, useRef, useState } from 'react';
import { useGameState } from '../context/GameContext';
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
import { CardHand } from './CardHand';
import { TrainingPlanView } from './TrainingPlanView';
import { useChat } from '../hooks/useChat';
import { TutorialSystem } from '../features/tutorial/TutorialSystem';
import { LoadingScreen } from './LoadingScreen';
import type { Player } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';
import { playSound } from '../audio/AudioManager';
import './ChatPanel.css';
import '../styles/game.css';
import '../styles/mobile.css';
import '../styles/training-plan.css';

// ============================================
// Layout Types & Breakpoints
// ============================================

type LayoutMode = 'desktop' | 'tablet' | 'mobile';

const BREAKPOINT_MOBILE = DESIGN_TOKENS.breakpoint.mobile;  // 768
const BREAKPOINT_TABLET = DESIGN_TOKENS.breakpoint.tablet;   // 1024

// Mobile panel definitions
type PanelId = 'hand' | 'players' | 'more';

// Sidebar tab for desktop
type SidebarTab = 'chat' | 'log';

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
    rollDice,
  } = useGameState();
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
  // otherPlayers available if needed for future use
  const _otherPlayers = allPlayers.filter((p) => p.id !== playerId);
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
                  onCellClick={(cellId, position) => {
                    console.log('Cell clicked:', cellId, position);
                  }}
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

          {/* Action Bar (bottom) */}
          <ActionBar
            myPlayer={myPlayer}
            isMyTurn={isMyTurn}
            currentPlayerName={currentPlayer?.name}
            useCard={useCard}
            players={allPlayers}
          />
        </>
      )}

      {/* ============ TABLET / MOBILE LAYOUT ============ */}
      {(layout === 'tablet' || layout === 'mobile') && (
        <>
          {/* Board area */}
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

      {/* Tutorial System */}
      <TutorialSystem />
    </div>
  );
}

// ============================================
// MobileSheetContent — for tablet/mobile panels
// ============================================

interface MobileSheetContentProps {
  activePanel: PanelId | null;
  myPlayer: Player | undefined;
  gameState: NonNullable<ReturnType<typeof useGameState>['gameState']>;
  chatMessages: Array<{ id: string; playerName: string; playerColor: string; text: string; timestamp: number }>;
  sendChatMessage: (message: string) => void;
  allPlayers: Player[];
  currentPlayer: Player | undefined;
  playerId: string | null;
  isMyTurn: boolean;
  useCard: (cardId: string, targetPlayerId?: string) => void;
}

function MobileSheetContent({
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>💬 聊天</h4>
            <ChatPanel messages={chatMessages} onSend={sendChatMessage} />
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>📜 游戏日志</h4>
            <GameLog entries={gameState.log} players={gameState.players} />
          </div>
        </div>
      );

    default:
      return null;
  }
}
