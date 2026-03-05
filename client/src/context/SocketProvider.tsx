// client/src/context/SocketProvider.tsx
// Bridges socket events from SocketContext to the Zustand store.
// Does NOT create its own socket — it uses the one from SocketContext.

import React, { useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';
import { useGameStore } from '../stores/gameStore';
import type { GameState, PendingAction } from '@nannaricher/shared';
import { playSound } from '../audio/AudioManager';

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
  addMissedEvent: (event: string) => void,
): void {
  if (!prev) return;

  const isHidden = document.hidden;

  // Round changed
  if (next.roundNumber > prev.roundNumber) {
    playSound('round_start');
    if (isHidden) {
      addMissedEvent(`第${next.roundNumber}轮开始`);
    }
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
        addMissedEvent('轮到你了！');
      }
    } else if (isHidden && nextPlayer) {
      addMissedEvent(`${nextPlayer.name} 开始操作`);
    }
  }

  // Vote start / end
  const prevActionType = prev.pendingAction?.type ?? null;
  const nextActionType = next.pendingAction?.type ?? null;

  if (prevActionType !== 'multi_vote' && nextActionType === 'multi_vote') {
    playSound('vote_start');
    if (isHidden) {
      addMissedEvent('发起了投票');
    }
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
        if (isHidden) addMissedEvent('你进入了医院');
      }
      if (!prevLocal.isBankrupt && nextLocal.isBankrupt) {
        playSound('bankrupt');
        if (isHidden) addMissedEvent('你破产了');
      }
      // Track stat changes while hidden
      if (isHidden) {
        const moneyDiff = nextLocal.money - prevLocal.money;
        if (moneyDiff !== 0) {
          addMissedEvent(`金钱 ${moneyDiff > 0 ? '+' : ''}${moneyDiff}`);
        }
        const gpaDiff = nextLocal.gpa - prevLocal.gpa;
        if (Math.abs(gpaDiff) >= 0.1) {
          addMissedEvent(`GPA ${gpaDiff > 0 ? '+' : ''}${gpaDiff.toFixed(1)}`);
        }
        const expDiff = nextLocal.exploration - prevLocal.exploration;
        if (expDiff !== 0) {
          addMissedEvent(`探索值 ${expDiff > 0 ? '+' : ''}${expDiff}`);
        }
      }
    }
  }

  // Track other players' bankruptcies
  if (isHidden) {
    for (const nextP of next.players) {
      if (nextP.id === localPlayerId) continue;
      const prevP = prev.players.find((p) => p.id === nextP.id);
      if (prevP && !prevP.isBankrupt && nextP.isBankrupt) {
        addMissedEvent(`${nextP.name} 破产了`);
      }
    }
  }

  // Opponent major event notifications (always, not just when hidden)
  for (const nextPlayer of next.players) {
    if (nextPlayer.id === localPlayerId) continue;
    const prevPlayer = prev.players.find((p) => p.id === nextPlayer.id);
    if (!prevPlayer) continue;

    const name = nextPlayer.name;
    const moneyDelta = nextPlayer.money - prevPlayer.money;

    if (moneyDelta >= 500) {
      useGameStore.getState().addOpponentNotification(`${name} 获得了 +${moneyDelta}\uD83D\uDCB0`);
    } else if (moneyDelta <= -500) {
      useGameStore.getState().addOpponentNotification(`${name} 失去了 ${moneyDelta}\uD83D\uDCB0`);
    }

    if (!prevPlayer.isBankrupt && nextPlayer.isBankrupt) {
      useGameStore.getState().addOpponentNotification(`${name} 破产了！`);
    }

    if (!prevPlayer.isInHospital && nextPlayer.isInHospital) {
      useGameStore.getState().addOpponentNotification(`${name} 住院了！`);
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
        // Clear event after making a choice
        store.getState().setCurrentEvent(null);
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
      diffAndPlaySounds(prevStateRef.current, state, localPlayerId, store.getState().addMissedEvent);
      prevStateRef.current = state;
      store.getState().setGameState(state);
    };

    const handleRoomCreated = ({ roomId, playerId }: { roomId: string; playerId: string }) => {
      store.getState().setRoomId(roomId);
      store.getState().setPlayerId(playerId);
      store.getState().setError(null);
      sessionStorage.setItem('nannaricher_roomId', roomId);
      sessionStorage.setItem('nannaricher_playerId', playerId);
    };

    const handleRoomJoined = ({ playerId }: { playerId: string }) => {
      store.getState().setPlayerId(playerId);
      store.getState().setError(null);
      const currentRoomId = store.getState().roomId;
      if (currentRoomId) {
        sessionStorage.setItem('nannaricher_roomId', currentRoomId);
      }
      sessionStorage.setItem('nannaricher_playerId', playerId);
    };

    const handleRoomError = ({ message }: { message: string }) => {
      console.error('[ZustandBridge] Room error:', message);
      store.getState().setError(message);
      // Clear session on room error (room not found, etc.)
      sessionStorage.removeItem('nannaricher_roomId');
      sessionStorage.removeItem('nannaricher_playerId');
    };

    const handleCardDrawn = (data: { card: any; deckType: string }) => {
      playSound('card_draw');
      store.getState().setDrawnCard(data);
    };

    const handleDiceResult = (data: { playerId: string; values: number[]; total: number }) => {
      if (data.playerId === 'system') {
        // Event dice (from resolveMultiVoteCard / server-side rolls)
        store.getState().setEventDice({ values: data.values, total: data.total });
        playSound('dice_land');
        setTimeout(() => store.getState().setEventDice(null), 2500);
      } else {
        store.getState().setDiceResult(data);
        playSound('dice_land');
      }
    };

    const handleEventTrigger = (data: { title: string; description: string; pendingAction?: PendingAction; playerId?: string }) => {
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
        if (eventKey === _lastEventKey && now - _lastEventTime < 500) return;
        _lastEventKey = eventKey;
        _lastEventTime = now;
      }
      store.getState().setCurrentEvent({
        title: data.title,
        description: data.description,
        pendingAction: data.pendingAction,
        playerId: data.playerId || data.pendingAction?.playerId,
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
      // Clear session — game is over
      sessionStorage.removeItem('nannaricher_roomId');
      sessionStorage.removeItem('nannaricher_playerId');
    };

    const handleVoteResult = (data: { cardId: string; results: Record<string, string[]>; winnerOption: string }) => {
      store.getState().setVoteResult(data);
      // Auto-clear after 5 seconds
      setTimeout(() => store.getState().setVoteResult(null), 5000);
    };

    const handleResourceChange = (data: { playerId: string; playerName: string; stat: 'money' | 'gpa' | 'exploration'; delta: number; current: number }) => {
      const localId = store.getState().playerId;
      if (data.playerId !== localId) {
        const statNames: Record<string, string> = { money: '资金', gpa: 'GPA', exploration: '探索值' };
        const sign = data.delta > 0 ? '+' : '';
        store.getState().setAnnouncement({
          message: `${data.playerName} ${statNames[data.stat] || data.stat} ${sign}${data.delta}`,
          type: data.delta > 0 ? 'success' : 'warning',
          timestamp: Date.now(),
        });
      }
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
    };
  }, [socket]);

  return <>{children}</>;
}
