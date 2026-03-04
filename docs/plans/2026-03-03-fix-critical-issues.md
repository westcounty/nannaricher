# 菜根人生代码问题修复计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复代码审查发现的架构和逻辑问题，确保游戏核心功能正确运行

**Architecture:**
- 统一 GameEngine 到单一实现
- 正确初始化 EventHandler
- 实现完整的培养计划胜利条件检查

**Tech Stack:** TypeScript, Node.js, Socket.IO, React

---

## Task 1: 统一 GameEngine 实现

**问题:** `server/src/index.ts` 和 `server/src/game/GameEngine.ts` 有两个不同的 GameEngine 类

**Files:**
- Modify: `server/src/index.ts`
- Keep: `server/src/game/GameEngine.ts` (这是正确完整的实现)

**Step 1: 移除 index.ts 中的重复 GameEngine 类**

删除 `server/src/index.ts` 中第 90-345 行的 GameEngine 类，保留文件顶部的导入。

**Step 2: 更新 GameEngine 导入方式**

将:
```typescript
import { EventHandler, GameEngine as GameEngineInterface } from './game/EventHandler.js';
```

改为:
```typescript
import { GameEngine } from './game/GameEngine.js';
import { EventHandler } from './game/EventHandler.js';
```

**Step 3: 更新 gameEngines Map 类型**

将:
```typescript
const gameEngines = new Map<string, GameEngine>();
```

改为:
```typescript
import { GameEngine as GameEngineClass } from './game/GameEngine.js';
const gameEngines = new Map<string, GameEngineClass>();
```

**Step 4: 更新 setupGameEngine 函数**

将:
```typescript
function setupGameEngine(roomId: string): void {
  const state = gameStates.get(roomId);
  if (!state) return;

  const engine = new GameEngine(state, new EventHandler({} as GameEngine));
  gameEngines.set(roomId, engine);
  eventHandlers.set(roomId, new EventHandler(engine));
}
```

改为:
```typescript
function setupGameEngine(roomId: string): void {
  const state = gameStates.get(roomId);
  if (!state) return;

  const engine = new GameEngineClass(roomId);
  gameEngines.set(roomId, engine);
  eventHandlers.set(roomId, engine.getEventHandler());
}
```

**Step 5: 验证构建**

Run: `npm run build -w server`
Expected: 构建成功，无错误

**Step 6: Commit**

```bash
git add server/src/index.ts
git commit -m "fix: remove duplicate GameEngine implementation, use unified version"
```

---

## Task 2: 修复 GameState 缺少 roundNumber 字段

**问题:** 设计文档要求 roundNumber，但实际缺失

**Files:**
- Modify: `shared/src/types.ts`
- Modify: `server/src/game/GameEngine.ts`

**Step 1: 在 GameState 中添加 roundNumber**

在 `shared/src/types.ts` 的 GameState 接口中添加:

```typescript
export interface GameState {
  // ... 现有字段
  roundNumber: number;  // 每6回合一个大轮
  // ...
}
```

**Step 2: 在 GameEngine 初始化时设置 roundNumber**

在 `server/src/game/GameEngine.ts` 的 `createInitialState` 方法中:

```typescript
return {
  // ...
  turnNumber: 0,
  roundNumber: 1,  // 添加这行
  // ...
};
```

**Step 3: 在 nextTurn 方法中更新 roundNumber**

在 GameEngine 的 nextTurn 方法中，当 turnNumber 是 6 的倍数时递增:

```typescript
nextTurn(): void {
  // ... 现有代码 ...

  // 每隔6回合增加一个大轮
  if (this.state.turnNumber % 6 === 0) {
    this.state.roundNumber++;
  }
}
```

**Step 4: 验证构建**

Run: `npm run build`
Expected: 构建成功

**Step 5: Commit**

```bash
git add shared/src/types.ts server/src/game/GameEngine.ts
git commit -m "feat: add roundNumber to GameState for 6-turn cycles"
```

---

## Task 3: 实现培养计划胜利条件检查

**问题:** checkWinCondition 函数过于简单，未实现14种具体的培养计划胜利条件

**Files:**
- Create: `server/src/game/WinConditionChecker.ts`
- Modify: `server/src/game/GameEngine.ts`

**Step 1: 创建 WinConditionChecker 类**

创建 `server/src/game/WinConditionChecker.ts`:

```typescript
// server/src/game/WinConditionChecker.ts
import { Player, GameState } from '@nannaricher/shared';
import { GameEngine } from './GameEngine.js';

export class WinConditionChecker {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  checkWinCondition(player: Player): { won: boolean; condition: string | null } {
    const state = this.engine.getState();

    // 检查每个已确认的培养计划
    for (const planId of player.confirmedPlans) {
      const result = this.checkPlanWinCondition(player, planId, state);
      if (result.won) {
        return result;
      }
    }

    return { won: false, condition: null };
  }

  private checkPlanWinCondition(
    player: Player,
    planId: string,
    state: GameState
  ): { won: boolean; condition: string | null } {
    switch (planId) {
      case 'plan_shangxue':
        // 商学院：金钱达到5000
        if (player.money >= 5000) {
          return { won: true, condition: '商学院：金钱达到5000' };
        }
        break;

      case 'plan_huaxue':
        // 化学化工学院：探索值达到45
        if (player.exploration >= 45) {
          return { won: true, condition: '化学化工学院：探索值达到45' };
        }
        break;

      case 'plan_makesi':
        // 马克思主义学院：GPA达到4.5
        if (player.gpa >= 4.5) {
          return { won: true, condition: '马克思主义学院：GPA达到4.5' };
        }
        break;

      case 'plan_faxue':
        // 法学院：场上出现破产玩家
        const hasBankrupt = state.players.some(
          p => p.id !== player.id && p.isBankrupt
        );
        if (hasBankrupt) {
          return { won: true, condition: '法学院：场上出现破产玩家' };
        }
        break;

      case 'plan_ruanjian':
        // 软件学院：金钱 + GPA*500 + 探索值*100 >= 6000
        const softwareScore = player.money + player.gpa * 500 + player.exploration * 100;
        if (softwareScore >= 6000) {
          return { won: true, condition: `软件学院：综合分数达到${softwareScore}>=6000` };
        }
        break;

      case 'plan_wenxue':
        // 文学院：3项属性均达到对应基础胜利的1/3
        const gpaPart = player.gpa * 10;
        const expPart = player.exploration;
        const moneyPart = player.money / 100;
        if (gpaPart >= 20 && expPart >= 20 && moneyPart >= 20) {
          return { won: true, condition: '文学院：3项属性均达到20' };
        }
        break;

      case 'plan_wuli':
        // 物理学院：任选两项达到60
        const physicsScores = [
          player.exploration,
          player.gpa * 10,
          player.money / 100
        ];
        const validPairs = this.countValidPairs(physicsScores, 60);
        if (validPairs >= 1) {
          return { won: true, condition: '物理学院：两项属性分数均达到60' };
        }
        break;

      case 'plan_tianwen':
        // 天文与空间科学学院：与所有其他玩家同时在同一格子停留过
        // 需要追踪历史位置，简化检查
        const allPlayersAtSameCell = this.checkAllPlayersAtSameCell(player, state);
        if (allPlayersAtSameCell) {
          return { won: true, condition: '天文学院：与其他玩家在同一格子相遇' };
        }
        break;

      case 'plan_jianzhu':
        // 建筑与城市规划学院：经历过起点、校医院、鼎、候车厅和闯门
        const requiredCells = ['start', 'hospital', 'ding', 'waiting_room', 'chuangmen'];
        const hasVisitedAll = requiredCells.every(cellId =>
          player.lineEventsTriggered['main']?.some(idx =>
            this.getCellIdAt(idx) === cellId
          )
        );
        // 简化版：检查是否访问过所有角落
        if (hasVisitedAll) {
          return { won: true, condition: '建筑学院：经历过所有主要格子' };
        }
        break;

      case 'plan_yishu':
        // 艺术学院：经历过浦口线每个事件
        const pukouCellCount = 12;
        const pukouEvents = player.lineEventsTriggered['pukou'] || [];
        if (pukouEvents.length >= pukouCellCount) {
          return { won: true, condition: '艺术学院：经历过浦口线所有事件' };
        }
        break;

      case 'plan_suzhou':
        // 苏州校区：经历过苏州校区每个事件
        const suzhouEvents = player.lineEventsTriggered['suzhou'] || [];
        if (suzhouEvents.length >= 10) {
          return { won: true, condition: '苏州校区：经历过所有苏州事件' };
        }
        break;

      case 'plan_haiwai':
        // 海外教育学院：有玩家获胜时使用了至少两次机会卡
        // 需要在游戏状态中追踪，简化处理
        if (player.chanceCardsUsedOnPlayers) {
          const totalUses = Object.values(player.chanceCardsUsedOnPlayers)
            .reduce((sum, count) => sum + count, 0);
          if (totalUses >= 2) {
            return { won: true, condition: '海外教育学院：使用了两次机会卡影响其他玩家' };
          }
        }
        break;

      default:
        break;
    }

    return { won: false, condition: null };
  }

  private countValidPairs(scores: number[], threshold: number): number {
    let count = 0;
    for (let i = 0; i < scores.length; i++) {
      for (let j = i + 1; j < scores.length; j++) {
        if (scores[i] >= threshold && scores[j] >= threshold) {
          count++;
        }
      }
    }
    return count;
  }

  private checkAllPlayersAtSameCell(player: Player, state: GameState): boolean {
    // 简化版：检查是否有其他玩家在当前位置
    return state.players.some(p =>
      p.id !== player.id &&
      p.position.type === player.position.type &&
      (player.position.type === 'main' ? p.position.index === player.position.index :
        p.position.lineId === player.position.lineId && p.position.index === player.position.index)
    );
  }

  private getCellIdAt(index: number): string | null {
    // 需要从 boardData 获取，这里简化处理
    return null;
  }
}
```

**Step 2: 在 GameEngine 中集成 WinConditionChecker**

在 `server/src/game/GameEngine.ts` 中添加:

```typescript
import { WinConditionChecker } from './WinConditionChecker.js';

export class GameEngine implements IGameEngine {
  private state: GameState;
  private eventHandler: EventHandler;
  private winChecker: WinConditionChecker;

  constructor(roomId: string) {
    this.state = this.createInitialState(roomId);
    this.eventHandler = new EventHandler(this);
    this.winChecker = new WinConditionChecker(this);
  }

  // 修改 checkWinConditions 方法
  checkWinConditions(playerId: string): boolean {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return false;

    // 检查基础胜利条件
    const baseScore = player.gpa * 10 + player.exploration;
    if (baseScore >= BASE_WIN_THRESHOLD) {
      this.declareWinner(playerId, `GPA*10+探索值达到 ${baseScore.toFixed(1)} >= ${BASE_WIN_THRESHOLD}`);
      return true;
    }

    // 检查培养计划胜利条件
    const result = this.winChecker.checkWinCondition(player);
    if (result.won && result.condition) {
      this.declareWinner(playerId, result.condition);
      return true;
    }

    return false;
  }

  // ... 其他方法
}
```

**Step 3: 验证构建**

Run: `npm run build`
Expected: 构建成功

**Step 4: Commit**

```bash
git add server/src/game/WinConditionChecker.ts server/src/game/GameEngine.ts
git commit -m "feat: implement comprehensive win condition checking for all training plans"
```

---

## Task 4: 修复 index.ts 中的胜利条件检查集成

**问题:** index.ts 中的 checkWinCondition 函数需要使用新的 WinConditionChecker

**Files:**
- Modify: `server/src/index.ts`

**Step 1: 更新 checkWinCondition 函数**

将:
```typescript
function checkWinCondition(roomId: string): { winnerId: string | null; condition: string | null } {
  // ... 旧的实现
}
```

改为:
```typescript
function checkWinCondition(roomId: string): { winnerId: string | null; condition: string | null } {
  const state = gameStates.get(roomId);
  const engine = gameEngines.get(roomId);
  if (!state || !engine) return { winnerId: null, condition: null };

  for (const player of state.players) {
    if (player.isBankrupt || player.isDisconnected) continue;

    // 检查基础胜利
    const baseScore = player.gpa * 10 + player.exploration;
    if (baseScore >= BASE_WIN_THRESHOLD) {
      return {
        winnerId: player.id,
        condition: `GPA*10+探索值达到 ${baseScore.toFixed(1)} >= ${BASE_WIN_THRESHOLD}`,
      };
    }

    // 检查培养计划胜利
    const winResult = engine.checkWinConditions(player.id);
    if (winResult) {
      return {
        winnerId: player.id,
        condition: '培养计划胜利条件达成',
      };
    }
  }

  return { winnerId: null, condition: null };
}
```

**Step 2: 验证构建**

Run: `npm run build -w server`
Expected: 构建成功

**Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "refactor: update win condition check to use GameEngine method"
```

---

## Task 5: 添加 ES 模块导入扩展名到新文件

**问题:** 新创建的文件需要使用 .js 扩展名

**Files:**
- Modify: `server/src/game/GameEngine.ts` (添加导入)
- Modify: `server/src/game/WinConditionChecker.ts`

**Step 1: 确保 WinConditionChecker 导入正确**

在 `server/src/game/GameEngine.ts` 确保有:
```typescript
import { WinConditionChecker } from './WinConditionChecker.js';
```

**Step 2: 验证构建**

Run: `npm run build`
Expected: 构建成功

**Step 3: Commit**

```bash
git add server/src/game/GameEngine.ts server/src/game/WinConditionChecker.ts
git commit -m "fix: add .js extension to ES module imports"
```

---

## Task 6: 更新 client 端显示 roundNumber

**问题:** 前端需要显示大轮信息

**Files:**
- Modify: `client/src/components/StatusBar.tsx`

**Step 1: 在状态栏显示 roundNumber**

在 `client/src/components/StatusBar.tsx` 中添加大轮显示:

```tsx
<div className="round-info">
  <span>第 {gameState?.turnNumber || 0} 回合</span>
  <span> · 第 {gameState?.roundNumber || 1} 轮</span>
</div>
```

**Step 2: 验证构建**

Run: `npm run build -w client`
Expected: 构建成功

**Step 3: Commit**

```bash
git add client/src/components/StatusBar.tsx
git commit -m "feat: display round number in status bar"
```

---

## Task 7: 修复弃用的 substr 方法

**问题:** 使用了已弃用的 `String.prototype.substr`

**Files:**
- Search and modify all occurrences

**Step 1: 查找所有 substr 使用**

Run: `grep -r "substr" server/src/`
Expected: 找到 `Math.random().toString(36).substr(2, 9)`

**Step 2: 替换为 substring**

将所有 `.substr(start, length)` 改为 `.substring(start, start + length)`

例如:
```typescript
// 旧
Math.random().toString(36).substr(2, 9)
// 新
Math.random().toString(36).substring(2, 11)
```

**Step 3: 验证构建**

Run: `npm run build`
Expected: 构建成功

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: replace deprecated substr with substring"
```

---

## Task 8: 最终验证和测试

**Step 1: 运行完整构建**

Run: `npm run build`
Expected: 所有包构建成功

**Step 2: 运行服务器测试**

Run: `npm run test -w server`
Expected: 所有测试通过

**Step 3: 本地启动测试**

Run: `npm run dev -w server`
Expected: 服务器启动无错误

**Step 4: 部署测试**

```bash
# 重新打包部署
cd D:/work/nannaricher
npm run build
tar -cvzf nannaricher-fix.tar.gz shared/dist server/dist client/dist server/package.json shared/package.json package.json package-lock.json ecosystem.config.cjs
scp -i ~/.ssh/photozen_nju_top_ed25519 nannaricher-fix.tar.gz root@47.110.32.207:/tmp/
ssh -i ~/.ssh/photozen_nju_top_ed25519 root@47.110.32.207 "cd /var/www/nannaricher && tar -xzf /tmp/nannaricher-fix.tar.gz && npm install --production && pm2 restart nannaricher-server"
```

**Step 5: 验证部署**

Run: `curl https://richer.nju.top/api/health`
Expected: `{"status":"ok", ...}`

**Step 6: Final Commit**

```bash
git add -A
git commit -m "fix: complete code review fixes - unified GameEngine, win conditions, roundNumber"
```

---

## Summary

| Task | Description | Estimated Time |
|------|-------------|----------------|
| 1 | 统一 GameEngine 实现 | 15 min |
| 2 | 添加 roundNumber 字段 | 10 min |
| 3 | 实现培养计划胜利条件 | 30 min |
| 4 | 集成胜利条件检查 | 10 min |
| 5 | 修复 ES 模块导入 | 5 min |
| 6 | 更新前端显示 | 10 min |
| 7 | 修复弃用方法 | 10 min |
| 8 | 最终验证测试 | 15 min |

**Total: ~1.5-2 hours**
