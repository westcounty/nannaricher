// client/src/context/SocketProvider.tsx
// Thin Socket.IO connection manager — only manages connection lifecycle
// and bridges socket events to the Zustand store.
// Does NOT hold any game state itself.

import React, { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../stores/gameStore';
import type { ClientToServerEvents, ServerToClientEvents, PendingAction } from '@nannaricher/shared';
import { playSound } from '../audio/AudioManager';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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
      store.getState().setGameState(state);
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

    socket.on('game:event-trigger', (data: { title: string; description: string; pendingAction: PendingAction }) => {
      store.getState().setCurrentEvent({
        title: data.title,
        description: data.description,
        pendingAction: data.pendingAction,
      });
      playSound('event_trigger');
    });

    socket.on('game:card-drawn', (data) => {
      store.getState().setDrawnCard(data);
      playSound('card_draw');
    });

    socket.on('game:announcement', (data) => {
      store.getState().setAnnouncement({
        ...data,
        timestamp: Date.now(),
      });
      // Play sound based on announcement type
      if (data.type === 'success') playSound('event_positive');
      else if (data.type === 'warning') playSound('event_negative');
      // Auto-clear announcement after 5 seconds
      setTimeout(() => {
        store.getState().setAnnouncement(null);
      }, 5000);
    });

    socket.on('game:player-won', (data) => {
      store.getState().setWinner(data);
      playSound('victory_fanfare');
    });

    // ------ Cleanup ------
    return () => {
      store.getState().setSocketActions(null);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return <>{children}</>;
}

/**
 * Hook to access the raw socket ref (for advanced use cases like
 * room:create / room:join that are not part of standard game actions).
 *
 * NOTE: For normal game actions (roll, choose, use card, etc.),
 * prefer `useGameStore().socketActions` instead.
 */
export function useSocketRef(): React.MutableRefObject<GameSocket | null> {
  // This is a simplified implementation. In production you'd use a context
  // or module-level ref for the socket instance.
  const ref = useRef<GameSocket | null>(null);
  return ref;
}
