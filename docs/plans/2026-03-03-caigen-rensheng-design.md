# 菜根人生 - 网页多人大富翁游戏设计

> 南京大学主题定制大富翁，支持 2-4 人在线联机

## 技术栈

- **前端:** React + Vite + TypeScript + HTML5 Canvas
- **后端:** Node.js + Express + Socket.io + TypeScript
- **部署:** 单 Node 进程，公网云服务器

## 整体架构

服务端权威架构：所有游戏逻辑在服务端执行，客户端只负责渲染和交互。

```
客户端 (React)
  ├── 棋盘渲染 (Canvas)
  ├── 玩家面板 (状态栏)
  └── 卡牌/事件弹窗系统
        │ WebSocket (Socket.io)
服务端 (Node.js)
  ├── 房间管理 (Room)
  ├── 游戏引擎 (回合制)
  └── 事件/卡牌系统 (数据驱动 JSON)
```

### 核心原则

1. **服务端权威** - 骰子、计算、胜负判定全在服务端
2. **数据驱动** - 棋盘/事件/卡牌全部 JSON 配置
3. **全量状态广播** - 每次变更广播完整 GameState
4. **房间隔离** - 每个游戏房间独立实例

### 项目结构

```
nannaricher/
├── client/          # React 前端 (Vite)
│   ├── src/
│   │   ├── components/   # UI 组件
│   │   ├── canvas/       # 棋盘 Canvas 渲染
│   │   ├── hooks/        # Socket 连接、游戏状态
│   │   └── assets/       # 图片、音效
│   └── index.html
├── server/          # Node.js 后端
│   ├── src/
│   │   ├── game/         # 游戏引擎核心
│   │   ├── data/         # 棋盘/事件/卡牌 JSON 数据
│   │   ├── rooms/        # 房间管理
│   │   └── index.ts      # 入口
│   └── package.json
└── shared/          # 前后端共享类型定义
    └── types.ts
```

## 棋盘数据模型

### 棋盘结构

**外圈主路** (~32格，环形): 起点 → 事件/机会格 → 校医院(角) → ... → 鼎(角) → ... → 候车厅(角) → 回到起点

**内部支线** (8条):

| 线路 | 格数 | 入场费 | 进入方式 |
|------|------|--------|----------|
| 浦口线 | 12 | 免费 | 强制进入 |
| 学在南哪 | 9 | 200 | 可选 |
| 赚在南哪 | 10 | 200 | 可选 |
| 苏州线 | 10 | 200 | 可选 |
| 乐在南哪 | 9 | 200 | 可选 |
| 鼓楼线 | 9 | 200 | 可选 |
| 仙林线 | 7 | 200 | 可选 |
| 食堂线 | 9 | 免费 | 强制进入 |

### 游戏状态

```typescript
interface GameState {
  roomId: string;
  phase: 'waiting' | 'playing' | 'finished';
  currentPlayerIndex: number;
  turnNumber: number;
  roundNumber: number;              // 每6回合一个大轮
  players: Player[];
  cardDecks: { chance: Card[]; destiny: Card[]; training: TrainingPlan[]; };
  actionQueue: PendingAction[];
  turnOrder: number[];
}

interface Player {
  id: string;
  name: string;
  money: number;                    // 起始2000或3000
  gpa: number;                      // 起始3.0
  exploration: number;              // 起始0
  position: Position;
  diceCount: 1 | 2;
  trainingPlans: TrainingPlan[];   // 最多2
  confirmedPlans: TrainingPlan[];
  heldCards: Card[];
  effects: ActiveEffect[];
  skipNextTurn: boolean;
  isInHospital: boolean;
  isAtDing: boolean;
  isBankrupt: boolean;
  linesVisited: string[];
  lineEventsTriggered: Record<string, number[]>;
}
```

### 回合流程

1. 检查暂停/医院/鼎状态
2. 掷骰子 (服务端随机)
3. 移动棋子 (经过起点领低保500，停留领600)
4. 执行格子事件 (可能需要玩家决策)
5. 检查胜利条件 (基础: GPA*10+探索值>=60; 培养计划)
6. 检查破产 (金钱<0出局)
7. 广播状态 → 下一位

## 网络通信

### Socket.io 事件

**客户端 → 服务端:** room:create, room:join, game:start, game:roll-dice, game:choose-action, game:use-card, game:confirm-plan, game:chat

**服务端 → 客户端:** room:created, room:player-joined, game:state-update, game:dice-result, game:event-trigger, game:card-drawn, game:announcement, game:player-won, game:chat

### 房间管理

- 6位房间码 (如 NJU42X)
- 房主开始游戏
- 断线重连: 60秒等待
- 房间超时: 10分钟无操作销毁
- 决策超时: 60秒自动选默认

## UI 设计

### 布局

```
┌──────────────────────────────────────────┐
│  顶栏: 房间号 | 回合数 | 当前玩家         │
├────────────────────────┬─────────────────┤
│                        │  玩家面板        │
│    棋盘 Canvas         │  (金钱/GPA/探索) │
│    (缩放/平移)          │  培养计划进度     │
│                        │                 │
├────────────────────────┴─────────────────┤
│  底栏: 掷骰子按钮 | 手牌 | 聊天           │
└──────────────────────────────────────────┘
```

### 交互

- 掷骰子: 按钮 → 动画 → 棋子移动动画
- 事件决策: 模态对话框 + 选项按钮
- 卡牌: 底栏手牌展示，点击使用
- 移动端: 双指缩放，竖屏折叠面板

## 事件/卡牌系统

数据驱动 JSON 配置，支持:
- `choice` - 选择执行
- `forced_choice` - 必须选择
- `dice_check` - 掷骰判定
- `optional_dice` - 可选掷骰
- `direct` - 直接效果
- `holdable` - 持有型卡牌

### 培养计划

- 开局抽3选1-2，公开展示
- 每6回合可确认1项 (锁定不可替换)
- 确认后可移动到任意线起点 (需交入场费)
- 胜利条件检查器: 每回合结束 + 关键操作后自动检查

### 特殊机制

- 持续效果: `player.effects[]` 每回合检查消费
- 多人互动卡: `PendingAction` 队列收齐所有选择后结算
- 强制线路: 格子标记 `forceEntry`
- 行动顺序反转: 修改 `turnOrder` 数组

## 起始配置

玩家选择:
- **双骰模式:** 2骰子, 金钱2000, GPA3.0, 探索值0
- **单骰模式:** 1骰子, 金钱3000, GPA3.0, 探索值0

**失败条件:** 金钱 < 0 (等于0可继续)
**基础胜利:** GPA*10 + 探索值 >= 60
**额外胜利:** 达成任意已确认培养计划条件
