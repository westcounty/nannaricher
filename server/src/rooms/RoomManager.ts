// server/src/rooms/RoomManager.ts
import { Player, PLAYER_COLORS, MAX_PLAYERS, Position, TrainingPlan, Card, ActiveEffect, DEFAULT_PLAN_SLOTS } from '@nannaricher/shared';
import type { GameCoordinator } from '../game/GameCoordinator.js';

export interface Room {
  roomId: string;
  hostSocketId: string;
  players: Player[];
  phase: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  lastActivity: number;
  readyPlayerIds: Set<string>;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createPlayer(name: string, socketId: string, diceCount: 1 | 2, index: number, userId?: string, authVerified?: boolean): Player {
  return {
    id: `p${Date.now()}_${index}`,
    socketId,
    userId,
    authVerified,
    name,
    color: PLAYER_COLORS[index],
    money: diceCount === 2 ? 2000 : 3000,
    gpa: 3.0,
    exploration: 0,
    position: { type: 'main', index: 0 } as Position,
    diceCount,
    trainingPlans: [] as TrainingPlan[],
    majorPlan: null,
    minorPlans: [],
    planSlotLimit: DEFAULT_PLAN_SLOTS,
    heldCards: [] as Card[],
    effects: [] as ActiveEffect[],
    skipNextTurn: false,
    isInHospital: false,
    isAtDing: false,
    isBankrupt: false,
    isDisconnected: false,
    linesVisited: [],
    lineEventsTriggered: {},
    hospitalVisits: 0,
    moneyZeroCount: 0,
    cafeteriaNoNegativeStreak: 0,
    cardsDrawnWithEnglish: 0,
    cardsDrawnWithDigitStart: [],
    chanceCardsUsedOnPlayers: {},
    gulou_endpoint_count: 0,
    modifiedWinThresholds: {},
    maxWinConditionSlots: 3,
    disabledWinConditions: [],
    lawyerShield: false,
    lastDiceValues: [],
    consecutivePositiveTurns: 0,
  };
}

/** Interval for cleanup timer (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
/** Max idle time before a room is removed (2 hours) */
const MAX_IDLE_MS = 2 * 60 * 60 * 1000;
/** Grace period after game finishes before room is cleaned up (30 minutes) */
const FINISHED_GRACE_MS = 30 * 60 * 1000;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private coordinators = new Map<string, GameCoordinator>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  createRoom(playerName: string, socketId: string, diceOption: 1 | 2, userId?: string, authVerified?: boolean) {
    let roomId: string;
    do { roomId = generateRoomCode(); } while (this.rooms.has(roomId));

    const player = createPlayer(playerName, socketId, diceOption, 0, userId, authVerified);
    const room: Room = {
      roomId,
      hostSocketId: socketId,
      players: [player],
      phase: 'waiting',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      readyPlayerIds: new Set(),
    };
    this.rooms.set(roomId, room);
    return { roomId, playerId: player.id };
  }

  joinRoom(roomId: string, playerName: string, socketId: string, diceOption: 1 | 2, userId?: string, authVerified?: boolean) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full');
    if (room.phase !== 'waiting') throw new Error('Game already started');

    const player = createPlayer(playerName, socketId, diceOption, room.players.length, userId, authVerified);
    room.players.push(player);
    room.lastActivity = Date.now();
    return { playerId: player.id };
  }

  getRoom(roomId: string) { return this.rooms.get(roomId); }
  removeRoom(roomId: string) {
    this.rooms.delete(roomId);
    this.coordinators.delete(roomId);
  }

  findRoomBySocket(socketId: string) {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.socketId === socketId)) return room;
    }
    return undefined;
  }

  updateActivity(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) room.lastActivity = Date.now();
  }

  resetPlayerForRestart(player: Player): Player {
    return {
      ...player,
      money: player.diceCount === 2 ? 2000 : 3000,
      gpa: 3.0,
      exploration: 0,
      position: { type: 'main', index: 0 } as Position,
      trainingPlans: [],
      majorPlan: null,
      minorPlans: [],
      planSlotLimit: DEFAULT_PLAN_SLOTS,
      heldCards: [],
      effects: [],
      skipNextTurn: false,
      isInHospital: false,
      isAtDing: false,
      isBankrupt: false,
      isDisconnected: false,
      linesVisited: [],
      lineEventsTriggered: {},
      hospitalVisits: 0,
      moneyZeroCount: 0,
      cafeteriaNoNegativeStreak: 0,
      cardsDrawnWithEnglish: 0,
      cardsDrawnWithDigitStart: [],
      chanceCardsUsedOnPlayers: {},
      gulou_endpoint_count: 0,
      modifiedWinThresholds: {},
      maxWinConditionSlots: 3,
      disabledWinConditions: [],
      lawyerShield: false,
      lastDiceValues: [],
      consecutivePositiveTurns: 0,
      turnStartSnapshot: undefined,
      gongguan_card_given: undefined,
    };
  }

  // --------------------------------------------------
  // Coordinator Management
  // --------------------------------------------------

  setCoordinator(roomId: string, coordinator: GameCoordinator): void {
    const old = this.coordinators.get(roomId);
    if (old) old.dispose();
    this.coordinators.set(roomId, coordinator);
  }

  getCoordinator(roomId: string): GameCoordinator | undefined {
    return this.coordinators.get(roomId);
  }

  // --------------------------------------------------
  // Disconnect Handling
  // --------------------------------------------------

  handleDisconnect(socketId: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room) return;

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return;

    const coordinator = this.coordinators.get(room.roomId);
    if (coordinator) {
      const state = coordinator.getState();
      player.isDisconnected = true;
      state.log.push({
        turn: state.turnNumber,
        playerId: player.id,
        message: `${player.name} 断开连接`,
        timestamp: Date.now(),
      });
      coordinator.broadcastState();

      // If in game, auto-handle disconnected player's pending action
      // Wait 15 seconds to give the player time to reconnect (tab switch, brief network loss)
      if (state.phase === 'playing' && state.pendingAction?.playerId === player.id) {
        setTimeout(() => {
          const coord = this.coordinators.get(room.roomId);
          if (coord) {
            const currentState = coord.getState();
            // Only auto-handle if player is STILL disconnected and action is still pending
            if (currentState.pendingAction?.playerId === player.id && player.isDisconnected) {
              coord.handleDisconnectedPlayerAction();
            }
          }
        }, 15000);
      }
    }
  }

  // --------------------------------------------------
  // Periodic Cleanup
  // --------------------------------------------------

  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [roomId, room] of this.rooms.entries()) {
        const isIdle = now - room.lastActivity > MAX_IDLE_MS;
        // Finished rooms get a grace period so players can view the settlement screen
        const isFinishedAndExpired = room.phase === 'finished'
          && now - room.lastActivity > FINISHED_GRACE_MS;
        if (isFinishedAndExpired || isIdle) {
          console.log(`[Cleanup] Removing room ${roomId} (finishedExpired=${isFinishedAndExpired}, idle=${isIdle})`);
          this.removeRoom(roomId);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
