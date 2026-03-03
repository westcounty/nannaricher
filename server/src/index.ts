import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './rooms/RoomManager.js';
import { createDecks } from './data/cards.js';
import { createTrainingDeck } from './data/trainingPlans.js';
import {
  GameState,
  Player,
  TrainingPlan,
  ClientToServerEvents,
  ServerToClientEvents,
  MIN_PLAYERS,
  INITIAL_TRAINING_DRAW,
} from '@nannaricher/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN || true
    : '*',
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000
});

const roomManager = new RoomManager();
const gameStates = new Map<string, GameState>();

// Utility functions
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function addLog(state: GameState, playerId: string, message: string): void {
  state.log.push({
    turn: state.turnNumber,
    playerId,
    message,
    timestamp: Date.now(),
  });
}

function broadcastGameState(roomId: string): void {
  const state = gameStates.get(roomId);
  if (!state) return;
  io.to(roomId).emit('game:state-update', state);
}

function initializeGameState(roomId: string, players: Player[]): GameState {
  const decks = createDecks();
  const trainingDeck = createTrainingDeck();

  shuffleArray(decks.chance);
  shuffleArray(decks.destiny);
  shuffleArray(trainingDeck);

  return {
    roomId,
    phase: 'waiting',
    currentPlayerIndex: 0,
    turnNumber: 0,
    players,
    cardDecks: {
      chance: decks.chance,
      destiny: decks.destiny,
      training: trainingDeck,
    },
    discardPiles: {
      chance: [],
      destiny: [],
    },
    pendingAction: null,
    turnOrder: players.map((_, i) => i),
    turnOrderReversed: false,
    winner: null,
    log: [],
  };
}

function handleSetupDrawTrainingPlans(roomId: string): void {
  const state = gameStates.get(roomId);
  if (!state || state.phase !== 'setup_plans') return;

  state.players.forEach((player) => {
    const drawnPlans: TrainingPlan[] = [];
    for (let i = 0; i < INITIAL_TRAINING_DRAW; i++) {
      const plan = state.cardDecks.training.pop();
      if (plan) drawnPlans.push(plan);
    }
    player.trainingPlans = drawnPlans;
  });

  state.pendingAction = {
    id: `setup_choose_plans_${Date.now()}`,
    type: 'draw_training_plan',
    playerId: 'all',
    prompt: '选择1-2项培养计划保留',
    options: [],
    timeoutMs: 120000,
  };

  broadcastGameState(roomId);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Room creation
  socket.on('room:create', (data) => {
    try {
      const { roomId, playerId } = roomManager.createRoom(
        data.playerName,
        socket.id,
        data.diceOption
      );

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.playerId = playerId;

      const room = roomManager.getRoom(roomId);
      if (room) {
        const state = initializeGameState(roomId, room.players);
        gameStates.set(roomId, state);
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
        data.diceOption
      );

      socket.join(data.roomId);
      socket.data.roomId = data.roomId;
      socket.data.playerId = playerId;

      const room = roomManager.getRoom(data.roomId);
      if (room) {
        const state = gameStates.get(data.roomId);
        if (state) {
          state.players = room.players;
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

  // Game start
  socket.on('game:start', () => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;

    const room = roomManager.getRoom(roomId);
    const state = gameStates.get(roomId);

    if (!room || !state) return;

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

    room.phase = 'playing';
    state.phase = 'setup_plans';
    state.turnNumber = 1;

    handleSetupDrawTrainingPlans(roomId);

    addLog(state, 'system', 'Game started!');
    broadcastGameState(roomId);

    io.to(roomId).emit('game:announcement', {
      message: '游戏开始！请选择培养计划',
      type: 'success',
    });
  });

  // Roll dice
  socket.on('game:roll-dice', () => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return;

    const state = gameStates.get(roomId);
    if (!state || state.phase !== 'playing') return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return;

    const diceCount = currentPlayer.diceCount;
    const values: number[] = [];
    for (let i = 0; i < diceCount; i++) {
      values.push(Math.floor(Math.random() * 6) + 1);
    }
    const total = values.reduce((a, b) => a + b, 0);

    io.to(roomId).emit('game:dice-result', {
      playerId,
      values,
      total,
    });

    addLog(state, playerId, `${currentPlayer.name} 投出了 ${values.join('+')}=${total}`);
    broadcastGameState(roomId);
  });

  // Choose action
  socket.on('game:choose-action', (data) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return;

    const state = gameStates.get(roomId);
    if (!state || !state.pendingAction) return;

    console.log(`Player ${playerId} chose action ${data.actionId}: ${data.choice}`);
  });

  // Use card
  socket.on('game:use-card', (data) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return;

    const state = gameStates.get(roomId);
    if (!state) return;

    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    const card = player.heldCards.find((c) => c.id === data.cardId);
    if (!card) return;

    card.effects.forEach((effect) => {
      if (effect.stat && effect.delta) {
        if (effect.stat === 'money') player.money += effect.delta;
        if (effect.stat === 'gpa') player.gpa += effect.delta;
        if (effect.stat === 'exploration') player.exploration += effect.delta;
      }
    });

    addLog(state, playerId, `${player.name} 使用了 ${card.name}`);
    player.heldCards = player.heldCards.filter((c) => c.id !== data.cardId);

    if (card.returnToDeck) {
      if (card.deckType === 'chance') {
        state.discardPiles.chance.push(card);
      } else {
        state.discardPiles.destiny.push(card);
      }
    }

    broadcastGameState(roomId);
  });

  // Confirm training plan
  socket.on('game:confirm-plan', (data) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return;

    const state = gameStates.get(roomId);
    if (!state) return;

    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    const plan = player.trainingPlans.find((p) => p.id === data.planId);
    if (!plan) return;

    plan.confirmed = true;
    player.confirmedPlans.push(plan.id);

    addLog(state, playerId, `${player.name} 确认了培养计划: ${plan.name}`);
    broadcastGameState(roomId);
  });

  // Chat
  socket.on('game:chat', (data) => {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return;

    const state = gameStates.get(roomId);
    if (!state) return;

    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    io.to(roomId).emit('game:chat', {
      playerName: player.name,
      message: data.message,
    });
  });

  // Reconnection
  socket.on('room:reconnect', (data) => {
    const room = roomManager.getRoom(data.roomId);
    if (!room) {
      socket.emit('room:error', { message: 'Room not found' });
      return;
    }

    const player = room.players.find((p) => p.id === data.playerId);
    if (!player) {
      socket.emit('room:error', { message: 'Player not found' });
      return;
    }

    player.socketId = socket.id;
    socket.join(data.roomId);
    socket.data.roomId = data.roomId;
    socket.data.playerId = data.playerId;

    const state = gameStates.get(data.roomId);
    if (state) {
      socket.emit('game:state-update', state);
    }
  });

  // Disconnect
  socket.on('disconnect', (reason) => {
    console.log('Client disconnected:', socket.id, 'reason:', reason);

    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;

    if (roomId && playerId) {
      const state = gameStates.get(roomId);
      if (state) {
        const player = state.players.find((p) => p.id === playerId);
        if (player) {
          player.isDisconnected = true;
          addLog(state, playerId, `${player.name} 断开连接`);
          broadcastGameState(roomId);
        }
      }
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error for', socket.id, ':', error);
  });
});

// In production, serve client build
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');

  app.use(express.static(clientPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));

  app.get('*', (_, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    io.close(() => {
      console.log('Socket.IO closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    io.close(() => {
      console.log('Socket.IO closed');
      process.exit(0);
    });
  });
});
