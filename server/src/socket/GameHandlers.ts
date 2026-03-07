// server/src/socket/GameHandlers.ts — Game-related socket event handlers
import type { GameServer, GameSocket } from './types.js';
import type { Room } from '../rooms/RoomManager.js';
import { RoomManager } from '../rooms/RoomManager.js';
import { GameEngine } from '../game/GameEngine.js';
import { GameCoordinator } from '../game/GameCoordinator.js';
import { MIN_PLAYERS, INITIAL_TRAINING_DRAW, PLAYER_COLORS } from '@nannaricher/shared';
import { saveGameResults } from '../db/gameResults.js';

/** Shared helper: create fresh engine+coordinator, start a new game for room.players */
function initAndStartNewGame(
  room: Room,
  roomId: string,
  io: GameServer,
  roomManager: RoomManager,
): void {
  room.phase = 'playing';
  room.readyPlayerIds = new Set();
  room.lastActivity = Date.now();

  const engine = new GameEngine(roomId);
  room.players.forEach(player => engine.addPlayer(player));
  const coordinator = new GameCoordinator(engine, io, roomId);
  coordinator.onFinished(() => {
    room.phase = 'finished';
    room.lastActivity = Date.now();
    const s = coordinator.getState();
    saveGameResults(roomId, s.players, s.winner, s.roundNumber);
  });
  roomManager.setCoordinator(roomId, coordinator);

  io.to(roomId).emit('game:restarting');

  const state = coordinator.getState();
  state.phase = 'playing';
  state.turnNumber = 1;
  state.roundNumber = 1;
  state.log.push({ turn: 1, playerId: 'system', message: '游戏重新开始！', timestamp: Date.now() });

  io.to(roomId).emit('game:announcement', { message: '房主重开了游戏！', type: 'success' });

  const firstPlayer = state.players[state.currentPlayerIndex];
  state.pendingAction = {
    id: `roll_dice_${Date.now()}`,
    playerId: firstPlayer.id,
    type: 'roll_dice',
    prompt: '请投骰子',
    timeoutMs: 60000,
  };
  coordinator.broadcastState();
}

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
    state.phase = 'playing';
    state.turnNumber = 1;
    state.roundNumber = 1; // 大一

    state.log.push({
      turn: state.turnNumber,
      playerId: 'system',
      message: '游戏开始！',
      timestamp: Date.now(),
    });

    // 大一开始：广播大一buff信息
    io.to(roomId).emit('game:announcement', {
      message: '大一开始！通用Buff生效：\n1. 所有GPA增加效果翻倍\n2. 鼓楼线所有正面收益翻倍',
      type: 'success',
    });

    // 设置第一个玩家掷骰子（跳过 setup_plans 阶段）
    const firstPlayer = state.players[state.currentPlayerIndex];
    state.pendingAction = {
      id: `roll_dice_${Date.now()}`,
      playerId: firstPlayer.id,
      type: 'roll_dice',
      prompt: '请投骰子',
      timeoutMs: 60000,
    };
    coordinator.broadcastState();
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

    const result = coordinator.handleUseCard(playerId, data.cardId, data.targetPlayerId);
    if (result?.error) {
      socket.emit('game:card-use-error', { message: result.error });
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

  // ====================================================
  // Admin Console Handlers
  // ====================================================

  // Admin: Force next turn (host only)
  socket.on('admin:force-next-turn', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const coordinator = roomManager.getCoordinator(roomId);
    if (!coordinator) return;

    if (room.hostSocketId !== socket.id) {
      socket.emit('room:error', { message: 'Only host can use admin commands' });
      return;
    }

    const state = coordinator.getState();
    if (state.phase !== 'playing') return;

    state.log.push({
      turn: state.turnNumber,
      playerId: 'system',
      message: '[管理员] 强制跳过当前回合',
      timestamp: Date.now(),
    });

    io.to(roomId).emit('game:announcement', {
      message: '管理员强制跳过了当前回合',
      type: 'warning',
    });

    coordinator.forceSkipTurn();
    coordinator.broadcastState();
  });

  // Admin: Modify player resources (host only)
  socket.on('admin:modify-resources', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const coordinator = roomManager.getCoordinator(roomId);
    if (!coordinator) return;

    if (room.hostSocketId !== socket.id) {
      socket.emit('room:error', { message: 'Only host can use admin commands' });
      return;
    }

    const state = coordinator.getState();
    if (state.phase !== 'playing') return;

    const changes = data.changes as { playerId: string; money: number; gpa: number; exploration: number }[];

    for (const change of changes) {
      // Input validation: reject NaN, Infinity, non-number
      if (typeof change.money !== 'number' || !isFinite(change.money)) continue;
      if (typeof change.gpa !== 'number' || !isFinite(change.gpa)) continue;
      if (typeof change.exploration !== 'number' || !isFinite(change.exploration)) continue;

      const player = state.players.find(p => p.id === change.playerId);
      if (!player) continue;

      player.money = Math.round(change.money);
      player.gpa = Math.round(change.gpa * 10) / 10;
      player.exploration = Math.round(change.exploration);

      // Re-evaluate bankruptcy: if money >= 0, clear bankrupt flag
      if (player.isBankrupt && player.money >= 0) {
        player.isBankrupt = false;
      }
    }

    state.log.push({
      turn: state.turnNumber,
      playerId: 'system',
      message: '[管理员] 修改了玩家资源',
      timestamp: Date.now(),
    });

    io.to(roomId).emit('game:announcement', {
      message: '管理员修改了玩家资源',
      type: 'warning',
    });

    coordinator.broadcastState();
  });

  // ====================================================
  // Game Restart Handlers
  // ====================================================

  // Game restart (host only, during active game)
  socket.on('game:restart', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (room.phase !== 'playing' && room.phase !== 'finished') return;

    if (room.hostSocketId !== socket.id) {
      socket.emit('room:error', { message: 'Only host can restart the game' });
      return;
    }

    room.players = room.players.map(p => roomManager.resetPlayerForRestart(p));
    initAndStartNewGame(room, roomId, io, roomManager);
  });

  // Ready up (non-host, after game finished)
  socket.on('game:ready-up', () => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (room.phase !== 'finished') return;

    // Host doesn't need to ready up
    if (room.players[0]?.id === playerId) return;

    room.readyPlayerIds.add(playerId);

    io.to(roomId).emit('game:ready-state', {
      readyPlayerIds: Array.from(room.readyPlayerIds),
    });
  });

  // Cancel ready (non-host, after game finished)
  socket.on('game:ready-cancel', () => {
    const roomId = socket.data.roomId;
    const playerId = socket.data.playerId;
    if (!roomId || !playerId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (room.phase !== 'finished') return;

    // Host doesn't participate in ready system
    if (room.players[0]?.id === playerId) return;

    room.readyPlayerIds.delete(playerId);

    io.to(roomId).emit('game:ready-state', {
      readyPlayerIds: Array.from(room.readyPlayerIds),
    });
  });

  // Restart with ready players (host only, after game finished)
  socket.on('game:restart-with-ready', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (room.phase !== 'finished') return;

    if (room.hostSocketId !== socket.id) {
      socket.emit('room:error', { message: 'Only host can restart the game' });
      return;
    }

    if (room.readyPlayerIds.size === 0) {
      socket.emit('room:error', { message: 'No players have readied up' });
      return;
    }

    // Determine who stays: host + ready players (exclude disconnected)
    const hostId = room.players[0]?.id;
    const connectedReadyIds = [...room.readyPlayerIds].filter(pid => {
      const p = room.players.find(pl => pl.id === pid);
      return p && !p.isDisconnected;
    });
    if (connectedReadyIds.length === 0) {
      socket.emit('room:error', { message: '没有已连接的准备玩家' });
      return;
    }
    const keepPlayerIds = new Set<string>([...(hostId ? [hostId] : []), ...connectedReadyIds]);

    // Remove unready non-host players from socket room
    for (const player of room.players) {
      if (!keepPlayerIds.has(player.id)) {
        const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
        if (socketsInRoom) {
          for (const sid of socketsInRoom) {
            const s = io.sockets.sockets.get(sid);
            if (s && s.data.playerId === player.id) {
              s.emit('room:dissolved', { message: '你未准备，已被移出房间' });
              s.leave(roomId);
              s.data.roomId = undefined;
              s.data.playerId = undefined;
            }
          }
        }
      }
    }

    // Filter players, reset them, re-assign colors
    room.players = room.players
      .filter(p => keepPlayerIds.has(p.id))
      .map((p, i) => {
        const reset = roomManager.resetPlayerForRestart(p);
        reset.color = PLAYER_COLORS[i];
        return reset;
      });

    // Update hostSocketId to the current host's socket
    const hostPlayer = room.players.find(p => p.id === hostId);
    if (hostPlayer) {
      room.hostSocketId = hostPlayer.socketId;
    }

    initAndStartNewGame(room, roomId, io, roomManager);
  });
}
