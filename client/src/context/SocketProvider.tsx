// client/src/context/SocketProvider.tsx
// Thin Socket.IO connection manager — only manages connection lifecycle
// and bridges socket events to the Zustand store.
// Does NOT hold any game state itself.

import React, { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import type { ClientToServerEvents, ServerToClientEvents, GameState } from '@nannaricher/shared';
import { playSound } from '../audio/AudioManager';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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
 * SocketProvider — wraps children with a Socket.IO connection.
 *
 * On mount it:
 *   1. Creates a socket connection
 *   2. Injects socket-based actions into the Zustand store
 *   3. Listens for server events and updates the store
 *
 * On unmount it disconnects cleanly.
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<GameSocket | null>(null);
  const prevStateRef = useRef<GameState | null>(null);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const store = useGameStore;

  useEffect(() => {
    const socket: GameSocket = io(window.location.origin, {
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

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

    // ------ Connection lifecycle ------
    socket.on('connect', () => {
      console.log('[SocketProvider] Connected:', socket.id);
      store.getState().setLoading(false);
      store.getState().setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('[SocketProvider] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        store.getState().setError('Server disconnected. Reconnecting...');
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[SocketProvider] Connection error:', error.message);
      store.getState().setError(`Connection failed: ${error.message}`);
    });

    // ------ Game event listeners -> store updates ------
    socket.on('game:state-update', (state) => {
      const localPlayerId = store.getState().playerId;
      diffAndPlaySounds(prevStateRef.current, state, localPlayerId);
      prevStateRef.current = state;
      store.getState().setGameState(state);
    });

    socket.on('game:card-drawn', (data) => {
      playSound('card_draw');
      store.getState().setDrawnCard(data);
    });

    socket.on('room:created', ({ roomId, playerId }) => {
      store.getState().setRoomId(roomId);
      store.getState().setPlayerId(playerId);
      store.getState().setError(null);
    });

    socket.on('room:joined', ({ playerId }) => {
      store.getState().setPlayerId(playerId);
      store.getState().setError(null);
    });

    socket.on('room:error', ({ message }) => {
      console.error('[SocketProvider] Room error:', message);
      store.getState().setError(message);
    });

    socket.on('game:dice-result', (data) => {
      store.getState().setDiceResult(data);
      playSound('dice_land');
    });

    // NOTE: game:event-trigger is handled by GameContext to avoid duplicate listeners.
    // Sound is played there as well.

    socket.on('game:announcement', (data) => {
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
    });

    socket.on('game:player-won', (data) => {
      store.getState().setWinner(data);
      playSound('victory');
      // Fanfare follows after a brief delay
      setTimeout(() => playSound('victory_fanfare'), 300);
    });

    // ------ Cleanup ------
    return () => {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
      store.getState().setSocketActions(null);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
