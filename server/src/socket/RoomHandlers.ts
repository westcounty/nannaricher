// server/src/socket/RoomHandlers.ts — Room-related socket event handlers
import type { GameServer, GameSocket } from './types.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { GameEngine } from '../game/GameEngine.js';
import { GameCoordinator } from '../game/GameCoordinator.js';
import { MIN_PLAYERS } from '@nannaricher/shared';
import { saveGameResults } from '../db/gameResults.js';

export function registerRoomHandlers(
  io: GameServer,
  socket: GameSocket,
  roomManager: RoomManager,
): void {

  // Room creation
  socket.on('room:create', (data) => {
    try {
      const { roomId, playerId } = roomManager.createRoom(
        data.playerName,
        socket.id,
        data.diceOption,
        socket.data.userId,
        socket.data.authVerified,
      );

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.playerId = playerId;

      // Set up game engine and coordinator for this room
      const room = roomManager.getRoom(roomId);
      if (room) {
        const engine = new GameEngine(roomId);
        room.players.forEach(player => engine.addPlayer(player));
        const coordinator = new GameCoordinator(engine, io, roomId);
        coordinator.onFinished(() => {
          room.phase = 'finished';
          room.lastActivity = Date.now();
          // Save game results to SQLite
          const state = coordinator.getState();
          saveGameResults(roomId, state.players, state.winner, state.roundNumber);
        });
        roomManager.setCoordinator(roomId, coordinator);

        // Broadcast initial state (engine already has players from forEach above)
        coordinator.broadcastState();
      }

      socket.emit('room:created', { roomId, playerId });
      console.log(`Room ${roomId} created by ${data.playerName}`);
    } catch (error) {
      socket.emit('room:error', { message: String(error) });
    }
  });

  // Room joining
  socket.on('room:join', (data) => {
    try {
      const { playerId } = roomManager.joinRoom(
        data.roomId,
        data.playerName,
        socket.id,
        data.diceOption,
        socket.data.userId,
        socket.data.authVerified,
      );

      socket.join(data.roomId);
      socket.data.roomId = data.roomId;
      socket.data.playerId = playerId;

      const room = roomManager.getRoom(data.roomId);
      if (room) {
        const coordinator = roomManager.getCoordinator(data.roomId);
        if (coordinator) {
          // Add new player to the engine (this pushes to state.players and inits turnOrder/tracker)
          const newPlayer = room.players.find(p => p.id === playerId);
          if (newPlayer) {
            coordinator.getEngine().addPlayer(newPlayer);
          }
          coordinator.broadcastState();
        }
        socket.to(data.roomId).emit('room:player-joined', {
          playerName: data.playerName,
        });
      }

      socket.emit('room:joined', { playerId });
      console.log(`${data.playerName} joined room ${data.roomId}`);
    } catch (error) {
      socket.emit('room:error', { message: String(error) });
    }
  });

  // Leave room
  socket.on('room:leave', () => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    if (room.phase === 'waiting') {
      // Waiting phase: remove player from room
      const idx = room.players.findIndex(p => p.id === playerId);
      if (idx === -1) return;
      const playerName = room.players[idx].name;
      room.players.splice(idx, 1);
      socket.leave(roomId);
      socket.data.roomId = undefined;
      socket.data.playerId = undefined;

      // If room is now empty, remove it
      if (room.players.length === 0) {
        roomManager.removeRoom(roomId);
        console.log(`Room ${roomId} removed (last player left)`);
        return;
      }

      // Update host if the host left
      if (idx === 0) {
        room.hostSocketId = room.players[0].socketId;
      }

      // Sync engine state
      const coordinator = roomManager.getCoordinator(roomId);
      if (coordinator) {
        const engine = coordinator.getEngine();
        const state = engine.getState();
        // Remove from engine state.players as well
        const engineIdx = state.players.findIndex(p => p.id === playerId);
        if (engineIdx !== -1) {
          state.players.splice(engineIdx, 1);
          // Rebuild turnOrder
          state.turnOrder = state.players.map((_, i) => i);
        }
        coordinator.broadcastState();
      }

      io.to(roomId).emit('game:announcement', {
        message: `${playerName} 离开了房间`,
        type: 'info',
      });
      console.log(`${playerName} left room ${roomId} (waiting phase)`);
    } else if (room.phase === 'playing') {
      // Playing phase: treat as disconnect
      roomManager.handleDisconnect(socket.id);
      socket.leave(roomId);
      socket.data.roomId = undefined;
      socket.data.playerId = undefined;
    }
  });

  // Dissolve room (host only)
  socket.on('room:dissolve', () => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    // Only the host (first player) can dissolve
    if (room.players[0]?.id !== playerId) {
      socket.emit('room:error', { message: '只有房主可以解散房间' });
      return;
    }

    // Broadcast dissolution to all players in the room
    io.to(roomId).emit('room:dissolved', { message: '房主已解散房间' });

    // Make all sockets leave the room
    const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
    if (socketsInRoom) {
      for (const sid of socketsInRoom) {
        const s = io.sockets.sockets.get(sid);
        if (s) {
          s.leave(roomId);
          s.data.roomId = undefined;
          s.data.playerId = undefined;
        }
      }
    }

    roomManager.removeRoom(roomId);
    console.log(`Room ${roomId} dissolved by host`);
  });

  // Reconnection
  socket.on('room:reconnect', (data) => {
    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found' });
      return;
    }

    const player = room.players.find(p => p.id === data.playerId);
    if (!player) {
      socket.emit('room:error', { message: 'Player not found' });
      return;
    }

    player.socketId = socket.id;
    player.isDisconnected = false;
    socket.join(data.roomId);
    socket.data.roomId = data.roomId;
    socket.data.playerId = data.playerId;

    const coordinator = roomManager.getCoordinator(data.roomId);
    if (coordinator) {
      const state = coordinator.getState();

      // Only log reconnection if the player was actually marked as disconnected
      if (player.isDisconnected) {
        state.log.push({
          turn: state.turnNumber,
          playerId: data.playerId,
          message: `${player.name} 重新连接`,
          timestamp: Date.now(),
        });
      }

      // Send full state to the reconnecting client
      socket.emit('game:state-update', state);

      // If there's a pending action for this player, re-send the event trigger
      // (skip roll_dice — that's handled by ActionBar, not a modal)
      if (state.pendingAction &&
          state.pendingAction.type !== 'roll_dice' &&
          (state.pendingAction.playerId === data.playerId || state.pendingAction.playerId === 'all')) {
        socket.emit('game:event-trigger', {
          title: state.pendingAction.prompt.slice(0, 20) || '事件',
          description: state.pendingAction.prompt,
          pendingAction: state.pendingAction,
        });
      }

      coordinator.broadcastState();
    }
  });
}
