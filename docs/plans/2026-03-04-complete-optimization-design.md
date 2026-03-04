# 菜根人生 — 完整优化设计方案

> **日期**: 2026-03-04
> **策略**: 渐进式重构（每阶段保持可运行）
> **视觉目标**: 精美像素级（纯代码实现，无外部美术）
> **平台**: 全平台等质（桌面/平板/手机）
> **玩家数**: 2-6 人
> **基准文档**: `2026-03-04-caigen-complete-redesign-design.md` (规则真理源)
> **审查文档**: `2026-03-04-expert-review-and-optimization.md` (问题清单)

---

## 设计决策总结

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 实施策略 | 渐进式重构 | 每阶段保持可运行，风险低 |
| 状态管理 | Zustand 单一源 | 删除 Context 重复，消除同步 bug |
| 动画引擎 | PixiJS ticker 内置 + Framer Motion UI 层 | 不增加依赖，职责清晰 |
| 服务端架构 | Coordinator 编排 + Handler 注册 | 可测试、可维护、index.ts <30 行 |
| 视觉方案 | 渐变/阴影/SVG图标/设计令牌 | 纯代码实现商业级视觉 |
| 音效方案 | Web Audio API 程序化合成 | 零文件依赖，轻量 |

---

## 第一部分：规则引擎 — 卡牌效果系统

### 1.1 问题

- 103 张卡牌仅 ~45 张有效果实现
- 投票卡 (10+ 张)、连锁卡 (3+ 张)、延迟效果卡 (~5 张) 全部缺失
- VotingSystem 和 ChainActionSystem 框架存在但无实际调用

### 1.2 设计 — 效果处理器注册表模式

替代巨大 switch/case，每张卡注册独立处理函数：

```typescript
// server/src/game/handlers/card-registry.ts
type CardHandler = (ctx: CardEffectContext) => CardEffectResult;
const CARD_HANDLERS = new Map<string, CardHandler>();

// 注册示例 — 闭馆音乐
CARD_HANDLERS.set('destiny_library_music', (ctx) => ({
  success: true,
  message: '闭馆音乐：下次事件效果将触发两次',
  delayedEffect: {
    type: 'double_event',
    triggerCondition: 'next_event',
    playerId: ctx.player.id,
  },
}));

// CardEffectHandler 改为查表调用
handleCardEffect(ctx: CardEffectContext): CardEffectResult {
  const handler = CARD_HANDLERS.get(ctx.card.id);
  if (handler) return handler(ctx);
  // fallback: 简单效果直接应用 card.effects[]
  return this.applySimpleEffects(ctx);
}
```

### 1.3 三大子系统

#### 1.3.1 VotingSystem — 全场投票

适用卡牌：泳馆常客、相逢是缘、初雪留痕、怪奇物谈、寻根时刻、休憩时刻、光影变幻、课程建群、换乘时刻、妙语连珠、校运动会、出行方式 (12 张)

```typescript
class VotingSystem {
  // 发起投票 → PendingAction(type:'multi_vote')
  startVote(state: GameState, config: VoteConfig): PendingAction;

  // 收集单人投票，返回是否全部完成
  collectVote(action: PendingAction, playerId: string, choice: string): boolean;

  // 结算：多数决/奇偶骰子决/平票处理
  resolveVote(action: PendingAction): VoteResult;
}

interface VoteConfig {
  cardId: string;
  prompt: string;
  options: { label: string; value: string }[];
  voters: string[] | 'all';
  timeoutMs: number;
  resolutionType: 'majority' | 'dice_parity' | 'count_based';
}

interface VoteResult {
  majority: string | 'tie';
  counts: Record<string, number>;
  voters: Record<string, string>;
}
```

#### 1.3.2 ChainActionSystem — 连锁行动

适用卡牌：八卦秘闻、南行玫瑰、外卖贼盗 (3 张)

```typescript
class ChainActionSystem {
  // 按顺序轮询玩家
  startChain(state: GameState, config: ChainConfig): PendingAction;

  // 收集当前玩家选择，推进到下一人
  advanceChain(action: PendingAction, choice: string): { done: boolean; nextPlayerId?: string };

  // 链结束时结算
  resolveChain(action: PendingAction): ChainResult;
}

interface ChainConfig {
  cardId: string;
  prompt: string;
  options: { label: string; value: string }[];
  playerOrder: string[];  // 从抽卡者下一位开始
  perPlayerTimeoutMs: number;
}
```

#### 1.3.3 DelayedEffectManager — 延迟效果

适用卡牌：闭馆音乐(效果翻倍)、系统故障(金钱冻结)、延迟满足(金钱归零后恢复)、风水轮转(行动反转)、滑板天才(双骰)

```typescript
// server/src/game/effects/DelayedEffectManager.ts
interface DelayedEffect {
  id: string;
  playerId: string;
  type: 'double_event' | 'money_freeze' | 'delayed_gratification' | 'reverse_order' | 'double_dice' | 'reverse_move';
  triggerTurn: number;
  triggerCondition?: 'next_event' | 'next_turn' | 'next_dice';
  data: Record<string, unknown>;
  resolved: boolean;
}

class DelayedEffectManager {
  private effects: DelayedEffect[] = [];

  add(effect: Omit<DelayedEffect, 'id' | 'resolved'>): void;

  // 每回合开始检查
  processStartOfTurn(currentTurn: number, playerId: string): DelayedEffect[];

  // 事件触发前检查
  hasDoubleEvent(playerId: string): boolean;
  hasMoneyFreeze(playerId: string): boolean;
  hasReverseMove(playerId: string): boolean;

  // 清理已结算的效果
  cleanup(): void;
}
```

### 1.4 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/game/handlers/card-registry.ts` | 新建 | 103 张卡牌处理函数注册表 |
| `server/src/game/effects/DelayedEffectManager.ts` | 新建 | 延迟效果队列管理 |
| `server/src/game/rules/CardEffectHandler.ts` | 重写 | 改为查表调用 |
| `server/src/game/interaction/VotingSystem.ts` | 重写 | 完整投票流程 |
| `server/src/game/interaction/ChainActionSystem.ts` | 重写 | 完整连锁流程 |
| `server/src/game/GameEngine.ts` | 修改 | 集成 DelayedEffectManager |
| `shared/src/types.ts` | 扩展 | DelayedEffect 接口 + PendingAction 新类型 |

---

## 第二部分：规则引擎 — 培养计划系统

### 2.1 问题

- 33 个胜利条件：~19 个已实现，~14 个缺失
- 33 个特殊能力：0 个已实现
- PlayerHistory 追踪数据大部分未被填充

### 2.2 设计 — 能力触发点模型

```typescript
// server/src/game/handlers/plan-registry.ts
type AbilityTrigger =
  | 'on_confirm'          // 确认时 (历史学院→移动到鼓楼)
  | 'on_cell_enter'       // 进入格子 (文学院→蒋公的面子)
  | 'on_money_loss'       // 金钱减少前 (法学院→免除)
  | 'on_gpa_change'       // GPA 变化 (哲学系→下限3.0)
  | 'on_line_enter'       // 进入支线 (新闻院→乐在南哪免费)
  | 'on_dice_roll'        // 掷骰子 (数学系→指定点数)
  | 'on_turn_start'       // 回合开始 (物理学院→双倍/后退)
  | 'on_card_draw'        // 抽卡 (外国语→立即抽卡)
  | 'on_move'             // 直接移动 (环境院→+2探索)
  | 'passive'             // 始终生效 (软件学院→金钱可至-1000)
  | 'on_other_win'        // 他人即将获胜 (海外教育→抢胜)
  ;

interface PlanAbilityDef {
  planId: string;
  trigger: AbilityTrigger;
  apply: (ctx: PlanAbilityContext) => PlanAbilityResult | null;
}

const PLAN_ABILITIES = new Map<string, PlanAbilityDef>();

// 注册示例
PLAN_ABILITIES.set('plan_zhexue', {
  planId: 'plan_zhexue',
  trigger: 'on_gpa_change',
  apply: (ctx) => {
    if (ctx.newGpa < 3.0) {
      return { overrideGpa: 3.0, message: '哲学系：GPA下限3.0' };
    }
    return null;
  },
});
```

### 2.3 胜利条件追踪填充

在 GameEngine 关键方法中插入 StateTracker 调用：

| 追踪数据 | 填充位置 | 受益计划 |
|---------|---------|---------|
| `lineExits[]` | `exitLine()` 时记录进出资源快照 | 文学院、哲学系、新闻传播学院 |
| `moneyHistory[]` | `advanceTurn()` 时记录当前金钱 | 大气科学学院 |
| `sharedCellsWith{}` | `movePlayerTo()` 时检查同格玩家 | 天文与空间科学学院 |
| `campusLineOrder[]` | `enterLine()` 时记录校区线ID | 历史学院 |
| `cardsDrawn[]` | `drawCard()` 时记录卡牌信息 | 外国语学院、信息管理学院 |
| `mainCellVisited[]` | `executeCellEvent()` 时记录格子ID | 建筑与城市规划学院 |

### 2.4 动态条件修改

社会学院和人工智能学院可"永久减少一个胜利条件位"：

```typescript
// Player 新增字段
interface Player {
  // ...existing
  modifiedWinThresholds: Record<string, number>; // planId → 修改后的阈值
}

// WinConditionChecker 中使用
case 'plan_shehuixue': {
  const threshold = player.modifiedWinThresholds['plan_shehuixue'] ?? 20;
  const minExploration = Math.min(...otherPlayers.map(p => p.exploration));
  if (player.exploration - minExploration >= threshold) {
    return { won: true, condition: `社会学院：探索值领先${threshold}`, planId };
  }
  break;
}
```

### 2.5 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/game/handlers/plan-registry.ts` | 新建 | 33 个能力注册表 |
| `server/src/game/rules/PlanAbilities.ts` | 重写 | 改为查注册表 + 触发点分发 |
| `server/src/game/rules/WinConditionChecker.ts` | 补全 | 剩余 ~14 个条件 |
| `server/src/game/history/StateTracker.ts` | 重写 | 完善所有追踪填充 |
| `shared/src/types.ts` | 扩展 | Player.modifiedWinThresholds |

---

## 第三部分：服务端架构重构

### 3.1 问题

- `index.ts` 1124 行上帝文件
- `GameEngine.ts` 1165 行（回合管理+状态修改+事件执行 混杂）
- 无内存清理（游戏结束后 Engine 不释放）
- 无错误边界

### 3.2 目录结构

```
server/src/
├── index.ts                         # ≤30行：import + listen
├── app.ts                           # Express + 中间件 + 静态文件
├── socket/
│   ├── SocketManager.ts             # Socket.IO 配置 + 连接/断连
│   ├── RoomHandlers.ts              # room:create/join/reconnect
│   └── GameHandlers.ts              # game:roll-dice/choose-action/use-card/confirm-plan/chat
├── game/
│   ├── GameEngine.ts                # 纯游戏状态+基础操作 (≤500行)
│   ├── GameCoordinator.ts           # 编排层：Socket↔Engine↔Broadcasting
│   ├── TurnManager.ts               # 回合管理（从 Engine 提取）
│   ├── effects/
│   │   └── DelayedEffectManager.ts
│   ├── handlers/
│   │   ├── card-registry.ts
│   │   ├── plan-registry.ts
│   │   ├── corner-handlers.ts
│   │   ├── event-handlers.ts
│   │   └── line-handlers.ts
│   ├── rules/
│   │   ├── CardEffectHandler.ts
│   │   ├── PlanAbilities.ts
│   │   └── WinConditionChecker.ts
│   ├── interaction/
│   │   ├── VotingSystem.ts
│   │   └── ChainActionSystem.ts
│   └── history/
│       └── StateTracker.ts
├── rooms/
│   └── RoomManager.ts
└── data/                             # 保持不变
```

### 3.3 GameCoordinator 编排模式

```typescript
// server/src/game/GameCoordinator.ts
class GameCoordinator {
  constructor(
    private engine: GameEngine,
    private turnManager: TurnManager,
    private io: Server,
    private roomId: string,
  ) {}

  async handleRollDice(playerId: string) {
    const result = this.engine.rollDice(playerId);
    this.broadcast('game:dice-result', result);
    await this.engine.processMovement(playerId, result.total);
    this.broadcastState();
    this.checkWinAfterAction(playerId);
  }

  async handleChooseAction(playerId: string, actionId: string, choice: string) {
    const result = this.engine.resolveAction(playerId, actionId, choice);
    if (result.announcement) this.broadcast('game:announcement', result.announcement);
    this.broadcastState();
    if (result.nextAction) return; // 还有后续操作
    this.turnManager.advanceTurn();
    this.broadcastState();
  }

  private broadcastState() {
    this.io.to(this.roomId).emit('game:state-update', this.engine.getState());
  }

  private broadcast(event: string, data: any) {
    this.io.to(this.roomId).emit(event, data);
  }

  private checkWinAfterAction(playerId: string) {
    const result = this.engine.checkWin(playerId);
    if (result.won) {
      this.broadcast('game:player-won', result);
      this.engine.endGame(playerId);
    }
  }
}
```

### 3.4 内存管理

```typescript
// rooms/RoomManager.ts 增强
class RoomManager {
  private cleanupTimer: NodeJS.Timer;

  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      for (const [roomId, room] of this.rooms) {
        const idleMs = Date.now() - room.lastActivity;
        if (room.phase === 'finished' && idleMs > 5 * 60_000) {
          this.destroyRoom(roomId);
        } else if (idleMs > 30 * 60_000) {
          this.destroyRoom(roomId);
        }
      }
    }, 60_000);
  }

  private destroyRoom(roomId: string) {
    this.rooms.delete(roomId);
    this.coordinators.delete(roomId);
    console.log(`Room ${roomId} cleaned up`);
  }
}
```

### 3.5 统一错误处理

```typescript
// socket/SocketManager.ts
function withErrorBoundary<T extends (...args: any[]) => any>(
  handler: T,
  socket: GameSocket,
): T {
  return ((...args: any[]) => {
    try {
      const result = handler(...args);
      if (result instanceof Promise) {
        return result.catch((err: Error) => {
          console.error('Game error:', err);
          socket.emit('room:error', { message: '服务器错误，请重试' });
        });
      }
      return result;
    } catch (err) {
      console.error('Game error:', err);
      socket.emit('room:error', { message: '服务器错误，请重试' });
    }
  }) as T;
}
```

### 3.6 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `server/src/index.ts` | 重写 | 缩减至 ≤30 行 |
| `server/src/app.ts` | 新建 | Express 配置 |
| `server/src/socket/SocketManager.ts` | 新建 | Socket.IO + 连接管理 |
| `server/src/socket/RoomHandlers.ts` | 新建 | room:* 事件 |
| `server/src/socket/GameHandlers.ts` | 新建 | game:* 事件 |
| `server/src/game/GameCoordinator.ts` | 新建 | 编排层 |
| `server/src/game/TurnManager.ts` | 新建 | 回合管理（从 Engine 提取） |
| `server/src/game/GameEngine.ts` | 瘦身 | ≤500 行 |
| `server/src/rooms/RoomManager.ts` | 增强 | 内存清理 |

---

## 第四部分：客户端架构重构

### 4.1 问题

- GameCanvas.tsx 526 行单文件
- Context + Zustand 双重状态
- 客户端硬编码棋盘数据（与服务端重复）
- 支线被限制只显示 5 格

### 4.2 PixiJS 渲染器分层

```
client/src/game/
├── GameCanvas.tsx                    # ≤80行：Application 生命周期
├── GameStage.ts                      # 舞台管理：层创建/销毁/resize
├── layers/
│   ├── BackgroundLayer.ts            # 棋盘底板 + 中央区域
│   ├── BoardLayer.ts                 # 28格主棋盘
│   ├── LineLayer.ts                  # 8条支线（完整显示）
│   ├── PlayerLayer.ts                # 玩家棋子 + 动画
│   ├── EffectLayer.ts                # 粒子/飘字/高亮
│   └── InteractionLayer.ts           # hover/click
├── sprites/
│   ├── CellSprite.ts                 # 格子精灵
│   ├── CornerSprite.ts               # 角落精灵
│   ├── PlayerPiece.ts                # 玩家棋子
│   └── LineCellSprite.ts             # 支线格子
├── animations/                       # 见第五部分
├── layout/
│   └── BoardLayout.ts                # 纯函数：坐标计算
└── interaction/
    └── ViewportController.ts          # 缩放/平移/手势
```

### 4.3 Zustand 单一状态源

```typescript
// stores/gameStore.ts
interface GameStore {
  // 持久状态
  gameState: GameState | null;
  roomId: string | null;
  playerId: string | null;

  // 瞬态状态
  pendingEvent: EventTrigger | null;
  pendingDice: DiceResult | null;
  pendingCard: Card | null;
  announcement: AnnouncementData | null;
  winner: WinResult | null;

  // 动画状态
  animationQueue: GameAnimation[];
  isAnimating: boolean;

  // 计算
  isMyTurn: () => boolean;
  currentPlayer: () => Player | null;
  myPlayer: () => Player | null;
  myHandCards: () => Card[];
  myPlans: () => TrainingPlan[];

  // Actions
  setGameState: (state: GameState) => void;
  rollDice: () => void;
  chooseAction: (actionId: string, choice: string) => void;
  useCard: (cardId: string, target?: string) => void;
  confirmPlan: (planId: string) => void;
  sendChat: (message: string) => void;
  enqueueAnimation: (anim: GameAnimation) => void;
  dequeueAnimation: () => void;
}
```

删除 `GameContext.tsx`，替换为 `SocketProvider`（仅管连接）+ `useGameStore()`。

### 4.4 共享数据去重

```typescript
// shared/src/board-data.ts — 单一真理源
export const MAIN_BOARD_CELLS: BoardCell[] = [
  { index: 0, id: 'start', name: '起点/低保日', type: 'corner', cornerType: 'start' },
  { index: 1, id: 'chance_1', name: '机会/命运', type: 'chance' },
  // ... 28格完整定义
];

export const LINE_CONFIGS: LineConfig[] = [
  { id: 'pukou', name: '浦口线', entryIndex: 4, cellCount: 12, forceEntry: true, entryFee: 0, direction: 'up' },
  // ... 8条线完整配置
];

export const CORNER_INDICES = [0, 7, 14, 21];
export const CELLS_PER_SIDE = 7;
export const MAIN_BOARD_SIZE = 28;
```

客户端 `client/src/data/board.ts` 和 `GameCanvas.tsx` 中的硬编码数据删除，改为从 `@nannaricher/shared` 导入。

### 4.5 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `client/src/game/GameCanvas.tsx` | 重写 | ≤80 行容器 |
| `client/src/game/GameStage.ts` | 新建 | 舞台管理 |
| `client/src/game/layers/*.ts` | 新建 | 6 个渲染层 |
| `client/src/game/sprites/*.ts` | 新建 | 4 个精灵类 |
| `client/src/game/layout/BoardLayout.ts` | 新建 | 坐标计算 |
| `client/src/game/interaction/ViewportController.ts` | 新建 | 手势控制 |
| `client/src/stores/gameStore.ts` | 重写 | 完整 Zustand store |
| `client/src/context/GameContext.tsx` | 删除 | 替换为 Zustand |
| `client/src/context/SocketContext.tsx` | 简化 | 仅管连接 |
| `client/src/data/board.ts` | 删除 | 改用 shared |
| `shared/src/board-data.ts` | 新建 | 棋盘数据 |

---

## 第五部分：动画系统

### 5.1 AnimationQueue 异步队列

```typescript
// client/src/game/animations/AnimationQueue.ts
interface GameAnimation {
  type: string;
  play: () => Promise<void>;
  onComplete?: () => void;
}

class AnimationQueue {
  private queue: GameAnimation[] = [];
  private playing = false;

  enqueue(anim: GameAnimation): Promise<void> {
    return new Promise(resolve => {
      this.queue.push({ ...anim, onComplete: resolve });
      if (!this.playing) this.playNext();
    });
  }

  async parallel(anims: GameAnimation[]): Promise<void> {
    await Promise.all(anims.map(a => a.play()));
  }

  private async playNext() {
    if (this.queue.length === 0) { this.playing = false; return; }
    this.playing = true;
    const anim = this.queue.shift()!;
    await anim.play();
    anim.onComplete?.();
    this.playNext();
  }
}
```

### 5.2 TweenEngine（基于 PixiJS ticker，零依赖）

```typescript
// client/src/game/animations/TweenEngine.ts
type EasingFn = (t: number) => number;

const EASINGS = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  bounce: (t: number) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

class TweenEngine {
  private tweens: Tween[] = [];

  constructor(private ticker: Ticker) {
    ticker.add(this.update.bind(this));
  }

  to(target: any, props: Record<string, number>, duration: number, easing: EasingFn = EASINGS.easeOut): Promise<void> {
    return new Promise(resolve => {
      this.tweens.push({
        target, props, duration, easing,
        startValues: Object.fromEntries(Object.keys(props).map(k => [k, target[k]])),
        elapsed: 0, resolve,
      });
    });
  }

  private update(ticker: Ticker) {
    const dt = ticker.deltaMS;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const t = this.tweens[i];
      t.elapsed += dt;
      const progress = Math.min(t.elapsed / t.duration, 1);
      const eased = t.easing(progress);
      for (const [key, endVal] of Object.entries(t.props)) {
        t.target[key] = t.startValues[key] + (endVal - t.startValues[key]) * eased;
      }
      if (progress >= 1) {
        this.tweens.splice(i, 1);
        t.resolve();
      }
    }
  }
}
```

### 5.3 动画清单

| 动画 | 文件 | 时长 | 技术 |
|------|------|------|------|
| 棋子逐格跳跃 | `PieceMoveAnim.ts` | 300ms/步 | TweenEngine 弧线轨迹 |
| 落点涟漪 | `PieceMoveAnim.ts` | 200ms | Graphics 扩散圆 |
| 3D骰子翻滚 | `DiceRollAnim.ts` | 1500ms | 精灵帧序列 |
| 骰子结果放大 | `DiceRollAnim.ts` | 600ms | TweenEngine scale |
| 资源飘字 | `FloatingText.ts` | 1500ms | Text 上浮+淡出 |
| 卡牌抽取 | CardRevealAnim (FM) | 500ms | Framer Motion spring |
| 卡牌翻转 | CardRevealAnim (FM) | 600ms | Framer Motion rotateY |
| 卡牌使用 | CardUseAnim (FM) | 400ms | Framer Motion 飞向目标 |
| 胜利烟花 | `ParticleEffect.ts` | 3000ms | PixiJS 粒子系统 |
| 破产碎裂 | `ParticleEffect.ts` | 1200ms | PixiJS 灰度+粒子 |
| 回合切换 | PlayerLayer | 500ms | TweenEngine glow |
| 进入支线 | LineLayer | 800ms | TweenEngine 路径高亮 |

### 5.4 reduced-motion 支持

```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class AnimationConfig {
  static get duration() {
    return prefersReducedMotion ? 0 : 1;  // multiplier
  }

  static shouldAnimate(): boolean {
    return !prefersReducedMotion;
  }
}

// 使用：
const duration = 300 * AnimationConfig.duration; // reduced 模式下为 0
```

### 5.5 文件变更

| 文件 | 操作 |
|------|------|
| `client/src/game/animations/AnimationQueue.ts` | 新建 |
| `client/src/game/animations/TweenEngine.ts` | 新建 |
| `client/src/game/animations/PieceMoveAnim.ts` | 新建 |
| `client/src/game/animations/DiceRollAnim.ts` | 新建 |
| `client/src/game/animations/FloatingText.ts` | 新建 |
| `client/src/game/animations/CardRevealAnim.ts` | 新建 |
| `client/src/game/animations/ParticleEffect.ts` | 新建 |
| `client/src/game/animations/AnimationConfig.ts` | 新建 |

---

## 第六部分：视觉设计系统

### 6.1 配色方案

```typescript
// styles/tokens.ts — 完整设计令牌
const DESIGN_TOKENS = {
  color: {
    brand: {
      primary: '#5E3A8D',       // 南大紫
      primaryLight: '#8B5FBF',
      primaryDark: '#3D2566',
      accent: '#C9A227',        // 金色
      accentLight: '#E0C55E',
    },
    bg: {
      main: '#0F0A1A',          // 深紫黑主背景
      surface: '#1A1230',       // 面板背景
      elevated: '#252040',      // 悬浮元素
      board: '#16102A',         // 棋盘区域
      overlay: 'rgba(0,0,0,0.6)', // 遮罩
    },
    cell: {
      corner: {
        start: ['#2E7D32', '#4CAF50'],       // 渐变色对
        hospital: ['#C62828', '#EF5350'],
        ding: ['#E65100', '#FFB300'],
        waitingRoom: ['#1565C0', '#42A5F5'],
      },
      event: ['#E65100', '#FF9800'],
      chance: ['#6A1B9A', '#AB47BC'],
      lineEntry: {
        pukou: ['#455A64', '#78909C'],
        study: ['#283593', '#5C6BC0'],
        money: ['#E65100', '#FF9800'],
        suzhou: ['#1565C0', '#42A5F5'],
        explore: ['#AD1457', '#EC407A'],
        xianlin: ['#2E7D32', '#66BB6A'],
        gulou: ['#4E342E', '#8D6E63'],
        food: ['#BF360C', '#FF7043'],
      },
    },
    resource: {
      money: '#FFD700',
      gpa: '#4CAF50',
      exploration: '#FF5722',
    },
    player: ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#00897B'],
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      muted: '#707070',
      danger: '#EF5350',
      success: '#66BB6A',
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, pill: 9999 },
  shadow: {
    sm: '0 2px 4px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
    lg: '0 8px 24px rgba(0,0,0,0.5)',
    glow: (color: string) => `0 0 12px ${color}40, 0 0 24px ${color}20`,
  },
  typography: {
    fontFamily: "'Noto Sans SC', system-ui, sans-serif",
    fontSize: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 28, display: 40 },
    fontWeight: { normal: 400, medium: 500, bold: 700, black: 900 },
  },
  animation: {
    duration: { instant: 0, fast: 150, normal: 300, slow: 500, verySlow: 800 },
    easing: {
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
  breakpoint: { mobile: 768, tablet: 1024, desktop: 1440 },
};
```

### 6.2 格子视觉规范

```
角落格 (90×90):
  - 圆角矩形, radius: 12px
  - 双色线性渐变(135deg)
  - 内部: SVG图标(32px) + 名称(粗体12px)
  - 外边框: 2px rgba(255,255,255,0.3)
  - 外发光: shadow.glow(主题色)

普通格 (70×28):
  - 圆角矩形, radius: 6px
  - 类型渐变色
  - 内部: 图标(14px) + 名称(10px)
  - hover: scale(1.1) + shadow.md + 信息浮窗

支线格 (28×28):
  - 圆角矩形, radius: 4px
  - 线路主题色(透明度80%)
  - 当前位置: 实色 + 发光
  - 已通过: 半透明
```

### 6.3 卡牌视觉规范

```
尺寸: 120×170px (桌面) / 90×127px (手机)
结构:
┌───────────────────┐
│ ▓▓▓ 类型色带 ▓▓▓  │  8px 高
│                   │
│      [图标]       │  40×40 SVG
│                   │
│   卡牌名称        │  bold 14px
│   ─────────       │
│   效果描述        │  normal 11px
│   (最多3行)       │
│                   │
│  [手持] [命运]    │  标签
└───────────────────┘

命运卡: 靛蓝渐变色带 + 蓝色边框
机会卡: 金色渐变色带 + 金色边框
手持标记: 左上角金色星标

hover: translateY(-10px) + scale(1.05) + shadow.lg
选中: 蓝色光框 + pulse
```

### 6.4 SVG 图标集

为游戏定制的 SVG 内联图标（无外部依赖）：

| 图标 | 用途 | 设计 |
|------|------|------|
| dice | 骰子操作 | 圆角方形 + 点阵 |
| coin | 金钱资源 | 圆形 + ¥ 符号 |
| book | GPA资源 | 打开的书 |
| compass | 探索资源 | 指南针 |
| card-destiny | 命运卡 | 星形 + 卡牌 |
| card-chance | 机会卡 | 问号 + 卡牌 |
| graduation | 培养计划 | 学位帽 |
| hospital | 校医院 | 十字 |
| train | 候车厅 | 火车 |
| cauldron | 鼎 | 三足鼎 |
| star | 起点 | 五角星 |
| lightning | 事件 | 闪电 |
| arrow-in | 线路入口 | 向内箭头 |
| trophy | 胜利 | 奖杯 |
| clock | 倒计时 | 时钟 |
| vote | 投票 | 投票箱 |

文件: `client/src/assets/icons.ts` — 导出 SVG 字符串常量

### 6.5 字体

```css
/* client/src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap');

:root {
  --font-main: 'Noto Sans SC', system-ui, -apple-system, sans-serif;
}

body {
  font-family: var(--font-main);
  -webkit-font-smoothing: antialiased;
}
```

### 6.6 文件变更

| 文件 | 操作 |
|------|------|
| `client/src/styles/tokens.ts` | 重写（完整令牌） |
| `client/src/assets/icons.ts` | 新建（SVG 图标集） |
| `client/src/index.css` | 修改（引入字体 + CSS 变量） |
| `client/src/styles/game.css` | 重写（应用新设计令牌） |
| `client/src/styles/components.css` | 新建（组件通用样式） |

---

## 第七部分：交互与全平台适配

### 7.1 三端布局设计

#### 桌面 (≥1024px)
```
┌──────────────────────────────────────────────────────────────────┐
│ [Logo] 菜根人生  房间:NJU42X  第2轮·回合8  👤张三的回合  [⚙][🔊]│
├────────────────────────────────────────┬─────────────────────────┤
│                                        │ 当前回合 / 玩家面板     │
│                                        │ 培养计划进度            │
│           棋盘画布 (PixiJS)             │ 手牌展示                │
│                                        │ 聊天（折叠）            │
├────────────────────────────────────────┤                         │
│ 📜 游戏日志 (可折叠)                    │                         │
└────────────────────────────────────────┴─────────────────────────┘
```

#### 平板横屏 (768-1023px)
```
┌──────────────────────────────────────┐
│ 状态栏                                │
├──────────────────────────────────────┤
│         棋盘画布 (更大比例)            │
├──────────────────────────────────────┤
│ 玩家状态条                            │
├──────────────────────────────────────┤
│ 🃏手牌 | 🎯计划 | 📜日志 | 💬聊天     │
│ (标签切换)                            │
└──────────────────────────────────────┘
```

#### 手机竖屏 (<768px)
```
┌─────────────────────────┐
│ 状态栏 (紧凑)            │
├─────────────────────────┤
│    棋盘画布 (全宽)       │
│    自动聚焦当前玩家       │
├─────────────────────────┤
│ 我的状态 + 操作按钮       │
├─────────────────────────┤
│ 🃏 | 🎯 | 📜 | 💬 | 👥  │
│ (底部标签栏)             │
└─────────────────────────┘
```

### 7.2 ViewportController（缩放/平移/手势）

```typescript
class ViewportController {
  private scale = 1;
  private offset = { x: 0, y: 0 };
  private isDragging = false;
  private pinchStartDistance = 0;

  // 鼠标
  onMouseWheel(e: WheelEvent): void;     // 滚轮缩放
  onMouseDown/Move/Up: void;              // 拖拽平移

  // 触摸
  onTouchStart(e: TouchEvent): void;      // 单指拖拽 / 双指缩放
  onTouchMove(e: TouchEvent): void;
  onTouchEnd(e: TouchEvent): void;

  // 双击重置
  onDoubleClick(e: MouseEvent | TouchEvent): void;

  // 自动聚焦
  focusOnCell(cellIndex: number, animate: boolean): void;
  focusOnPlayer(playerId: string, animate: boolean): void;

  // 约束
  private clampScale(scale: number): number; // 0.5x - 3x
  private clampOffset(offset: Point): Point; // 不超出棋盘边界
}
```

### 7.3 状态感知系统

```typescript
// 全局状态提示条
const StatusIndicator: React.FC = () => {
  const phase = useGameStore(s => s.gameState?.phase);
  const isMyTurn = useGameStore(s => s.isMyTurn());
  const currentName = useGameStore(s => s.currentPlayer()?.name);

  const message = useMemo(() => {
    if (!phase) return '';
    const map: Record<string, string> = {
      rolling_dice: isMyTurn ? '🎲 轮到你了！' : `⏳ ${currentName} 掷骰子中...`,
      moving: `${currentName} 移动中...`,
      making_choice: isMyTurn ? '🤔 请做选择' : `⏳ ${currentName} 思考中...`,
      multi_interaction: '🗳️ 全体互动！',
      waiting_others: '⏳ 等待其他玩家...',
    };
    return map[phase] || '';
  }, [phase, isMyTurn, currentName]);

  return <div className="status-indicator">{message}</div>;
};
```

### 7.4 投票/连锁 UI

#### 投票面板
```
┌──────────────────────────────────┐
│  🗳️ [卡牌名]                     │
│  "[提示文字]"                     │
│                                  │
│  ┌─────────────┐ ┌─────────────┐│
│  │  选项A       │ │  选项B       ││
│  │  [描述]      │ │  [描述]      ││
│  │  [X票]      │ │  [Y票]      ││
│  └─────────────┘ └─────────────┘│
│                                  │
│  ⏱️ XX秒                         │
│  ✅张三 | ⏳李四 | ⏳王五          │
└──────────────────────────────────┘
```

#### 连锁行动面板
```
┌──────────────────────────────────┐
│  🔗 [卡牌名]                     │
│  传播链: 张三→李四→[你]          │
│  当前第3人，需投>3               │
│                                  │
│  [🗣️ 继续] [🤫 放弃]             │
│  ⏱️ 30秒                         │
└──────────────────────────────────┘
```

### 7.5 培养计划进度显示

```
┌──────────────────────────────┐
│ 🎓 我的培养计划               │
├──────────────────────────────┤
│ 🏦 商学院 [已确认]            │
│ 💰 2000/5000                 │
│ ████████░░░░░░░░░░ 40%      │
│ 能力: 直达赚在南哪免费        │
├──────────────────────────────┤
│ 🧪 化学化工学院 [未确认]      │
│ 🧭 12/45                     │
│ ████░░░░░░░░░░░░░░ 27%      │
│ 能力: 指定格子下回合失效      │
└──────────────────────────────┘
```

### 7.6 文件变更

| 文件 | 操作 |
|------|------|
| `client/src/game/interaction/ViewportController.ts` | 新建 |
| `client/src/components/StatusIndicator.tsx` | 新建 |
| `client/src/components/VotePanel.tsx` | 新建 |
| `client/src/components/ChainActionPanel.tsx` | 新建 |
| `client/src/components/TrainingPlanView.tsx` | 重写 |
| `client/src/components/CardHand.tsx` | 重写 |
| `client/src/components/GameScreen.tsx` | 重写（三端布局） |
| `client/src/components/GameLog.tsx` | 重写（分级+图标） |
| `client/src/styles/game.css` | 重写 |
| `client/src/styles/mobile.css` | 新建 |

---

## 第八部分：音效、新手引导、测试

### 8.1 音效系统

保留 Web Audio API 程序化合成（零外部文件），扩展音效类型：

```typescript
// audio/sounds.ts
const SOUND_DEFS = {
  dice_shake:    { type: 'noise', duration: 800, freq: [200, 2000] },
  dice_land:     { type: 'tone', freq: 220, duration: 100, wave: 'triangle' },
  dice_result:   { type: 'chime', freqs: [523, 659, 784], duration: 300 },
  piece_step:    { type: 'tone', freq: 440, duration: 80, wave: 'sine' },
  piece_land:    { type: 'tone', freq: 330, duration: 120, wave: 'triangle' },
  coin_gain:     { type: 'chime', freqs: [784, 988, 1175], duration: 200 },
  coin_loss:     { type: 'tone', freq: 175, duration: 300, wave: 'sawtooth' },
  gpa_up:        { type: 'chime', freqs: [440, 554, 659], duration: 250 },
  gpa_down:      { type: 'tone', freq: 196, duration: 250, wave: 'sine' },
  card_draw:     { type: 'noise', duration: 200, freq: [500, 3000] },
  card_flip:     { type: 'tone', freq: 660, duration: 150, wave: 'sine' },
  card_use:      { type: 'chime', freqs: [523, 784], duration: 200 },
  event_trigger: { type: 'tone', freq: 440, duration: 200, wave: 'square' },
  vote_start:    { type: 'chime', freqs: [330, 440, 550], duration: 400 },
  vote_end:      { type: 'chime', freqs: [440, 550, 660], duration: 300 },
  turn_start:    { type: 'tone', freq: 523, duration: 150, wave: 'sine' },
  victory:       { type: 'chime', freqs: [523, 659, 784, 1047], duration: 1000 },
  bankrupt:      { type: 'tone', freq: 110, duration: 800, wave: 'sawtooth' },
  timer_tick:    { type: 'tone', freq: 880, duration: 50, wave: 'sine' },
  timer_urgent:  { type: 'tone', freq: 1760, duration: 100, wave: 'square' },
  button_click:  { type: 'tone', freq: 600, duration: 50, wave: 'sine' },
  notification:  { type: 'chime', freqs: [523, 659], duration: 200 },
  line_enter:    { type: 'chime', freqs: [330, 440, 550, 660], duration: 500 },
  line_exit:     { type: 'chime', freqs: [660, 550, 440], duration: 400 },
};
```

AudioManager 增加音量分级控制（master/sfx/music）和 localStorage 持久化。

### 8.2 新手引导

```typescript
// features/tutorial/TutorialSteps.ts
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'first_dice',
    trigger: { phase: 'rolling_dice', isFirstTime: true },
    target: '.dice-button',
    message: '点击掷骰子开始移动',
    position: 'above',
    duration: 5000,
  },
  {
    id: 'first_card',
    trigger: { event: 'card_drawn', isFirstTime: true },
    target: '.card-hand',
    message: '你获得了一张卡牌！点击查看详情',
    position: 'above',
    duration: 5000,
  },
  {
    id: 'first_plan_select',
    trigger: { phase: 'setup_plans', isFirstTime: true },
    target: '.plan-panel',
    message: '选择你的毕业方向（1-2个培养计划）',
    position: 'center',
    duration: 8000,
  },
  {
    id: 'plan_confirm_available',
    trigger: { event: 'plan_confirm_available', isFirstTime: true },
    target: '.plan-confirm-btn',
    message: '现在可以确认培养计划获得特殊能力了',
    position: 'left',
    duration: 6000,
  },
  {
    id: 'first_line',
    trigger: { event: 'line_entry_choice', isFirstTime: true },
    target: null,
    message: '你可以选择进入支线探索，查看期望收益再决定',
    position: 'center',
    duration: 6000,
  },
];

// 非模态 tooltip 形式，不阻塞操作
// 已触发的步骤存储在 localStorage
// 支持"跳过全部引导"选项
```

### 8.3 回合上限与强制结算

```typescript
// 回合上限（按人数）
const TOTAL_ROUNDS: Record<number, number> = {
  2: 32,  // 2人 = 4年级 × 8回合
  3: 28,  // 3人
  4: 24,  // 4人
  5: 20,  // 5-6人
  6: 20,
};

// 强制结算评分
function calculateFinalScore(player: Player): number {
  return player.gpa * 10 + player.exploration + player.money / 100;
}

// 大四结束时：
// 1. 已满足培养计划的玩家优先获胜
// 2. 无人满足则按综合评分排名
// 3. 同分比较：培养计划数 > GPA > 探索 > 金钱
```

### 8.4 测试策略

```
单元测试 (Vitest, server/__tests__/):
  - 33 种胜利条件 → 33 个 test case
  - 103 张卡牌效果 → 遍历注册表自动测试
  - 33 个培养计划能力 → 33 个 test case
  - 投票结算逻辑
  - 连锁行动逻辑
  - 延迟效果逻辑
  - 坐标计算纯函数

集成测试 (Vitest, server/__tests__/):
  - Socket.IO 事件往返
  - 房间创建/加入/断线重连
  - 完整回合流程

E2E (Playwright, e2e/):
  - 2人完整游戏到胜利
  - 投票卡多人交互
  - 移动端触摸操作
  - 断线重连恢复
```

### 8.5 部署优化

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'pixi': ['pixi.js'],
        'framer': ['framer-motion'],
        'socket': ['socket.io-client'],
        'zustand': ['zustand'],
      },
    },
  },
  sourcemap: false,
  minify: 'terser',
}

// 懒加载游戏模块
const GameScreen = React.lazy(() => import('./components/GameScreen'));

// 资源预加载
<link rel="preconnect" href="https://fonts.googleapis.com" />
```

### 8.6 文件变更

| 文件 | 操作 |
|------|------|
| `client/src/audio/sounds.ts` | 新建（音效定义） |
| `client/src/audio/AudioManager.ts` | 增强（音量分级） |
| `client/src/features/tutorial/TutorialSteps.ts` | 新建 |
| `client/src/features/tutorial/TutorialSystem.tsx` | 重写（接入主流程） |
| `server/src/game/TurnManager.ts` | 新建（含回合上限） |
| `server/src/game/rules/__tests__/*.test.ts` | 新建/补全 |
| `e2e/game-flow.spec.ts` | 补全 |
| `client/vite.config.ts` | 修改（代码分割） |

---

## 渐进式实施阶段总览

| Phase | 名称 | 核心目标 | 预估文件变更 |
|-------|------|---------|------------|
| **1** | 规则引擎完善 | 103卡+33能力+投票+连锁+延迟=100% | ~15 文件 |
| **2** | 服务端重构 | index.ts<30行 + Coordinator + 内存清理 | ~10 文件 |
| **3** | 客户端重构 | Zustand统一 + 渲染器分层 + 数据去重 | ~20 文件 |
| **4** | 动画系统 | AnimationQueue + 棋子/骰子/飘字/卡牌 | ~8 文件 |
| **5** | 视觉升级 | 设计令牌+渐变+图标+字体+卡牌设计 | ~10 文件 |
| **6** | 交互完善 | 三端布局+手势+投票UI+进度条 | ~12 文件 |
| **7** | 体验打磨 | 音效+引导+回合上限+日志分级 | ~8 文件 |
| **8** | 测试质量 | 单元+集成+E2E 覆盖 | ~10 文件 |

**每个 Phase 完成后游戏保持可运行**。Phase 1 完成后游戏从"半成品"变为"完整可玩"，是最关键的阶段。

---

## 总文件变更统计

| 类型 | 数量 |
|------|------|
| 新建文件 | ~40 个 |
| 重写文件 | ~15 个 |
| 修改文件 | ~15 个 |
| 删除文件 | ~3 个 (GameContext.tsx, client/data/board.ts, 重复代码) |
| **总计** | ~73 个文件变更 |
