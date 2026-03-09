// server/src/socket/RoomHandlers.ts — Room-related socket event handlers
import type { GameServer, GameSocket } from './types.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { GameEngine } from '../game/GameEngine.js';
import { GameCoordinator } from '../game/GameCoordinator.js';
import { MIN_PLAYERS, MAX_PLAYERS } from '@nannaricher/shared';
import { saveGameResults } from '../db/gameResults.js';
import { generateBotName, randomStrategyName } from '../game/bot/index.js';

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
      const room = roomManager.getRoom(data.roomId);

      // If the room is in 'playing' phase, attempt to reconnect a disconnected player
      if (room && room.phase === 'playing') {
        const disconnectedPlayer = room.players.find(p =>
          p.isDisconnected && (
            (socket.data.userId && p.userId === socket.data.userId) ||
            p.name === data.playerName
          ),
        );

        if (disconnectedPlayer) {
          // Perform reconnection (similar to room:reconnect)
          disconnectedPlayer.socketId = socket.id;
          disconnectedPlayer.isDisconnected = false;
          socket.join(data.roomId);
          socket.data.roomId = data.roomId;
          socket.data.playerId = disconnectedPlayer.id;

          const coordinator = roomManager.getCoordinator(data.roomId);
          if (coordinator) {
            const state = coordinator.getState();
            state.log.push({
              turn: state.turnNumber,
              playerId: disconnectedPlayer.id,
              message: `${disconnectedPlayer.name} 重新连接`,
              timestamp: Date.now(),
            });

            // Send full state to the reconnecting client
            socket.emit('game:state-update', state);

            // Re-send pending action if applicable
            if (state.pendingAction &&
                state.pendingAction.type !== 'roll_dice' &&
                (state.pendingAction.playerId === disconnectedPlayer.id ||
                 state.pendingAction.playerId === 'all')) {
              socket.emit('game:event-trigger', {
                title: state.pendingAction.prompt.slice(0, 20) || '事件',
                description: state.pendingAction.prompt,
                pendingAction: state.pendingAction,
              });
            }

            coordinator.broadcastState();
          }

          // Emit joined event with reconnected flag
          socket.emit('room:joined', {
            playerId: disconnectedPlayer.id,
            roomId: data.roomId,
            reconnected: true,
          });
          console.log(`${data.playerName} rejoined room ${data.roomId} via join`);
          return;
        }

        // No matching disconnected player — join as spectator automatically
        const spectator = roomManager.addSpectator(
          data.roomId,
          socket.id,
          data.playerName,
          data.diceOption,
          socket.data.userId,
          socket.data.authVerified,
        );
        if (spectator) {
          socket.join(data.roomId);
          socket.data.roomId = data.roomId;

          const coordinator = roomManager.getCoordinator(data.roomId);
          if (coordinator) {
            const state = coordinator.getState();
            state.spectators = roomManager.getSpectatorInfos(data.roomId);
            socket.emit('game:state-update', state);
          }

          io.to(data.roomId).emit('room:spectator-update', {
            spectators: roomManager.getSpectatorInfos(data.roomId),
          });

          socket.emit('room:joined', {
            playerId: '__spectator__',
            roomId: data.roomId,
          });

          io.to(data.roomId).emit('game:announcement', {
            message: `${data.playerName} 加入观战`,
            type: 'info',
          });
          console.log(`${data.playerName} joined room ${data.roomId} as spectator (game in progress)`);
        } else {
          socket.emit('room:error', { message: '加入观战失败' });
        }
        return;
      }

      // Normal waiting-phase join logic
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

      socket.emit('room:joined', { playerId, roomId: data.roomId });
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

    const wasDisconnected = player.isDisconnected;
    player.socketId = socket.id;
    player.isDisconnected = false;
    socket.join(data.roomId);
    socket.data.roomId = data.roomId;
    socket.data.playerId = data.playerId;

    const coordinator = roomManager.getCoordinator(data.roomId);
    if (coordinator) {
      const state = coordinator.getState();

      // Only log reconnection if the player was actually marked as disconnected
      if (wasDisconnected) {
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

    // Emit joined event so client store gets roomId/playerId
    socket.emit('room:joined', {
      playerId: data.playerId,
      roomId: data.roomId,
      playerName: player.name,
      reconnected: true,
    });
    console.log(`${player.name} reconnected to room ${data.roomId}`);
  });

  // --------------------------------------------------
  // Bot Management (host only)
  // --------------------------------------------------

  socket.on('room:add-bot', async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    // Only host can add bots
    if (room.hostSocketId !== socket.id) {
      socket.emit('room:error', { message: '只有房主可以添加机器人' });
      return;
    }

    if (room.players.length >= MAX_PLAYERS) {
      socket.emit('room:error', { message: '房间已满' });
      return;
    }

    // Only allow in waiting or finished phase
    if (room.phase !== 'waiting' && room.phase !== 'finished') {
      socket.emit('room:error', { message: '游戏进行中无法添加机器人' });
      return;
    }

    // Collect used names
    const usedNames = new Set(room.players.map(p => p.name));

    try {
      const botName = await generateBotName(usedNames);
      const strategyName = randomStrategyName();
      // Use host's dice option for bots (index 0 = host)
      const diceOption = room.players[0]?.diceCount || 1;
      const bot = roomManager.addBot(roomId, botName, diceOption, strategyName);

      if (!bot) {
        socket.emit('room:error', { message: '添加机器人失败' });
        return;
      }

      // Add bot to engine if coordinator exists
      const coordinator = roomManager.getCoordinator(roomId);
      if (coordinator) {
        coordinator.getEngine().addPlayer(bot);
        // Register bot for auto-play
        coordinator.registerBot(bot.id, strategyName);

        // If finished phase, auto-ready the bot
        if (room.phase === 'finished') {
          room.readyPlayerIds.add(bot.id);
          io.to(roomId).emit('game:ready-state', {
            readyPlayerIds: Array.from(room.readyPlayerIds),
          });
        }

        coordinator.broadcastState();
      }

      io.to(roomId).emit('game:announcement', {
        message: `机器人 ${botName} 加入了房间`,
        type: 'info',
      });
      console.log(`Bot ${botName} (${strategyName}) added to room ${roomId}`);
    } catch (error) {
      socket.emit('room:error', { message: '添加机器人失败: ' + String(error) });
    }
  });

  // Remove player (host only, works for both real players and bots)
  socket.on('room:remove-player', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    if (room.hostSocketId !== socket.id) {
      socket.emit('room:error', { message: '只有房主可以移除玩家' });
      return;
    }

    // Only allow in waiting or finished phase
    if (room.phase !== 'waiting' && room.phase !== 'finished') {
      socket.emit('room:error', { message: '游戏进行中无法移除玩家' });
      return;
    }

    // Cannot remove host
    if (data.playerId === room.players[0]?.id) {
      socket.emit('room:error', { message: '不能移除房主' });
      return;
    }

    const playerToRemove = room.players.find(p => p.id === data.playerId);
    if (!playerToRemove) {
      socket.emit('room:error', { message: '玩家不存在' });
      return;
    }

    const wasBot = playerToRemove.isBot;
    const playerName = playerToRemove.name;

    // If real player, notify them and remove from socket room
    if (!wasBot) {
      const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
      if (socketsInRoom) {
        for (const sid of socketsInRoom) {
          const s = io.sockets.sockets.get(sid);
          if (s && s.data.playerId === data.playerId) {
            // Convert to spectator instead of kicking
            s.data.playerId = undefined;
            // Add as spectator
            roomManager.addSpectator(roomId, sid, playerName, playerToRemove.diceCount, s.data.userId, s.data.authVerified);
            s.emit('room:error', { message: '你已被房主移出玩家列表，现在为观战状态' });
            break;
          }
        }
      }
    }

    // Remove from players array
    const removed = roomManager.removePlayer(roomId, data.playerId);
    if (!removed) {
      socket.emit('room:error', { message: '移除失败' });
      return;
    }

    // Clean up ready state
    room.readyPlayerIds.delete(data.playerId);

    // Update engine state
    const coordinator = roomManager.getCoordinator(roomId);
    if (coordinator) {
      if (wasBot) {
        coordinator.unregisterBot(data.playerId);
      }
      const engine = coordinator.getEngine();
      const state = engine.getState();
      const engineIdx = state.players.findIndex(p => p.id === data.playerId);
      if (engineIdx !== -1) {
        state.players.splice(engineIdx, 1);
        state.turnOrder = state.players.map((_, i) => i);
      }
      // Update spectator info in state
      state.spectators = roomManager.getSpectatorInfos(roomId);
      coordinator.broadcastState();
    }

    io.to(roomId).emit('game:announcement', {
      message: `${playerName} 已被移出房间`,
      type: 'info',
    });

    // Send spectator update
    io.to(roomId).emit('room:spectator-update', {
      spectators: roomManager.getSpectatorInfos(roomId),
    });

    if (room.phase === 'finished') {
      io.to(roomId).emit('game:ready-state', {
        readyPlayerIds: Array.from(room.readyPlayerIds),
      });
    }

    console.log(`${playerName} removed from room ${roomId}`);
  });

  // --------------------------------------------------
  // Spectator System
  // --------------------------------------------------

  socket.on('room:join-as-spectator', (data) => {
    try {
      const room = roomManager.getRoom(data.roomId);
      if (!room) {
        socket.emit('room:error', { message: '房间不存在' });
        return;
      }

      // Add as spectator
      const spectator = roomManager.addSpectator(
        data.roomId,
        socket.id,
        data.playerName,
        1, // default dice option
        socket.data.userId,
        socket.data.authVerified,
      );

      if (!spectator) {
        socket.emit('room:error', { message: '加入观战失败' });
        return;
      }

      socket.join(data.roomId);
      socket.data.roomId = data.roomId;
      // playerId stays undefined for spectators

      // Send current game state to spectator
      const coordinator = roomManager.getCoordinator(data.roomId);
      if (coordinator) {
        const state = coordinator.getState();
        state.spectators = roomManager.getSpectatorInfos(data.roomId);
        socket.emit('game:state-update', state);
      }

      // Notify room
      io.to(data.roomId).emit('room:spectator-update', {
        spectators: roomManager.getSpectatorInfos(data.roomId),
      });

      socket.emit('room:joined', {
        playerId: '__spectator__',
        roomId: data.roomId,
      });

      io.to(data.roomId).emit('game:announcement', {
        message: `${data.playerName} 加入观战`,
        type: 'info',
      });

      console.log(`${data.playerName} joined room ${data.roomId} as spectator`);
    } catch (error) {
      socket.emit('room:error', { message: String(error) });
    }
  });

  // Spectator ready-up (for joining next game)
  socket.on('room:spectator-ready', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room || room.phase !== 'finished') return;

    const spectator = room.spectators.find(s => s.socketId === socket.id);
    if (!spectator) return;

    // Check if there's room for more players
    const currentReadyCount = room.readyPlayerIds.size + 1; // +1 for host
    const botCount = room.players.filter(p => p.isBot).length;
    // Spectators can ready up; host will manage slots before restart
    spectator.isReady = true;

    io.to(roomId).emit('room:spectator-update', {
      spectators: roomManager.getSpectatorInfos(roomId),
    });

    io.to(roomId).emit('game:announcement', {
      message: `观战者 ${spectator.name} 已准备加入下一局`,
      type: 'info',
    });
  });

  // Spectator cancel ready
  socket.on('room:spectator-cancel-ready', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room || room.phase !== 'finished') return;

    const spectator = room.spectators.find(s => s.socketId === socket.id);
    if (!spectator) return;

    spectator.isReady = false;

    io.to(roomId).emit('room:spectator-update', {
      spectators: roomManager.getSpectatorInfos(roomId),
    });
  });
}
