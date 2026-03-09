// client/src/context/SocketProvider.tsx
// Bridges socket events from SocketContext to the Zustand store.
// Does NOT create its own socket — it uses the one from SocketContext.

import React, { useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useGameStore } from '../stores/gameStore';
import type { GameState, PendingAction } from '@nannaricher/shared';
import { playSound } from '../audio/AudioManager';
import { AnimationGate } from '../game/AnimationGate';

let _lastEventKey = '';
let _lastEventTime = 0;

/**
 * Compare previous and new game state and play appropriate sounds.
 * Called on every `game:state-update` BEFORE the store is updated.
 * Also tracks missed events when the tab is hidden.
 */
function diffAndPlaySounds(
  prev: GameState | null,
  next: GameState,
  localPlayerId: string | null,
): void {
  if (!prev) return;

  const isHidden = document.hidden;

  // Round changed
  if (next.roundNumber > prev.roundNumber) {
    playSound('round_start');
  }

  // Current player changed — turn start / end
  if (next.currentPlayerIndex !== prev.currentPlayerIndex && localPlayerId) {
    const prevPlayer = prev.players[prev.currentPlayerIndex];
    const nextPlayer = next.players[next.currentPlayerIndex];

    if (prevPlayer?.id === localPlayerId) {
      playSound('turn_end');
    }
    if (nextPlayer?.id === localPlayerId) {
      playSound('turn_start');
      // Notify player when tab is in the background
      if (isHidden) {
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('菜根人生', { body: '轮到你了！' });
        }
      }
    }
  }

  // Vote start / end
  const prevActionType = prev.pendingAction?.type ?? null;
  const nextActionType = next.pendingAction?.type ?? null;

  if (prevActionType !== 'multi_vote' && nextActionType === 'multi_vote') {
    playSound('vote_start');
  }
  if (prevActionType === 'multi_vote' && nextActionType !== 'multi_vote') {
    playSound('vote_end');
  }

  // Local-player status changes
  if (localPlayerId) {
    const prevLocal = prev.players.find((p) => p.id === localPlayerId);
    const nextLocal = next.players.find((p) => p.id === localPlayerId);

    if (prevLocal && nextLocal) {
      if (!prevLocal.isInHospital && nextLocal.isInHospital) {
        playSound('hospital_enter');
      }
      if (!prevLocal.isBankrupt && nextLocal.isBankrupt) {
        playSound('bankrupt');
      }
    }
  }

  // Opponent major status changes (always, not just when hidden)
  for (const nextPlayer of next.players) {
    if (nextPlayer.id === localPlayerId) continue;
    const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
    if (!prevPlayer) continue;

    const name = nextPlayer.name;

    if (!prevPlayer.isBankrupt && nextPlayer.isBankrupt) {
      useGameStore.getState().addNotification(`${name} 破产了！`, 'warning');
    }

    if (!prevPlayer.isInHospital && nextPlayer.isInHospital) {
      useGameStore.getState().addNotification(`${name} 住院了！`, 'warning');
    }
  }
}

/**
 * ZustandBridge — sits inside SocketContext's SocketProvider.
 *
 * On mount it:
 *   1. Injects socket-based actions into the Zustand store
 *   2. Listens for server events and updates the store
 *
 * On unmount it cleans up listeners.
 */
export function ZustandBridge({ children }: { children: React.ReactNode }) {
  const { socket, isConnected } = useSocket();
  const prevStateRef = useRef<GameState | null>(null);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventActionIdRef = useRef<string | null>(null);
  const store = useGameStore;

  // Keep isLoading synced with connection status
  useEffect(() => {
    store.getState().setLoading(!isConnected);
  }, [isConnected]);

  useEffect(() => {
    if (!socket) return;

    // ------ Inject socket actions into Zustand store ------
    store.getState().setSocketActions({
      rollDice: () => {
        if (store.getState().isMyTurn() && !store.getState().isRolling) {
          store.getState().setRolling(true);
          socket.emit('game:roll-dice');
          playSound('dice_shake');
        }
      },
      chooseAction: (actionId: string, choice: string) => {
        socket.emit('game:choose-action', { actionId, choice });
        // Don't clear event for parallel_plan_selection — panel shows "waiting" state
        const currentEvent = store.getState().currentEvent;
        if (currentEvent?.pendingAction?.type !== ('parallel_plan_selection' as any)) {
          store.getState().setCurrentEvent(null);
        }
      },
      useCard: (cardId: string, targetPlayerId?: string) => {
        socket.emit('game:use-card', { cardId, targetPlayerId });
      },
      sendChat: (message: string) => {
        socket.emit('game:chat', { message });
      },
    });

    // ------ Game event listeners -> store updates ------
    const handleStateUpdate = (state: GameState) => {
      const localPlayerId = store.getState().playerId;
      diffAndPlaySounds(prevStateRef.current, state, localPlayerId);
      prevStateRef.current = state;
      store.getState().setGameState(state);

      // Fallback: detect winner from state update if game:player-won was missed
      if (state.phase === 'finished' && state.winner && !store.getState().winner) {
        const winner = state.players.find((p: any) => p.id === state.winner);
        store.getState().setWinner({
          playerId: state.winner,
          playerName: winner?.name || 'Unknown',
          condition: '',
        });
      }

      // Show parallel plan selection when state update includes it
      const newPa = state.pendingAction;
      if (newPa && newPa.type === ('parallel_plan_selection' as any)
          && newPa.targetPlayerIds?.includes(localPlayerId || '')
          && !store.getState().currentEvent) {
        store.getState().setCurrentEvent({
          title: '升学阶段',
          description: '选择培养计划',
          pendingAction: newPa,
        });
      }
      // Clear plan selection panel when pendingAction is no longer parallel_plan_selection
      const currentEvent = store.getState().currentEvent;
      if (currentEvent?.pendingAction?.type === ('parallel_plan_selection' as any)
          && (!newPa || newPa.type !== ('parallel_plan_selection' as any))) {
        store.getState().setCurrentEvent(null);
      }
    };

    const handleRoomCreated = ({ roomId, playerId }: { roomId: string; playerId: string }) => {
      store.getState().setRoomId(roomId);
      store.getState().setPlayerId(playerId);
      store.getState().setError(null);
      sessionStorage.setItem('nannaricher_roomId', roomId);
      sessionStorage.setItem('nannaricher_playerId', playerId);
      localStorage.setItem('nannaricher_roomId', roomId);
      localStorage.setItem('nannaricher_playerId', playerId);
    };

    const handleRoomJoined = ({ playerId, roomId, reconnected }: { playerId: string; roomId: string; reconnected?: boolean }) => {
      store.getState().setRoomId(roomId);
      store.getState().setPlayerId(playerId);
      store.getState().setError(null);
      sessionStorage.setItem('nannaricher_roomId', roomId);
      sessionStorage.setItem('nannaricher_playerId', playerId);
      localStorage.setItem('nannaricher_roomId', roomId);
      localStorage.setItem('nannaricher_playerId', playerId);
      if (reconnected) {
        store.getState().addNotification('已重新连接到游戏', 'success');
      }
    };

    const handleRoomError = ({ message }: { message: string }) => {
      console.error('[ZustandBridge] Room error:', message);
      store.getState().setError(message);
      // Clear session on room error (room not found, etc.)
      sessionStorage.removeItem('nannaricher_roomId');
      sessionStorage.removeItem('nannaricher_playerId');
      localStorage.removeItem('nannaricher_roomId');
      localStorage.removeItem('nannaricher_playerId');
    };

    const handleCardDrawn = (data: { card: any; deckType: string; playerId?: string; addedToHand?: boolean }) => {
      playSound('card_draw');
      store.getState().setDrawnCard(data);
    };

    const handleDiceResult = (data: { playerId: string; values: number[]; total: number; isEventDice?: boolean }) => {
      const gameState = store.getState().gameState;
      const isMovementDice = data.playerId !== 'system'
        && !data.isEventDice
        && gameState?.pendingAction?.type === 'roll_dice';

      if (isMovementDice) {
        // Normal movement dice — show DiceRoller overlay
        store.getState().setDiceResult(data);
        playSound('dice_land');
      } else {
        // Event dice (card effects, vote results, etc.) — show EventDiceOverlay
        store.getState().setEventDice({ values: data.values, total: data.total });
        playSound('dice_land');
        setTimeout(() => store.getState().setEventDice(null), 3500);
      }
    };

    const handleEventTrigger = (data: { title: string; description: string; pendingAction?: PendingAction; playerId?: string; effects?: { money?: number; gpa?: number; exploration?: number }; severity?: 'minor' | 'normal' | 'epic' }) => {
      // Deduplicate by pendingAction id
      if (data.pendingAction?.id && data.pendingAction.id === lastEventActionIdRef.current) {
        return;
      }
      if (data.pendingAction?.id) {
        lastEventActionIdRef.current = data.pendingAction.id;
      }
      // Time-window deduplication to prevent double-triggering
      const pa = data.pendingAction;
      if (pa) {
        const eventKey = `${pa.playerId}:${pa.type}:${pa.prompt}`;
        const now = Date.now();
        if (eventKey === _lastEventKey && now - _lastEventTime < 1000) return;
        _lastEventKey = eventKey;
        _lastEventTime = now;
      }

      // Parallel plan selection — always show as full modal
      if (data.pendingAction?.type === ('parallel_plan_selection' as any)) {
        store.getState().setCurrentEvent({
          title: '升学阶段',
          description: '选择培养计划',
          pendingAction: data.pendingAction,
        });
        playSound('event_trigger');
        return;
      }

      // Infer severity if not provided by server
      const effectiveSeverity: 'minor' | 'normal' | 'epic' = data.severity ?? (() => {
        if (data.pendingAction) return 'normal' as const;
        const e = data.effects;
        if (!e) return 'normal' as const;
        const isMinor = Math.abs(e.money ?? 0) < 200
          && Math.abs(e.gpa ?? 0) < 0.2
          && Math.abs(e.exploration ?? 0) < 5;
        return isMinor ? 'minor' as const : 'normal' as const;
      })();

      // Helper: wait for piece animations to finish before showing any UI.
      // Uses requestAnimationFrame to let PlayerLayer.update() start animations
      // from the React useEffect triggered by the same state-update batch.
      const afterAnimations = async (): Promise<void> => {
        // Yield two frames so the React effect that calls PlayerLayer.update()
        // has a chance to run and register animations with AnimationGate.
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await AnimationGate.waitForIdle();
      };

      // Minor non-interactive events -> notification toast instead of modal
      if (effectiveSeverity === 'minor' && !data.pendingAction) {
        afterAnimations().then(() => {
          store.getState().addNotification(
            `${data.title}: ${data.description}`,
            'info',
          );
          playSound('event_trigger');
        });
        return;
      }

      // Other players' events -> downgrade to toast with effect summary
      // For events without pendingAction (info-only like 鼎), always downgrade for others
      const localPlayerId = store.getState().playerId;
      const isOtherPlayerEvent = data.playerId
        ? data.playerId !== localPlayerId
        : data.pendingAction
          ? data.pendingAction.playerId !== localPlayerId && data.pendingAction.playerId !== 'all'
          : false;
      if (isOtherPlayerEvent && (!data.pendingAction || effectiveSeverity !== 'epic')) {
        // Build compact effect summary
        const effectParts: string[] = [];
        if (data.effects) {
          if (data.effects.money) effectParts.push(`\uD83D\uDCB0${data.effects.money > 0 ? '+' : ''}${data.effects.money}`);
          if (data.effects.gpa) effectParts.push(`\uD83D\uDCDA${data.effects.gpa > 0 ? '+' : ''}${data.effects.gpa}`);
          if (data.effects.exploration) effectParts.push(`\uD83D\uDDFA\uFE0F${data.effects.exploration > 0 ? '+' : ''}${data.effects.exploration}`);
        }
        const suffix = effectParts.length > 0 ? ` (${effectParts.join(' ')})` : '';
        afterAnimations().then(() => {
          store.getState().addNotification(
            `${data.title}: ${data.description}${suffix}`,
            'info',
          );
          playSound('event_trigger');
        });
        return;
      }

      afterAnimations().then(() => {
        store.getState().setCurrentEvent({
          title: data.title,
          description: data.description,
          pendingAction: data.pendingAction,
          playerId: data.playerId || data.pendingAction?.playerId,
          effects: data.effects,
          severity: effectiveSeverity,
        });
        playSound('event_trigger');
      });
    };

    const handleAnnouncement = (data: { message: string; type: 'info' | 'warning' | 'success' }) => {
      // Wait for piece animations to finish before showing announcement
      const show = () => {
        store.getState().addNotification(data.message, data.type);
        if (data.type === 'success') playSound('event_positive');
        else if (data.type === 'warning') playSound('event_negative');
      };
      if (AnimationGate.isAnimating) {
        AnimationGate.waitForIdle().then(show);
      } else {
        show();
      }
    };

    const handlePlayerWon = (data: { playerId: string; playerName: string; condition: string }) => {
      const show = () => {
        store.getState().setWinner(data);
        playSound('victory');
        setTimeout(() => playSound('victory_fanfare'), 300);
        sessionStorage.removeItem('nannaricher_roomId');
        sessionStorage.removeItem('nannaricher_playerId');
        localStorage.removeItem('nannaricher_roomId');
        localStorage.removeItem('nannaricher_playerId');
      };
      // Wait for piece animations to finish before showing victory screen
      if (AnimationGate.isAnimating) {
        AnimationGate.waitForIdle().then(show);
      } else {
        show();
      }
    };

    const handleVoteResult = (data: { cardId: string; results: Record<string, string[]>; winnerOption: string }) => {
      store.getState().setVoteResult(data);
      // Auto-clear after 5 seconds
      setTimeout(() => store.getState().setVoteResult(null), 5000);
    };

    const handleResourceChange = (_data: { playerId: string; playerName: string; stat: 'money' | 'gpa' | 'exploration'; delta: number; current: number }) => {
      // Resource change notifications removed — event-trigger toasts and player cards
      // already convey this information without noise.
    };

    const handleCardUseError = ({ message }: { message: string }) => {
      store.getState().addNotification(message, 'warning');
    };

    const handleRoomDissolved = ({ message }: { message: string }) => {
      store.getState().addNotification(message, 'warning');
      sessionStorage.removeItem('nannaricher_roomId');
      sessionStorage.removeItem('nannaricher_playerId');
      localStorage.removeItem('nannaricher_roomId');
      localStorage.removeItem('nannaricher_playerId');
      store.getState().resetToLobby();
    };

    const handleRestarting = () => {
      store.getState().setWinner(null);
      store.getState().setCurrentEvent(null);
      store.getState().setDiceResult(null);
      store.getState().setDrawnCard(null);
      store.getState().setAnnouncement(null);
      store.getState().setVoteResult(null);
      store.getState().setEventDice(null);
      store.getState().setReadyPlayerIds([]);
      // Clear stale notifications from previous game
      store.setState({ notifications: [] });
    };

    const handleReadyState = (data: { readyPlayerIds: string[] }) => {
      store.getState().setReadyPlayerIds(data.readyPlayerIds);
    };

    const handleLineExitSummary = (data: {
      playerId: string; lineId: string; lineName: string;
      entryTurn: number; exitTurn: number;
      deltas: { money: number; gpa: number; exploration: number };
    }) => {
      const state = store.getState();
      const player = state.gameState?.players.find(p => p.id === data.playerId);
      const name = player?.name || '玩家';
      const parts: string[] = [];
      if (data.deltas.money) parts.push(`资金${data.deltas.money > 0 ? '+' : ''}${data.deltas.money}`);
      if (data.deltas.gpa) parts.push(`GPA${data.deltas.gpa > 0 ? '+' : ''}${data.deltas.gpa}`);
      if (data.deltas.exploration) parts.push(`探索${data.deltas.exploration > 0 ? '+' : ''}${data.deltas.exploration}`);
      const summary = parts.length > 0 ? parts.join('，') : '无变化';
      store.getState().addNotification(`${name} 完成 ${data.lineName}：${summary}`, 'info');
    };

    const handlePlanAbilityTrigger = (data: {
      playerId: string; planName: string; message: string;
    }) => {
      const state = store.getState();
      const player = state.gameState?.players.find(p => p.id === data.playerId);
      const name = player?.name || '玩家';
      store.getState().addNotification(
        `${name}【${data.planName}】${data.message}`,
        'info',
      );
    };

    socket.on('game:state-update', handleStateUpdate);
    socket.on('room:created', handleRoomCreated);
    socket.on('room:joined', handleRoomJoined);
    socket.on('room:error', handleRoomError);
    socket.on('game:card-drawn', handleCardDrawn);
    socket.on('game:dice-result', handleDiceResult);
    socket.on('game:event-trigger', handleEventTrigger);
    socket.on('game:announcement', handleAnnouncement);
    socket.on('game:player-won', handlePlayerWon);
    socket.on('game:resource-change', handleResourceChange);
    socket.on('game:vote-result', handleVoteResult);
    socket.on('game:card-use-error', handleCardUseError);
    socket.on('game:line-exit-summary', handleLineExitSummary);
    socket.on('game:plan-ability-trigger', handlePlanAbilityTrigger);
    socket.on('room:dissolved', handleRoomDissolved);
    socket.on('game:restarting', handleRestarting);
    socket.on('game:ready-state', handleReadyState);

    const handleSpectatorUpdate = (data: { spectators: import('@nannaricher/shared').SpectatorInfo[] }) => {
      store.getState().setSpectators(data.spectators);
    };
    socket.on('room:spectator-update', handleSpectatorUpdate);

    // ------ Cleanup ------
    return () => {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
      store.getState().setSocketActions(null);
      socket.off('game:state-update', handleStateUpdate);
      socket.off('room:created', handleRoomCreated);
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:error', handleRoomError);
      socket.off('game:card-drawn', handleCardDrawn);
      socket.off('game:dice-result', handleDiceResult);
      socket.off('game:event-trigger', handleEventTrigger);
      socket.off('game:announcement', handleAnnouncement);
      socket.off('game:player-won', handlePlayerWon);
      socket.off('game:resource-change', handleResourceChange);
      socket.off('game:vote-result', handleVoteResult);
      socket.off('game:card-use-error', handleCardUseError);
      socket.off('game:line-exit-summary', handleLineExitSummary);
      socket.off('game:plan-ability-trigger', handlePlanAbilityTrigger);
      socket.off('room:dissolved', handleRoomDissolved);
      socket.off('game:restarting', handleRestarting);
      socket.off('game:ready-state', handleReadyState);
      socket.off('room:spectator-update', handleSpectatorUpdate);
    };
  }, [socket]);

  return <>{children}</>;
}
