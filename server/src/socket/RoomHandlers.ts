// server/src/socket/RoomHandlers.ts — Room-related socket event handlers
import type { GameServer, GameSocket } from './types.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { GameEngine } from '../game/GameEngine.js';
import { GameCoordinator } from '../game/GameCoordinator.js';
import { MIN_PLAYERS } from '@nannaricher/shared';

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
      socket.emit('game:state-update', state);
      state.log.push({
        turn: state.turnNumber,
        playerId: data.playerId,
        message: `${player.name} 重新连接`,
        timestamp: Date.now(),
      });
      coordinator.broadcastState();
    }
  });
}
