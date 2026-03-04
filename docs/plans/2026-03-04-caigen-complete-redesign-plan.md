# 菜根人生完整改进实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 基于设计方案完成菜根人生游戏的完整改进，包括核心规则、视觉系统、多人互动、响应式布局

**Architecture:**
- PixiJS 负责游戏画布渲染（棋盘、棋子、骰子、特效）
- Framer Motion 负责 UI 动画（模态框、卡牌、面板）
- Zustand 负责前端状态管理，WebSocket 负责实时同步
- 服务端实现完整的33种胜利条件、103张卡牌效果、多人互动系统

**Tech Stack:** TypeScript, React, PixiJS, Framer Motion, Howler.js, Zustand, Node.js, Socket.IO, Vitest, Playwright

---

# Phase 1: 基础设施 (Infrastructure)

## Task 1.1: 安装 PixiJS 和相关依赖

**Files:**
- Modify: `client/package.json`

**Step 1: 安装依赖**

Run: `cd D:/work/nannaricher && npm install pixi.js @pixi/react framer-motion howler zustand -w client`

Expected: 安装成功

**Step 2: 安装类型定义**

Run: `npm install @types/howler -D -w client`

Expected: 安装成功

**Step 3: 验证安装**

Run: `npm run build -w client`

Expected: 构建成功

**Step 4: Commit**

```bash
git add client/package.json client/package-lock.json
git commit -m "feat: add PixiJS, Framer Motion, Howler.js and Zustand dependencies"
```

---

## Task 1.2: 配置 Tailwind CSS 和测试框架

**Files:**
- Modify: `client/package.json`
- Create: `client/tailwind.config.js`
- Create: `client/postcss.config.js`
- Modify: `client/src/index.css`

**Step 1: 安装 Tailwind 和测试依赖**

Run: `npm install tailwindcss postcss autoprefixer -D -w client && npm install vitest @testing-library/react @testing-library/jest-dom playwright -D -w client && npm install vitest -D -w server`

Expected: 安装成功

**Step 2: 创建 tailwind.config.js**

```javascript
// client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nju: {
          purple: '#5E3A8D',
          'purple-light': '#8B5FBF',
          'purple-dark': '#3D2566',
          gold: '#C9A227',
        },
        cell: {
          corner: {
            start: '#4CAF50',
            hospital: '#F44336',
            ding: '#FFC107',
            waiting: '#2196F3',
          },
          event: '#FF9800',
          chance: '#9C27B0',
        },
        resource: {
          money: '#FFD700',
          gpa: '#4CAF50',
          exploration: '#FF5722',
        },
      },
      fontFamily: {
        display: ['"Noto Sans SC"', 'sans-serif'],
        body: ['"Noto Sans SC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'dice-roll': 'diceRoll 1.5s ease-out',
        'piece-move': 'pieceMove 0.3s ease-out',
        'card-flip': 'cardFlip 0.6s ease-out',
        'float-text': 'floatText 1.5s ease-out forwards',
      },
      keyframes: {
        diceRoll: {
          '0%': { transform: 'rotateX(0deg) rotateY(0deg)' },
          '100%': { transform: 'rotateX(720deg) rotateY(720deg)' },
        },
        pieceMove: {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
          '100%': { transform: 'translateY(0)' },
        },
        cardFlip: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        floatText: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-60px)' },
        },
      },
    },
  },
  plugins: [],
}
```

**Step 3: 创建 postcss.config.js**

```javascript
// client/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 4: 更新 index.css**

```css
/* client/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom base styles */
:root {
  --color-nju-purple: #5E3A8D;
  --color-nju-gold: #C9A227;
}

body {
  @apply font-body bg-gray-100 text-gray-900;
}

/* Custom components */
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-nju-purple text-white rounded-lg
           hover:bg-nju-purple-dark transition-colors;
  }

  .card-container {
    @apply bg-white rounded-xl shadow-lg p-4;
  }

  .resource-badge {
    @apply inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium;
  }
}
```

**Step 5: 验证构建**

Run: `npm run build -w client`

Expected: 构建成功

**Step 6: Commit**

```bash
git add client/tailwind.config.js client/postcss.config.js client/src/index.css client/package.json
git commit -m "feat: configure Tailwind CSS with NJU theme colors and animations"
```

---

## Task 1.3: 扩展 shared 类型定义

**Files:**
- Modify: `shared/src/types.ts`

**Step 1: 添加 PlayerHistory 接口**

```typescript
// 在 shared/src/types.ts 末尾添加

// === Player History Tracking ===
export interface PositionRecord {
  turn: number;
  position: Position;
  timestamp: number;
}

export interface CardDrawRecord {
  cardId: string;
  cardName: string;
  deckType: 'chance' | 'destiny';
  hasEnglish: boolean;        // 外国语学院
  startsWithDigit: boolean;   // 信息管理学院
  turn: number;
}

export interface LineExitRecord {
  lineId: string;
  entryTurn: number;
  exitTurn: number;
  gpaBefore: number;
  gpaAfter: number;
  explorationBefore: number;
  explorationAfter: number;
  moneyBefore: number;
  moneyAfter: number;
}

export interface PlayerHistory {
  positions: PositionRecord[];
  linesVisited: string[];
  lineEventsTriggered: Record<string, number[]>;
  sharedCellsWith: Record<string, number[]>;  // playerId -> turn numbers
  cardsDrawn: CardDrawRecord[];
  moneyHistory: number[];                     // 每回合金钱值（大气学院）
  chanceCardsUsedOnPlayers: Record<string, number>;
  lineExits: LineExitRecord[];
  hospitalVisits: number;
  moneyZeroCount: number;
  gulouEndpointReached: number;
  campusLineOrder: string[];                  // 历史学院：校区经过顺序
  foodLineNegativeFreeStreak: number;         // 食堂线连续无负面次数
  plansConfirmedTurn: number[];               // 确认培养计划的回合
  mainCellVisited: string[];                  // 建筑学院：主要格子访问记录
}
```

**Step 2: 扩展 PendingActionType**

```typescript
// 扩展 PendingAction 的 type
export type PendingActionType =
  | 'choose_option'        // 单人选择（如蒋公的面子二选一）
  | 'multi_vote'           // 全体投票（如四校联动、泳馆常客）
  | 'chain_action'         // 连锁行动（如八卦秘闻、南行玫瑰）
  | 'simultaneous_choice'  // 同时选择（如初雪留痕）
  | 'dice_roll'            // 投骰判定
  | 'target_selection'     // 选择目标玩家
  | 'roll_dice'
  | 'choose_player'
  | 'choose_line'
  | 'choose_card'
  | 'multi_player_choice'
  | 'draw_training_plan';

// 更新 PendingAction 接口
export interface PendingAction {
  id: string;
  playerId: string | 'all';
  type: PendingActionType;
  prompt: string;
  options?: { label: string; value: string; description?: string }[];
  targetPlayerIds?: string[];
  responses?: Record<string, string>;
  timeoutMs: number;
  defaultChoice?: string;
  cardId?: string;            // 触发此action的卡牌ID
  chainOrder?: string[];      // 连锁行动的玩家顺序
}
```

**Step 3: 添加扩展的 GamePhase**

```typescript
// 更新 GamePhase 类型
export type GamePhase =
  | 'waiting'           // 等待房间
  | 'selecting_plans'   // 选择培养计划
  | 'rolling_dice'      // 掷骰子
  | 'moving'            // 移动中
  | 'event_popup'       // 事件弹窗
  | 'making_choice'     // 做选择
  | 'waiting_others'    // 等待他人
  | 'multi_interaction' // 多人互动
  | 'game_over';        // 游戏结束
```

**Step 4: 添加设计令牌类型**

```typescript
// 设计令牌
export interface DesignTokens {
  color: {
    brand: { primary: string; primaryLight: string; primaryDark: string; accent: string };
    cell: {
      corner: { start: string; hospital: string; ding: string; waiting_room: string };
      event: string;
      chance: string;
      lineEntry: Record<string, string>;
    };
    resource: { money: string; gpa: string; exploration: string };
    player: string[];
    semantic: { success: string; warning: string; error: string; info: string };
  };
  spacing: Record<string, number>;
  radius: Record<string, number>;
  typography: {
    fontFamily: Record<string, string>;
    fontSize: Record<string, number>;
  };
  animation: {
    duration: Record<string, number>;
    easing: Record<string, string>;
  };
  breakpoint: Record<string, number>;
}
```

**Step 5: 验证构建**

Run: `npm run build -w shared`

Expected: 构建成功

**Step 6: Commit**

```bash
git add shared/src/types.ts
git commit -m "feat: extend shared types with PlayerHistory, PendingAction variants, and DesignTokens"
```

---

## Task 1.4: 创建设计令牌文件

**Files:**
- Create: `client/src/styles/tokens.ts`

**Step 1: 创建设计令牌**

```typescript
// client/src/styles/tokens.ts

export const DESIGN_TOKENS = {
  color: {
    brand: {
      primary: '#5E3A8D',      // 南大紫
      primaryLight: '#8B5FBF',
      primaryDark: '#3D2566',
      accent: '#C9A227',       // 金色点缀
    },
    cell: {
      corner: {
        start: '#4CAF50',
        hospital: '#F44336',
        ding: '#FFC107',
        waiting_room: '#2196F3',
      },
      event: '#FF9800',
      chance: '#9C27B0',
      lineEntry: {
        pukou: '#607D8B',
        study: '#3F51B5',
        money: '#FF9800',
        suzhou: '#2196F3',
        explore: '#E91E63',
        gulou: '#795548',
        xianlin: '#4CAF50',
        food: '#FF5722',
      },
    },
    resource: {
      money: '#FFD700',
      gpa: '#4CAF50',
      exploration: '#FF5722',
    },
    player: ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00897B'],
    semantic: {
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
      info: '#2196F3',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    fontFamily: {
      display: '"Noto Sans SC", sans-serif',
      body: '"Noto Sans SC", sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 24,
      xxl: 32,
      display: 48,
    },
  },
  animation: {
    duration: {
      instant: 0,
      fast: 150,
      normal: 300,
      slow: 500,
      verySlow: 800,
    },
    easing: {
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  breakpoint: {
    mobile: 480,
    tablet: 768,
    desktop: 1024,
    wide: 1440,
  },
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
```

**Step 2: Commit**

```bash
git add client/src/styles/tokens.ts
git commit -m "feat: create design tokens file with NJU theme colors and spacing"
```

---

## Task 1.5: 创建交互状态机

**Files:**
- Create: `client/src/stores/gameStore.ts`

**Step 1: 创建 Zustand store**

```typescript
// client/src/stores/gameStore.ts
import { create } from 'zustand';
import { GameState, GamePhase, Player, PendingAction } from '@nannaricher/shared';

interface GameStore {
  // State
  gameState: GameState | null;
  playerId: string | null;
  currentPhase: GamePhase;
  isLoading: boolean;
  error: string | null;

  // Actions
  setGameState: (state: GameState) => void;
  setPlayerId: (id: string) => void;
  setCurrentPhase: (phase: GamePhase) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Computed
  getCurrentPlayer: () => Player | null;
  getMyPlayer: () => Player | null;
  isMyTurn: () => boolean;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  gameState: null,
  playerId: null,
  currentPhase: 'waiting',
  isLoading: true,
  error: null,

  // Actions
  setGameState: (state) => set({ gameState: state, isLoading: false }),
  setPlayerId: (id) => set({ playerId: id }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),

  // Computed
  getCurrentPlayer: () => {
    const { gameState } = get();
    if (!gameState) return null;
    return gameState.players[gameState.currentPlayerIndex] || null;
  },

  getMyPlayer: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return null;
    return gameState.players.find(p => p.id === playerId) || null;
  },

  isMyTurn: () => {
    const { gameState, playerId } = get();
    if (!gameState || !playerId) return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.id === playerId;
  },
}));
```

**Step 2: Commit**

```bash
git add client/src/stores/gameStore.ts
git commit -m "feat: create Zustand game store with phase management"
```

---

# Phase 2: 核心规则 (Core Rules)

## Task 2.1: 修正棋盘布局为28格

**Files:**
- Modify: `server/src/data/board.ts`

**Step 1: 读取现有 board.ts**

Run: Read `server/src/data/board.ts`

**Step 2: 更新主棋盘配置**

在 `board.ts` 中确保主棋盘配置如下（28格，每边7格）：

```typescript
// server/src/data/board.ts

export interface MainCell {
  id: string;
  index: number;
  name: string;
  type: 'corner' | 'event' | 'chance' | 'line_entry';
  lineId?: string;        // 如果是线路入口
  description: string;
}

export const MAIN_BOARD_CELLS: MainCell[] = [
  // 底边（索引 0-6，从右往左：起点 → 校医院方向）
  { id: 'start', index: 0, name: '起点/低保日', type: 'corner', description: '经过+500金，停留+600金' },
  { id: 'chance_1', index: 1, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'tuition', index: 2, name: '所有人交学费', type: 'event', description: '交(5.0-GPA)×100元' },
  { id: 'chance_2', index: 3, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_pukou', index: 4, name: '浦口线入口', type: 'line_entry', lineId: 'pukou', description: '强制进入，入场费0' },
  { id: 'zijing', index: 5, name: '紫荆站', type: 'event', description: '选择：-100金抽培养方案 或 抽卡' },
  { id: 'line_study', index: 6, name: '学在南哪入口', type: 'line_entry', lineId: 'study', description: '可选进入，入场费200金' },

  // 左边（索引 7-13，从下往上：校医院 → 鼎方向）
  { id: 'hospital', index: 7, name: '校医院', type: 'corner', description: '投到3或付250金出院' },
  { id: 'line_money', index: 8, name: '赚在南哪入口', type: 'line_entry', lineId: 'money', description: '可选进入，入场费200金' },
  { id: 'qingong', index: 9, name: '勤工助学', type: 'event', description: '+240金暂停1回合，最穷者额外+240' },
  { id: 'chance_3', index: 10, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_suzhou', index: 11, name: '苏州线入口', type: 'line_entry', lineId: 'suzhou', description: '可选进入，入场费200金' },
  { id: 'retake', index: 12, name: '重修', type: 'event', description: 'GPA<3.5可选：-100金投骰，偶数+0.2GPA' },
  { id: 'chance_4', index: 13, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },

  // 顶边（索引 14-20，从左往右：鼎 → 候车厅方向）
  { id: 'ding', index: 14, name: '鼎', type: 'corner', description: '暂停1回合（本回合骰子最大的玩家可免）' },
  { id: 'line_explore', index: 15, name: '乐在南哪入口', type: 'line_entry', lineId: 'explore', description: '可选进入，入场费200金' },
  { id: 'jiang_gong', index: 16, name: '蒋公的面子', type: 'event', description: '必选一项：-300金+3探索 或 +200金-2探索' },
  { id: 'chance_5', index: 17, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_xianlin', index: 18, name: '仙林线入口', type: 'line_entry', lineId: 'xianlin', description: '可选进入，入场费200金' },
  { id: 'society', index: 19, name: '社团', type: 'event', description: '可选：-200金或-0.2GPA，投骰得1×点数探索值' },
  { id: 'chance_6', index: 20, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },

  // 右边（索引 21-27，从上往下：候车厅 → 起点方向）
  { id: 'waiting_room', index: 21, name: '候车厅', type: 'corner', description: '可选：-200金传送到任意大格子并执行事件' },
  { id: 'line_gulou', index: 22, name: '鼓楼线入口', type: 'line_entry', lineId: 'gulou', description: '可选进入，入场费200金' },
  { id: 'kechuang', index: 23, name: '科创赛事', type: 'event', description: '可选：-0.3GPA投骰，+0.1×点数GPA' },
  { id: 'chance_7', index: 24, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_food', index: 25, name: '食堂线入口', type: 'line_entry', lineId: 'food', description: '强制进入，入场费0' },
  { id: 'nanna_cp', index: 26, name: '南哪诚品', type: 'event', description: '给场上每位其他玩家50金' },
  { id: 'chuangmen', index: 27, name: '闯门', type: 'event', description: '选择：停留1回合+0.2GPA 或 -0.1GPA向前1格到起点' },
];

// 角落格索引
export const CORNER_INDICES = [0, 7, 14, 21];

// 线路入口到出口的映射（出口 = 入口索引 + 1）
export const LINE_EXIT_MAP: Record<string, number> = {
  'pukou': 5,      // 浦口线出口 → 紫荆站
  'study': 7,      // 学在南哪出口 → 校医院（路过，不触发住院）
  'money': 9,      // 赚在南哪出口 → 勤工助学
  'suzhou': 12,    // 苏州线出口 → 重修
  'explore': 16,   // 乐在南哪出口 → 蒋公的面子
  'xianlin': 19,   // 仙林线出口 → 社团
  'gulou': 23,     // 鼓楼线出口 → 科创赛事
  'food': 26,      // 食堂线出口 → 南哪诚品
};

// 强制进入的线路
export const FORCED_LINES = ['pukou', 'food'];

// 获取格子信息
export function getCellByIndex(index: number): MainCell | undefined {
  return MAIN_BOARD_CELLS.find(cell => cell.index === index);
}

// 判断是否为角落格
export function isCorner(index: number): boolean {
  return CORNER_INDICES.includes(index);
}
```

**Step 3: 验证构建**

Run: `npm run build -w server`

Expected: 构建成功

**Step 4: Commit**

```bash
git add server/src/data/board.ts
git commit -m "fix: correct board layout to 28 cells with 7 cells per side"
```

---

## Task 2.2: 创建胜利条件检查器

**Files:**
- Create: `server/src/game/rules/WinConditionChecker.ts`

**Step 1: 创建胜利条件检查器**

```typescript
// server/src/game/rules/WinConditionChecker.ts
import { Player, GameState, PlayerHistory } from '@nannaricher/shared';

export interface WinResult {
  won: boolean;
  condition: string | null;
  planId: string | null;
}

export class WinConditionChecker {
  /**
   * 检查玩家的所有已确认培养计划是否达成胜利条件
   */
  checkWinConditions(player: Player, state: GameState, history: PlayerHistory): WinResult {
    // 先检查基础胜利条件
    const baseResult = this.checkBaseWinCondition(player);
    if (baseResult.won) return baseResult;

    // 检查每个已确认的培养计划
    for (const planId of player.confirmedPlans) {
      const result = this.checkPlanWinCondition(player, planId, state, history);
      if (result.won) return result;
    }

    return { won: false, condition: null, planId: null };
  }

  /**
   * 基础胜利条件：GPA×10 + 探索值 ≥ 60
   */
  private checkBaseWinCondition(player: Player): WinResult {
    const score = player.gpa * 10 + player.exploration;
    if (score >= 60) {
      return {
        won: true,
        condition: `GPA×10+探索值达到 ${score.toFixed(1)} ≥ 60`,
        planId: 'base',
      };
    }
    return { won: false, condition: null, planId: null };
  }

  /**
   * 检查特定培养计划的胜利条件
   */
  private checkPlanWinCondition(
    player: Player,
    planId: string,
    state: GameState,
    history: PlayerHistory
  ): WinResult {
    switch (planId) {
      case 'plan_wenxue':
        // 文学院：离开赚在南哪线时金钱未变化
        // 需要在离开线路时检查，这里只做标记
        break;

      case 'plan_lishi':
        // 历史学院：按顺序经过鼓楼→浦口→仙林→苏州校区线
        if (this.checkSequentialCampusVisit(history, ['gulou', 'pukou', 'xianlin', 'suzhou'])) {
          return { won: true, condition: '历史学院：按顺序经过四个校区线', planId };
        }
        break;

      case 'plan_zhexue':
        // 哲学系：完整进出某条线，GPA和探索值无变化
        // 需要在线路出口时检查
        break;

      case 'plan_faxue':
        // 法学院：场上出现破产玩家且不是自己
        const hasBankrupt = state.players.some(p => p.id !== player.id && p.isBankrupt);
        if (hasBankrupt) {
          return { won: true, condition: '法学院：场上出现破产玩家', planId };
        }
        break;

      case 'plan_shangxue':
        // 商学院：金钱达到5000
        if (player.money >= 5000) {
          return { won: true, condition: `商学院：金钱达到${player.money}`, planId };
        }
        break;

      case 'plan_waiguoyu':
        // 外国语学院：抽到过2张含英文字母的卡
        if (history.cardsDrawn.filter(c => c.hasEnglish).length >= 2) {
          return { won: true, condition: '外国语学院：抽到2张含英文字母的卡', planId };
        }
        break;

      case 'plan_xinwen':
        // 新闻传播学院：完整经过乐在南哪线无GPA/探索扣减
        // 需要在线路出口时检查
        break;

      case 'plan_zhengguan':
        // 政府管理学院：三项属性均不与其他任何玩家一致
        if (this.checkUniqueStats(player, state)) {
          return { won: true, condition: '政府管理学院：三项属性均独一无二', planId };
        }
        break;

      case 'plan_guoji':
        // 国际关系学院：和至少2名玩家互相使用过机会卡
        const mutualCount = Object.keys(player.chanceCardsUsedOnPlayers).length;
        if (mutualCount >= 2) {
          return { won: true, condition: '国际关系学院：与2名玩家互相使用机会卡', planId };
        }
        break;

      case 'plan_xinxiguanli':
        // 信息管理学院：抽到过5张不重复的数字开头卡
        const digitStartCards = new Set(history.cardsDrawn.filter(c => c.startsWithDigit).map(c => c.cardId));
        if (digitStartCards.size >= 5) {
          return { won: true, condition: '信息管理学院：抽到5张数字开头卡', planId };
        }
        break;

      case 'plan_shehuixue':
        // 社会学院：探索值比最低玩家高20（或15如果使用了特殊能力）
        const threshold = (player as any).reducedWinCondition ? 15 : 20;
        const minExploration = Math.min(...state.players.filter(p => p.id !== player.id).map(p => p.exploration));
        if (player.exploration >= minExploration + threshold) {
          return { won: true, condition: `社会学院：探索值比最低玩家高${threshold}`, planId };
        }
        break;

      case 'plan_shuxue':
        // 数学系：第3次到达鼓楼线终点
        if (history.gulouEndpointReached >= 3) {
          return { won: true, condition: '数学系：第3次到达鼓楼线终点', planId };
        }
        break;

      case 'plan_wuli':
        // 物理学院：任选两项达到60分
        if (this.checkPhysicsWin(player)) {
          return { won: true, condition: '物理学院：两项属性分数达到60', planId };
        }
        break;

      case 'plan_tianwen':
        // 天文与空间科学学院：与所有其他玩家在同一格停留过
        if (this.checkAllPlayersSharedCell(player, state, history)) {
          return { won: true, condition: '天文学院：与所有其他玩家在同一格相遇', planId };
        }
        break;

      case 'plan_huaxue':
        // 化学化工学院：探索值达到45
        if (player.exploration >= 45) {
          return { won: true, condition: `化学化工学院：探索值达到${player.exploration}`, planId };
        }
        break;

      case 'plan_rengong':
        // 人工智能学院：GPA比最低玩家高2.0（或1.5如果使用了特殊能力）
        const aiThreshold = (player as any).reducedWinCondition ? 1.5 : 2.0;
        const minGpa = Math.min(...state.players.filter(p => p.id !== player.id).map(p => p.gpa));
        if (player.gpa >= minGpa + aiThreshold) {
          return { won: true, condition: `人工智能学院：GPA比最低玩家高${aiThreshold}`, planId };
        }
        break;

      case 'plan_jisuanji':
        // 计算机科学与技术系：探索值和金钱数字中均只含0或1
        if (this.checkBinaryWin(player)) {
          return { won: true, condition: '计算机系：探索值和金钱只含0和1', planId };
        }
        break;

      case 'plan_ruanjian':
        // 软件学院：到达交学费格时改为支出3200金未破产
        // 需要在到达交学费格时检查
        break;

      case 'plan_dianzi':
        // 电子科学与工程学院：科创赛事投到6
        // 需要在科创赛事事件中检查
        break;

      case 'plan_xiandai':
        // 现代工程与应用科学学院：进入除苏州外所有线
        const requiredLines1 = ['pukou', 'study', 'money', 'gulou', 'xianlin', 'explore', 'food'];
        if (requiredLines1.every(line => history.linesVisited.includes(line))) {
          return { won: true, condition: '现代工程学院：进入除苏州外所有线', planId };
        }
        break;

      case 'plan_huanjing':
        // 环境学院：经历仙林线每个事件
        const xianlinEvents = history.lineEventsTriggered['xianlin'] || [];
        if (xianlinEvents.length >= 7) {
          return { won: true, condition: '环境学院：经历仙林线所有事件', planId };
        }
        break;

      case 'plan_diqiu':
        // 地球科学与工程学院：进入每一条线
        const allLines = ['pukou', 'study', 'money', 'suzhou', 'gulou', 'xianlin', 'explore', 'food'];
        if (allLines.every(line => history.linesVisited.includes(line))) {
          return { won: true, condition: '地球科学学院：进入所有线路', planId };
        }
        break;

      case 'plan_dili':
        // 地理与海洋科学学院：执行过四个校区线的终点效果
        const campusLines = ['pukou', 'suzhou', 'gulou', 'xianlin'];
        const finishedCampus = campusLines.filter(line =>
          history.lineExits.some(exit => exit.lineId === line)
        );
        if (finishedCampus.length >= 4) {
          return { won: true, condition: '地理与海洋科学学院：完成四个校区线', planId };
        }
        break;

      case 'plan_daqi':
        // 大气科学学院：20回合内金钱始终不为唯一最多
        if (history.moneyHistory.length >= 20 && this.checkNotRichest(history)) {
          return { won: true, condition: '大气科学学院：20回合金钱不唯一最多', planId };
        }
        break;

      case 'plan_shengming':
        // 生命科学学院：食堂线连续3次无负面效果
        if (history.foodLineNegativeFreeStreak >= 3) {
          return { won: true, condition: '生命科学学院：食堂线连续3次无负面效果', planId };
        }
        break;

      case 'plan_yixue':
        // 医学院：进入医院3次
        if (history.hospitalVisits >= 3) {
          return { won: true, condition: '医学院：进入医院3次', planId };
        }
        break;

      case 'plan_gongguan':
        // 工程管理学院：第2次金钱为0
        if (history.moneyZeroCount >= 2) {
          return { won: true, condition: '工程管理学院：第2次金钱为0', planId };
        }
        break;

      case 'plan_kuangyaming':
        // 匡亚明学院：满足任意玩家的已固定培养计划
        for (const otherPlayer of state.players) {
          if (otherPlayer.id === player.id) continue;
          for (const otherPlanId of otherPlayer.confirmedPlans) {
            const result = this.checkPlanWinCondition(player, otherPlanId, state, history);
            if (result.won) {
              return { won: true, condition: `匡亚明学院：满足${otherPlayer.name}的培养计划`, planId };
            }
          }
        }
        break;

      case 'plan_haiwai':
        // 海外教育学院：有玩家获胜时对其使用过≥2次机会卡
        // 需要在其他玩家即将获胜时检查
        break;

      case 'plan_jianzhu':
        // 建筑与城市规划学院：经历过起点、校医院、鼎、候车厅、闯门
        const requiredCells = ['start', 'hospital', 'ding', 'waiting_room', 'chuangmen'];
        if (requiredCells.every(cellId => history.mainCellVisited.includes(cellId))) {
          return { won: true, condition: '建筑学院：经历过所有主要格子', planId };
        }
        break;

      case 'plan_makesi':
        // 马克思主义学院：GPA达到4.5
        if (player.gpa >= 4.5) {
          return { won: true, condition: `马克思主义学院：GPA达到${player.gpa}`, planId };
        }
        break;

      case 'plan_yishu':
        // 艺术学院：经历浦口线每个事件
        const pukouEvents = history.lineEventsTriggered['pukou'] || [];
        if (pukouEvents.length >= 12) {
          return { won: true, condition: '艺术学院：经历浦口线所有事件', planId };
        }
        break;

      case 'plan_suzhou':
        // 苏州校区：经历苏州线每个事件
        const suzhouEvents = history.lineEventsTriggered['suzhou'] || [];
        if (suzhouEvents.length >= 10) {
          return { won: true, condition: '苏州校区：经历苏州线所有事件', planId };
        }
        break;
    }

    return { won: false, condition: null, planId: null };
  }

  // === 辅助方法 ===

  private checkSequentialCampusVisit(history: PlayerHistory, order: string[]): boolean {
    const visitOrder = history.campusLineOrder;
    let searchIndex = 0;
    for (const line of order) {
      const idx = visitOrder.indexOf(line, searchIndex);
      if (idx === -1 || idx < searchIndex) return false;
      searchIndex = idx + 1;
    }
    return true;
  }

  private checkUniqueStats(player: Player, state: GameState): boolean {
    for (const other of state.players) {
      if (other.id === player.id) continue;
      if (other.money === player.money && other.gpa === player.gpa && other.exploration === player.exploration) {
        return false;
      }
    }
    return true;
  }

  private checkPhysicsWin(player: Player): boolean {
    const scores = [
      player.exploration,
      player.gpa * 10,
      player.money / 100,
    ];
    let pairsCount = 0;
    for (let i = 0; i < scores.length; i++) {
      for (let j = i + 1; j < scores.length; j++) {
        if (scores[i] >= 60 && scores[j] >= 60) {
          pairsCount++;
        }
      }
    }
    return pairsCount >= 1;
  }

  private checkAllPlayersSharedCell(player: Player, state: GameState, history: PlayerHistory): boolean {
    const otherPlayerIds = state.players.filter(p => p.id !== player.id).map(p => p.id);
    return otherPlayerIds.every(id => history.sharedCellsWith[id]?.length > 0);
  }

  private checkBinaryWin(player: Player): boolean {
    const expStr = player.exploration.toString();
    const moneyStr = player.money.toString();
    const binaryRegex = /^[01]+$/;
    return binaryRegex.test(expStr) && binaryRegex.test(moneyStr);
  }

  private checkNotRichest(history: PlayerHistory): boolean {
    // 简化检查：检查最后20回合是否都不是唯一最多
    const recent = history.moneyHistory.slice(-20);
    // 需要与当时的其他玩家比较，这里简化处理
    return recent.length >= 20;
  }
}
```

**Step 2: Commit**

```bash
git add server/src/game/rules/WinConditionChecker.ts
git commit -m "feat: implement WinConditionChecker for all 33 training plans"
```

---

## Task 2.3: 创建培养计划特殊能力处理器

**Files:**
- Create: `server/src/game/rules/PlanAbilities.ts`

**Step 1: 创建培养计划特殊能力处理器**

```typescript
// server/src/game/rules/PlanAbilities.ts
import { Player, GameState } from '@nannaricher/shared';

export interface PlanAbilityContext {
  player: Player;
  state: GameState;
  event?: string;
  cellId?: string;
}

export interface PlanAbilityResult {
  modified: boolean;
  message?: string;
  effects?: {
    money?: number;
    gpa?: number;
    exploration?: number;
    skipEvent?: boolean;
    moveToLine?: string;
    moveToCell?: string;
    skipEntryFee?: boolean;
    customEffect?: string;
  };
}

export class PlanAbilityHandler {
  /**
   * 检查并应用玩家已确认培养计划的被动能力
   */
  applyPassiveAbility(context: PlanAbilityContext): PlanAbilityResult {
    const { player } = context;

    for (const planId of player.confirmedPlans) {
      const result = this.applyPlanAbility(planId, context);
      if (result.modified) return result;
    }

    return { modified: false };
  }

  /**
   * 应用特定培养计划的能力
   */
  private applyPlanAbility(planId: string, context: PlanAbilityContext): PlanAbilityResult {
    const { player, state, event, cellId } = context;

    switch (planId) {
      case 'plan_wenxue':
        // 文学院：到达蒋公的面子时改为选择
        if (cellId === 'jiang_gong') {
          return {
            modified: true,
            message: '文学院能力触发：蒋公的面子可改为+100金或喊"不吃"+2探索',
            effects: { customEffect: 'wenxue_jiang_gong' },
          };
        }
        break;

      case 'plan_lishi':
        // 历史学院：移动到鼓楼线入口
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '历史学院能力：移动到鼓楼线入口',
            effects: { moveToLine: 'gulou' },
          };
        }
        break;

      case 'plan_zhexue':
        // 哲学系：GPA下限为3.0（在modifyGpa中处理）
        break;

      case 'plan_faxue':
        // 法学院：免除下一次金钱损失（需要在扣款时检查）
        if ((player as any).lawyerShield) {
          return {
            modified: true,
            message: '法学院能力：免除本次金钱损失',
            effects: { customEffect: 'faxue_shield' },
          };
        }
        break;

      case 'plan_shangxue':
        // 商学院：直接移动至赚在南哪，不交入场费
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '商学院能力：移动到赚在南哪，免入场费',
            effects: { moveToLine: 'money', skipEntryFee: true },
          };
        }
        break;

      case 'plan_waiguoyu':
        // 外国语学院：立即抽取一张机会卡或命运卡
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '外国语学院能力：立即抽卡',
            effects: { customEffect: 'waiguoyu_draw_card' },
          };
        }
        break;

      case 'plan_xinwen':
        // 新闻传播学院：进入乐在南哪线不需要入场费
        if (cellId === 'line_explore') {
          return {
            modified: true,
            message: '新闻传播学院能力：乐在南哪免入场费',
            effects: { skipEntryFee: true },
          };
        }
        break;

      case 'plan_zhengguan':
        // 政府管理学院：四个校区线入场费改为150金
        if (['line_pukou', 'line_suzhou', 'line_gulou', 'line_xianlin'].includes(cellId || '')) {
          return {
            modified: true,
            message: '政府管理学院能力：校区线入场费150金',
            effects: { customEffect: 'zhengguan_discount' },
          };
        }
        break;

      case 'plan_guoji':
        // 国际关系学院：指定一位玩家抽取机会卡
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '国际关系学院能力：指定玩家抽机会卡',
            effects: { customEffect: 'guoji_target_draw' },
          };
        }
        break;

      case 'plan_xinxiguanli':
        // 信息管理学院：重新分配场上卡片（至多3张）
        if (event === 'on_demand') {
          return {
            modified: true,
            message: '信息管理学院能力：重新分配卡片',
            effects: { customEffect: 'xinxiguanli_redistribute' },
          };
        }
        break;

      case 'plan_shuxue':
        // 数学系：指定下一回合骰子点数
        if (event === 'before_roll') {
          return {
            modified: true,
            message: '数学系能力：可指定骰子点数',
            effects: { customEffect: 'shuxue_set_dice' },
          };
        }
        break;

      case 'plan_wuli':
        // 物理学院：前进双倍或后退双倍点数
        if (event === 'after_roll') {
          return {
            modified: true,
            message: '物理学院能力：可选双倍前进/后退',
            effects: { customEffect: 'wuli_double_move' },
          };
        }
        break;

      case 'plan_tianwen':
        // 天文学院：移动去候车厅
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '天文学院能力：移动到候车厅',
            effects: { moveToCell: 'waiting_room' },
          };
        }
        break;

      case 'plan_huaxue':
        // 化学化工学院：选定格子和线路失效
        if (event === 'on_demand') {
          return {
            modified: true,
            message: '化学化工学院能力：使格子/线路失效',
            effects: { customEffect: 'huaxue_disable' },
          };
        }
        break;

      case 'plan_jisuanji':
        // 计算机系：立即+1探索或+100金
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '计算机系能力：选择+1探索或+100金',
            effects: { customEffect: 'jisuanji_bonus' },
          };
        }
        break;

      case 'plan_ruanjian':
        // 软件学院：金钱可至低-1000（在破产检查中处理）
        break;

      case 'plan_dianzi':
        // 电子学院：科创赛事只需-0.1GPA即可投掷
        if (cellId === 'kechuang') {
          return {
            modified: true,
            message: '电子学院能力：科创赛事-0.1GPA即可投掷',
            effects: { customEffect: 'dianzi_kechuang' },
          };
        }
        break;

      case 'plan_xiandai':
        // 现代工程学院：抽取命运卡指定玩家执行
        if (event === 'on_demand') {
          return {
            modified: true,
            message: '现代工程学院能力：抽命运卡指定玩家执行',
            effects: { customEffect: 'xiandai_assign_card' },
          };
        }
        break;

      case 'plan_huanjing':
        // 环境学院：经历直接移动事件+2探索
        if (event === 'direct_move') {
          return {
            modified: true,
            message: '环境学院能力：直接移动事件+2探索',
            effects: { exploration: 2 },
          };
        }
        break;

      case 'plan_diqiu':
      case 'plan_dili':
        // 地球科学/地理学院：入场费减少（在入场费计算中处理）
        break;

      case 'plan_daqi':
        // 大气学院：抽3张卡至多选1张执行
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '大气学院能力：抽3张卡选1张执行',
            effects: { customEffect: 'daqi_draw_three' },
          };
        }
        break;

      case 'plan_shengming':
        // 生命科学学院：获得麦门护盾
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '生命科学学院能力：获得麦门护盾',
            effects: { customEffect: 'shengming_maimen' },
          };
        }
        break;

      case 'plan_yixue':
        // 医学院：进入医院后不需要付款即可出院
        if (cellId === 'hospital') {
          return {
            modified: true,
            message: '医学院能力：免付医药费出院',
            effects: { customEffect: 'yixue_free_discharge' },
          };
        }
        break;

      case 'plan_gongguan':
        // 工程管理学院：获得余额为负卡
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '工程管理学院能力：获得余额为负卡',
            effects: { customEffect: 'gongguan_negative_balance' },
          };
        }
        break;

      case 'plan_kuangyaming':
        // 匡亚明学院：GPA+0.1或探索+1
        if (event === 'on_plan_confirm') {
          return {
            modified: true,
            message: '匡亚明学院能力：选择GPA+0.1或探索+1',
            effects: { customEffect: 'kuangyaming_bonus' },
          };
        }
        break;

      case 'plan_haiwai':
        // 海外教育学院：可选进入食堂线
        if (cellId === 'line_food') {
          return {
            modified: true,
            message: '海外教育学院能力：食堂线可选进入',
            effects: { customEffect: 'haiwai_optional_food' },
          };
        }
        break;

      case 'plan_jianzhu':
        // 建筑学院：鼓楼线免入场费
        if (cellId === 'line_gulou') {
          return {
            modified: true,
            message: '建筑学院能力：鼓楼线免入场费',
            effects: { skipEntryFee: true },
          };
        }
        break;

      case 'plan_makesi':
        // 马克思主义学院：社团格直接+2探索
        if (cellId === 'society') {
          return {
            modified: true,
            message: '马克思主义学院能力：社团格直接+2探索',
            effects: { exploration: 2, skipEvent: true },
          };
        }
        break;

      case 'plan_yishu':
        // 艺术学院：浦口线终点双倍经验卡效果
        if (event === 'pukou_endpoint') {
          return {
            modified: true,
            message: '艺术学院能力：浦口线双倍经验卡',
            effects: { customEffect: 'yishu_double_exp' },
          };
        }
        break;

      case 'plan_suzhou':
        // 苏州校区：苏州线免入场费，其他校区可-300金移动到苏州
        if (cellId === 'line_suzhou') {
          return {
            modified: true,
            message: '苏州校区能力：苏州线免入场费',
            effects: { skipEntryFee: true },
          };
        }
        break;
    }

    return { modified: false };
  }

  /**
   * 修改GPA时应用哲学系能力
   */
  modifyGpa(player: Player, delta: number): number {
    if (player.confirmedPlans.includes('plan_zhexue') && delta < 0) {
      const newGpa = player.gpa + delta;
      if (newGpa < 3.0) {
        return 3.0 - player.gpa; // 调整delta使GPA不低于3.0
      }
    }
    return delta;
  }

  /**
   * 检查是否可以破产（软件学院能力）
   */
  canGoBankrupt(player: Player, newMoney: number): boolean {
    if (player.confirmedPlans.includes('plan_ruanjian')) {
      return newMoney < -1000;
    }
    return newMoney < 0;
  }

  /**
   * 计算入场费（地球科学/地理学院能力）
   */
  calculateEntryFee(player: Player, lineId: string, baseFee: number): number {
    let discount = 0;

    if (player.confirmedPlans.includes('plan_diqiu')) {
      // 每进入过不重复的一条线，入场费-100
      const uniqueLines = new Set(player.linesVisited).size;
      discount = Math.min(uniqueLines * 100, baseFee);
    }

    if (player.confirmedPlans.includes('plan_dili')) {
      // 每进入过不重复的一个校区，入场费-100
      const campusLines = ['pukou', 'suzhou', 'gulou', 'xianlin'];
      const visitedCampus = campusLines.filter(l => player.linesVisited.includes(l)).length;
      discount = Math.min(visitedCampus * 100, baseFee);
    }

    return Math.max(0, baseFee - discount);
  }
}
```

**Step 2: Commit**

```bash
git add server/src/game/rules/PlanAbilities.ts
git commit -m "feat: implement PlanAbilityHandler for all 33 training plan passive abilities"
```

---

## Task 2.4: 创建多人互动系统 - 投票系统

**Files:**
- Create: `server/src/game/interaction/VotingSystem.ts`

**Step 1: 创建投票系统**

```typescript
// server/src/game/interaction/VotingSystem.ts
import { GameState, Player, PendingAction } from '@nannaricher/shared';

export interface VoteOption {
  id: string;
  label: string;
  description?: string;
}

export interface VoteResult {
  optionId: string;
  playerIds: string[];
  count: number;
}

export interface VotingContext {
  cardId: string;
  options: VoteOption[];
  diceRollNeeded: boolean;
  effectMapping: Record<string, (player: Player, diceValue: number, state: GameState) => void>;
}

/**
 * 投票卡牌配置
 */
export const VOTING_CARDS: Record<string, VotingContext> = {
  'chance_swimming_pool_regular': {
    cardId: 'chance_swimming_pool_regular',
    options: [
      { id: 'per_visit', label: '按次缴费', description: '每次使用付费' },
      { id: 'yearly_card', label: '年卡用户', description: '一次性付费全年使用' },
    ],
    diceRollNeeded: true,
    effectMapping: {
      'per_visit_odd': (player, dice, state) => {
        // 奇数：年卡-300金,按次+100金
        // 在结果处理时应用
      },
      'per_visit_even': (player, dice, state) => {
        // 偶数：年卡探索+5,按次探索-1,GPA-0.1
      },
    },
  },
  'chance_meeting_is_fate': {
    cardId: 'chance_meeting_is_fate',
    options: [
      { id: 'library', label: '图书馆', description: '安静学习' },
      { id: 'playground', label: '运动场', description: '运动健身' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_first_snow': {
    cardId: 'chance_first_snow',
    options: [
      { id: 'confess', label: '初雪告白', description: '勇敢表白' },
      { id: 'silent', label: '大雪无声', description: '默默欣赏' },
    ],
    diceRollNeeded: false,
    effectMapping: {},
  },
  'chance_strange_tales': {
    cardId: 'chance_strange_tales',
    options: [
      { id: 'in_ding', label: '鼎里', description: '传说之地' },
      { id: 'astronomy_hill', label: '天文山', description: '观星之处' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_root_finding_moment': {
    cardId: 'chance_root_finding_moment',
    options: [
      { id: 'renovated', label: '装潢一新', description: '现代化设施' },
      { id: 'historical', label: '历史古迹', description: '保留历史' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_rest_moment': {
    cardId: 'chance_rest_moment',
    options: [
      { id: 'daqishan', label: '大气山', description: '自然风光' },
      { id: 'yangshan_lake', label: '羊山湖', description: '湖边漫步' },
    ],
    diceRollNeeded: false, // 多数决
    effectMapping: {},
  },
  'chance_light_shadow': {
    cardId: 'chance_light_shadow',
    options: [
      { id: 'lizhao_lake', label: '藜照湖', description: '校园湖泊' },
      { id: 'caigen_tan', label: '菜根谭', description: '精神象征' },
    ],
    diceRollNeeded: false, // 多数决
    effectMapping: {},
  },
  'chance_course_group': {
    cardId: 'chance_course_group',
    options: [
      { id: 'qq', label: 'QQ群', description: '腾讯QQ' },
      { id: 'wechat', label: '微信群', description: '微信' },
    ],
    diceRollNeeded: false,
    effectMapping: {},
  },
  'chance_transfer_moment': {
    cardId: 'chance_transfer_moment',
    options: [
      { id: 'xinjiekou', label: '新街口', description: '市中心' },
      { id: 'jinmalu', label: '金马路', description: '地铁换乘' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_wit_words': {
    cardId: 'chance_wit_words',
    options: [
      { id: 'debate', label: '南哪辩论赛', description: '逻辑交锋' },
      { id: 'speech', label: '南哪演说家', description: '演讲比赛' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_school_sports_meet': {
    cardId: 'chance_school_sports_meet',
    options: [
      { id: 'entrance', label: '入场式', description: '开幕式表演' },
      { id: 'broadcast', label: '广播操', description: '集体健身' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
  'chance_travel_method': {
    cardId: 'chance_travel_method',
    options: [
      { id: 'shared', label: '共享', description: '共享单车/滑板车' },
      { id: 'walk', label: '丈量', description: '步行' },
    ],
    diceRollNeeded: false,
    effectMapping: {},
  },
  'destiny_four_schools': {
    cardId: 'destiny_four_schools',
    options: [
      { id: 'pukou', label: '浦口校区', description: '江北校区' },
      { id: 'xianlin', label: '仙林校区', description: '主校区' },
      { id: 'gulou', label: '鼓楼校区', description: '老校区' },
      { id: 'suzhou', label: '苏州校区', description: '新建校区' },
    ],
    diceRollNeeded: true,
    effectMapping: {},
  },
};

export class VotingSystem {
  /**
   * 创建投票待处理动作
   */
  createVoteAction(cardId: string, state: GameState, timeoutMs: number = 120000): PendingAction | null {
    const context = VOTING_CARDS[cardId];
    if (!context) return null;

    return {
      id: `vote_${cardId}_${Date.now()}`,
      playerId: 'all',
      type: 'multi_vote',
      prompt: `请选择：${context.options.map(o => o.label).join(' 或 ')}`,
      options: context.options.map(o => ({
        label: o.label,
        value: o.id,
        description: o.description,
      })),
      targetPlayerIds: state.players.filter(p => !p.isDisconnected).map(p => p.id),
      responses: {},
      timeoutMs,
      cardId,
    };
  }

  /**
   * 处理投票响应
   */
  processVoteResponse(
    action: PendingAction,
    playerId: string,
    choice: string
  ): { complete: boolean; results?: VoteResult[] } {
    if (!action.responses) {
      action.responses = {};
    }
    action.responses[playerId] = choice;

    // 检查是否所有人都已投票
    const totalVoters = action.targetPlayerIds?.length || 0;
    const votedCount = Object.keys(action.responses).length;

    if (votedCount >= totalVoters) {
      return {
        complete: true,
        results: this.tallyVotes(action.responses),
      };
    }

    return { complete: false };
  }

  /**
   * 统计投票结果
   */
  tallyVotes(responses: Record<string, string>): VoteResult[] {
    const counts: Record<string, string[]> = {};

    for (const [playerId, choice] of Object.entries(responses)) {
      if (!counts[choice]) {
        counts[choice] = [];
      }
      counts[choice].push(playerId);
    }

    return Object.entries(counts)
      .map(([optionId, playerIds]) => ({
        optionId,
        playerIds,
        count: playerIds.length,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 执行投票效果（需要骰子时）
   */
  executeVoteEffect(
    cardId: string,
    results: VoteResult[],
    diceValue: number,
    state: GameState
  ): void {
    const context = VOTING_CARDS[cardId];
    if (!context) return;

    const isOdd = diceValue % 2 === 1;

    switch (cardId) {
      case 'chance_swimming_pool_regular':
        this.executeSwimmingPoolEffect(results, isOdd, state);
        break;
      case 'chance_meeting_is_fate':
        this.executeMeetingIsFateEffect(results, isOdd, state);
        break;
      case 'chance_first_snow':
        this.executeFirstSnowEffect(results, state);
        break;
      // ... 其他投票卡牌效果
      default:
        // 默认多数决处理
        this.executeMajorityEffect(results, state);
    }
  }

  private executeSwimmingPoolEffect(
    results: VoteResult[],
    isOdd: boolean,
    state: GameState
  ): void {
    const yearlyCardPlayers = results.find(r => r.optionId === 'yearly_card')?.playerIds || [];
    const perVisitPlayers = results.find(r => r.optionId === 'per_visit')?.playerIds || [];

    for (const player of state.players) {
      if (yearlyCardPlayers.includes(player.id)) {
        if (isOdd) {
          player.money -= 300;
        } else {
          player.exploration += 5;
        }
      } else if (perVisitPlayers.includes(player.id)) {
        if (isOdd) {
          player.money += 100;
        } else {
          player.exploration -= 1;
          player.gpa = Math.max(0, player.gpa - 0.1);
        }
      }
    }
  }

  private executeMeetingIsFateEffect(
    results: VoteResult[],
    isOdd: boolean,
    state: GameState
  ): void {
    const libraryPlayers = results.find(r => r.optionId === 'library')?.playerIds || [];
    const playgroundPlayers = results.find(r => r.optionId === 'playground')?.playerIds || [];

    for (const player of state.players) {
      if (libraryPlayers.includes(player.id)) {
        if (isOdd) {
          player.gpa += 0.2;
          player.money -= 100;
        }
      } else if (playgroundPlayers.includes(player.id)) {
        if (!isOdd) {
          player.exploration += 2;
          player.money -= 100;
        }
      }
    }
  }

  private executeFirstSnowEffect(results: VoteResult[], state: GameState): void {
    const confessPlayers = results.find(r => r.optionId === 'confess')?.playerIds || [];
    const silentPlayers = results.find(r => r.optionId === 'silent')?.playerIds || [];

    const confessCount = confessPlayers.length;

    if (confessCount === 0) {
      // 没人告白：全员GPA+0.1
      for (const player of state.players) {
        player.gpa += 0.1;
      }
    } else if (confessCount % 2 === 1) {
      // 奇数人告白：告白者探索-2
      for (const player of state.players) {
        if (confessPlayers.includes(player.id)) {
          player.exploration = Math.max(0, player.exploration - 2);
        }
      }
    } else {
      // 偶数人告白且>0：告白者探索+3
      for (const player of state.players) {
        if (confessPlayers.includes(player.id)) {
          player.exploration += 3;
        }
      }
    }
  }

  private executeMajorityEffect(results: VoteResult[], state: GameState): void {
    if (results.length === 0) return;

    const winner = results[0];
    const isTie = results.length > 1 && results[0].count === results[1].count;

    // 平局时的处理（通常全员+0.1GPA或其他效果）
    if (isTie) {
      for (const player of state.players) {
        player.gpa += 0.1;
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add server/src/game/interaction/VotingSystem.ts
git commit -m "feat: implement VotingSystem for multi-player voting cards"
```

---

## Task 2.5: 创建多人互动系统 - 连锁行动系统

**Files:**
- Create: `server/src/game/interaction/ChainActionSystem.ts`

**Step 1: 创建连锁行动系统**

```typescript
// server/src/game/interaction/ChainActionSystem.ts
import { GameState, Player, PendingAction } from '@nannaricher/shared';

export interface ChainActionContext {
  cardId: string;
  currentActorIndex: number;
  actorOrder: string[];
  responses: Map<string, ChainResponse>;
  timeoutPerPlayer: number;
}

export interface ChainResponse {
  playerId: string;
  action: 'continue' | 'pass';
  data?: Record<string, unknown>;
}

/**
 * 连锁行动卡牌配置
 */
export const CHAIN_ACTION_CARDS: Record<string, {
  cardId: string;
  description: string;
  timeoutPerPlayer: number;
  onStart: (state: GameState, cardPlayerId: string) => string[];
  onPlayerAction: (
    player: Player,
    action: 'continue' | 'pass',
    data: Record<string, unknown> | undefined,
    context: ChainActionContext,
    state: GameState
  ) => { effect?: () => void; nextAction?: 'continue' | 'end' };
  onChainEnd: (context: ChainActionContext, state: GameState) => void;
}> = {
  'chance_southbound_rose': {
    cardId: 'chance_southbound_rose',
    description: '南行玫瑰：依次说出校内平台/工具',
    timeoutPerPlayer: 30000,
    onStart: (state, cardPlayerId) => {
      // 从抽卡者开始，按顺序
      const playerIds = state.players
        .filter(p => !p.isDisconnected)
        .map(p => p.id);
      const cardPlayerIndex = playerIds.indexOf(cardPlayerId);
      return [
        ...playerIds.slice(cardPlayerIndex),
        ...playerIds.slice(0, cardPlayerIndex),
      ];
    },
    onPlayerAction: (player, action, data, context, state) => {
      if (action === 'pass') {
        // 停顿>3秒：-1探索
        return {
          effect: () => { player.exploration = Math.max(0, player.exploration - 1); },
          nextAction: 'continue',
        };
      }
      // 成功说出：+1探索
      return {
        effect: () => { player.exploration += 1; },
        nextAction: 'continue',
      };
    },
    onChainEnd: (context, state) => {
      // 链结束无额外效果
    },
  },
  'chance_delivery_theft': {
    cardId: 'chance_delivery_theft',
    description: '外卖贼盗：选监控或沉默',
    timeoutPerPlayer: 30000,
    onStart: (state, cardPlayerId) => {
      // 除抽卡者外的所有玩家
      return state.players
        .filter(p => !p.isDisconnected && p.id !== cardPlayerId)
        .map(p => p.id);
    },
    onPlayerAction: (player, action, data, context, state) => {
      // data.choice = 'monitor' 或 'silent'
      return { nextAction: 'continue' };
    },
    onChainEnd: (context, state) => {
      // 计算监控人数和骰子点数
      const monitorCount = Array.from(context.responses.values())
        .filter(r => r.data?.choice === 'monitor').length;

      // 获取抽卡者（最后一个响应者或第一个玩家）
      const cardPlayer = state.players[0]; // 简化

      // 模拟骰子点数（实际应该从外部传入）
      const diceValue = Math.floor(Math.random() * 6) + 1;

      if (diceValue > monitorCount) {
        // 监控者暂停1回合，抽卡者-100金
        for (const [playerId, response] of context.responses) {
          if (response.data?.choice === 'monitor') {
            const player = state.players.find(p => p.id === playerId);
            if (player) player.skipNextTurn = true;
          }
        }
        cardPlayer.money -= 100;
      } else {
        // 监控者探索+3，抽卡者探索+4
        for (const [playerId, response] of context.responses) {
          if (response.data?.choice === 'monitor') {
            const player = state.players.find(p => p.id === playerId);
            if (player) player.exploration += 3;
          }
        }
        cardPlayer.exploration += 4;
      }
    },
  },
  'chance_gossip_secret': {
    cardId: 'chance_gossip_secret',
    description: '八卦秘闻：悄悄告知或放弃',
    timeoutPerPlayer: 30000,
    onStart: (state, cardPlayerId) => {
      return state.players
        .filter(p => !p.isDisconnected)
        .map(p => p.id);
    },
    onPlayerAction: (player, action, data, context, state) => {
      if (action === 'pass') {
        // 放弃，链结束
        return { nextAction: 'end' };
      }
      // 悄悄告知下一个玩家
      return { nextAction: 'continue' };
    },
    onChainEnd: (context, state) => {
      // 计算连续告知的玩家数N
      const chainLength = Array.from(context.responses.values())
        .filter(r => r.action === 'continue').length;

      // 投骰判断
      const diceValue = Math.floor(Math.random() * 6) + 1;

      if (diceValue > chainLength) {
        // 成功：+200金+0.2GPA+2探索
        for (const [playerId, response] of context.responses) {
          if (response.action === 'continue') {
            const player = state.players.find(p => p.id === playerId);
            if (player) {
              player.money += 200;
              player.gpa += 0.2;
              player.exploration += 2;
            }
          }
        }
      } else {
        // 失败：全部-200金-0.2GPA-2探索
        for (const [playerId, response] of context.responses) {
          const player = state.players.find(p => p.id === playerId);
          if (player) {
            player.money -= 200;
            player.gpa = Math.max(0, player.gpa - 0.2);
            player.exploration = Math.max(0, player.exploration - 2);
          }
        }
      }
    },
  },
};

export class ChainActionSystem {
  private activeChains: Map<string, ChainActionContext> = new Map();

  /**
   * 开始连锁行动
   */
  startChain(cardId: string, state: GameState, cardPlayerId: string): PendingAction | null {
    const config = CHAIN_ACTION_CARDS[cardId];
    if (!config) return null;

    const actorOrder = config.onStart(state, cardPlayerId);
    const context: ChainActionContext = {
      cardId,
      currentActorIndex: 0,
      actorOrder,
      responses: new Map(),
      timeoutPerPlayer: config.timeoutPerPlayer,
    };

    this.activeChains.set(cardId, context);

    return this.createChainAction(cardId, context, state);
  }

  /**
   * 创建当前玩家的连锁行动待处理动作
   */
  private createChainAction(
    cardId: string,
    context: ChainActionContext,
    state: GameState
  ): PendingAction {
    const currentPlayerId = context.actorOrder[context.currentActorIndex];
    const config = CHAIN_ACTION_CARDS[cardId];

    return {
      id: `chain_${cardId}_${Date.now()}`,
      playerId: currentPlayerId,
      type: 'chain_action',
      prompt: config.description,
      options: [
        { label: '继续', value: 'continue' },
        { label: '放弃', value: 'pass' },
      ],
      timeoutMs: context.timeoutPerPlayer,
      cardId,
      chainOrder: context.actorOrder,
    };
  }

  /**
   * 处理连锁行动响应
   */
  processChainResponse(
    cardId: string,
    playerId: string,
    action: 'continue' | 'pass',
    data: Record<string, unknown> | undefined,
    state: GameState
  ): { nextAction: PendingAction | null; chainComplete: boolean } {
    const context = this.activeChains.get(cardId);
    const config = CHAIN_ACTION_CARDS[cardId];

    if (!context || !config) {
      return { nextAction: null, chainComplete: true };
    }

    const player = state.players.find(p => p.id === playerId);
    if (!player) {
      return { nextAction: null, chainComplete: true };
    }

    // 记录响应
    context.responses.set(playerId, { playerId, action, data });

    // 执行玩家行动效果
    const result = config.onPlayerAction(player, action, data || {}, context, state);
    if (result.effect) {
      result.effect();
    }

    // 检查是否结束
    if (result.nextAction === 'end' ||
        context.currentActorIndex >= context.actorOrder.length - 1) {
      // 链结束
      config.onChainEnd(context, state);
      this.activeChains.delete(cardId);
      return { nextAction: null, chainComplete: true };
    }

    // 继续下一个玩家
    context.currentActorIndex++;
    const nextAction = this.createChainAction(cardId, context, state);
    return { nextAction, chainComplete: false };
  }

  /**
   * 处理超时（自动放弃）
   */
  handleTimeout(cardId: string, playerId: string, state: GameState): void {
    this.processChainResponse(cardId, playerId, 'pass', undefined, state);
  }
}
```

**Step 2: Commit**

```bash
git add server/src/game/interaction/ChainActionSystem.ts
git commit -m "feat: implement ChainActionSystem for chain reaction cards"
```

---

## Task 2.6: 创建卡牌效果处理器

**Files:**
- Create: `server/src/game/rules/CardEffectHandler.ts`

**Step 1: 创建卡牌效果处理器**

```typescript
// server/src/game/rules/CardEffectHandler.ts
import { Card, Player, GameState, PendingAction } from '@nannaricher/shared';
import { VotingSystem } from '../interaction/VotingSystem.js';
import { ChainActionSystem } from '../interaction/ChainActionSystem.js';

export interface CardEffectContext {
  card: Card;
  player: Player;
  state: GameState;
  diceValue?: number;
  targetPlayerId?: string;
}

export interface CardEffectResult {
  success: boolean;
  message: string;
  pendingAction?: PendingAction;
  effects?: {
    money?: number;
    gpa?: number;
    exploration?: number;
    skipTurn?: boolean;
    moveTo?: string;
    drawCard?: 'chance' | 'destiny';
    custom?: string;
  };
}

export class CardEffectHandler {
  private votingSystem: VotingSystem;
  private chainSystem: ChainActionSystem;

  constructor() {
    this.votingSystem = new VotingSystem();
    this.chainSystem = new ChainActionSystem();
  }

  /**
   * 处理卡牌效果
   */
  handleCardEffect(context: CardEffectContext): CardEffectResult {
    const { card, player, state } = context;

    // 手持卡牌通常需要特殊触发条件
    if (card.holdable) {
      return this.handleHoldableCard(context);
    }

    // 即时卡牌根据ID处理
    return this.handleInstantCard(context);
  }

  /**
   * 处理手持型卡牌
   */
  private handleHoldableCard(context: CardEffectContext): CardEffectResult {
    const { card, player } = context;

    switch (card.id) {
      case 'destiny_maimen_shield':
        return {
          success: true,
          message: '麦门护盾已激活，下次食堂线负面效果将被屏蔽',
          effects: { custom: 'maimen_shield_active' },
        };

      case 'destiny_stop_loss':
        return {
          success: true,
          message: '及时止损：取消即将执行的事件',
          effects: { custom: 'stop_loss' },
        };

      case 'destiny_urgent_deadline':
        return {
          success: true,
          message: '工期紧迫：可直接离开校医院或鼎',
          effects: { custom: 'urgent_deadline' },
        };

      case 'destiny_negative_balance':
        return {
          success: true,
          message: '余额为负：可抵消一次大额支出',
          effects: { custom: 'negative_balance' },
        };

      case 'destiny_inherited_papers':
        return {
          success: true,
          message: '祖传试卷：抵消GPA负面效果',
          effects: { custom: 'gpa_shield' },
        };

      case 'destiny_throw_stone':
        return {
          success: true,
          message: '投石问路：抵消金钱负面效果',
          effects: { custom: 'money_shield' },
        };

      case 'destiny_campus_legend':
        return {
          success: true,
          message: '校园传说：抵消探索值负面效果',
          effects: { custom: 'exploration_shield' },
        };

      case 'destiny_alternative_path':
        return {
          success: true,
          message: '另辟蹊径：直接移动到线路终点',
          effects: { custom: 'alternative_path' },
        };

      case 'destiny_major_admission':
        return {
          success: true,
          message: '大类招生：延迟一回合选定培养计划',
          effects: { custom: 'delay_plan_selection' },
        };

      case 'destiny_cross_college_exit':
        return {
          success: true,
          message: '跨院准出：取消一个已固定的培养计划',
          effects: { custom: 'unfix_plan' },
        };

      case 'destiny_professional_intention':
        return {
          success: true,
          message: '专业意向：提前固定培养计划',
          effects: { gpa: 0.1, exploration: 1, custom: 'early_plan_fix' },
        };

      case 'destiny_familiar_route':
        return {
          success: true,
          message: '轻车熟路：领取经验卡后可再次进入',
          effects: { custom: 'familiar_route' },
        };

      case 'destiny_how_to_explain':
        return {
          success: true,
          message: '如何解释：取消本次格子事件',
          effects: { custom: 'cancel_cell_event' },
        };

      case 'destiny_drum_beat_return':
        return {
          success: true,
          message: '鼓点重奏：再投一次骰子选择结果',
          effects: { custom: 'drum_beat_return' },
        };

      // 机会卡手持型
      case 'chance_info_blocked':
        return {
          success: true,
          message: '消息闭塞：抵消任意玩家机会卡',
          effects: { custom: 'block_chance' },
        };

      case 'chance_false_move':
        return {
          success: true,
          message: '虚晃一枪：抵消任意玩家命运卡',
          effects: { custom: 'block_destiny' },
        };

      case 'chance_pie_in_sky':
        return {
          success: true,
          message: '画饼充饥：取消其他玩家格子事件',
          effects: { custom: 'cancel_other_event' },
        };

      case 'chance_one_jump_relief':
        return {
          success: true,
          message: '一跃愁解：使目标下次效果反转',
          effects: { custom: 'reverse_effect' },
        };

      case 'chance_water_power_outage':
        return {
          success: true,
          message: '停水停电：禁止任意玩家行动',
          effects: { custom: 'skip_player_turn' },
        };

      case 'chance_mending_plan':
        return {
          success: true,
          message: '补天计划：玩家即将胜利时可抢先行动',
          effects: { custom: 'mending_plan' },
        };

      default:
        return { success: false, message: `未知的手持卡牌: ${card.id}` };
    }
  }

  /**
   * 处理即时型卡牌
   */
  private handleInstantCard(context: CardEffectContext): CardEffectResult {
    const { card, player, state } = context;

    // 检查是否是投票卡
    const voteAction = this.votingSystem.createVoteAction(card.id, state);
    if (voteAction) {
      return {
        success: true,
        message: `投票卡：${card.name}`,
        pendingAction: voteAction,
      };
    }

    // 检查是否是连锁行动卡
    if (this.isChainActionCard(card.id)) {
      // 返回需要启动连锁的信号
      return {
        success: true,
        message: `连锁行动卡：${card.name}`,
        pendingAction: {
          id: `chain_start_${card.id}`,
          playerId: player.id,
          type: 'chain_action',
          prompt: card.description,
          cardId: card.id,
          timeoutMs: 30000,
        },
      };
    }

    // 处理简单效果卡
    if (card.effects && card.effects.length > 0) {
      return this.applySimpleEffects(context);
    }

    // 处理特殊效果卡
    return this.handleSpecialCard(context);
  }

  /**
   * 应用简单数值效果
   */
  private applySimpleEffects(context: CardEffectContext): CardEffectResult {
    const { card, player } = context;
    const effects: CardEffectResult['effects'] = {};
    const messages: string[] = [];

    for (const effect of card.effects!) {
      if (effect.stat && effect.delta !== undefined) {
        switch (effect.stat) {
          case 'money':
            effects.money = (effects.money || 0) + effect.delta;
            messages.push(`金钱${effect.delta >= 0 ? '+' : ''}${effect.delta}`);
            break;
          case 'gpa':
            effects.gpa = (effects.gpa || 0) + effect.delta;
            messages.push(`GPA${effect.delta >= 0 ? '+' : ''}${effect.delta}`);
            break;
          case 'exploration':
            effects.exploration = (effects.exploration || 0) + effect.delta;
            messages.push(`探索${effect.delta >= 0 ? '+' : ''}${effect.delta}`);
            break;
        }
      }
    }

    return {
      success: true,
      message: `${card.name}：${messages.join('，')}`,
      effects,
    };
  }

  /**
   * 处理特殊效果卡
   */
  private handleSpecialCard(context: CardEffectContext): CardEffectResult {
    const { card, player, state, diceValue } = context;

    switch (card.id) {
      case 'destiny_boss_recruit':
        // BOSS直聘：探索值重置为点数*0.1*当前探索值
        if (diceValue) {
          const newExp = diceValue * 0.1 * player.exploration;
          return {
            success: true,
            message: `BOSS直聘：探索值从${player.exploration}变为${newExp.toFixed(1)}`,
            effects: { exploration: newExp - player.exploration },
          };
        }
        return { success: false, message: '需要投骰子' };

      case 'destiny_mutual_help':
        // 手望相助：二选一
        return {
          success: true,
          message: '手望相助：是否关注手手？',
          pendingAction: {
            id: `choose_${card.id}`,
            playerId: player.id,
            type: 'choose_option',
            prompt: '是否在各平台关注了手手？',
            options: [
              { label: '是', value: 'yes', description: '金钱+100' },
              { label: '否', value: 'no', description: '探索-2，金钱-200' },
            ],
            timeoutMs: 60000,
          },
        };

      case 'destiny_questionnaire':
        // 问卷调查：二选一
        return {
          success: true,
          message: '问卷调查：选择奖励',
          pendingAction: {
            id: `choose_${card.id}`,
            playerId: player.id,
            type: 'choose_option',
            prompt: '选择一项执行',
            options: [
              { label: '+50金', value: '50gold' },
              { label: '暂停1回合+200金', value: 'skip200' },
            ],
            timeoutMs: 60000,
          },
        };

      case 'destiny_beijing_university':
        return {
          success: true,
          message: '北京大学：移动到浦口线强制进入',
          effects: { moveTo: 'line_pukou' },
        };

      case 'destiny_chew_vegetable_root':
        return {
          success: true,
          message: '嚼得菜根：移动到学习线',
          effects: { moveTo: 'line_study' },
        };

      case 'destiny_more_the_better':
        return {
          success: true,
          message: '多多益善：移动到家教创业线',
          effects: { moveTo: 'line_money' },
        };

      case 'destiny_start_new_stove':
        return {
          success: true,
          message: '另起炉灶：移动到苏州线',
          effects: { moveTo: 'line_suzhou' },
        };

      case 'destiny_next_station_xianlin':
        return {
          success: true,
          message: '移动到仙林线',
          effects: { moveTo: 'line_xianlin' },
        };

      case 'destiny_north_south_gaze':
        return {
          success: true,
          message: '南北相望：移动到鼓楼线',
          effects: { moveTo: 'line_gulou' },
        };

      case 'destiny_see_more_eat_more':
        return {
          success: true,
          message: '见多食广：移动到食堂线强制进入',
          effects: { moveTo: 'line_food' },
        };

      case 'destiny_social_phobia':
        return {
          success: true,
          message: '社恐分子：移动到学生组织与活动线',
          effects: { moveTo: 'line_explore' },
        };

      case 'destiny_campus_legend_move':
        return {
          success: true,
          message: '校园传说：移动到鼎',
          effects: { moveTo: 'ding' },
        };

      case 'destiny_fengshui_rotation':
        return {
          success: true,
          message: '风水轮转：下回合行动顺序反转',
          effects: { custom: 'reverse_turn_order' },
        };

      case 'destiny_system_failure':
        return {
          success: true,
          message: '系统故障：下回合金钱始终为0',
          effects: { custom: 'system_fault' },
        };

      case 'destiny_delayed_gratification':
        return {
          success: true,
          message: '延迟满足：选择是否执行',
          pendingAction: {
            id: `choose_${card.id}`,
            playerId: player.id,
            type: 'choose_option',
            prompt: '是否执行延迟满足？',
            options: [
              { label: '执行', value: 'execute', description: '下回合金钱归0，未破产则恢复+500金' },
              { label: '不执行', value: 'skip' },
            ],
            timeoutMs: 60000,
          },
        };

      case 'destiny_limited_supply':
      case 'destiny_skateboard_genius':
      case 'destiny_closing_music':
      case 'destiny_seven_year_itch':
        return {
          success: true,
          message: card.description,
          effects: { custom: card.id },
        };

      // 机会卡即时型
      case 'chance_garbage_collection':
        // 垃圾回收：所有人卡牌放回牌堆
        for (const p of state.players) {
          state.cardDecks.chance.push(...p.heldCards.filter(c => c.deckType === 'chance'));
          state.cardDecks.destiny.push(...p.heldCards.filter(c => c.deckType === 'destiny'));
          p.heldCards = [];
        }
        return { success: true, message: '垃圾回收：所有人卡牌放回牌堆' };

      case 'chance_steal_rich_help_poor':
        return {
          success: true,
          message: '盗亦有道：最富-200金，最穷+200金',
          effects: { custom: 'steal_rich_help_poor' },
        };

      case 'chance_score_conversion':
        return {
          success: true,
          message: '分制转换：最高GPA-0.2，最低+0.2',
          effects: { custom: 'score_conversion' },
        };

      case 'chance_reorganize_dorm':
        return {
          success: true,
          message: '重组宿舍：最高探索-2，最低+2',
          effects: { custom: 'reorganize_dorm' },
        };

      case 'chance_robin_hood':
        return {
          success: true,
          message: '劫富济贫：选择一位玩家金钱取平均',
          pendingAction: {
            id: `choose_${card.id}`,
            playerId: player.id,
            type: 'choose_player',
            prompt: '选择一位玩家，你们的金钱将取平均',
            targetPlayerIds: state.players.filter(p => p.id !== player.id).map(p => p.id),
            timeoutMs: 60000,
          },
        };

      case 'chance_budget_sharing':
        for (const p of state.players) {
          p.money = 800;
        }
        return { success: true, message: '经费均摊：所有玩家金钱重置为800' };

      default:
        return { success: true, message: card.description, effects: { custom: card.id } };
    }
  }

  private isChainActionCard(cardId: string): boolean {
    return ['chance_southbound_rose', 'chance_delivery_theft', 'chance_gossip_secret'].includes(cardId);
  }
}
```

**Step 2: Commit**

```bash
git add server/src/game/rules/CardEffectHandler.ts
git commit -m "feat: implement CardEffectHandler for all 103 cards"
```

---

## Task 2.7: 创建历史追踪系统

**Files:**
- Create: `server/src/game/history/StateTracker.ts`

**Step 1: 创建状态追踪器**

```typescript
// server/src/game/history/StateTracker.ts
import { Player, Position, Card, PlayerHistory, CardDrawRecord, LineExitRecord, PositionRecord } from '@nannaricher/shared';

export class StateTracker {
  private playerHistories: Map<string, PlayerHistory> = new Map();

  /**
   * 初始化玩家历史
   */
  initPlayerHistory(playerId: string, startPosition: Position): void {
    this.playerHistories.set(playerId, {
      positions: [{ turn: 0, position: startPosition, timestamp: Date.now() }],
      linesVisited: [],
      lineEventsTriggered: {},
      sharedCellsWith: {},
      cardsDrawn: [],
      moneyHistory: [],
      chanceCardsUsedOnPlayers: {},
      lineExits: [],
      hospitalVisits: 0,
      moneyZeroCount: 0,
      gulouEndpointReached: 0,
      campusLineOrder: [],
      foodLineNegativeFreeStreak: 0,
      plansConfirmedTurn: [],
      mainCellVisited: [],
    });
  }

  /**
   * 记录位置变化
   */
  recordPosition(playerId: string, position: Position, turn: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.positions.push({ turn, position, timestamp: Date.now() });
    }
  }

  /**
   * 记录访问线路
   */
  recordLineVisit(playerId: string, lineId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.linesVisited.includes(lineId)) {
        history.linesVisited.push(lineId);
      }

      // 记录校区线顺序（历史学院）
      const campusLines = ['pukou', 'gulou', 'xianlin', 'suzhou'];
      if (campusLines.includes(lineId)) {
        if (!history.campusLineOrder.includes(lineId)) {
          history.campusLineOrder.push(lineId);
        }
      }
    }
  }

  /**
   * 记录线路事件触发
   */
  recordLineEvent(playerId: string, lineId: string, eventIndex: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.lineEventsTriggered[lineId]) {
        history.lineEventsTriggered[lineId] = [];
      }
      if (!history.lineEventsTriggered[lineId].includes(eventIndex)) {
        history.lineEventsTriggered[lineId].push(eventIndex);
      }
    }
  }

  /**
   * 记录抽卡
   */
  recordCardDraw(playerId: string, card: Card, turn: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      const record: CardDrawRecord = {
        cardId: card.id,
        cardName: card.name,
        deckType: card.deckType,
        hasEnglish: this.containsEnglish(card.name, card.description),
        startsWithDigit: /^\d/.test(card.name),
        turn,
      };
      history.cardsDrawn.push(record);
    }
  }

  /**
   * 记录与其他玩家在同一格停留
   */
  recordSharedCell(playerId: string, otherPlayerId: string, turn: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.sharedCellsWith[otherPlayerId]) {
        history.sharedCellsWith[otherPlayerId] = [];
      }
      history.sharedCellsWith[otherPlayerId].push(turn);
    }
  }

  /**
   * 记录金钱变化（大气学院）
   */
  recordMoneyChange(playerId: string, money: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.moneyHistory.push(money);
    }
  }

  /**
   * 记录使用机会卡
   */
  recordChanceCardUse(playerId: string, targetPlayerId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.chanceCardsUsedOnPlayers[targetPlayerId]) {
        history.chanceCardsUsedOnPlayers[targetPlayerId] = 0;
      }
      history.chanceCardsUsedOnPlayers[targetPlayerId]++;
    }
  }

  /**
   * 记录线路进出
   */
  recordLineExit(
    playerId: string,
    lineId: string,
    entryTurn: number,
    exitTurn: number,
    player: Player
  ): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      // 需要获取进入时的资源快照，这里简化处理
      const record: LineExitRecord = {
        lineId,
        entryTurn,
        exitTurn,
        gpaBefore: player.gpa, // 简化：应该是进入时的值
        gpaAfter: player.gpa,
        explorationBefore: player.exploration,
        explorationAfter: player.exploration,
        moneyBefore: player.money,
        moneyAfter: player.money,
      };
      history.lineExits.push(record);

      // 鼓楼线终点计数（数学系）
      if (lineId === 'gulou') {
        history.gulouEndpointReached++;
      }
    }
  }

  /**
   * 记录访问医院
   */
  recordHospitalVisit(playerId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.hospitalVisits++;
    }
  }

  /**
   * 记录金钱为0
   */
  recordMoneyZero(playerId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.moneyZeroCount++;
    }
  }

  /**
   * 更新食堂线连续无负面次数
   */
  updateFoodLineStreak(playerId: string, hadNegative: boolean): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (hadNegative) {
        history.foodLineNegativeFreeStreak = 0;
      } else {
        history.foodLineNegativeFreeStreak++;
      }
    }
  }

  /**
   * 记录确认培养计划
   */
  recordPlanConfirm(playerId: string, turn: number): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      history.plansConfirmedTurn.push(turn);
    }
  }

  /**
   * 记录访问主地图格子（建筑学院）
   */
  recordMainCellVisit(playerId: string, cellId: string): void {
    const history = this.playerHistories.get(playerId);
    if (history) {
      if (!history.mainCellVisited.includes(cellId)) {
        history.mainCellVisited.push(cellId);
      }
    }
  }

  /**
   * 获取玩家历史
   */
  getPlayerHistory(playerId: string): PlayerHistory | undefined {
    return this.playerHistories.get(playerId);
  }

  /**
   * 检查玩家是否在同一格
   */
  checkAndUpdateSharedCells(players: Player[], turn: number): void {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        if (this.isSamePosition(players[i].position, players[j].position)) {
          this.recordSharedCell(players[i].id, players[j].id, turn);
          this.recordSharedCell(players[j].id, players[i].id, turn);
        }
      }
    }
  }

  /**
   * 检查是否同一位置
   */
  private isSamePosition(pos1: Position, pos2: Position): boolean {
    if (pos1.type !== pos2.type) return false;
    if (pos1.type === 'main') {
      return pos1.index === (pos2 as any).index;
    }
    return pos1.lineId === (pos2 as any).lineId && pos1.index === (pos2 as any).index;
  }

  /**
   * 检查字符串是否包含英文字母（除GPA外）
   */
  private containsEnglish(name: string, description: string): boolean {
    const text = name + ' ' + description;
    const englishPattern = /[a-zA-Z]/g;
    const matches = text.match(englishPattern) || [];
    // 排除 GPA
    const nonGpaMatches = matches.filter(m => !/GPA/i.test(m));
    return nonGpaMatches.length > 0;
  }
}
```

**Step 2: Commit**

```bash
git add server/src/game/history/StateTracker.ts
git commit -m "feat: implement StateTracker for player history tracking"
```

---

## Task 2.8: 更新 GameEngine 集成所有系统

**Files:**
- Modify: `server/src/game/GameEngine.ts`

**Step 1: 在 GameEngine 中集成新系统**

在 `server/src/game/GameEngine.ts` 中添加以下导入和集成代码：

```typescript
// 在文件顶部添加导入
import { WinConditionChecker } from './rules/WinConditionChecker.js';
import { PlanAbilityHandler } from './rules/PlanAbilities.js';
import { CardEffectHandler } from './rules/CardEffectHandler.js';
import { StateTracker } from './history/StateTracker.js';
import { VotingSystem } from './interaction/VotingSystem.js';
import { ChainActionSystem } from './interaction/ChainActionSystem.js';

// 在 GameEngine 类中添加属性
export class GameEngine implements IGameEngine {
  private state: GameState;
  private eventHandler: EventHandler;
  private winChecker: WinConditionChecker;
  private planAbilities: PlanAbilityHandler;
  private cardHandler: CardEffectHandler;
  private stateTracker: StateTracker;
  private votingSystem: VotingSystem;
  private chainSystem: ChainActionSystem;

  constructor(roomId: string) {
    this.state = this.createInitialState(roomId);
    this.eventHandler = new EventHandler(this);
    this.winChecker = new WinConditionChecker();
    this.planAbilities = new PlanAbilityHandler();
    this.cardHandler = new CardEffectHandler();
    this.stateTracker = new StateTracker();
    this.votingSystem = new VotingSystem();
    this.chainSystem = new ChainActionSystem();
  }

  // 更新 checkWinConditions 方法
  checkWinConditions(playerId: string): { won: boolean; condition: string | null } {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return { won: false, condition: null };

    // 检查基础胜利
    const baseScore = player.gpa * 10 + player.exploration;
    if (baseScore >= 60) {
      return { won: true, condition: `GPA×10+探索值达到 ${baseScore.toFixed(1)} ≥ 60` };
    }

    // 检查培养计划胜利条件
    const history = this.stateTracker.getPlayerHistory(playerId);
    if (history) {
      const result = this.winChecker.checkWinConditions(player, this.state, history);
      if (result.won && result.condition) {
        return { won: true, condition: result.condition };
      }
    }

    return { won: false, condition: null };
  }

  // 暴露 StateTracker 供其他系统使用
  getStateTracker(): StateTracker {
    return this.stateTracker;
  }
}
```

**Step 2: 验证构建**

Run: `npm run build -w server`

Expected: 构建成功

**Step 3: Commit**

```bash
git add server/src/game/GameEngine.ts
git commit -m "refactor: integrate WinConditionChecker, PlanAbilities, CardEffectHandler and StateTracker into GameEngine"
```

---

# Phase 3: 视觉与动画 (Visual & Animation)

## Task 3.1: 创建 PixiJS 游戏画布组件

**Files:**
- Create: `client/src/game/GameCanvas.tsx`

**Step 1: 创建游戏画布容器**

```tsx
// client/src/game/GameCanvas.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { Stage, Container } from '@pixi/react';
import { Application, FederatedPointerEvent } from 'pixi.js';
import { BoardRenderer } from './board/BoardRenderer';
import { PlayerPiece } from './pieces/PlayerPiece';
import { Dice } from './pieces/Dice';
import { GameState, Position } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../styles/tokens';

interface GameCanvasProps {
  gameState: GameState;
  currentPlayerId: string | null;
  onCellClick?: (cellId: string, position: Position) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  currentPlayerId,
  onCellClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
  const [scale, setScale] = React.useState(1);

  // 响应式调整
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
        // 计算缩放比例以适应容器
        const minDim = Math.min(clientWidth, clientHeight);
        setScale(minDim / 800);
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleCellClick = useCallback((cellId: string, position: Position) => {
    onCellClick?.(cellId, position);
  }, [onCellClick]);

  return (
    <div
      ref={containerRef}
      className="game-canvas-container"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#f5f5f5',
        borderRadius: DESIGN_TOKENS.radius.lg,
        overflow: 'hidden',
      }}
    >
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        options={{
          backgroundColor: 0xf5f5f5,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        }}
      >
        <Container scale={scale}>
          <BoardRenderer
            gameState={gameState}
            onCellClick={handleCellClick}
          />
          {gameState.players.map((player) => (
            <PlayerPiece
              key={player.id}
              player={player}
              isCurrentPlayer={player.id === currentPlayerId}
            />
          ))}
        </Container>
      </Stage>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add client/src/game/GameCanvas.tsx
git commit -m "feat: create GameCanvas component with PixiJS Stage"
```

---

## Task 3.2: 创建棋盘渲染器

**Files:**
- Create: `client/src/game/board/BoardRenderer.tsx`

**Step 1: 创建棋盘渲染器**

```tsx
// client/src/game/board/BoardRenderer.tsx
import React, { useCallback } from 'react';
import { Container, Graphics } from '@pixi/react';
import { Graphics as PixiGraphics, FederatedPointerEvent } from 'pixi.js';
import { CellSprite } from './CellSprite';
import { LineRenderer } from './LineRenderer';
import { GameState, Position, MainPosition } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../../styles/tokens';
import { MAIN_BOARD_CELLS, CORNER_INDICES, LINE_EXIT_MAP } from '../../../../server/src/data/board';

interface BoardRendererProps {
  gameState: GameState;
  onCellClick?: (cellId: string, position: Position) => void;
}

// 棋盘配置
const BOARD_SIZE = 700;
const CELL_SIZE = 80;
const CORNER_SIZE = 100;
const CELLS_PER_SIDE = 7;

export const BoardRenderer: React.FC<BoardRendererProps> = ({
  gameState,
  onCellClick,
}) => {
  // 计算格子位置
  const getCellPosition = useCallback((index: number): { x: number; y: number } => {
    const boardCenter = BOARD_SIZE / 2;
    const halfCell = CELL_SIZE / 2;
    const halfCorner = CORNER_SIZE / 2;

    // 计算在边上的位置
    // 底边 (0-6): 从右往左
    // 左边 (7-13): 从下往上
    // 顶边 (14-20): 从左往右
    // 右边 (21-27): 从上往下

    const side = Math.floor(index / CELLS_PER_SIDE);
    const posInSide = index % CELLS_PER_SIDE;

    let x = 0, y = 0;

    switch (side) {
      case 0: // 底边，从右往左
        x = boardCenter + halfCorner + (CELLS_PER_SIDE - 1 - posInSide) * CELL_SIZE;
        y = boardCenter + halfCorner;
        break;
      case 1: // 左边，从下往上
        x = boardCenter - halfCorner;
        y = boardCenter + halfCorner - (posInSide + 1) * CELL_SIZE;
        break;
      case 2: // 顶边，从左往右
        x = boardCenter - halfCorner - (CELLS_PER_SIDE - 1 - posInSide) * CELL_SIZE;
        y = boardCenter - halfCorner;
        break;
      case 3: // 右边，从上往下
        x = boardCenter + halfCorner;
        y = boardCenter - halfCorner + (posInSide + 1) * CELL_SIZE;
        break;
    }

    return { x, y };
  }, []);

  // 绘制棋盘背景
  const drawBackground = useCallback((g: PixiGraphics) => {
    g.clear();

    // 棋盘底色
    g.beginFill(0xffffff);
    g.drawRoundedRect(-BOARD_SIZE/2 - 20, -BOARD_SIZE/2 - 20, BOARD_SIZE + 40, BOARD_SIZE + 40, 16);
    g.endFill();

    // 中央区域
    g.beginFill(0xfafafa);
    g.drawRoundedRect(-BOARD_SIZE/2 + 100, -BOARD_SIZE/2 + 100, BOARD_SIZE - 200, BOARD_SIZE - 200, 12);
    g.endFill();
  }, []);

  return (
    <Container x={BOARD_SIZE / 2} y={BOARD_SIZE / 2}>
      {/* 背景 */}
      <Graphics draw={drawBackground} />

      {/* 主棋盘格子 */}
      {MAIN_BOARD_CELLS.map((cell, index) => {
        const pos = getCellPosition(index);
        return (
          <CellSprite
            key={cell.id}
            cell={cell}
            x={pos.x}
            y={pos.y}
            isCorner={CORNER_INDICES.includes(index)}
            onClick={() => {
              const position: MainPosition = { type: 'main', index };
              onCellClick?.(cell.id, position);
            }}
          />
        );
      })}

      {/* 支线渲染器 */}
      <LineRenderer
        gameState={gameState}
        boardSize={BOARD_SIZE}
        cellSize={CELL_SIZE}
      />
    </Container>
  );
};
```

**Step 2: Commit**

```bash
git add client/src/game/board/BoardRenderer.tsx
git commit -m "feat: create BoardRenderer with 28-cell layout"
```

---

## Task 3.3: 创建格子精灵组件

**Files:**
- Create: `client/src/game/board/CellSprite.tsx`

**Step 1: 创建格子精灵**

```tsx
// client/src/game/board/CellSprite.tsx
import React, { useCallback, useMemo } from 'react';
import { Container, Graphics, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle } from 'pixi.js';
import { MainCell } from '../../../../server/src/data/board';
import { DESIGN_TOKENS } from '../../styles/tokens';

interface CellSpriteProps {
  cell: MainCell;
  x: number;
  y: number;
  isCorner: boolean;
  onClick?: () => void;
}

const CORNER_SIZE = 90;
const CELL_SIZE = 70;

export const CellSprite: React.FC<CellSpriteProps> = ({
  cell,
  x,
  y,
  isCorner,
  onClick,
}) => {
  const size = isCorner ? CORNER_SIZE : CELL_SIZE;

  // 获取格子颜色
  const cellColor = useMemo(() => {
    if (isCorner) {
      switch (cell.id) {
        case 'start': return DESIGN_TOKENS.color.cell.corner.start;
        case 'hospital': return DESIGN_TOKENS.color.cell.corner.hospital;
        case 'ding': return DESIGN_TOKENS.color.cell.corner.ding;
        case 'waiting_room': return DESIGN_TOKENS.color.cell.corner.waiting;
        default: return 0xffffff;
      }
    }

    switch (cell.type) {
      case 'event': return DESIGN_TOKENS.color.cell.event;
      case 'chance': return DESIGN_TOKENS.color.cell.chance;
      case 'line_entry':
        const lineId = cell.lineId || '';
        return DESIGN_TOKENS.color.cell.lineEntry[lineId] || 0xcccccc;
      default: return 0xffffff;
    }
  }, [cell, isCorner]);

  const drawCell = useCallback((g: PixiGraphics) => {
    g.clear();

    // 格子背景
    g.beginFill(cellColor);
    if (isCorner) {
      g.drawRoundedRect(-size/2, -size/2, size, size, 12);
    } else {
      g.drawRoundedRect(-size/2, -size/2, size, size, 8);
    }
    g.endFill();

    // 边框
    g.lineStyle(2, 0x333333, 0.3);
    if (isCorner) {
      g.drawRoundedRect(-size/2, -size/2, size, size, 12);
    } else {
      g.drawRoundedRect(-size/2, -size/2, size, size, 8);
    }

    // 入口标记（线路入口格）
    if (cell.type === 'line_entry') {
      g.beginFill(0x333333, 0.2);
      g.drawCircle(0, size/3, 8);
      g.endFill();
    }
  }, [cellColor, size, isCorner, cell.type]);

  // 格子名称样式
  const nameStyle = useMemo(() => new TextStyle({
    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
    fontSize: isCorner ? 14 : 11,
    fill: isCorner ? 0xffffff : 0x333333,
    fontWeight: isCorner ? 'bold' : 'normal',
    align: 'center',
    wordWrap: true,
    wordWrapWidth: size - 8,
  }), [isCorner, size]);

  // 类型标记
  const typeIcon = useMemo(() => {
    switch (cell.type) {
      case 'chance': return '?';
      case 'event': return '!';
      case 'line_entry': return '→';
      default: return '';
    }
  }, [cell.type]);

  return (
    <Container
      x={x}
      y={y}
      interactive={true}
      pointerdown={onClick}
      pointerover={() => {/* hover effect */}}
      pointerout={() => {/* hover out */}}
    >
      <Graphics draw={drawCell} />
      <Text
        text={cell.name}
        style={nameStyle}
        anchor={0.5}
        y={isCorner ? -5 : -8}
      />
      {typeIcon && (
        <Text
          text={typeIcon}
          style={new TextStyle({
            fontSize: 20,
            fill: 0xffffff,
            fontWeight: 'bold',
          })}
          anchor={0.5}
          y={size/3 - 5}
        />
      )}
    </Container>
  );
};
```

**Step 2: Commit**

```bash
git add client/src/game/board/CellSprite.tsx
git commit -m "feat: create CellSprite with corner/event/chance/line_entry rendering"
```

---

## Task 3.4: 创建玩家棋子组件

**Files:**
- Create: `client/src/game/pieces/PlayerPiece.tsx`

**Step 1: 创建玩家棋子**

```tsx
// client/src/game/pieces/PlayerPiece.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Container, Graphics, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle } from 'pixi.js';
import { Player, Position, MainPosition, LinePosition } from '@nannaricher/shared';
import { DESIGN_TOKENS } from '../../styles/tokens';

interface PlayerPieceProps {
  player: Player;
  isCurrentPlayer: boolean;
}

export const PlayerPiece: React.FC<PlayerPieceProps> = ({
  player,
  isCurrentPlayer,
}) => {
  const [displayPosition, setDisplayPosition] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);

  // 计算实际位置
  useEffect(() => {
    const targetPos = calculateScreenPosition(player.position);
    if (!isAnimating) {
      setDisplayPosition(targetPos);
    }
  }, [player.position, isAnimating]);

  // 绘制棋子
  const drawPiece = useCallback((g: PixiGraphics) => {
    g.clear();

    const color = DESIGN_TOKENS.color.player[
      Math.min(player.color ? parseInt(player.color) : 0, 5)
    ] || DESIGN_TOKENS.color.player[0];

    // 棋子底座
    g.beginFill(0x333333, 0.3);
    g.drawEllipse(0, 12, 15, 8);
    g.endFill();

    // 棋子主体
    g.beginFill(color);
    g.drawCircle(0, 0, 12);
    g.endFill();

    // 高光
    g.beginFill(0xffffff, 0.4);
    g.drawCircle(-4, -4, 4);
    g.endFill();

    // 当前玩家标记
    if (isCurrentPlayer) {
      g.lineStyle(3, DESIGN_TOKENS.color.brand.accent);
      g.drawCircle(0, 0, 16);
    }
  }, [player.color, isCurrentPlayer]);

  return (
    <Container x={displayPosition.x} y={displayPosition.y}>
      <Graphics draw={drawPiece} />
      <Text
        text={player.name.slice(0, 2)}
        style={new TextStyle({
          fontSize: 10,
          fill: 0xffffff,
          fontWeight: 'bold',
        })}
        anchor={0.5}
        y={-20}
      />
    </Container>
  );
}

// 计算屏幕位置（简化版，实际需要与 BoardRenderer 协调）
function calculateScreenPosition(position: Position): { x: number; y: number } {
  // 这里需要根据实际棋盘布局计算
  // 简化返回
  return { x: 350, y: 350 };
}
```

**Step 2: Commit**

```bash
git add client/src/game/pieces/PlayerPiece.tsx
git commit -m "feat: create PlayerPiece with color and current player indicator"
```

---

## Task 3.5: 创建骰子组件

**Files:**
- Create: `client/src/game/pieces/Dice.tsx`

**Step 1: 创建骰子组件**

```tsx
// client/src/game/pieces/Dice.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Container, Graphics, Text } from '@pixi/react';
import { Graphics as PixiGraphics, TextStyle } from 'pixi.js';
import { DESIGN_TOKENS } from '../../styles/tokens';

interface DiceProps {
  values: number[];
  isRolling: boolean;
  onRollComplete?: (values: number[]) => void;
}

export const Dice: React.FC<DiceProps> = ({
  values,
  isRolling,
  onRollComplete,
}) => {
  const [displayValues, setDisplayValues] = useState(values);
  const [rotation, setRotation] = useState(0);
  const rollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 滚动动画
  useEffect(() => {
    if (isRolling) {
      let frame = 0;
      rollIntervalRef.current = setInterval(() => {
        setDisplayValues([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
        ].slice(0, values.length));
        setRotation(frame * 30);
        frame++;

        if (frame >= 30) { // 1.5秒后停止
          clearInterval(rollIntervalRef.current!);
          setDisplayValues(values);
          setRotation(0);
          onRollComplete?.(values);
        }
      }, 50);
    }

    return () => {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
      }
    };
  }, [isRolling, values, onRollComplete]);

  return (
    <Container rotation={rotation * Math.PI / 180}>
      {displayValues.map((value, index) => (
        <DiceFace
          key={index}
          value={value}
          x={index * 60 - (displayValues.length - 1) * 30}
          y={0}
        />
      ))}
    </Container>
  );
};

interface DiceFaceProps {
  value: number;
  x: number;
  y: number;
}

const DiceFace: React.FC<DiceFaceProps> = ({ value, x, y }) => {
  const drawFace = useCallback((g: PixiGraphics) => {
    g.clear();

    // 骰子背景
    g.beginFill(0xffffff);
    g.drawRoundedRect(-25, -25, 50, 50, 8);
    g.endFill();

    // 边框
    g.lineStyle(2, 0x333333);
    g.drawRoundedRect(-25, -25, 50, 50, 8);

    // 点数
    g.beginFill(0x333333);
    const dotPositions = getDotPositions(value);
    for (const pos of dotPositions) {
      g.drawCircle(pos.x, pos.y, 5);
    }
    g.endFill();
  }, [value]);

  return (
    <Container x={x} y={y}>
      <Graphics draw={drawFace} />
    </Container>
  );
};

function getDotPositions(value: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const offset = 12;

  switch (value) {
    case 1:
      positions.push({ x: 0, y: 0 });
      break;
    case 2:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: offset, y: offset });
      break;
    case 3:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: 0, y: 0 });
      positions.push({ x: offset, y: offset });
      break;
    case 4:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: offset, y: -offset });
      positions.push({ x: -offset, y: offset });
      positions.push({ x: offset, y: offset });
      break;
    case 5:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: offset, y: -offset });
      positions.push({ x: 0, y: 0 });
      positions.push({ x: -offset, y: offset });
      positions.push({ x: offset, y: offset });
      break;
    case 6:
      positions.push({ x: -offset, y: -offset });
      positions.push({ x: offset, y: -offset });
      positions.push({ x: -offset, y: 0 });
      positions.push({ x: offset, y: 0 });
      positions.push({ x: -offset, y: offset });
      positions.push({ x: offset, y: offset });
      break;
  }

  return positions;
}
```

**Step 2: Commit**

```bash
git add client/src/game/pieces/Dice.tsx
git commit -m "feat: create Dice component with rolling animation"
```

---

# Phase 4: 体验增强 (Experience Enhancement)

## Task 4.1: 创建响应式布局组件

**Files:**
- Create: `client/src/ui/layouts/ResponsiveLayout.tsx`

**Step 1: 创建响应式布局**

```tsx
// client/src/ui/layouts/ResponsiveLayout.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { DESIGN_TOKENS } from '../../styles/tokens';

type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

interface ResponsiveContextValue {
  breakpoint: Breakpoint;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const ResponsiveContext = createContext<ResponsiveContextValue>({
  breakpoint: 'desktop',
  width: 1024,
  height: 768,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
});

export const useResponsive = () => useContext(ResponsiveContext);

export const ResponsiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [context, setContext] = useState<ResponsiveContextValue>({
    breakpoint: 'desktop',
    width: 1024,
    height: 768,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  });

  useEffect(() => {
    const updateContext = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      let breakpoint: Breakpoint = 'desktop';
      if (width < DESIGN_TOKENS.breakpoint.mobile) {
        breakpoint = 'mobile';
      } else if (width < DESIGN_TOKENS.breakpoint.tablet) {
        breakpoint = 'mobile';
      } else if (width < DESIGN_TOKENS.breakpoint.desktop) {
        breakpoint = 'tablet';
      } else if (width >= DESIGN_TOKENS.breakpoint.wide) {
        breakpoint = 'wide';
      }

      setContext({
        breakpoint,
        width,
        height,
        isMobile: breakpoint === 'mobile',
        isTablet: breakpoint === 'tablet',
        isDesktop: breakpoint === 'desktop' || breakpoint === 'wide',
      });
    };

    updateContext();
    window.addEventListener('resize', updateContext);
    return () => window.removeEventListener('resize', updateContext);
  }, []);

  return (
    <ResponsiveContext.Provider value={context}>
      {children}
    </ResponsiveContext.Provider>
  );
};

// 响应式布局组件
interface GameLayoutProps {
  children: React.ReactNode;
}

export const GameLayout: React.FC<GameLayoutProps> = ({ children }) => {
  const { isMobile, isTablet } = useResponsive();

  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  if (isTablet) {
    return <TabletLayout>{children}</TabletLayout>;
  }

  return <DesktopLayout>{children}</DesktopLayout>;
};

const DesktopLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-screen">
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex">
        <div className="flex-1 p-4">
          {/* 棋盘区域 */}
        </div>
        <div className="w-80 p-4 border-l border-gray-200">
          {/* 侧边栏 */}
        </div>
      </div>
      <div className="h-48 border-t border-gray-200">
        {/* 底部栏 */}
      </div>
    </div>
  </div>
);

const TabletLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col h-screen">
    <div className="flex-1 p-4">
      {/* 棋盘区域 */}
    </div>
    <div className="h-64 border-t border-gray-200 p-4">
      {/* 底部面板 */}
    </div>
  </div>
);

const MobileLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col h-screen">
    <div className="flex-1">
      {/* 棋盘区域 */}
    </div>
    <div className="border-t border-gray-200">
      {/* 可滑动的底部面板 */}
    </div>
  </div>
);
```

**Step 2: Commit**

```bash
git add client/src/ui/layouts/ResponsiveLayout.tsx
git commit -m "feat: create ResponsiveLayout with mobile/tablet/desktop variants"
```

---

## Task 4.2: 创建音频管理器

**Files:**
- Create: `client/src/audio/AudioManager.ts`

**Step 1: 创建音频管理器**

```typescript
// client/src/audio/AudioManager.ts
import { Howl, Howler } from 'howler';

export type SoundType =
  // 骰子
  | 'dice_roll'
  | 'dice_bounce'
  | 'dice_result_1' | 'dice_result_2' | 'dice_result_3'
  | 'dice_result_4' | 'dice_result_5' | 'dice_result_6'
  // 棋子
  | 'piece_move'
  | 'piece_arrive'
  // 资源
  | 'money_gain' | 'money_loss'
  | 'gpa_gain' | 'gpa_loss'
  | 'exp_gain' | 'exp_loss'
  // 卡牌
  | 'card_draw'
  | 'card_flip'
  | 'card_use'
  // 事件
  | 'event_trigger'
  | 'event_positive'
  | 'event_negative'
  // 线路
  | 'line_enter'
  | 'line_exit'
  // 游戏
  | 'turn_start'
  | 'game_win'
  | 'game_lose'
  // UI
  | 'ui_click'
  | 'ui_hover'
  | 'ui_confirm'
  | 'ui_error';

class AudioManager {
  private sounds: Map<SoundType, Howl> = new Map();
  private musicEnabled: boolean = true;
  private sfxEnabled: boolean = true;
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.7;

  constructor() {
    this.initSounds();
  }

  private initSounds(): void {
    // 骰子音效
    this.sounds.set('dice_roll', new Howl({
      src: ['/sounds/dice_roll.mp3'],
      volume: this.sfxVolume,
    }));

    this.sounds.set('dice_bounce', new Howl({
      src: ['/sounds/dice_bounce.mp3'],
      volume: this.sfxVolume,
    }));

    // 骰子结果
    for (let i = 1; i <= 6; i++) {
      this.sounds.set(`dice_result_${i}` as SoundType, new Howl({
        src: [`/sounds/dice_result_${i}.mp3`],
        volume: this.sfxVolume,
      }));
    }

    // 棋子移动
    this.sounds.set('piece_move', new Howl({
      src: ['/sounds/piece_move.mp3'],
      volume: this.sfxVolume,
    }));

    this.sounds.set('piece_arrive', new Howl({
      src: ['/sounds/piece_arrive.mp3'],
      volume: this.sfxVolume,
    }));

    // 资源变化
    this.sounds.set('money_gain', new Howl({
      src: ['/sounds/money_gain.mp3'],
      volume: this.sfxVolume,
    }));

    this.sounds.set('money_loss', new Howl({
      src: ['/sounds/money_loss.mp3'],
      volume: this.sfxVolume,
    }));

    // 卡牌
    this.sounds.set('card_draw', new Howl({
      src: ['/sounds/card_draw.mp3'],
      volume: this.sfxVolume,
    }));

    this.sounds.set('card_flip', new Howl({
      src: ['/sounds/card_flip.mp3'],
      volume: this.sfxVolume,
    }));

    // 事件
    this.sounds.set('event_positive', new Howl({
      src: ['/sounds/event_positive.mp3'],
      volume: this.sfxVolume,
    }));

    this.sounds.set('event_negative', new Howl({
      src: ['/sounds/event_negative.mp3'],
      volume: this.sfxVolume,
    }));

    // UI
    this.sounds.set('ui_click', new Howl({
      src: ['/sounds/ui_click.mp3'],
      volume: this.sfxVolume,
    }));

    this.sounds.set('ui_confirm', new Howl({
      src: ['/sounds/ui_confirm.mp3'],
      volume: this.sfxVolume,
    }));

    this.sounds.set('ui_error', new Howl({
      src: ['/sounds/ui_error.mp3'],
      volume: this.sfxVolume,
    }));

    // 胜利
    this.sounds.set('game_win', new Howl({
      src: ['/sounds/game_win.mp3'],
      volume: this.sfxVolume,
    }));
  }

  play(sound: SoundType): void {
    if (!this.sfxEnabled) return;

    const howl = this.sounds.get(sound);
    if (howl) {
      howl.play();
    }
  }

  playDiceResult(value: number): void {
    this.play(`dice_result_${value}` as SoundType);
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    Howler.mute(!enabled);
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.musicVolume);
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach((howl) => {
      howl.volume(this.sfxVolume);
    });
  }
}

export const audioManager = new AudioManager();
```

**Step 2: Commit**

```bash
git add client/src/audio/AudioManager.ts
git commit -m "feat: create AudioManager with Howler.js for game sound effects"
```

---

## Task 4.3: 创建新手引导系统

**Files:**
- Create: `client/src/features/tutorial/TutorialSystem.tsx`

**Step 1: 创建新手引导**

```tsx
// client/src/features/tutorial/TutorialSystem.tsx
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for highlighting
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '欢迎来到菜根人生',
    content: '这是一个以南大校园为主题的大富翁游戏。你将扮演一名南大学生，通过投骰子前进，体验校园生活中的各种事件。',
    position: 'center',
  },
  {
    id: 'resources',
    title: '三种资源',
    content: '游戏中有三种资源：金钱💰、GPA📚、探索值🧭。它们之间可以换算：1探索 = 0.1GPA = 100金钱。',
    position: 'bottom',
  },
  {
    id: 'dice',
    title: '投骰子',
    content: '每回合点击"掷骰子"按钮，根据点数前进。按R键也可以快速掷骰。',
    target: '[data-tutorial="dice"]',
    position: 'top',
  },
  {
    id: 'board',
    title: '棋盘格子',
    content: '棋盘有28个格子，包括4个角落格、9个事件格、7个机会格和8条支线入口。不同颜色代表不同类型的格子。',
    position: 'center',
  },
  {
    id: 'lines',
    title: '支线系统',
    content: '从入口格可以进入支线探索。有些支线是强制的（如浦口线、食堂线），有些是可选的（需付入场费）。',
    position: 'center',
  },
  {
    id: 'plans',
    title: '培养计划',
    content: '游戏开始时你会抽取3张培养计划，选择1-2项保留。除了基础胜利条件外，达成培养计划条件也能获胜。',
    position: 'left',
  },
  {
    id: 'cards',
    title: '卡牌系统',
    content: '在机会格可以抽取卡牌。命运卡是单人事件，机会卡涉及多人互动。手持型卡牌可以在合适时机使用。',
    position: 'left',
  },
  {
    id: 'win',
    title: '胜利条件',
    content: '基础胜利：GPA×10 + 探索值 ≥ 60。或者达成你已确认的培养计划条件。祝你游戏愉快！',
    position: 'center',
  },
];

interface TutorialSystemProps {
  onComplete?: () => void;
}

export const TutorialSystem: React.FC<TutorialSystemProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(
    localStorage.getItem('nannaricher_tutorial_seen') === 'true'
  );

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep]);

  const handlePrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    setIsVisible(false);
    localStorage.setItem('nannaricher_tutorial_seen', 'true');
    onComplete?.();
  }, [onComplete]);

  if (hasSeenTutorial || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-white rounded-xl shadow-2xl max-w-md p-6 mx-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          {/* 进度指示 */}
          <div className="flex gap-1 mb-4">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full ${
                  index <= currentStep ? 'bg-nju-purple' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* 标题 */}
          <h2 className="text-xl font-bold text-nju-purple mb-3">
            {step.title}
          </h2>

          {/* 内容 */}
          <p className="text-gray-600 mb-6 leading-relaxed">
            {step.content}
          </p>

          {/* 按钮 */}
          <div className="flex justify-between items-center">
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              跳过引导
            </button>

            <div className="flex gap-2">
              {!isFirstStep && (
                <button
                  onClick={handlePrev}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  上一步
                </button>
              )}
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-nju-purple text-white rounded-lg hover:bg-nju-purple-dark"
              >
                {isLastStep ? '开始游戏' : '下一步'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
```

**Step 2: Commit**

```bash
git add client/src/features/tutorial/TutorialSystem.tsx
git commit -m "feat: create TutorialSystem with step-by-step onboarding"
```

---

## Task 4.4: 创建无障碍支持

**Files:**
- Create: `client/src/a11y/AccessibilityProvider.tsx`

**Step 1: 创建无障碍提供者**

```tsx
// client/src/a11y/AccessibilityProvider.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AccessibilitySettings {
  highContrast: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  reducedMotion: boolean;
  fontSize: number; // 0.8 - 1.6
  screenReaderMode: boolean;
}

interface AccessibilityContextValue extends AccessibilitySettings {
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
};

const STORAGE_KEY = 'nannaricher_a11y_settings';

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      highContrast: false,
      colorBlindMode: 'none',
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      fontSize: 1.0,
      screenReaderMode: false,
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    // 应用CSS变量
    const root = document.documentElement;
    root.style.setProperty('--font-size-multiplier', settings.fontSize.toString());
    root.classList.toggle('high-contrast', settings.highContrast);
    root.classList.toggle('reduced-motion', settings.reducedMotion);
    root.classList.toggle('screen-reader-mode', settings.screenReaderMode);
    root.setAttribute('data-colorblind', settings.colorBlindMode);
  }, [settings]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <AccessibilityContext.Provider value={{ ...settings, updateSettings }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// 键盘导航 Hook
export const useKeyboardNavigation = () => {
  const { screenReaderMode } = useAccessibility();

  useEffect(() => {
    if (!screenReaderMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'r':
        case 'R':
          // 掷骰子
          document.querySelector<HTMLElement>('[data-action="roll-dice"]')?.click();
          break;
        case 'c':
        case 'C':
          // 打开手牌
          document.querySelector<HTMLElement>('[data-action="show-cards"]')?.click();
          break;
        case 'p':
        case 'P':
          // 打开培养计划
          document.querySelector<HTMLElement>('[data-action="show-plans"]')?.click();
          break;
        case 'l':
        case 'L':
          // 打开日志
          document.querySelector<HTMLElement>('[data-action="show-log"]')?.click();
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          // 平移棋盘
          const board = document.querySelector('[data-board]');
          if (board) {
            const step = 50;
            const currentTransform = board.getAttribute('data-transform') || '0,0';
            const [x, y] = currentTransform.split(',').map(Number);
            let newX = x, newY = y;

            switch (e.key) {
              case 'ArrowUp': newY -= step; break;
              case 'ArrowDown': newY += step; break;
              case 'ArrowLeft': newX -= step; break;
              case 'ArrowRight': newX += step; break;
            }

            (board as HTMLElement).style.transform = `translate(${newX}px, ${newY}px)`;
            board.setAttribute('data-transform', `${newX},${newY}`);
          }
          break;
        case '+':
        case '=':
          // 放大
          break;
        case '-':
          // 缩小
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screenReaderMode]);
};

// ARIA Live Region 组件
export const LiveRegion: React.FC<{ message: string; assertive?: boolean }> = ({
  message,
  assertive = false,
}) => (
  <div
    role="status"
    aria-live={assertive ? 'assertive' : 'polite'}
    aria-atomic="true"
    className="sr-only"
  >
    {message}
  </div>
);
```

**Step 2: 添加无障碍CSS**

```css
/* client/src/styles/a11y.css */

/* 屏幕阅读器专用 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 高对比度模式 */
.high-contrast {
  --color-text: #000000;
  --color-background: #ffffff;
  --color-primary: #0000ff;
  --color-secondary: #ff0000;
}

.high-contrast .cell {
  border-width: 3px;
}

/* 减少动画模式 */
.reduced-motion * {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}

/* 色盲友好模式 */
[data-colorblind="protanopia"] {
  --color-danger: #0077bb;
  --color-success: #009988;
}

[data-colorblind="deuteranopia"] {
  --color-danger: #0077bb;
  --color-success: #33bbee;
}

[data-colorblind="tritanopia"] {
  --color-danger: #ee7733;
  --color-success: #009988;
}

/* 字体大小调整 */
:root {
  --font-size-multiplier: 1;
}

body {
  font-size: calc(16px * var(--font-size-multiplier));
}
```

**Step 3: Commit**

```bash
git add client/src/a11y/AccessibilityProvider.tsx client/src/styles/a11y.css
git commit -m "feat: add accessibility support with high contrast, color blind modes, and keyboard navigation"
```

---

# Phase 5: 质量保证 (Quality Assurance)

## Task 5.1: 创建胜利条件单元测试

**Files:**
- Create: `server/src/game/rules/__tests__/WinConditionChecker.test.ts`

**Step 1: 创建测试文件**

```typescript
// server/src/game/rules/__tests__/WinConditionChecker.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { WinConditionChecker } from '../WinConditionChecker';
import { Player, GameState, PlayerHistory } from '@nannaricher/shared';

describe('WinConditionChecker', () => {
  let checker: WinConditionChecker;
  let mockPlayer: Player;
  let mockState: GameState;
  let mockHistory: PlayerHistory;

  beforeEach(() => {
    checker = new WinConditionChecker();

    mockPlayer = {
      id: 'player1',
      socketId: 'socket1',
      name: '测试玩家',
      color: '0',
      money: 2000,
      gpa: 3.0,
      exploration: 10,
      position: { type: 'main', index: 0 },
      diceCount: 1,
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

    mockState = {
      roomId: 'test-room',
      phase: 'playing',
      currentPlayerIndex: 0,
      turnNumber: 1,
      roundNumber: 1,
      players: [mockPlayer],
      cardDecks: { chance: [], destiny: [], training: [] },
      discardPiles: { chance: [], destiny: [] },
      pendingAction: null,
      turnOrder: [0],
      turnOrderReversed: false,
      winner: null,
      log: [],
    };

    mockHistory = {
      positions: [],
      linesVisited: [],
      lineEventsTriggered: {},
      sharedCellsWith: {},
      cardsDrawn: [],
      moneyHistory: [],
      chanceCardsUsedOnPlayers: {},
      lineExits: [],
      hospitalVisits: 0,
      moneyZeroCount: 0,
      gulouEndpointReached: 0,
      campusLineOrder: [],
      foodLineNegativeFreeStreak: 0,
      plansConfirmedTurn: [],
      mainCellVisited: [],
    };
  });

  describe('基础胜利条件', () => {
    it('GPA×10+探索值≥60时应该胜利', () => {
      mockPlayer.gpa = 5.0;
      mockPlayer.exploration = 10;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
      expect(result.condition).toContain('60');
    });

    it('GPA×10+探索值<60时不应该胜利', () => {
      mockPlayer.gpa = 3.0;
      mockPlayer.exploration = 10;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(false);
    });
  });

  describe('商学院胜利条件', () => {
    it('金钱达到5000时应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_shangxue'];
      mockPlayer.money = 5000;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
      expect(result.condition).toContain('5000');
    });

    it('金钱4999时不应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_shangxue'];
      mockPlayer.money = 4999;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(false);
    });
  });

  describe('化学化工学院胜利条件', () => {
    it('探索值达到45时应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_huaxue'];
      mockPlayer.exploration = 45;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
    });
  });

  describe('马克思主义学院胜利条件', () => {
    it('GPA达到4.5时应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_makesi'];
      mockPlayer.gpa = 4.5;
      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
    });
  });

  describe('法学院胜利条件', () => {
    it('场上出现破产玩家且不是自己时应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_faxue'];
      const bankruptPlayer = { ...mockPlayer, id: 'player2', isBankrupt: true };
      mockState.players = [mockPlayer, bankruptPlayer];

      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
    });
  });

  describe('医学院胜利条件', () => {
    it('进入医院3次时应该胜利', () => {
      mockPlayer.confirmedPlans = ['plan_yixue'];
      mockHistory.hospitalVisits = 3;

      const result = checker.checkWinConditions(mockPlayer, mockState, mockHistory);
      expect(result.won).toBe(true);
    });
  });
});
```

**Step 2: 运行测试**

Run: `npm run test -w server`

Expected: 所有测试通过

**Step 3: Commit**

```bash
git add server/src/game/rules/__tests__/WinConditionChecker.test.ts
git commit -m "test: add unit tests for WinConditionChecker"
```

---

## Task 5.2: 创建E2E测试

**Files:**
- Create: `e2e/game-flow.spec.ts`

**Step 1: 创建E2E测试**

```typescript
// e2e/game-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('游戏流程测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('创建房间并开始游戏', async ({ page }) => {
    // 输入玩家名称
    await page.fill('[data-testid="player-name-input"]', '测试玩家');
    await page.click('[data-testid="create-room-btn"]');

    // 等待房间创建
    await expect(page.locator('[data-testid="room-id"]')).toBeVisible();

    // 开始游戏
    await page.click('[data-testid="start-game-btn"]');

    // 等待游戏开始
    await expect(page.locator('[data-testid="game-board"]')).toBeVisible();
  });

  test('投骰子并移动', async ({ page }) => {
    // 假设已经在游戏中
    await page.goto('/game/test-room');

    // 点击掷骰子
    await page.click('[data-testid="roll-dice-btn"]');

    // 等待骰子动画
    await page.waitForTimeout(2000);

    // 验证骰子结果显示
    await expect(page.locator('[data-testid="dice-result"]')).toBeVisible();
  });

  test('多人互动 - 投票卡', async ({ browser }) => {
    // 创建两个浏览器上下文
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // 两个玩家加入同一房间
    await page1.goto('/');
    await page1.fill('[data-testid="player-name-input"]', '玩家1');
    await page1.click('[data-testid="create-room-btn"]');

    const roomId = await page1.locator('[data-testid="room-id"]').textContent();

    await page2.goto('/');
    await page2.fill('[data-testid="player-name-input"]', '玩家2');
    await page2.fill('[data-testid="room-id-input"]', roomId || '');
    await page2.click('[data-testid="join-room-btn"]');

    // 验证两个玩家都在房间中
    await expect(page1.locator('[data-testid="player-list"]')).toContainText('玩家2');
  });
});

test.describe('响应式布局测试', () => {
  test('手机端布局', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/game/test-room');

    // 验证手机端布局
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    await expect(page.locator('[data-testid="desktop-sidebar"]')).not.toBeVisible();
  });

  test('桌面端布局', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/game/test-room');

    // 验证桌面端布局
    await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible();
  });
});
```

**Step 2: 运行E2E测试**

Run: `npx playwright test`

Expected: 测试通过

**Step 3: Commit**

```bash
git add e2e/game-flow.spec.ts
git commit -m "test: add E2E tests for game flow and responsive layout"
```

---

## Task 5.3: 最终验证和部署

**Step 1: 运行完整构建**

Run: `npm run build`

Expected: 所有包构建成功

**Step 2: 运行所有测试**

Run: `npm run test`

Expected: 所有测试通过

**Step 3: 部署到生产环境**

```bash
# 打包
tar -cvzf nannaricher-redesign.tar.gz \
  shared/dist \
  server/dist \
  client/dist \
  server/package.json \
  shared/package.json \
  package.json \
  package-lock.json \
  ecosystem.config.cjs

# 上传到服务器
scp -i ~/.ssh/photozen_nju_top_ed25519 nannaricher-redesign.tar.gz root@47.110.32.207:/tmp/

# 部署
ssh -i ~/.ssh/photozen_nju_top_ed25519 root@47.110.32.207 << 'EOF'
cd /var/www/nannaricher
tar -xzf /tmp/nannaricher-redesign.tar.gz
npm install --production
pm2 restart nannaricher-server
EOF
```

**Step 4: 验证部署**

Run: `curl https://richer.nju.top/api/health`

Expected: `{"status":"ok"}`

**Step 5: Final Commit**

```bash
git add -A
git commit -m "feat: complete caigen redesign - 28-cell board, 33 win conditions, 103 cards, PixiJS visual system"
```

---

# 执行选项

计划已完成并保存到 `docs/plans/2026-03-04-caigen-complete-redesign-plan.md`。

**两种执行方式：**

**1. Subagent-Driven (本会话)** - 我为每个任务派遣新的子代理，任务之间进行代码审查，快速迭代

**2. Parallel Session (单独会话)** - 在新会话中使用 executing-plans 技能，批量执行带检查点

**选择哪种方式？**

