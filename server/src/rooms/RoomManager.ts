// server/src/rooms/RoomManager.ts
import { Player, PLAYER_COLORS, MAX_PLAYERS, Position, TrainingPlan, Card, ActiveEffect } from '@nannaricher/shared';

export interface Room {
  roomId: string;
  hostSocketId: string;
  players: Player[];
  phase: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  lastActivity: number;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createPlayer(name: string, socketId: string, diceCount: 1 | 2, index: number): Player {
  return {
    id: `p${Date.now()}_${index}`,
    socketId,
    name,
    color: PLAYER_COLORS[index],
    money: diceCount === 2 ? 2000 : 3000,
    gpa: 3.0,
    exploration: 0,
    position: { type: 'main', index: 0 } as Position,
    diceCount,
    trainingPlans: [] as TrainingPlan[],
    confirmedPlans: [],
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
    lawyerShield: false,
    lastDiceValues: [],
  };
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(playerName: string, socketId: string, diceOption: 1 | 2) {
    let roomId: string;
    do { roomId = generateRoomCode(); } while (this.rooms.has(roomId));

    const player = createPlayer(playerName, socketId, diceOption, 0);
    const room: Room = {
      roomId,
      hostSocketId: socketId,
      players: [player],
      phase: 'waiting',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.rooms.set(roomId, room);
    return { roomId, playerId: player.id };
  }

  joinRoom(roomId: string, playerName: string, socketId: string, diceOption: 1 | 2) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full');
    if (room.phase !== 'waiting') throw new Error('Game already started');

    const player = createPlayer(playerName, socketId, diceOption, room.players.length);
    room.players.push(player);
    room.lastActivity = Date.now();
    return { playerId: player.id };
  }

  getRoom(roomId: string) { return this.rooms.get(roomId); }
  removeRoom(roomId: string) { this.rooms.delete(roomId); }

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
}
