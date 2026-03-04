// server/src/socket/GameHandlers.ts — Game-related socket event handlers
import type { GameServer, GameSocket } from './types.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { MIN_PLAYERS, INITIAL_TRAINING_DRAW } from '@nannaricher/shared';

export function registerGameHandlers(
  io: GameServer,
  socket: GameSocket,
  roomManager: RoomManager,
): void {

  // Game start
  socket.on('game:start', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    const coordinator = roomManager.getCoordinator(roomId);
    if (!room || !coordinator) return;

    if (room.hostSocketId !== socket.id) {
      socket.emit('room:error', { message: 'Only host can start the game' });
      return;
    }

    if (room.players.length < MIN_PLAYERS) {
      socket.emit('room:error', {
        message: `Need at least ${MIN_PLAYERS} players`,
      });
      return;
    }

    const state = coordinator.getState();

    room.phase = 'playing';
    state.phase = 'setup_plans';
    state.turnNumber = 1;

    coordinator.handleSetupDrawTrainingPlans();

    state.log.push({
      turn: state.turnNumber,
      playerId: 'system',
      message: '游戏开始！',
      timestamp: Date.now(),
    });
    coordinator.broadcastState();

    io.to(roomId).emit('game:announcement', {
      message: '游戏开始！请选择培养计划',
      type: 'success',
    });
  });

  // Roll dice
  socket.on('game:roll-dice', () => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const coordinator = roomManager.getCoordinator(roomId);
    if (!coordinator) return;

    coordinator.handleRollDice(playerId);
  });

  // Choose action
  socket.on('game:choose-action', (data) => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const coordinator = roomManager.getCoordinator(roomId);
    if (!coordinator) return;

    coordinator.handleChooseAction(playerId, data.actionId, data.choice);
  });

  // Use card
  socket.on('game:use-card', (data) => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const coordinator = roomManager.getCoordinator(roomId);
    if (!coordinator) return;

    coordinator.handleUseCard(playerId, data.cardId, data.targetPlayerId);
  });

  // Confirm training plan
  socket.on('game:confirm-plan', (data) => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const coordinator = roomManager.getCoordinator(roomId);
    if (!coordinator) return;

    const result = coordinator.handleConfirmPlan(playerId, data.planId);
    if (result.error) {
      socket.emit('room:error', { message: result.error });
    }
  });

  // Chat
  socket.on('game:chat', (data) => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const coordinator = roomManager.getCoordinator(roomId);
    if (!coordinator) return;

    const state = coordinator.getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    io.to(roomId).emit('game:chat', {
      playerName: player.name,
      message: data.message,
    });
  });
}
