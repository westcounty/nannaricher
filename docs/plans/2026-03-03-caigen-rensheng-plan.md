# 菜根人生 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web-based multiplayer board game "菜根人生" (NJU-themed Monopoly) with real-time online play for 2-4 players.

**Architecture:** React + Vite frontend with Canvas board rendering, Node.js + Express + Socket.io backend with server-authoritative game logic. Monorepo with shared TypeScript types. All game data (board, events, cards) driven by JSON config.

**Tech Stack:** TypeScript, React 18, Vite, HTML5 Canvas, Node.js, Express, Socket.io

---

## Phase 1: Project Foundation (Tasks 1-3)

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (root workspace)
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `.gitignore`

**Step 1: Initialize root workspace**

```json
// package.json
{
  "name": "nannaricher",
  "private": true,
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "npm run dev -w server",
    "dev:client": "npm run dev -w client",
    "build": "npm run build -w shared && npm run build -w server && npm run build -w client",
    "test": "npm run test -w server"
  },
  "devDependencies": {
    "concurrently": "^9.1.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Setup shared package**

```json
// shared/package.json
{
  "name": "@nannaricher/shared",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "build": "tsc" }
}
```

```json
// shared/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Setup server package**

```json
// server/package.json
{
  "name": "@nannaricher/server",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "@nannaricher/shared": "*",
    "express": "^4.21.0",
    "socket.io": "^4.8.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

Server entry point:

```typescript
// server/src/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

**Step 4: Setup client package**

```json
// client/package.json
{
  "name": "@nannaricher/client",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@nannaricher/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "socket.io-client": "^4.8.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0"
  }
}
```

```typescript
// client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true } } }
});
```

Minimal App:

```tsx
// client/src/App.tsx
export default function App() {
  return <div>菜根人生 - Loading...</div>;
}
```

**Step 5: Install dependencies and verify**

Run: `npm install && npm run dev`
Expected: Server on 3001, Client on 5173, both start without errors.

**Step 6: Commit**

```bash
git add -A ':!nul'
git commit -m "feat: scaffold monorepo with client/server/shared packages"
```

---

### Task 2: Shared Type Definitions

**Files:**
- Create: `shared/src/index.ts`
- Create: `shared/src/types.ts`
- Create: `shared/src/constants.ts`

**Step 1: Define core game types**

```typescript
// shared/src/types.ts

// === Position ===
export interface MainPosition { type: 'main'; index: number; }
export interface LinePosition { type: 'line'; lineId: string; index: number; }
export type Position = MainPosition | LinePosition;

// === Effects ===
export interface ActiveEffect {
  id: string;
  type: 'skip_turn' | 'reverse_move' | 'double_move' | 'double_event'
    | 'system_fault' | 'delayed_gratification' | 'custom';
  turnsRemaining: number;
  data?: Record<string, unknown>;
}

// === Cards ===
export interface CardEffect {
  stat?: 'money' | 'gpa' | 'exploration';
  delta?: number;
  multiplier?: number; // delta = multiplier * diceValue
  target?: 'self' | 'all' | 'choose_player' | 'richest' | 'poorest'
    | 'highest_gpa' | 'lowest_gpa' | 'highest_exp' | 'lowest_exp';
}

export interface Card {
  id: string;
  name: string;
  description: string;
  deckType: 'chance' | 'destiny';
  holdable: boolean;        // can be kept in hand
  singleUse: boolean;
  returnToDeck: boolean;    // return after use
  effects: CardEffect[];
  // Complex cards use server-side handler by id
}

export interface TrainingPlan {
  id: string;
  name: string;           // e.g. "文学院"
  winCondition: string;   // description
  passiveAbility: string; // description
  confirmed: boolean;
}

// === Player ===
export interface Player {
  id: string;
  socketId: string;
  name: string;
  color: string;
  money: number;
  gpa: number;
  exploration: number;
  position: Position;
  diceCount: 1 | 2;
  trainingPlans: TrainingPlan[];
  confirmedPlans: string[];    // ids of confirmed plans
  heldCards: Card[];
  effects: ActiveEffect[];
  skipNextTurn: boolean;
  isInHospital: boolean;
  isAtDing: boolean;
  isBankrupt: boolean;
  isDisconnected: boolean;
  linesVisited: string[];
  lineEventsTriggered: Record<string, number[]>;
  hospitalVisits: number;
  moneyZeroCount: number;
  cafeteriaNoNegativeStreak: number;
  cardsDrawnWithEnglish: number;
  cardsDrawnWithDigitStart: string[];
  chanceCardsUsedOnPlayers: Record<string, number>; // playerId -> count
  gulou_endpoint_count: number;
}

// === Pending Action (waiting for player input) ===
export interface PendingAction {
  id: string;
  playerId: string;
  type: 'choose_option' | 'roll_dice' | 'choose_player' | 'choose_line'
    | 'choose_card' | 'multi_player_choice' | 'draw_training_plan';
  prompt: string;
  options?: { label: string; value: string }[];
  targetPlayerIds?: string[];     // for multi-player choices
  responses?: Record<string, string>; // collected responses
  timeoutMs: number;
}

// === Game State ===
export type GamePhase = 'waiting' | 'setup_plans' | 'playing' | 'finished';

export interface GameState {
  roomId: string;
  phase: GamePhase;
  currentPlayerIndex: number;
  turnNumber: number;
  players: Player[];
  cardDecks: {
    chance: Card[];
    destiny: Card[];
    training: TrainingPlan[];
  };
  discardPiles: {
    chance: Card[];
    destiny: Card[];
  };
  pendingAction: PendingAction | null;
  turnOrder: number[];          // player indices
  turnOrderReversed: boolean;
  winner: string | null;        // player id
  log: GameLogEntry[];
}

export interface GameLogEntry {
  turn: number;
  playerId: string;
  message: string;
  timestamp: number;
}

// === Socket Events ===
export interface ClientToServerEvents {
  'room:create': (data: { playerName: string; diceOption: 1 | 2 }) => void;
  'room:join': (data: { roomId: string; playerName: string; diceOption: 1 | 2 }) => void;
  'game:start': () => void;
  'game:roll-dice': () => void;
  'game:choose-action': (data: { actionId: string; choice: string }) => void;
  'game:use-card': (data: { cardId: string; targetPlayerId?: string }) => void;
  'game:confirm-plan': (data: { planId: string }) => void;
  'game:chat': (data: { message: string }) => void;
  'room:reconnect': (data: { roomId: string; playerId: string }) => void;
}

export interface ServerToClientEvents {
  'room:created': (data: { roomId: string; playerId: string }) => void;
  'room:joined': (data: { playerId: string }) => void;
  'room:player-joined': (data: { playerName: string }) => void;
  'room:error': (data: { message: string }) => void;
  'game:state-update': (state: GameState) => void;
  'game:dice-result': (data: { playerId: string; values: number[]; total: number }) => void;
  'game:event-trigger': (data: { title: string; description: string; pendingAction: PendingAction }) => void;
  'game:card-drawn': (data: { card: Card; deckType: string }) => void;
  'game:announcement': (data: { message: string; type: 'info' | 'warning' | 'success' }) => void;
  'game:player-won': (data: { playerId: string; playerName: string; condition: string }) => void;
  'game:chat': (data: { playerName: string; message: string }) => void;
}
```

**Step 2: Define constants**

```typescript
// shared/src/constants.ts
export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const ROOM_CODE_LENGTH = 6;
export const SALARY_PASS = 500;
export const SALARY_STOP = 600;
export const HOSPITAL_FEE = 250;
export const HOSPITAL_DICE_TARGET = 3;
export const WAITING_ROOM_FEE = 200;
export const PLAN_CONFIRM_INTERVAL = 6; // every 6 turns
export const MAX_TRAINING_PLANS = 2;
export const INITIAL_TRAINING_DRAW = 3;
export const ACTION_TIMEOUT_MS = 60_000;
export const RECONNECT_TIMEOUT_MS = 60_000;
export const ROOM_IDLE_TIMEOUT_MS = 600_000;
export const BASE_WIN_THRESHOLD = 60; // GPA*10 + exploration >= 60
```

**Step 3: Create barrel export**

```typescript
// shared/src/index.ts
export * from './types';
export * from './constants';
```

**Step 4: Commit**

```bash
git add shared/
git commit -m "feat: add shared type definitions and constants"
```

---

### Task 3: Room Manager

**Files:**
- Create: `server/src/rooms/RoomManager.ts`
- Create: `server/src/rooms/__tests__/RoomManager.test.ts`

**Step 1: Write failing tests**

```typescript
// server/src/rooms/__tests__/RoomManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../RoomManager';

describe('RoomManager', () => {
  let rm: RoomManager;
  beforeEach(() => { rm = new RoomManager(); });

  it('creates a room and returns a 6-char code', () => {
    const { roomId } = rm.createRoom('Alice', 'socket1', 2);
    expect(roomId).toHaveLength(6);
    expect(rm.getRoom(roomId)).toBeDefined();
  });

  it('joins an existing room', () => {
    const { roomId } = rm.createRoom('Alice', 'socket1', 2);
    rm.joinRoom(roomId, 'Bob', 'socket2', 1);
    const room = rm.getRoom(roomId)!;
    expect(room.players).toHaveLength(2);
  });

  it('rejects join if room is full (4 players)', () => {
    const { roomId } = rm.createRoom('A', 's1', 1);
    rm.joinRoom(roomId, 'B', 's2', 1);
    rm.joinRoom(roomId, 'C', 's3', 1);
    rm.joinRoom(roomId, 'D', 's4', 1);
    expect(() => rm.joinRoom(roomId, 'E', 's5', 1)).toThrow('full');
  });

  it('rejects join for nonexistent room', () => {
    expect(() => rm.joinRoom('NOPE00', 'Bob', 's2', 1)).toThrow('not found');
  });

  it('removes room', () => {
    const { roomId } = rm.createRoom('Alice', 'socket1', 2);
    rm.removeRoom(roomId);
    expect(rm.getRoom(roomId)).toBeUndefined();
  });

  it('finds room by socket id', () => {
    const { roomId } = rm.createRoom('Alice', 'socket1', 2);
    expect(rm.findRoomBySocket('socket1')?.roomId).toBe(roomId);
  });
});
```

**Step 2: Run tests to verify failure**

Run: `cd server && npx vitest run src/rooms/__tests__/RoomManager.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement RoomManager**

```typescript
// server/src/rooms/RoomManager.ts
import { Player, PLAYER_COLORS, MAX_PLAYERS } from '@nannaricher/shared';

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
    position: { type: 'main', index: 0 },
    diceCount,
    trainingPlans: [],
    confirmedPlans: [],
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
```

**Step 4: Run tests to verify pass**

Run: `cd server && npx vitest run src/rooms/__tests__/RoomManager.test.ts`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add server/src/rooms/
git commit -m "feat: add RoomManager with create/join/remove and tests"
```

---

## Phase 2: Game Engine Core (Tasks 4-6)

### Task 4: Board Data - Main Board Layout

**Files:**
- Create: `server/src/data/board.ts`
- Create: `shared/src/board-types.ts`
- Update: `shared/src/index.ts`

**Step 1: Define board types in shared**

```typescript
// shared/src/board-types.ts
export type CellType = 'corner' | 'event' | 'chance' | 'line_entry';

export interface BoardCell {
  index: number;
  id: string;
  name: string;
  type: CellType;
  // For line entries
  lineId?: string;
  forceEntry?: boolean;
  entryFee?: number;
  // For corner cells
  cornerType?: 'start' | 'hospital' | 'ding' | 'waiting_room';
}

export interface LineCell {
  index: number;
  id: string;
  name: string;
  description: string;
  // Event handler id - server resolves by id
  handlerId: string;
}

export interface BoardLine {
  id: string;
  name: string;
  entryFee: number;
  forceEntry: boolean;
  cells: LineCell[];
  experienceCard: { id: string; name: string; description: string; handlerId: string; };
}

export interface BoardData {
  mainBoard: BoardCell[];
  lines: Record<string, BoardLine>;
}
```

Add to `shared/src/index.ts`: `export * from './board-types';`

**Step 2: Create main board layout**

Based on the original board image and rules doc, the outer ring has ~32 cells arranged clockwise from 起点. The exact order (referencing rules doc 事件方格 section and image):

```typescript
// server/src/data/board.ts
import { BoardData } from '@nannaricher/shared';

export const boardData: BoardData = {
  mainBoard: [
    // Corner 1: 起点/低保日
    { index: 0, id: 'start', name: '起点/低保日', type: 'corner', cornerType: 'start' },
    // Side 1: Start → Hospital
    { index: 1, id: 'tuition', name: '所有人交学费', type: 'event' },
    { index: 2, id: 'chance_1', name: '机会/命运', type: 'chance' },
    { index: 3, id: 'jiang_gong', name: '蒋公的面子', type: 'event' },
    { index: 4, id: 'line_pukou', name: '浦口线入口', type: 'line_entry', lineId: 'pukou', forceEntry: true, entryFee: 0 },
    { index: 5, id: 'retake', name: '重修', type: 'event' },
    { index: 6, id: 'chance_2', name: '机会/命运', type: 'chance' },
    { index: 7, id: 'society', name: '社团', type: 'event' },
    // Corner 2: 校医院
    { index: 8, id: 'hospital', name: '校医院', type: 'corner', cornerType: 'hospital' },
    // Side 2: Hospital → Ding
    { index: 9, id: 'line_study', name: '学在南哪入口', type: 'line_entry', lineId: 'study', forceEntry: false, entryFee: 200 },
    { index: 10, id: 'zijing', name: '紫荆站', type: 'event' },
    { index: 11, id: 'chance_3', name: '机会/命运', type: 'chance' },
    { index: 12, id: 'line_money', name: '赚在南哪入口', type: 'line_entry', lineId: 'money', forceEntry: false, entryFee: 200 },
    { index: 13, id: 'nanna_cp', name: '南哪诚品', type: 'event' },
    { index: 14, id: 'chance_4', name: '机会/命运', type: 'chance' },
    { index: 15, id: 'line_suzhou', name: '苏州线入口', type: 'line_entry', lineId: 'suzhou', forceEntry: false, entryFee: 200 },
    // Corner 3: 鼎
    { index: 16, id: 'ding', name: '鼎', type: 'corner', cornerType: 'ding' },
    // Side 3: Ding → Waiting Room
    { index: 17, id: 'line_explore', name: '乐在南哪入口', type: 'line_entry', lineId: 'explore', forceEntry: false, entryFee: 200 },
    { index: 18, id: 'kechuang', name: '科创赛事', type: 'event' },
    { index: 19, id: 'chance_5', name: '机会/命运', type: 'chance' },
    { index: 20, id: 'line_gulou', name: '鼓楼线入口', type: 'line_entry', lineId: 'gulou', forceEntry: false, entryFee: 200 },
    { index: 21, id: 'chuangmen', name: '闯门', type: 'event' },
    { index: 22, id: 'chance_6', name: '机会/命运', type: 'chance' },
    { index: 23, id: 'line_xianlin', name: '仙林线入口', type: 'line_entry', lineId: 'xianlin', forceEntry: false, entryFee: 200 },
    // Corner 4: 候车厅
    { index: 24, id: 'waiting_room', name: '候车厅', type: 'corner', cornerType: 'waiting_room' },
    // Side 4: Waiting Room → Start
    { index: 25, id: 'line_food', name: '食堂线入口', type: 'line_entry', lineId: 'food', forceEntry: true, entryFee: 0 },
    { index: 26, id: 'qingong', name: '勤工助学', type: 'event' },
    { index: 27, id: 'chance_7', name: '机会/命运', type: 'chance' },
  ],
  lines: {}, // Populated in Task 5
};

export const MAIN_BOARD_SIZE = boardData.mainBoard.length;
```

**Step 3: Commit**

```bash
git add shared/src/board-types.ts shared/src/index.ts server/src/data/
git commit -m "feat: add board data types and main board layout"
```

---

### Task 5: Board Data - All 8 Line Routes

**Files:**
- Update: `server/src/data/board.ts` (add all lines)
- Create: `server/src/data/lines/pukou.ts`
- Create: `server/src/data/lines/study.ts`
- Create: `server/src/data/lines/money.ts`
- Create: `server/src/data/lines/suzhou.ts`
- Create: `server/src/data/lines/explore.ts`
- Create: `server/src/data/lines/gulou.ts`
- Create: `server/src/data/lines/xianlin.ts`
- Create: `server/src/data/lines/food.ts`
- Create: `server/src/data/lines/index.ts`

Each line file exports a `BoardLine` object. All event handler logic is referenced by `handlerId` and implemented in Task 8. Here I just define the data structure.

**Step 1: Create all 8 line data files**

Example for pukou line (浦口线, 12 cells):

```typescript
// server/src/data/lines/pukou.ts
import { BoardLine } from '@nannaricher/shared';

export const pukouLine: BoardLine = {
  id: 'pukou',
  name: '浦口线 - 浦口校区',
  entryFee: 0,
  forceEntry: true,
  cells: [
    { index: 0, id: 'pk_1', name: '图书馆空调没有开放', description: 'GPA减少0.2', handlerId: 'pukou_library_ac' },
    { index: 1, id: 'pk_2', name: '三地奔波', description: '金钱减少200，GPA增加0.3', handlerId: 'pukou_commute' },
    { index: 2, id: 'pk_3', name: '地广人稀', description: '探索值减少2，抽一张机会卡或命运卡', handlerId: 'pukou_sparse' },
    { index: 3, id: 'pk_4', name: '潜心学习嚼菜根', description: '金钱增加100，GPA增加0.2', handlerId: 'pukou_study' },
    { index: 4, id: 'pk_5', name: '交通不便', description: '探索值减少1，抽一张机会卡或命运卡', handlerId: 'pukou_transport' },
    { index: 5, id: 'pk_6', name: '手手速报', description: '摇骰子：奇数探索值-2，偶数探索值+3', handlerId: 'pukou_shoushou' },
    { index: 6, id: 'pk_7', name: '必要设施缺失', description: '金钱+200，探索值+2，GPA-0.2', handlerId: 'pukou_facilities' },
    { index: 7, id: 'pk_8', name: '食堂及菜品匮乏', description: '下一次前进改为倒退', handlerId: 'pukou_cafeteria' },
    { index: 8, id: 'pk_9', name: '金陵学院大门', description: '探索值减少2', handlerId: 'pukou_jinling_gate' },
    { index: 9, id: 'pk_10', name: '没有IT侠', description: '金钱减少100，抽一张机会卡或命运卡', handlerId: 'pukou_no_it' },
    { index: 10, id: 'pk_11', name: '快递寄到车大成贤', description: '奇数：探索值+1；偶数：抽卡', handlerId: 'pukou_delivery' },
    { index: 11, id: 'pk_12', name: '被子被鸟屎污染', description: '金钱减少100', handlerId: 'pukou_bird' },
  ],
  experienceCard: {
    id: 'pk_exp', name: '跨校区调宿',
    description: '金钱+400，可选移动至鼓楼/仙林/苏州线入口，经过起点不领低保',
    handlerId: 'pukou_exp_card',
  },
};
```

Follow the same pattern for all 8 lines (study, money, suzhou, explore, gulou, xianlin, food). Each cell maps 1:1 to the rules document events. The `handlerId` is a unique string the game engine uses to find the event handler function.

Barrel export:

```typescript
// server/src/data/lines/index.ts
import { BoardLine } from '@nannaricher/shared';
import { pukouLine } from './pukou';
import { studyLine } from './study';
import { moneyLine } from './money';
import { suzhouLine } from './suzhou';
import { exploreLine } from './explore';
import { gulouLine } from './gulou';
import { xianlinLine } from './xianlin';
import { foodLine } from './food';

export const allLines: Record<string, BoardLine> = {
  pukou: pukouLine,
  study: studyLine,
  money: moneyLine,
  suzhou: suzhouLine,
  explore: exploreLine,
  gulou: gulouLine,
  xianlin: xianlinLine,
  food: foodLine,
};
```

Then update `server/src/data/board.ts` to import and assign `lines: allLines`.

**Step 2: Commit**

```bash
git add server/src/data/
git commit -m "feat: add all 8 line route data definitions"
```

---

### Task 6: Game Engine - Core Turn Loop

**Files:**
- Create: `server/src/game/GameEngine.ts`
- Create: `server/src/game/dice.ts`
- Create: `server/src/game/__tests__/GameEngine.test.ts`
- Create: `server/src/game/__tests__/dice.test.ts`

**Step 1: Write dice utility with tests**

```typescript
// server/src/game/__tests__/dice.test.ts
import { describe, it, expect } from 'vitest';
import { rollDice } from '../dice';

describe('rollDice', () => {
  it('returns 1 value for single dice', () => {
    const result = rollDice(1);
    expect(result.values).toHaveLength(1);
    expect(result.values[0]).toBeGreaterThanOrEqual(1);
    expect(result.values[0]).toBeLessThanOrEqual(6);
    expect(result.total).toBe(result.values[0]);
  });

  it('returns 2 values for double dice', () => {
    const result = rollDice(2);
    expect(result.values).toHaveLength(2);
    expect(result.total).toBe(result.values[0] + result.values[1]);
  });
});
```

```typescript
// server/src/game/dice.ts
export function rollDice(count: 1 | 2): { values: number[]; total: number } {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(Math.floor(Math.random() * 6) + 1);
  }
  return { values, total: values.reduce((a, b) => a + b, 0) };
}

export function rollSingleDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}
```

**Step 2: Write GameEngine core tests**

```typescript
// server/src/game/__tests__/GameEngine.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../GameEngine';
import { Player } from '@nannaricher/shared';

function makePlayer(id: string, index: number): Player {
  return {
    id, socketId: `s_${id}`, name: `Player${index}`, color: '#000',
    money: 2000, gpa: 3.0, exploration: 0,
    position: { type: 'main', index: 0 }, diceCount: 2,
    trainingPlans: [], confirmedPlans: [], heldCards: [], effects: [],
    skipNextTurn: false, isInHospital: false, isAtDing: false,
    isBankrupt: false, isDisconnected: false, linesVisited: [],
    lineEventsTriggered: {}, hospitalVisits: 0, moneyZeroCount: 0,
    cafeteriaNoNegativeStreak: 0, cardsDrawnWithEnglish: 0,
    cardsDrawnWithDigitStart: [], chanceCardsUsedOnPlayers: {},
    gulou_endpoint_count: 0,
  };
}

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine([makePlayer('p1', 0), makePlayer('p2', 1)]);
  });

  it('initializes with correct state', () => {
    const state = engine.getState();
    expect(state.phase).toBe('playing');
    expect(state.players).toHaveLength(2);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.turnNumber).toBe(1);
  });

  it('moves player forward on dice roll', () => {
    engine.processDiceRoll([3]); // force dice to 3
    const player = engine.getState().players[0];
    expect(player.position).toEqual({ type: 'main', index: 3 });
  });

  it('wraps around the board and pays salary on passing start', () => {
    const state = engine.getState();
    state.players[0].position = { type: 'main', index: 26 };
    engine.processDiceRoll([4]); // 26 + 4 = 30 → wraps to index 2 (board size 28)
    const player = engine.getState().players[0];
    expect(player.position.type).toBe('main');
    expect(player.money).toBe(2500); // passed start: +500
  });

  it('pays double salary when landing on start', () => {
    const state = engine.getState();
    state.players[0].position = { type: 'main', index: 25 };
    engine.processDiceRoll([3]); // 25 + 3 = 28 → wraps to 0
    const player = engine.getState().players[0];
    expect((player.position as any).index).toBe(0);
    expect(player.money).toBe(2600); // stopped on start: +600
  });

  it('advances to next player after turn', () => {
    engine.processDiceRoll([2]);
    engine.endTurn();
    expect(engine.getState().currentPlayerIndex).toBe(1);
  });

  it('skips bankrupt players', () => {
    engine.getState().players[1].isBankrupt = true;
    engine.processDiceRoll([2]);
    engine.endTurn();
    // Should wrap back to player 0 since player 1 is bankrupt
    expect(engine.getState().currentPlayerIndex).toBe(0);
  });

  it('checks base win condition', () => {
    const p = engine.getState().players[0];
    p.gpa = 4.0; // 4.0 * 10 = 40
    p.exploration = 20; // 40 + 20 = 60 >= 60
    expect(engine.checkWinConditions(p.id)).toBe(true);
  });

  it('detects bankruptcy when money < 0', () => {
    const p = engine.getState().players[0];
    p.money = -1;
    engine.checkBankruptcy(p.id);
    expect(p.isBankrupt).toBe(true);
  });
});
```

**Step 3: Implement GameEngine**

```typescript
// server/src/game/GameEngine.ts
import {
  GameState, Player, Position, PendingAction,
  GameLogEntry, SALARY_PASS, SALARY_STOP, BASE_WIN_THRESHOLD,
} from '@nannaricher/shared';
import { boardData, MAIN_BOARD_SIZE } from '../data/board';

export class GameEngine {
  private state: GameState;

  constructor(players: Player[]) {
    this.state = {
      roomId: '',
      phase: 'playing',
      currentPlayerIndex: 0,
      turnNumber: 1,
      players: [...players],
      cardDecks: { chance: [], destiny: [], training: [] },
      discardPiles: { chance: [], destiny: [] },
      pendingAction: null,
      turnOrder: players.map((_, i) => i),
      turnOrderReversed: false,
      winner: null,
      log: [],
    };
  }

  getState(): GameState { return this.state; }

  getCurrentPlayer(): Player {
    return this.state.players[this.state.turnOrder[this.state.currentPlayerIndex]];
  }

  processDiceRoll(forcedValues?: number[]): { values: number[]; total: number } {
    const player = this.getCurrentPlayer();
    const values = forcedValues ?? Array.from(
      { length: player.diceCount },
      () => Math.floor(Math.random() * 6) + 1
    );
    const total = values.reduce((a, b) => a + b, 0);

    // Check reverse move effect
    const reverseIdx = player.effects.findIndex(e => e.type === 'reverse_move');
    const direction = reverseIdx >= 0 ? -1 : 1;
    if (reverseIdx >= 0) player.effects.splice(reverseIdx, 1);

    // Check double move effect
    const doubleIdx = player.effects.findIndex(e => e.type === 'double_move');
    const multiplier = doubleIdx >= 0 ? 2 : 1;
    if (doubleIdx >= 0) player.effects.splice(doubleIdx, 1);

    if (player.position.type === 'main') {
      this.moveOnMainBoard(player, total * multiplier * direction);
    } else {
      this.moveOnLine(player, total * multiplier);
    }

    return { values, total };
  }

  private moveOnMainBoard(player: Player, steps: number) {
    const pos = player.position as { type: 'main'; index: number };
    const oldIndex = pos.index;
    let newIndex = (oldIndex + steps + MAIN_BOARD_SIZE) % MAIN_BOARD_SIZE;

    // Check if passed start (index 0)
    if (steps > 0 && (newIndex < oldIndex || newIndex === 0)) {
      if (newIndex === 0) {
        player.money += SALARY_STOP;
      } else {
        player.money += SALARY_PASS;
      }
    }

    player.position = { type: 'main', index: newIndex };
  }

  private moveOnLine(player: Player, steps: number) {
    const pos = player.position as { type: 'line'; lineId: string; index: number };
    const line = boardData.lines[pos.lineId];
    if (!line) return;

    const newIndex = Math.min(pos.index + steps, line.cells.length - 1);
    player.position = { type: 'line', lineId: pos.lineId, index: newIndex };

    // If reached or passed end, will trigger experience card (handled by event system)
  }

  endTurn() {
    let next = (this.state.currentPlayerIndex + 1) % this.state.players.length;
    // Skip bankrupt/disconnected players
    let attempts = 0;
    while (attempts < this.state.players.length) {
      const idx = this.state.turnOrder[next];
      const p = this.state.players[idx];
      if (!p.isBankrupt && !p.isDisconnected) break;
      next = (next + 1) % this.state.players.length;
      attempts++;
    }
    this.state.currentPlayerIndex = next;
    this.state.turnNumber++;
  }

  checkWinConditions(playerId: string): boolean {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;
    return player.gpa * 10 + player.exploration >= BASE_WIN_THRESHOLD;
  }

  checkBankruptcy(playerId: string) {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;
    if (player.money < 0) {
      player.isBankrupt = true;
      this.addLog(playerId, `${player.name} 破产了！`);
    }
    if (player.money === 0) player.moneyZeroCount++;
  }

  applyStatChange(playerId: string, stat: 'money' | 'gpa' | 'exploration', delta: number) {
    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return;
    if (stat === 'money') {
      player.money += delta;
    } else if (stat === 'gpa') {
      player.gpa = Math.max(0, +(player.gpa + delta).toFixed(1));
    } else {
      player.exploration = Math.max(0, player.exploration + delta);
    }
  }

  addLog(playerId: string, message: string) {
    this.state.log.push({
      turn: this.state.turnNumber,
      playerId,
      message,
      timestamp: Date.now(),
    });
  }
}
```

**Step 4: Run all tests**

Run: `cd server && npx vitest run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add server/src/game/
git commit -m "feat: add GameEngine core with turn loop, movement, win/bankrupt checks"
```

---

## Phase 3: Event & Card Systems (Tasks 7-9)

### Task 7: Card Data - Destiny & Chance Cards

**Files:**
- Create: `server/src/data/cards/destiny-cards.ts`
- Create: `server/src/data/cards/chance-cards.ts`
- Create: `server/src/data/cards/training-plans.ts`
- Create: `server/src/data/cards/index.ts`

**Step 1: Define all destiny cards (命运卡)**

Create `destiny-cards.ts` with an array of Card objects, one per destiny card from the rules doc (约50张). Each card has a unique `id`, `name`, `description`, and `handlerId` for complex logic. Simple stat changes use the `effects` array directly.

Example entries:

```typescript
// server/src/data/cards/destiny-cards.ts
import { Card } from '@nannaricher/shared';

export const destinyCards: Card[] = [
  // Holdable cards
  { id: 'dc_maimen', name: '麦门护盾', description: '食堂线屏蔽负面效果一次',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_timely_stop', name: '及时止损', description: '取消自己即将执行的格子事件',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_rush', name: '工期紧迫', description: '直接离开校医院或鼎',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_negative_balance', name: '余额为负', description: '抵消一次不小于当前金钱的支出',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_exam_paper', name: '祖传试卷', description: '抵消一次GPA负面效果',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_scout', name: '投石问路', description: '抵消一次金钱负面效果',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_campus_legend_card', name: '校园传说', description: '抵消一次探索值负面效果',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_shortcut', name: '另辟蹊径', description: '线内直接移动到终点，不领经验卡',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_mass_enrollment', name: '大类招生', description: '延迟一回合选定培养计划',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_cross_college', name: '跨院准出', description: '取消一个已固定的培养方案',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_major_intent', name: '专业意向', description: '提前一回合固定培养方案，获得0.1GPA和1探索值',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_familiar_road', name: '轻车熟路', description: '线终点领经验卡后可重新进入该线',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_explain', name: '如何解释', description: '取消本次格子事件',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  { id: 'dc_drum_beat', name: '鼓点重奏', description: '再投一次骰子，选择一次结果',
    deckType: 'destiny', holdable: true, singleUse: true, returnToDeck: true, effects: [] },
  // Direct effect cards (not holdable)
  { id: 'dc_boss', name: 'BOSS直聘', description: '加入四无黑工厂，投骰子，探索值重置为点数*0.1*当前值',
    deckType: 'destiny', holdable: false, singleUse: false, returnToDeck: false, effects: [] },
  { id: 'dc_sustainable', name: '可持续性', description: '金钱增加300',
    deckType: 'destiny', holdable: false, singleUse: false, returnToDeck: false,
    effects: [{ stat: 'money', delta: 300 }] },
  { id: 'dc_survive', name: '存活下去', description: '金钱减少300',
    deckType: 'destiny', holdable: false, singleUse: false, returnToDeck: false,
    effects: [{ stat: 'money', delta: -300 }] },
  // ... (continue for all ~50 destiny cards from the rules)
  // Movement cards
  { id: 'dc_peking_uni', name: '北京大学', description: '直接移动到浦口线，强制进入',
    deckType: 'destiny', holdable: false, singleUse: false, returnToDeck: false, effects: [] },
  { id: 'dc_chew_root', name: '嚼得菜根', description: '直接移动到学习线',
    deckType: 'destiny', holdable: false, singleUse: false, returnToDeck: false, effects: [] },
  // ... all other destiny cards
];
```

**Step 2: Define all chance cards (机会卡)**

Same pattern in `chance-cards.ts`, ~40 cards. Many are multi-player interaction cards with `handlerId` for complex logic.

**Step 3: Define all training plans (培养计划)**

```typescript
// server/src/data/cards/training-plans.ts
import { TrainingPlan } from '@nannaricher/shared';

export const trainingPlans: TrainingPlan[] = [
  { id: 'tp_literature', name: '文学院',
    winCondition: '离开赚在南哪线时金钱未变化',
    passiveAbility: '蒋公的面子改为：获得100金钱，或喊不吃获得2探索值',
    confirmed: false },
  { id: 'tp_history', name: '历史学院',
    winCondition: '按顺序经过鼓楼、浦口、仙林、苏州校区线',
    passiveAbility: '移动到鼓楼线入口',
    confirmed: false },
  // ... all 33 training plans from the rules
  { id: 'tp_marxism', name: '马克思主义学院',
    winCondition: 'GPA达到4.5',
    passiveAbility: '社团格子改为直接获得2探索值',
    confirmed: false },
];
```

**Step 4: Barrel export and commit**

```typescript
// server/src/data/cards/index.ts
export { destinyCards } from './destiny-cards';
export { chanceCards } from './chance-cards';
export { trainingPlans } from './training-plans';
```

```bash
git add server/src/data/cards/
git commit -m "feat: add all card data (destiny, chance, training plans)"
```

---

### Task 8: Event Handler System

**Files:**
- Create: `server/src/game/EventHandler.ts`
- Create: `server/src/game/handlers/main-board-handlers.ts`
- Create: `server/src/game/handlers/line-handlers.ts`
- Create: `server/src/game/handlers/card-handlers.ts`
- Create: `server/src/game/__tests__/EventHandler.test.ts`

The event handler system maps `handlerId` strings to handler functions. Each handler receives the GameEngine and current player, and returns either immediate effects or a PendingAction requiring player input.

**Step 1: Write failing tests**

```typescript
// server/src/game/__tests__/EventHandler.test.ts
import { describe, it, expect } from 'vitest';
import { EventHandler } from '../EventHandler';
import { GameEngine } from '../GameEngine';

describe('EventHandler', () => {
  it('resolves tuition event: pay (5.0 - GPA) * 100', () => {
    // Player with GPA 3.0 pays (5.0-3.0)*100 = 200
    const engine = createTestEngine(); // helper
    const player = engine.getState().players[0];
    player.gpa = 3.0;
    player.money = 2000;

    const handler = new EventHandler(engine);
    handler.execute('tuition', player.id);

    expect(player.money).toBe(1800); // 2000 - 200
  });

  it('returns PendingAction for choice events', () => {
    const engine = createTestEngine();
    const player = engine.getState().players[0];
    const handler = new EventHandler(engine);

    const result = handler.execute('jiang_gong', player.id);
    expect(result?.type).toBe('choose_option');
    expect(result?.options).toHaveLength(2);
  });
});
```

**Step 2: Implement EventHandler**

```typescript
// server/src/game/EventHandler.ts
import { PendingAction, ACTION_TIMEOUT_MS } from '@nannaricher/shared';
import { GameEngine } from './GameEngine';

type HandlerFn = (engine: GameEngine, playerId: string) => PendingAction | null;

export class EventHandler {
  private handlers = new Map<string, HandlerFn>();
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.registerAllHandlers();
  }

  execute(handlerId: string, playerId: string): PendingAction | null {
    const handler = this.handlers.get(handlerId);
    if (!handler) {
      console.warn(`No handler for: ${handlerId}`);
      return null;
    }
    return handler(this.engine, playerId);
  }

  resolveChoice(actionId: string, playerId: string, choice: string) {
    // Process the choice for a pending action
    // Implemented per-handler with a resolution map
  }

  private registerAllHandlers() {
    // Main board events
    this.handlers.set('tuition', (engine, pid) => {
      const p = engine.getState().players.find(pl => pl.id === pid)!;
      const amount = Math.round((5.0 - p.gpa) * 100);
      // ALL players pay
      for (const player of engine.getState().players) {
        if (!player.isBankrupt) {
          const fee = Math.round((5.0 - player.gpa) * 100);
          engine.applyStatChange(player.id, 'money', -fee);
          engine.addLog(player.id, `交学费 ${fee} 金钱`);
        }
      }
      return null;
    });

    this.handlers.set('jiang_gong', (engine, pid) => ({
      id: `action_${Date.now()}`,
      playerId: pid,
      type: 'choose_option',
      prompt: '蒋公的面子：你必须选择一项执行',
      options: [
        { label: '支付300金钱，获得3探索值', value: 'pay' },
        { label: '损失2探索值，获得200金钱', value: 'gain' },
      ],
      timeoutMs: ACTION_TIMEOUT_MS,
    }));

    // ... register all handlers for main board, lines, cards
    // Each handler follows the same pattern:
    // - Direct effects: apply immediately, return null
    // - Choices: return PendingAction with options
    // - Dice checks: roll dice, apply effects based on result
  }
}
```

**Step 3: Create handler files for main board, lines, and cards**

`main-board-handlers.ts` - handlers for tuition, jiang_gong, retake, society, zijing, nanna_cp, kechuang, chuangmen, qingong, and corner events (hospital, ding, waiting_room).

`line-handlers.ts` - handlers for all events in all 8 lines + experience cards.

`card-handlers.ts` - handlers for destiny cards, chance cards, and training plan effects.

Each file exports a function `registerHandlers(handlerMap)` that adds entries.

**Step 4: Run tests, commit**

```bash
git add server/src/game/
git commit -m "feat: add event handler system with main board and line event handlers"
```

---

### Task 9: Socket.io Integration - Wire Server Events

**Files:**
- Create: `server/src/SocketHandler.ts`
- Update: `server/src/index.ts`

**Step 1: Implement SocketHandler**

```typescript
// server/src/SocketHandler.ts
import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@nannaricher/shared';
import { RoomManager } from './rooms/RoomManager';
import { GameEngine } from './game/GameEngine';
import { EventHandler } from './game/EventHandler';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Store game engines per room
const games = new Map<string, { engine: GameEngine; eventHandler: EventHandler }>();

export function setupSocketHandlers(io: TypedServer, roomManager: RoomManager) {
  io.on('connection', (socket: TypedSocket) => {
    socket.on('room:create', ({ playerName, diceOption }) => {
      const { roomId, playerId } = roomManager.createRoom(playerName, socket.id, diceOption);
      socket.join(roomId);
      socket.emit('room:created', { roomId, playerId });
    });

    socket.on('room:join', ({ roomId, playerName, diceOption }) => {
      try {
        const { playerId } = roomManager.joinRoom(roomId, playerName, socket.id, diceOption);
        socket.join(roomId);
        socket.emit('room:joined', { playerId });
        io.to(roomId).emit('room:player-joined', { playerName });
        // Send current room state
        const room = roomManager.getRoom(roomId)!;
        io.to(roomId).emit('game:state-update', buildWaitingState(room));
      } catch (e: any) {
        socket.emit('room:error', { message: e.message });
      }
    });

    socket.on('game:start', () => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room || room.hostSocketId !== socket.id) return;
      if (room.players.length < 2) {
        socket.emit('room:error', { message: '至少需要2名玩家' });
        return;
      }
      room.phase = 'playing';
      const engine = new GameEngine(room.players);
      const eventHandler = new EventHandler(engine);
      games.set(room.roomId, { engine, eventHandler });
      io.to(room.roomId).emit('game:state-update', engine.getState());
    });

    socket.on('game:roll-dice', () => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) return;
      const game = games.get(room.roomId);
      if (!game) return;
      const currentPlayer = game.engine.getCurrentPlayer();
      if (currentPlayer.socketId !== socket.id) return;

      const result = game.engine.processDiceRoll();
      io.to(room.roomId).emit('game:dice-result', {
        playerId: currentPlayer.id, values: result.values, total: result.total,
      });

      // Resolve cell event at new position
      // ... (trigger event handler based on cell)

      io.to(room.roomId).emit('game:state-update', game.engine.getState());
    });

    socket.on('game:choose-action', ({ actionId, choice }) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) return;
      const game = games.get(room.roomId);
      if (!game) return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      game.eventHandler.resolveChoice(actionId, player.id, choice);

      // Check win/bankrupt, then advance turn or continue
      game.engine.checkBankruptcy(player.id);
      if (game.engine.checkWinConditions(player.id)) {
        io.to(room.roomId).emit('game:player-won', {
          playerId: player.id, playerName: player.name, condition: 'base',
        });
      }

      io.to(room.roomId).emit('game:state-update', game.engine.getState());
    });

    socket.on('game:chat', ({ message }) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      io.to(room.roomId).emit('game:chat', { playerName: player.name, message });
    });

    socket.on('disconnect', () => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) player.isDisconnected = true;
      // Start reconnect timer...
    });
  });
}
```

**Step 2: Update server entry point**

```typescript
// server/src/index.ts - update to use SocketHandler
import { setupSocketHandlers } from './SocketHandler';
import { RoomManager } from './rooms/RoomManager';

// ... after creating io
const roomManager = new RoomManager();
setupSocketHandlers(io, roomManager);
```

**Step 3: Verify server starts**

Run: `npm run dev:server`
Expected: "Server running on port 3001" with no errors

**Step 4: Commit**

```bash
git add server/src/
git commit -m "feat: add Socket.io handler wiring room and game events"
```

---

## Phase 4: Client Foundation (Tasks 10-12)

### Task 10: React App Shell + Socket Hook

**Files:**
- Create: `client/src/hooks/useSocket.ts`
- Create: `client/src/hooks/useGameState.ts`
- Create: `client/src/context/GameContext.tsx`
- Update: `client/src/App.tsx`
- Update: `client/src/main.tsx`
- Create: `client/src/styles/global.css`

**Step 1: Create socket hook**

```typescript
// client/src/hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@nannaricher/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    const socket: TypedSocket = io(
      window.location.hostname === 'localhost'
        ? 'http://localhost:3001'
        : window.location.origin
    );
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []);

  return socketRef;
}
```

**Step 2: Create game state context**

```typescript
// client/src/context/GameContext.tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { GameState, PendingAction } from '@nannaricher/shared';

interface GameCtx {
  roomId: string | null;
  playerId: string | null;
  gameState: GameState | null;
  pendingAction: PendingAction | null;
  setRoomId: (id: string) => void;
  setPlayerId: (id: string) => void;
  setGameState: (state: GameState) => void;
  setPendingAction: (action: PendingAction | null) => void;
}

const GameContext = createContext<GameCtx>(null!);
export const useGame = () => useContext(GameContext);

export function GameProvider({ children }: { children: ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  return (
    <GameContext.Provider value={{
      roomId, playerId, gameState, pendingAction,
      setRoomId, setPlayerId, setGameState, setPendingAction,
    }}>
      {children}
    </GameContext.Provider>
  );
}
```

**Step 3: Wire App with router-like screens**

```tsx
// client/src/App.tsx
import { useGame, GameProvider } from './context/GameContext';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';

function AppInner() {
  const { gameState } = useGame();
  if (!gameState || gameState.phase === 'waiting') return <LobbyScreen />;
  return <GameScreen />;
}

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
```

**Step 4: Add global styles**

```css
/* client/src/styles/global.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Noto Sans SC', sans-serif; background: #1a1a2e; color: #eee; }
```

**Step 5: Commit**

```bash
git add client/src/
git commit -m "feat: add React app shell with socket hook and game context"
```

---

### Task 11: Lobby Screen (Create/Join Room)

**Files:**
- Create: `client/src/components/LobbyScreen.tsx`
- Create: `client/src/components/RoomWaiting.tsx`

**Step 1: Implement LobbyScreen**

```tsx
// client/src/components/LobbyScreen.tsx
import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useGame } from '../context/GameContext';
import { RoomWaiting } from './RoomWaiting';

export function LobbyScreen() {
  const socketRef = useSocket();
  const { roomId, setRoomId, setPlayerId, setGameState } = useGame();
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [diceOption, setDiceOption] = useState<1 | 2>(2);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('room:created', ({ roomId, playerId }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
    });
    socket.on('room:joined', ({ playerId }) => { setPlayerId(playerId); });
    socket.on('room:error', ({ message }) => { setError(message); });
    socket.on('game:state-update', (state) => { setGameState(state); });

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:error');
      socket.off('game:state-update');
    };
  }, [socketRef.current]);

  if (roomId) return <RoomWaiting />;

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>菜根人生</h1>
      <p style={{ color: '#888', marginBottom: 32 }}>南京大学主题大富翁</p>

      <input placeholder="你的名字" value={playerName}
        onChange={e => setPlayerName(e.target.value)}
        style={{ width: '100%', padding: 12, marginBottom: 12, borderRadius: 8 }} />

      <div style={{ marginBottom: 16 }}>
        <label><input type="radio" checked={diceOption === 2}
          onChange={() => setDiceOption(2)} /> 双骰 (金钱2000)</label>
        <label style={{ marginLeft: 16 }}><input type="radio" checked={diceOption === 1}
          onChange={() => setDiceOption(1)} /> 单骰 (金钱3000)</label>
      </div>

      <button onClick={() => {
        if (!playerName.trim()) return;
        socketRef.current?.emit('room:create', { playerName, diceOption });
      }} style={{ width: '100%', padding: 12, marginBottom: 8, borderRadius: 8,
        background: '#e74c3c', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16 }}>
        创建房间
      </button>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input placeholder="房间号" value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          style={{ flex: 1, padding: 12, borderRadius: 8 }} />
        <button onClick={() => {
          if (!playerName.trim() || !joinCode.trim()) return;
          socketRef.current?.emit('room:join', { roomId: joinCode, playerName, diceOption });
        }} style={{ padding: '12px 24px', borderRadius: 8,
          background: '#3498db', color: '#fff', border: 'none', cursor: 'pointer' }}>
          加入
        </button>
      </div>

      {error && <p style={{ color: '#e74c3c', marginTop: 12 }}>{error}</p>}
    </div>
  );
}
```

**Step 2: Implement RoomWaiting**

```tsx
// client/src/components/RoomWaiting.tsx
import { useSocket } from '../hooks/useSocket';
import { useGame } from '../context/GameContext';

export function RoomWaiting() {
  const socketRef = useSocket();
  const { roomId, gameState } = useGame();

  const players = gameState?.players ?? [];
  const isHost = gameState?.players[0]?.socketId === socketRef.current?.id;

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
      <h2>等待玩家加入</h2>
      <p style={{ fontSize: 32, fontFamily: 'monospace', margin: '16px 0', color: '#f39c12' }}>
        {roomId}
      </p>
      <p style={{ color: '#888' }}>分享房间号给朋友</p>

      <div style={{ margin: '24px 0' }}>
        {players.map((p, i) => (
          <div key={p.id} style={{ padding: 8, background: '#2a2a4a', margin: 4, borderRadius: 8,
            borderLeft: `4px solid ${p.color}` }}>
            {p.name} {i === 0 ? '(房主)' : ''} - {p.diceCount === 2 ? '双骰' : '单骰'}
          </div>
        ))}
      </div>

      {isHost && players.length >= 2 && (
        <button onClick={() => socketRef.current?.emit('game:start')}
          style={{ padding: '12px 32px', borderRadius: 8,
            background: '#2ecc71', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18 }}>
          开始游戏
        </button>
      )}
    </div>
  );
}
```

**Step 3: Verify lobby works**

Run: `npm run dev`
Open browser → should see lobby with create/join. Create room → see room code. Open second tab → join with code.

**Step 4: Commit**

```bash
git add client/src/components/
git commit -m "feat: add lobby screen with create/join room UI"
```

---

### Task 12: Game Screen Layout + Player Panel

**Files:**
- Create: `client/src/components/GameScreen.tsx`
- Create: `client/src/components/PlayerPanel.tsx`
- Create: `client/src/components/TopBar.tsx`
- Create: `client/src/components/ActionBar.tsx`

**Step 1: Implement GameScreen layout**

```tsx
// client/src/components/GameScreen.tsx
import { useGame } from '../context/GameContext';
import { TopBar } from './TopBar';
import { PlayerPanel } from './PlayerPanel';
import { ActionBar } from './ActionBar';
import { BoardCanvas } from '../canvas/BoardCanvas';

export function GameScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <BoardCanvas />
        </div>
        <PlayerPanel />
      </div>
      <ActionBar />
    </div>
  );
}
```

**Step 2: Implement PlayerPanel**

```tsx
// client/src/components/PlayerPanel.tsx
import { useGame } from '../context/GameContext';

export function PlayerPanel() {
  const { gameState } = useGame();
  if (!gameState) return null;

  return (
    <div style={{ width: 260, background: '#16213e', padding: 12, overflowY: 'auto' }}>
      <h3 style={{ marginBottom: 12 }}>玩家</h3>
      {gameState.players.map((p, i) => {
        const isCurrent = gameState.turnOrder[gameState.currentPlayerIndex] === i;
        return (
          <div key={p.id} style={{
            padding: 12, marginBottom: 8, borderRadius: 8,
            background: isCurrent ? '#1a3a5c' : '#0f3460',
            borderLeft: `4px solid ${p.color}`,
            opacity: p.isBankrupt ? 0.4 : 1,
          }}>
            <div style={{ fontWeight: 'bold' }}>{p.name} {isCurrent ? '◀' : ''}</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              <span>💰 {p.money}</span>
              <span style={{ marginLeft: 12 }}>📊 {p.gpa.toFixed(1)}</span>
              <span style={{ marginLeft: 12 }}>🐋 {p.exploration}</span>
            </div>
            {p.trainingPlans.length > 0 && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                {p.trainingPlans.map(tp => (
                  <div key={tp.id}>
                    {tp.name} {p.confirmedPlans.includes(tp.id) ? '✅' : ''}
                  </div>
                ))}
              </div>
            )}
            {p.isBankrupt && <div style={{ color: '#e74c3c', fontSize: 12 }}>已破产</div>}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Implement TopBar and ActionBar**

```tsx
// client/src/components/TopBar.tsx
import { useGame } from '../context/GameContext';

export function TopBar() {
  const { roomId, gameState } = useGame();
  const currentPlayer = gameState
    ? gameState.players[gameState.turnOrder[gameState.currentPlayerIndex]]
    : null;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 16px', background: '#0f3460' }}>
      <span>房间: {roomId}</span>
      <span>回合 {gameState?.turnNumber ?? 0}</span>
      <span style={{ color: currentPlayer?.color }}>
        当前: {currentPlayer?.name ?? '...'}
      </span>
    </div>
  );
}
```

```tsx
// client/src/components/ActionBar.tsx
import { useSocket } from '../hooks/useSocket';
import { useGame } from '../context/GameContext';

export function ActionBar() {
  const socketRef = useSocket();
  const { gameState, playerId } = useGame();

  const currentPlayer = gameState
    ? gameState.players[gameState.turnOrder[gameState.currentPlayerIndex]]
    : null;
  const isMyTurn = currentPlayer?.id === playerId;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12,
      background: '#16213e' }}>
      <button
        disabled={!isMyTurn}
        onClick={() => socketRef.current?.emit('game:roll-dice')}
        style={{
          padding: '12px 32px', borderRadius: 8, fontSize: 18,
          background: isMyTurn ? '#e74c3c' : '#555', color: '#fff',
          border: 'none', cursor: isMyTurn ? 'pointer' : 'not-allowed',
        }}>
        🎲 掷骰子
      </button>
      <div style={{ flex: 1, fontSize: 14, color: '#888' }}>
        {isMyTurn ? '轮到你了！' : `等待 ${currentPlayer?.name ?? ''} 操作...`}
      </div>
    </div>
  );
}
```

**Step 4: Create placeholder BoardCanvas**

```tsx
// client/src/canvas/BoardCanvas.tsx
export function BoardCanvas() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: '#555' }}>
      棋盘加载中... (Task 13)
    </div>
  );
}
```

**Step 5: Verify layout**

Run: `npm run dev`, create room with 2 players, start game. Should see top bar, player panel, action bar, placeholder board.

**Step 6: Commit**

```bash
git add client/src/
git commit -m "feat: add game screen layout with player panel, top bar, action bar"
```

---

## Phase 5: Board Canvas Rendering (Tasks 13-14)

### Task 13: Canvas Board Renderer

**Files:**
- Update: `client/src/canvas/BoardCanvas.tsx`
- Create: `client/src/canvas/boardRenderer.ts`
- Create: `client/src/canvas/boardLayout.ts`
- Create: `client/src/canvas/colors.ts`

The board is rendered on an HTML5 Canvas. We pre-calculate cell positions in `boardLayout.ts`, then draw cells, labels, player tokens, and line routes in `boardRenderer.ts`.

**Step 1: Define cell layout coordinates**

```typescript
// client/src/canvas/boardLayout.ts
// Pre-computed (x, y, width, height) for each cell on the board.
// Outer ring is a rectangle border. Inner lines are horizontal rows.

export interface CellLayout {
  id: string;
  x: number; y: number;
  w: number; h: number;
  labelLines: string[];
}

const BOARD_W = 1200;
const BOARD_H = 1000;
const CELL_W = 100;   // outer cell width
const CELL_H = 80;    // outer cell height
const CORNER = 100;   // corner cell size

// Outer ring: 28 cells. 4 corners + 7 cells per side.
// Top row (left→right): index 0-7, 8 (corner)
// Right col (top→bottom): index 9-15, 16 (corner)
// Bottom row (right→left): index 17-23, 24 (corner)
// Left col (bottom→top): index 25-27, then wraps to 0

export function computeMainBoardLayout(): CellLayout[] {
  const layouts: CellLayout[] = [];
  // Top row: start at top-left
  // ... compute based on grid math
  // (Implementation: calculate x,y for each of the 28 cells
  //  arranged as a rectangular border)
  return layouts;
}

export function computeLineLayouts(): Record<string, CellLayout[]> {
  // 8 horizontal rows inside the board, evenly spaced
  // Each line's cells are small squares in a row
  return {};
}

export const BOARD_SIZE = { w: BOARD_W, h: BOARD_H };
```

**Step 2: Implement board renderer**

```typescript
// client/src/canvas/boardRenderer.ts
import type { GameState } from '@nannaricher/shared';
import { computeMainBoardLayout, computeLineLayouts, BOARD_SIZE } from './boardLayout';

const mainLayout = computeMainBoardLayout();
const lineLayouts = computeLineLayouts();

export function renderBoard(ctx: CanvasRenderingContext2D, state: GameState) {
  const { w, h } = BOARD_SIZE;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, w, h);

  // Draw outer cells
  for (const cell of mainLayout) {
    drawCell(ctx, cell, '#0f3460', '#e94560');
  }

  // Draw line routes
  for (const [lineId, cells] of Object.entries(lineLayouts)) {
    for (const cell of cells) {
      drawCell(ctx, cell, '#16213e', '#888');
    }
  }

  // Draw player tokens
  for (const player of state.players) {
    if (player.isBankrupt) continue;
    const pos = getPlayerPixelPosition(player.position, player.id, state.players);
    if (pos) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawCell(ctx: CanvasRenderingContext2D, cell: CellLayout,
  bgColor: string, borderColor: string) {
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
  ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);

  // Label
  ctx.fillStyle = '#ddd';
  ctx.font = '11px "Noto Sans SC"';
  ctx.textAlign = 'center';
  cell.labelLines.forEach((line, i) => {
    ctx.fillText(line, cell.x + cell.w / 2, cell.y + 16 + i * 14, cell.w - 4);
  });
}

function getPlayerPixelPosition(position: any, playerId: string, allPlayers: any[]) {
  // Find the CellLayout for the player's position, offset tokens so they don't overlap
  // ...
  return { x: 0, y: 0 }; // placeholder
}
```

**Step 3: Wire Canvas component**

```tsx
// client/src/canvas/BoardCanvas.tsx
import { useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { renderBoard } from './boardRenderer';
import { BOARD_SIZE } from './boardLayout';

export function BoardCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState } = useGame();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderBoard(ctx, gameState);
  }, [gameState]);

  return (
    <canvas ref={canvasRef}
      width={BOARD_SIZE.w} height={BOARD_SIZE.h}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}
```

**Step 4: Verify board renders**

Run: `npm run dev`, start game → should see colored cells on canvas with player tokens.

**Step 5: Commit**

```bash
git add client/src/canvas/
git commit -m "feat: add Canvas board renderer with cell layout and player tokens"
```

---

### Task 14: Canvas Pan/Zoom + Cell Tooltips

**Files:**
- Create: `client/src/canvas/useCanvasInteraction.ts`
- Update: `client/src/canvas/BoardCanvas.tsx`

**Step 1: Add pan/zoom hook**

```typescript
// client/src/canvas/useCanvasInteraction.ts
import { useRef, useEffect, useState, RefObject } from 'react';

interface Transform { offsetX: number; offsetY: number; scale: number; }

export function useCanvasInteraction(canvasRef: RefObject<HTMLCanvasElement>) {
  const [transform, setTransform] = useState<Transform>({ offsetX: 0, offsetY: 0, scale: 1 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setTransform(t => ({ ...t, scale: Math.max(0.3, Math.min(3, t.scale * factor)) }));
    };

    const onMouseDown = (e: MouseEvent) => {
      dragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setTransform(t => ({ ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY + dy }));
    };

    const onMouseUp = () => { dragging.current = false; };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Touch events for mobile
    let lastTouchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        dragging.current = true;
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / lastTouchDist;
        lastTouchDist = dist;
        setTransform(t => ({ ...t, scale: Math.max(0.3, Math.min(3, t.scale * factor)) }));
      } else if (dragging.current && e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastPos.current.x;
        const dy = e.touches[0].clientY - lastPos.current.y;
        lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setTransform(t => ({ ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY + dy }));
      }
    };
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchmove', onTouchMove);
    canvas.addEventListener('touchend', () => { dragging.current = false; });

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [canvasRef]);

  return transform;
}
```

**Step 2: Apply transform in BoardCanvas and add tooltip on hover**

Update `BoardCanvas.tsx` to apply `ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY)` before rendering, and detect which cell is hovered for tooltip display.

**Step 3: Commit**

```bash
git add client/src/canvas/
git commit -m "feat: add canvas pan/zoom and cell hover tooltips"
```

---

## Phase 6: Game Interaction UI (Tasks 15-17)

### Task 15: Dice Animation + Event Modal

**Files:**
- Create: `client/src/components/DiceAnimation.tsx`
- Create: `client/src/components/EventModal.tsx`
- Update: `client/src/components/ActionBar.tsx`

**Step 1: Dice animation component**

```tsx
// client/src/components/DiceAnimation.tsx
import { useState, useEffect } from 'react';

interface Props {
  values: number[];
  onComplete: () => void;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function DiceAnimation({ values, onComplete }: Props) {
  const [rolling, setRolling] = useState(true);
  const [display, setDisplay] = useState(values.map(() => 1));

  useEffect(() => {
    let frame = 0;
    const interval = setInterval(() => {
      setDisplay(values.map(() => Math.floor(Math.random() * 6) + 1));
      frame++;
      if (frame > 15) {
        clearInterval(interval);
        setDisplay(values);
        setRolling(false);
        setTimeout(onComplete, 800);
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      background: 'rgba(0,0,0,0.8)', padding: 32, borderRadius: 16, zIndex: 100,
      display: 'flex', gap: 16,
    }}>
      {display.map((v, i) => (
        <span key={i} style={{
          fontSize: 64, transition: rolling ? 'none' : 'transform 0.3s',
          transform: rolling ? `rotate(${Math.random() * 30 - 15}deg)` : 'none',
        }}>
          {DICE_FACES[v - 1]}
        </span>
      ))}
    </div>
  );
}
```

**Step 2: Event modal for decisions**

```tsx
// client/src/components/EventModal.tsx
import { useSocket } from '../hooks/useSocket';
import type { PendingAction } from '@nannaricher/shared';

interface Props { action: PendingAction; }

export function EventModal({ action }: Props) {
  const socketRef = useSocket();

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        background: '#16213e', padding: 24, borderRadius: 12,
        maxWidth: 500, width: '90%',
      }}>
        <h3 style={{ marginBottom: 12 }}>{action.prompt}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {action.options?.map(opt => (
            <button key={opt.value}
              onClick={() => socketRef.current?.emit('game:choose-action', {
                actionId: action.id, choice: opt.value,
              })}
              style={{
                padding: 12, borderRadius: 8, background: '#0f3460',
                color: '#fff', border: '1px solid #e94560', cursor: 'pointer',
                textAlign: 'left', fontSize: 14,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add client/src/components/
git commit -m "feat: add dice animation and event decision modal"
```

---

### Task 16: Card Hand UI + Training Plan View

**Files:**
- Create: `client/src/components/CardHand.tsx`
- Create: `client/src/components/TrainingPlanView.tsx`
- Update: `client/src/components/ActionBar.tsx`

**Step 1: Card hand component**

Shows held cards at the bottom. Click a card to see detail / use it.

```tsx
// client/src/components/CardHand.tsx
import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useGame } from '../context/GameContext';
import type { Card } from '@nannaricher/shared';

export function CardHand() {
  const { gameState, playerId } = useGame();
  const socketRef = useSocket();
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  const me = gameState?.players.find(p => p.id === playerId);
  if (!me || me.heldCards.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0' }}>
      {me.heldCards.map(card => (
        <div key={card.id}
          onClick={() => setSelectedCard(card)}
          style={{
            minWidth: 80, padding: 8, borderRadius: 8, cursor: 'pointer',
            background: card.deckType === 'chance' ? '#2d6a4f' : '#7b2cbf',
            fontSize: 12, textAlign: 'center',
          }}>
          <div style={{ fontWeight: 'bold' }}>{card.name}</div>
        </div>
      ))}
      {selectedCard && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
        }} onClick={() => setSelectedCard(null)}>
          <div style={{ background: '#16213e', padding: 24, borderRadius: 12, maxWidth: 400 }}
            onClick={e => e.stopPropagation()}>
            <h3>{selectedCard.name}</h3>
            <p style={{ margin: '12px 0', color: '#aaa' }}>{selectedCard.description}</p>
            <button onClick={() => {
              socketRef.current?.emit('game:use-card', { cardId: selectedCard.id });
              setSelectedCard(null);
            }} style={{ padding: '8px 24px', borderRadius: 8,
              background: '#e74c3c', color: '#fff', border: 'none', cursor: 'pointer' }}>
              使用
            </button>
            <button onClick={() => setSelectedCard(null)}
              style={{ marginLeft: 8, padding: '8px 24px', borderRadius: 8,
                background: '#555', color: '#fff', border: 'none', cursor: 'pointer' }}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Training plan view in PlayerPanel sidebar**

Add collapsible training plan section showing win condition text, progress indicator, and confirm button (when eligible).

**Step 3: Commit**

```bash
git add client/src/components/
git commit -m "feat: add card hand UI and training plan view"
```

---

### Task 17: Chat Panel + Game Log

**Files:**
- Create: `client/src/components/ChatPanel.tsx`
- Create: `client/src/components/GameLog.tsx`

**Step 1: Chat panel** - simple input + message list, wired to `game:chat` socket events.

**Step 2: Game log** - auto-scrolling list showing game events from `gameState.log`.

**Step 3: Commit**

```bash
git add client/src/components/
git commit -m "feat: add chat panel and game event log"
```

---

## Phase 7: Polish & Deploy (Tasks 18-20)

### Task 18: Mobile Responsive Layout

**Files:**
- Update: `client/src/components/GameScreen.tsx`
- Create: `client/src/hooks/useMediaQuery.ts`

**Step 1: Add responsive hook**

```typescript
// client/src/hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
```

**Step 2: Update GameScreen for mobile**

On narrow screens (< 768px): stack layout vertically, player panel becomes bottom tabs, canvas takes full width.

**Step 3: Commit**

```bash
git add client/src/
git commit -m "feat: add mobile responsive layout"
```

---

### Task 19: Production Build + Static Serving

**Files:**
- Update: `server/src/index.ts` (serve built client)
- Create: `Dockerfile` (optional)
- Update: `package.json` (build script)

**Step 1: Server serves client build in production**

```typescript
// Add to server/src/index.ts
import path from 'path';

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (_, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}
```

**Step 2: Add build script**

```json
// root package.json scripts
"build": "npm run build -w client && npm run build -w server",
"start": "NODE_ENV=production node server/dist/index.js"
```

**Step 3: Verify production build**

Run: `npm run build && npm start`
Open browser at `http://localhost:3001` → full game should work.

**Step 4: Commit**

```bash
git add -A ':!nul'
git commit -m "feat: add production build with static file serving"
```

---

### Task 20: End-to-End Smoke Test

**Files:**
- Create: `server/src/__tests__/e2e.test.ts`

**Step 1: Write E2E test using socket.io-client**

```typescript
// server/src/__tests__/e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import express from 'express';
import { RoomManager } from '../rooms/RoomManager';
import { setupSocketHandlers } from '../SocketHandler';

describe('E2E: full game flow', () => {
  let httpServer: any, io: any, port: number;

  beforeAll((done) => {
    const app = express();
    httpServer = createServer(app);
    io = new Server(httpServer);
    const rm = new RoomManager();
    setupSocketHandlers(io, rm);
    httpServer.listen(0, () => {
      port = (httpServer.address() as any).port;
      done();
    });
  });
  afterAll(() => { io.close(); httpServer.close(); });

  it('two players can create room, join, start, and roll dice', async () => {
    const p1 = ioClient(`http://localhost:${port}`);
    const p2 = ioClient(`http://localhost:${port}`);

    // P1 creates room
    const roomId = await new Promise<string>(resolve => {
      p1.emit('room:create', { playerName: 'Alice', diceOption: 2 });
      p1.on('room:created', ({ roomId }) => resolve(roomId));
    });

    // P2 joins
    await new Promise<void>(resolve => {
      p2.emit('room:join', { roomId, playerName: 'Bob', diceOption: 1 });
      p2.on('room:joined', () => resolve());
    });

    // P1 starts game
    const state = await new Promise<any>(resolve => {
      p1.on('game:state-update', (s) => { if (s.phase === 'playing') resolve(s); });
      p1.emit('game:start');
    });

    expect(state.players).toHaveLength(2);
    expect(state.phase).toBe('playing');

    // P1 rolls dice
    const diceResult = await new Promise<any>(resolve => {
      p1.on('game:dice-result', resolve);
      p1.emit('game:roll-dice');
    });

    expect(diceResult.values.length).toBeGreaterThanOrEqual(1);
    expect(diceResult.total).toBeGreaterThanOrEqual(1);

    p1.close();
    p2.close();
  });
});
```

**Step 2: Run E2E test**

Run: `cd server && npx vitest run src/__tests__/e2e.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add server/src/__tests__/
git commit -m "test: add end-to-end smoke test for room creation and dice roll"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-3 | Monorepo scaffold, shared types, room manager |
| 2 | 4-6 | Board data, line routes, game engine core |
| 3 | 7-9 | Card data, event handler system, socket wiring |
| 4 | 10-12 | React app, lobby UI, game screen layout |
| 5 | 13-14 | Canvas board rendering, pan/zoom |
| 6 | 15-17 | Dice animation, event modals, cards UI, chat |
| 7 | 18-20 | Mobile responsive, production build, E2E test |

**Total: 20 tasks across 7 phases.**

Each task is self-contained with clear file paths, code, test commands, and commit points. The data-heavy tasks (5, 7) involve transcribing all game content from the rules document into JSON/TypeScript — these are large but mechanical.
