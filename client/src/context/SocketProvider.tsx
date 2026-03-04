// client/src/context/SocketProvider.tsx
// Bridges socket events from SocketContext to the Zustand store.
// Does NOT create its own socket — it uses the one from SocketContext.

import React, { useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useGameStore } from '../stores/gameStore';
import type { GameState, PendingAction } from '@nannaricher/shared';
import { playSound } from '../audio/AudioManager';

/**
 * Compare previous and new game state and play appropriate sounds.
 * Called on every `game:state-update` BEFORE the store is updated.
 */
function diffAndPlaySounds(
  prev: GameState | null,
  next: GameState,
  localPlayerId: string | null,
): void {
  if (!prev) return;

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
      if (document.hidden) {
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
        // Clear event after making a choice
        store.getState().setCurrentEvent(null);
      },
      useCard: (cardId: string, targetPlayerId?: string) => {
        socket.emit('game:use-card', { cardId, targetPlayerId });
      },
      confirmPlan: (planId: string) => {
        socket.emit('game:confirm-plan', { planId });
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
    };

    const handleRoomCreated = ({ roomId, playerId }: { roomId: string; playerId: string }) => {
      store.getState().setRoomId(roomId);
      store.getState().setPlayerId(playerId);
      store.getState().setError(null);
    };

    const handleRoomJoined = ({ playerId }: { playerId: string }) => {
      store.getState().setPlayerId(playerId);
      store.getState().setError(null);
    };

    const handleRoomError = ({ message }: { message: string }) => {
      console.error('[ZustandBridge] Room error:', message);
      store.getState().setError(message);
    };

    const handleCardDrawn = (data: { card: any; deckType: string }) => {
      playSound('card_draw');
      store.getState().setDrawnCard(data);
    };

    const handleDiceResult = (data: { playerId: string; values: number[]; total: number }) => {
      store.getState().setDiceResult(data);
      playSound('dice_land');
    };

    const handleEventTrigger = (data: { title: string; description: string; pendingAction: PendingAction }) => {
      // Only show event modal if this event is for the current player
      const localPlayerId = store.getState().playerId;
      if (data.pendingAction?.playerId && data.pendingAction.playerId !== localPlayerId) {
        return;
      }
      store.getState().setCurrentEvent({
        title: data.title,
        description: data.description,
        pendingAction: data.pendingAction,
      });
      playSound('event_trigger');
    };

    const handleAnnouncement = (data: { message: string; type: 'info' | 'warning' | 'success' }) => {
      store.getState().setAnnouncement({
        ...data,
        timestamp: Date.now(),
      });
      // Play sound based on announcement type
      if (data.type === 'success') playSound('event_positive');
      else if (data.type === 'warning') playSound('event_negative');
      // Clear previous timer before setting a new one
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
      // Auto-clear announcement after 5 seconds
      announcementTimerRef.current = setTimeout(() => {
        store.getState().setAnnouncement(null);
        announcementTimerRef.current = null;
      }, 5000);
    };

    const handlePlayerWon = (data: { playerId: string; playerName: string; condition: string }) => {
      store.getState().setWinner(data);
      playSound('victory');
      // Fanfare follows after a brief delay
      setTimeout(() => playSound('victory_fanfare'), 300);
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
    };
  }, [socket]);

  return <>{children}</>;
}
