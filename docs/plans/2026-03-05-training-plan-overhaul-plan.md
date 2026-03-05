# 培养计划系统大改 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构培养计划系统：大一共享公共buff，大二起按年抽取培养计划并支持主修/辅修方向，移除5张卡牌，修改9张卡牌效果。

**Architecture:** 将现有 `confirmedPlans: string[]` 替换为 `majorPlan: string | null` + `minorPlans: string[]` 双字段结构。大一buff通过 `roundNumber === 1` 条件判断实现，无需额外状态。培养计划抽取从游戏开始移至大二，每年支持"不调整/调整"选择流程。

**Tech Stack:** TypeScript, Socket.IO, React

---

### Task 1: 更新共享类型和常量

**Files:**
- Modify: `shared/src/types.ts:47-80` (Player interface)
- Modify: `shared/src/constants.ts:14` (常量)

**Step 1: 修改 Player interface**

在 `shared/src/types.ts` 中，替换 `confirmedPlans` 为新字段：

```typescript
// 在 Player interface 中，替换:
//   confirmedPlans: string[];    // ids of confirmed plans
// 为:
  majorPlan: string | null;       // 主修方向的计划ID（被动效果仅主修生效）
  minorPlans: string[];           // 辅修方向的计划ID列表
  planSlotLimit: number;          // 培养计划槽位上限（默认2，专业意向可+1）
```

同时保留 `trainingPlans: TrainingPlan[]` 不变（语义从"已抽取"变为"已加入培养列表"）。

移除 `TrainingPlan.confirmed` 字段：
```typescript
export interface TrainingPlan {
  id: string;
  name: string;
  winCondition: string;
  passiveAbility: string;
  // 移除 confirmed: boolean;
}
```

**Step 2: 修改常量**

在 `shared/src/constants.ts` 中：
```typescript
// 修改:
export const MAX_TRAINING_PLANS = 2;  // 值不变，语义变为默认槽位上限
// 新增:
export const DEFAULT_PLAN_SLOTS = 2;  // 默认培养计划槽位
```

**Step 3: 添加辅助函数到 constants.ts**

```typescript
// 获取玩家所有已加入培养列表的计划ID
export function getPlayerPlanIds(player: { majorPlan: string | null; minorPlans: string[] }): string[] {
  const ids: string[] = [];
  if (player.majorPlan) ids.push(player.majorPlan);
  ids.push(...player.minorPlans);
  return ids;
}
```

**Step 4: Commit**

```bash
git add shared/src/types.ts shared/src/constants.ts
git commit -m "refactor: replace confirmedPlans with majorPlan/minorPlans structure"
```

---

### Task 2: 更新 GameEngine 中的玩家初始化和 GPA buff

**Files:**
- Modify: `server/src/game/GameEngine.ts:196-300` (modifyPlayerGpa, addPlayer)

**Step 1: 更新 addPlayer 中的初始字段**

找到 `addPlayer` 方法，将:
```typescript
confirmedPlans: [],
```
替换为:
```typescript
majorPlan: null,
minorPlans: [],
planSlotLimit: DEFAULT_PLAN_SLOTS,
```

同时添加 `import { DEFAULT_PLAN_SLOTS } from '@nannaricher/shared';`

**Step 2: 修改 modifyPlayerGpa 添加大一buff**

在 `server/src/game/GameEngine.ts` 的 `modifyPlayerGpa` 方法中，在计算 newGpa 之前添加大一buff逻辑：

```typescript
modifyPlayerGpa(playerId: string, delta: number): void {
    const player = this.getPlayer(playerId);
    if (!player || player.isBankrupt) return;

    // Card effect: blockGpaLoss (祖传试卷)
    if (delta < 0) {
      const blockIdx = player.effects.findIndex(
        e => e.type === 'custom' && e.data?.blockGpaLoss
      );
      if (blockIdx >= 0) {
        player.effects.splice(blockIdx, 1);
        this.log('祖传试卷：抵消本次GPA损失', playerId);
        return;
      }
    }

    // 大一通用buff：GPA增加效果翻倍
    let actualDelta = delta;
    if (this.state.roundNumber === 1 && delta > 0) {
      actualDelta = delta * 2;
      this.log(`大一buff：GPA增加翻倍 (${delta} → ${actualDelta})`, playerId);
    }

    const oldGpa = player.gpa;
    let newGpa = player.gpa + actualDelta;
    // ... rest unchanged
```

**Step 3: 全局替换 confirmedPlans 引用为新字段**

在 `GameEngine.ts` 中搜索所有 `confirmedPlans` 引用并更新：
- `player.confirmedPlans.includes(planId)` → `player.majorPlan === planId || player.minorPlans.includes(planId)`
- 迭代 `player.confirmedPlans` → 使用 `getPlayerPlanIds(player)`

具体位置：
- Line ~1094 (`plan.confirmed` 检查) → 改为检查 plan.id 是否在 getPlayerPlanIds 中
- Line ~1452 (`plan.confirmed = true`) → 移除

**Step 4: Commit**

```bash
git add server/src/game/GameEngine.ts
git commit -m "feat: add freshman GPA buff and replace confirmedPlans with majorPlan/minorPlans"
```

---

### Task 3: 添加鼓楼线大一收益翻倍buff

**Files:**
- Modify: `server/src/game/handlers/line-handlers.ts:694-782` (gulou handlers)

**Step 1: 创建 gulou buff 辅助函数**

在 `line-handlers.ts` 文件开头（handler注册区域之前），添加辅助函数：

```typescript
/** 大一buff：鼓楼线正面数值效果翻倍 */
function applyFreshmanGulouBuff(engine: IGameEngine, playerId: string, stat: 'money' | 'gpa' | 'exploration', delta: number): void {
  const state = engine.getState();
  if (state.roundNumber === 1 && delta > 0) {
    const doubled = delta * 2;
    if (stat === 'money') engine.modifyPlayerMoney(playerId, doubled);
    else if (stat === 'gpa') engine.modifyPlayerGpa(playerId, doubled);
    else engine.modifyPlayerExploration(playerId, doubled);
    engine.log(`大一buff：鼓楼线${stat}收益翻倍 (${delta} → ${doubled})`, playerId);
  } else {
    if (stat === 'money') engine.modifyPlayerMoney(playerId, delta);
    else if (stat === 'gpa') engine.modifyPlayerGpa(playerId, delta);
    else engine.modifyPlayerExploration(playerId, delta);
  }
}
```

**注意：** 因为 modifyPlayerGpa 已经内置了大一GPA翻倍buff，对于鼓楼线内的 GPA 增加，不应该再次翻倍。需要特殊处理：鼓楼线buff对 exploration 和 money 翻倍，但 GPA 翻倍已经在 modifyPlayerGpa 中处理了，所以鼓楼线内不再额外翻倍 GPA。

**修正方案：** 鼓楼线buff只需要对 exploration 和 money 翻倍。GPA 已由 modifyPlayerGpa 统一处理。

```typescript
/** 大一buff：鼓楼线正面探索值/金钱收益翻倍（GPA已由modifyPlayerGpa统一翻倍） */
function gulouFreshmanBuff(engine: IGameEngine, stat: 'money' | 'exploration', delta: number): number {
  if (engine.getState().roundNumber === 1 && delta > 0) return delta * 2;
  return delta;
}
```

**Step 2: 更新各鼓楼线handler**

对每个鼓楼线handler中的正面 exploration/money 效果应用buff：

**gulou_root_plan:**
```typescript
// 探索值 < 10 时 +2 → 大一buff翻倍
const expDelta = gulouFreshmanBuff(engine, 'exploration', 2);
engine.modifyPlayerExploration(playerId, expDelta);
```

**gulou_heritage:**
```typescript
// +1/+2/+4 探索值 → 大一buff翻倍
const delta = dice <= 2 ? 1 : dice <= 4 ? 2 : 4;
engine.modifyPlayerExploration(playerId, gulouFreshmanBuff(engine, 'exploration', delta));
```

**gulou_celebrity:**
```typescript
// 偶数分支 +2 探索值 → 翻倍
engine.modifyPlayerExploration(playerId, gulouFreshmanBuff(engine, 'exploration', 2));
```

**gulou_wedding:** +3 探索值 → 翻倍
**gulou_retired_teacher:** +1 探索值 → 翻倍（GPA+0.1由modifyPlayerGpa自动翻倍）
**gulou_building_guide:** +2 探索值 → 翻倍
**gulou_tour_guide:** +2 探索值 → 翻倍
**gulou_exp_card:** +3 探索值 → 翻倍

**Step 3: Commit**

```bash
git add server/src/game/handlers/line-handlers.ts
git commit -m "feat: add freshman Gulou line bonus buff (double positive exploration/money)"
```

---

### Task 4: 移除5张卡牌

**Files:**
- Modify: `server/src/data/cards.ts` (删除卡牌定义)
- Modify: `server/src/game/handlers/card-handlers.ts` (删除handler)

**Step 1: 从 cards.ts 中移除卡牌定义**

删除以下卡牌对象：
1. `chance_flag_raising` (升旗仪式) — 约 Line 791-799
2. `chance_clustering_algorithm` (聚类算法) — 约 Line 801-809
3. `chance_internship_referral` (实习内推) — 约 Line 811-819
4. `chance_southbound_rose` (南行玫瑰) — 约 Line 821-829
5. `destiny_major_admission` (大类招生) — 约 Line 87-95

**Step 2: 从 card-handlers.ts 中移除handler**

删除以下handler注册：
1. `card_chance_flag_raising` — 约 Line 963-974
2. `card_chance_clustering_algorithm` — 约 Line 977-989
3. `card_chance_internship_referral` — 约 Line 992-999
4. `card_chance_southbound_rose` — 约 Line 1002-1015
5. `card_destiny_major_admission` — 约 Line 1428-1437

**Step 3: Commit**

```bash
git add server/src/data/cards.ts server/src/game/handlers/card-handlers.ts
git commit -m "feat: remove 5 cards (升旗仪式/聚类算法/实习内推/南行玫瑰/大类招生)"
```

---

### Task 5: 修改经费均摊卡牌

**Files:**
- Modify: `server/src/data/cards.ts` (description)
- Modify: `server/src/game/handlers/card-handlers.ts:620-628` (handler)

**Step 1: 更新卡牌描述**

cards.ts 中 `chance_budget_sharing`：
```typescript
description: '场上所有玩家的金钱数重置为2000',
```

**Step 2: 更新handler**

card-handlers.ts 中 `card_chance_budget_sharing`：
```typescript
eventHandler.registerHandler('card_chance_budget_sharing', (engine, playerId) => {
  const players = engine.getAllPlayers();
  players.forEach(p => {
    const diff = 2000 - p.money;
    engine.modifyPlayerMoney(p.id, diff);
  });
  engine.log('经费均摊：所有玩家金钱变为2000', playerId);
  return null;
});
```

**Step 3: Commit**

```bash
git add server/src/data/cards.ts server/src/game/handlers/card-handlers.ts
git commit -m "feat: update 经费均摊 to reset money to 2000"
```

---

### Task 6: 修改跨院准出和专业意向卡牌

**Files:**
- Modify: `server/src/data/cards.ts` (descriptions)
- Modify: `server/src/game/handlers/card-handlers.ts:1440-1515` (handlers)

**Step 1: 更新跨院准出卡牌定义和handler**

cards.ts 中更新 `destiny_cross_college_exit`：
```typescript
{
  id: 'destiny_cross_college_exit',
  name: '跨院准出',
  description: '单次使用，你可以立即交换自己的主修培养计划和辅修培养计划，如果没有辅修培养计划则无事发生',
  deckType: 'destiny',
  holdable: true,
  singleUse: true,
  returnToDeck: true,    // 不放回，待使用后放回命运卡堆
  effects: [],
},
```

card-handlers.ts 中替换 `card_destiny_cross_college_exit` 和 callback：
```typescript
eventHandler.registerHandler('card_destiny_cross_college_exit', (engine, playerId) => {
  const player = engine.getPlayer(playerId);
  if (!player) return null;

  if (player.minorPlans.length === 0) {
    engine.log('跨院准出：没有辅修培养计划，无事发生', playerId);
    return null;
  }

  if (player.minorPlans.length === 1) {
    // 只有一个辅修，直接交换
    const oldMajor = player.majorPlan;
    const oldMinor = player.minorPlans[0];
    player.majorPlan = oldMinor;
    player.minorPlans = oldMajor ? [oldMajor] : [];
    const majorName = player.trainingPlans.find(p => p.id === oldMinor)?.name || oldMinor;
    engine.log(`跨院准出：主修变为 ${majorName}`, playerId);
    return null;
  }

  // 多个辅修，让玩家选择要交换的辅修
  const options = player.minorPlans.map(planId => {
    const plan = player.trainingPlans.find(p => p.id === planId);
    return { label: plan?.name || planId, value: planId };
  });
  const action = engine.createPendingAction(
    playerId, 'choose_option', '跨院准出：选择一项辅修与主修交换', options
  );
  action.callbackHandler = 'card_cross_college_exit_callback';
  return action;
});

eventHandler.registerHandler('card_cross_college_exit_callback', (engine, playerId, choice) => {
  const player = engine.getPlayer(playerId);
  if (!player || !choice) return null;

  const oldMajor = player.majorPlan;
  player.majorPlan = choice;
  player.minorPlans = player.minorPlans.filter(id => id !== choice);
  if (oldMajor) player.minorPlans.push(oldMajor);
  const majorName = player.trainingPlans.find(p => p.id === choice)?.name || choice;
  engine.log(`跨院准出：主修变为 ${majorName}`, playerId);
  return null;
});
```

**Step 2: 更新专业意向卡牌定义和handler**

cards.ts 中更新 `destiny_professional_intention`：
```typescript
{
  id: 'destiny_professional_intention',
  name: '专业意向',
  description: '单次使用，你可以永久增加一个培养计划槽位，然后获得0.1GPA和1探索值',
  deckType: 'destiny',
  holdable: true,
  singleUse: true,
  returnToDeck: true,
  effects: [],   // 移除旧effects，handler中统一处理
},
```

card-handlers.ts 中替换 `card_destiny_professional_intention` 和 callback：
```typescript
eventHandler.registerHandler('card_destiny_professional_intention', (engine, playerId) => {
  const player = engine.getPlayer(playerId);
  if (!player) return null;

  player.planSlotLimit += 1;
  engine.modifyPlayerGpa(playerId, 0.1);
  engine.modifyPlayerExploration(playerId, 1);
  engine.log(`专业意向：培养计划槽位上限增加到 ${player.planSlotLimit}，GPA +0.1，探索值 +1`, playerId);
  return null;
});
```

删除旧的 `card_professional_intention_callback` handler。

**Step 3: Commit**

```bash
git add server/src/data/cards.ts server/src/game/handlers/card-handlers.ts
git commit -m "feat: update 跨院准出 (swap major/minor) and 专业意向 (add plan slot)"
```

---

### Task 7: 修改强基计划/国家专项/二次选拔卡牌

**Files:**
- Modify: `server/src/data/cards.ts` (descriptions)
- Modify: `server/src/game/handlers/card-handlers.ts:321-342` (handlers)

这三张卡牌逻辑相似：抽取一张培养计划 → 选择是否加入 → 检查溢出 → 给予奖励。

**Step 1: 更新卡牌描述**

```typescript
// destiny_strong_base_plan
description: '你立即再抽取一张培养计划并选择一项加入培养计划，不能超过上限，若超过可选择保留并重设主修方向，然后获得0.2GPA',

// destiny_national_special
description: '你立即再抽取一张培养计划并选择一项加入培养计划，不能超过上限，若超过可选择保留并重设主修方向，然后获得200金钱',

// destiny_secondary_selection
description: '你立即再抽取一张培养计划并选择一项加入培养计划，不能超过上限，若超过可选择保留并重设主修方向，然后获得2探索值',
```

**Step 2: 创建通用的「抽取并加入培养计划」handler工厂**

在 card-handlers.ts 中创建通用函数（建议放在文件适当位置）：

```typescript
/**
 * 通用「抽取1张培养计划并加入」流程
 * 用于强基计划/国家专项/二次选拔
 */
function createDrawAndAddPlanHandler(
  handlerId: string,
  callbackId: string,
  bonusFn: (engine: IGameEngine, playerId: string) => void,
  bonusLog: string,
) {
  eventHandler.registerHandler(handlerId, (engine, playerId) => {
    const plan = engine.drawTrainingPlan(playerId);
    if (!plan) {
      engine.log(`${bonusLog}：培养计划牌堆已空，仅获得奖励`, playerId);
      bonusFn(engine, playerId);
      return null;
    }

    const player = engine.getPlayer(playerId);
    if (!player) return null;

    // 展示抽到的计划，选择是否加入
    const options = [
      {
        label: `加入: ${plan.name}`,
        value: `add_${plan.id}`,
        description: `胜利条件: ${plan.winCondition}${plan.passiveAbility ? '\n被动能力: ' + plan.passiveAbility : ''}`,
      },
      { label: '不加入', value: 'skip' },
    ];

    const action = engine.createPendingAction(
      playerId, 'choose_option', `${bonusLog}：抽到 ${plan.name}，是否加入培养计划？`, options
    );
    action.callbackHandler = callbackId;
    return action;
  });

  eventHandler.registerHandler(callbackId, (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;

    if (choice && choice.startsWith('add_')) {
      const planId = choice.replace('add_', '');
      // 加入培养列表并设置主修/辅修
      // 这里需要调用 GameCoordinator 的计划管理方法
      // 通过 engine.emit 或直接调用
      addPlanToPlayer(engine, player, planId);
    }

    bonusFn(engine, playerId);
    return null;
  });
}
```

**注意：** 上述工厂函数中的 `addPlanToPlayer` 需要处理主修/辅修设置和溢出检查。这需要和 Task 9 中的 GameCoordinator 计划管理方法配合。具体实现在 Task 9 中完善。

暂时先在 card-handlers.ts 中注册简化版handler，后续在 Task 9 中与 GameCoordinator 集成：

```typescript
// 强基计划
eventHandler.registerHandler('card_destiny_strong_base_plan', (engine, playerId) => {
  return drawAndAddPlanFlow(engine, playerId, '强基计划', () => {
    engine.modifyPlayerGpa(playerId, 0.2);
    engine.log('强基计划：GPA +0.2', playerId);
  });
});

// 国家专项
eventHandler.registerHandler('card_destiny_national_special', (engine, playerId) => {
  return drawAndAddPlanFlow(engine, playerId, '国家专项', () => {
    engine.modifyPlayerMoney(playerId, 200);
    engine.log('国家专项：金钱 +200', playerId);
  });
});

// 二次选拔
eventHandler.registerHandler('card_destiny_secondary_selection', (engine, playerId) => {
  return drawAndAddPlanFlow(engine, playerId, '二次选拔', () => {
    engine.modifyPlayerExploration(playerId, 2);
    engine.log('二次选拔：探索值 +2', playerId);
  });
});
```

**Step 3: Commit**

```bash
git add server/src/data/cards.ts server/src/game/handlers/card-handlers.ts
git commit -m "feat: update 强基计划/国家专项/二次选拔 to draw-and-add-plan flow"
```

---

### Task 8: 修改联合培养和学科评估卡牌

**Files:**
- Modify: `server/src/data/cards.ts` (descriptions)
- Modify: `server/src/game/handlers/card-handlers.ts:897-960` (handlers)

**Step 1: 更新联合培养**

cards.ts description:
```typescript
description: '选择一位其他玩家，将你们各自的一张辅修培养计划交换',
```

card-handlers.ts 中替换 `card_chance_joint_training`：
```typescript
eventHandler.registerHandler('card_chance_joint_training', (engine, playerId) => {
  const player = engine.getPlayer(playerId);
  if (!player) return null;

  if (player.minorPlans.length === 0) {
    engine.log('联合培养：你没有辅修培养计划，无法交换', playerId);
    return null;
  }

  const others = engine.getAllPlayers().filter(p =>
    p.id !== playerId && !p.isBankrupt && p.minorPlans.length > 0
  );
  if (others.length === 0) {
    engine.log('联合培养：没有其他玩家有辅修培养计划', playerId);
    return null;
  }

  // 选择目标玩家
  const options = others.map(p => ({
    label: p.name,
    value: p.id,
    description: `辅修: ${p.minorPlans.map(id => p.trainingPlans.find(tp => tp.id === id)?.name || id).join(', ')}`,
  }));
  const action = engine.createPendingAction(
    playerId, 'choose_option', '联合培养：选择一位玩家交换辅修培养计划', options
  );
  action.callbackHandler = 'card_joint_training_choose_target';
  return action;
});

// Step 1: 选中目标后，选择自己的辅修
eventHandler.registerHandler('card_joint_training_choose_target', (engine, playerId, choice) => {
  const player = engine.getPlayer(playerId);
  if (!player || !choice) return null;

  const target = engine.getPlayer(choice);
  if (!target) return null;

  // 如果自己只有1个辅修，直接选择目标的
  if (player.minorPlans.length === 1) {
    // 直接进入选目标辅修
    if (target.minorPlans.length === 1) {
      // 双方都只有1个，直接交换
      swapMinorPlans(engine, player, player.minorPlans[0], target, target.minorPlans[0]);
      return null;
    }

    const options = target.minorPlans.map(id => {
      const plan = target.trainingPlans.find(p => p.id === id);
      return { label: plan?.name || id, value: `${choice}:${player.minorPlans[0]}:${id}` };
    });
    const action = engine.createPendingAction(
      playerId, 'choose_option', `选择${target.name}的一项辅修计划来交换`, options
    );
    action.callbackHandler = 'card_joint_training_finalize';
    return action;
  }

  // 先选自己的辅修
  const myOptions = player.minorPlans.map(id => {
    const plan = player.trainingPlans.find(p => p.id === id);
    return { label: plan?.name || id, value: `${choice}:${id}` };
  });
  const action = engine.createPendingAction(
    playerId, 'choose_option', '选择你要交换的辅修培养计划', myOptions
  );
  action.callbackHandler = 'card_joint_training_choose_mine';
  return action;
});

eventHandler.registerHandler('card_joint_training_choose_mine', (engine, playerId, choice) => {
  const player = engine.getPlayer(playerId);
  if (!player || !choice) return null;

  const [targetId, myPlanId] = choice.split(':');
  const target = engine.getPlayer(targetId);
  if (!target) return null;

  if (target.minorPlans.length === 1) {
    swapMinorPlans(engine, player, myPlanId, target, target.minorPlans[0]);
    return null;
  }

  const options = target.minorPlans.map(id => {
    const plan = target.trainingPlans.find(p => p.id === id);
    return { label: plan?.name || id, value: `${targetId}:${myPlanId}:${id}` };
  });
  const action = engine.createPendingAction(
    playerId, 'choose_option', `选择${target.name}的一项辅修计划来交换`, options
  );
  action.callbackHandler = 'card_joint_training_finalize';
  return action;
});

eventHandler.registerHandler('card_joint_training_finalize', (engine, playerId, choice) => {
  const player = engine.getPlayer(playerId);
  if (!player || !choice) return null;

  const [targetId, myPlanId, theirPlanId] = choice.split(':');
  const target = engine.getPlayer(targetId);
  if (!target) return null;

  swapMinorPlans(engine, player, myPlanId, target, theirPlanId);
  return null;
});
```

辅助函数：
```typescript
function swapMinorPlans(engine: IGameEngine, playerA: Player, planIdA: string, playerB: Player, planIdB: string): void {
  // 从双方 minorPlans 中移除并交换
  playerA.minorPlans = playerA.minorPlans.filter(id => id !== planIdA);
  playerB.minorPlans = playerB.minorPlans.filter(id => id !== planIdB);

  // 从 trainingPlans 中找到并交换实际的 plan 对象
  const planA = playerA.trainingPlans.find(p => p.id === planIdA);
  const planB = playerB.trainingPlans.find(p => p.id === planIdB);

  if (planA && planB) {
    playerA.trainingPlans = playerA.trainingPlans.filter(p => p.id !== planIdA);
    playerB.trainingPlans = playerB.trainingPlans.filter(p => p.id !== planIdB);
    playerA.trainingPlans.push(planB);
    playerB.trainingPlans.push(planA);
    playerA.minorPlans.push(planIdB);
    playerB.minorPlans.push(planIdA);
    engine.log(`联合培养：${playerA.name}的${planA.name}与${playerB.name}的${planB.name}交换`, playerA.id);
  }
}
```

**Step 2: 更新学科评估**

cards.ts description:
```typescript
description: '抽取一张培养计划并选择一位玩家，替换其一张辅修培养计划（若没有辅修培养计划则无事发生）',
```

card-handlers.ts 中替换 `card_chance_discipline_evaluation`：
```typescript
eventHandler.registerHandler('card_chance_discipline_evaluation', (engine, playerId) => {
  const newPlan = engine.drawTrainingPlan(playerId);
  if (!newPlan) {
    engine.log('学科评估：培养计划牌堆已空', playerId);
    return null;
  }

  // 找有辅修计划的其他玩家
  const others = engine.getAllPlayers().filter(p =>
    p.id !== playerId && !p.isBankrupt && p.minorPlans.length > 0
  );
  if (others.length === 0) {
    engine.log(`学科评估：抽到${newPlan.name}，但无人有辅修计划可替换`, playerId);
    return null;
  }

  const options = others.map(p => ({
    label: p.name,
    value: p.id,
    description: `辅修: ${p.minorPlans.map(id => p.trainingPlans.find(tp => tp.id === id)?.name || id).join(', ')}`,
  }));
  const action = engine.createPendingAction(
    playerId, 'choose_option', `学科评估：抽到 ${newPlan.name}，选择一位玩家替换其辅修计划`, options
  );
  action.cardId = 'chance_discipline_evaluation';
  action.callbackHandler = 'card_discipline_evaluation_target';
  return action;
});

eventHandler.registerHandler('card_discipline_evaluation_target', (engine, playerId, choice) => {
  if (!choice) return null;
  const target = engine.getPlayer(choice);
  const player = engine.getPlayer(playerId);
  if (!target || !player) return null;

  // 找到刚抽的计划（最后一个加入 trainingPlans 的）
  const newPlan = player.trainingPlans[player.trainingPlans.length - 1];

  if (target.minorPlans.length === 1) {
    // 只有一个辅修，直接替换
    const replacedId = target.minorPlans[0];
    const replaced = target.trainingPlans.find(p => p.id === replacedId);
    target.trainingPlans = target.trainingPlans.filter(p => p.id !== replacedId);
    target.minorPlans = [newPlan.id];
    target.trainingPlans.push(newPlan);
    // 从使用者的 trainingPlans 中移除
    player.trainingPlans = player.trainingPlans.filter(p => p.id !== newPlan.id);
    engine.log(`学科评估：将${target.name}的辅修 ${replaced?.name} 替换为 ${newPlan.name}`, playerId);
    return null;
  }

  // 多个辅修，让玩家选择替换哪个
  const options = target.minorPlans.map(id => {
    const plan = target.trainingPlans.find(p => p.id === id);
    return { label: plan?.name || id, value: `${choice}:${id}` };
  });
  const action = engine.createPendingAction(
    playerId, 'choose_option', `选择${target.name}的一项辅修计划来替换`, options
  );
  action.callbackHandler = 'card_discipline_evaluation_replace';
  return action;
});

eventHandler.registerHandler('card_discipline_evaluation_replace', (engine, playerId, choice) => {
  if (!choice) return null;
  const [targetId, replacedId] = choice.split(':');
  const target = engine.getPlayer(targetId);
  const player = engine.getPlayer(playerId);
  if (!target || !player) return null;

  const newPlan = player.trainingPlans[player.trainingPlans.length - 1];
  const replaced = target.trainingPlans.find(p => p.id === replacedId);
  target.trainingPlans = target.trainingPlans.filter(p => p.id !== replacedId);
  target.minorPlans = target.minorPlans.filter(id => id !== replacedId).concat(newPlan.id);
  target.trainingPlans.push(newPlan);
  player.trainingPlans = player.trainingPlans.filter(p => p.id !== newPlan.id);
  engine.log(`学科评估：将${target.name}的辅修 ${replaced?.name} 替换为 ${newPlan.name}`, playerId);
  return null;
});
```

**Step 3: Commit**

```bash
git add server/src/data/cards.ts server/src/game/handlers/card-handlers.ts
git commit -m "feat: update 联合培养 (swap minor plans) and 学科评估 (replace minor plan)"
```

---

### Task 9: 修改出行方式卡牌

**Files:**
- Modify: `server/src/data/cards.ts` (description)
- Modify: `server/src/game/handlers/card-handlers.ts` (handler + vote callback)

**Step 1: 更新卡牌描述**

```typescript
description: '所有玩家选择【共享出行】或【丈量校园】。共享出行多：丈量校园玩家探索+2，共享出行玩家选-100金或暂停1回合。丈量校园多：共享出行玩家GPA+0.2，丈量校园玩家选-1探索或暂停1回合。相等：所有人GPA+0.1，探索+1',
```

**Step 2: 更新handler**

替换 `card_chance_travel_method` handler 和投票回调。

投票阶段保持 multi_vote 结构不变。关键在于投票回调处理逻辑。

搜索现有投票回调处理位置（在 GameCoordinator 中处理 multi_vote 结果的地方），然后更新出行方式的回调：

```typescript
// 投票handler保持不变（已有multi_vote结构）
eventHandler.registerHandler('card_chance_travel_method', (engine, _playerId) => {
  const players = engine.getAllPlayers().filter(p => !p.isBankrupt);
  return {
    id: `vote_travel_method_${Date.now()}`,
    playerId: 'all',
    type: 'multi_vote' as const,
    prompt: '出行方式：选择你的出行方式',
    options: [
      { label: '共享出行', value: 'shared', description: '人多则受罚（-100金 or 暂停1回合），人少则获利（GPA+0.2）' },
      { label: '丈量校园', value: 'walk', description: '人多则受罚（-1探索 or 暂停1回合），人少则获利（探索+2）' },
    ],
    targetPlayerIds: players.map(p => p.id),
    cardId: 'chance_travel_method',
    timeoutMs: 30000,
  };
});
```

**投票结果回调**（在 GameCoordinator 中处理 multi_vote 结果的 `handleVoteResult` 或类似方法中，找到 `chance_travel_method` 的处理分支）：

```typescript
// 在 handleVoteResult 中的 chance_travel_method case:
case 'chance_travel_method': {
  const shared = Object.entries(responses).filter(([, v]) => v === 'shared').map(([id]) => id);
  const walk = Object.entries(responses).filter(([, v]) => v === 'walk').map(([id]) => id);

  if (shared.length > walk.length) {
    // 共享出行人多 → 丈量校园玩家探索+2，共享出行玩家选惩罚
    for (const pid of walk) {
      this.engine.modifyPlayerExploration(pid, 2);
    }
    this.addLog('system', `共享出行(${shared.length})人多，丈量校园玩家探索+2`);

    // 共享出行玩家需要各自选择惩罚
    this.startTravelPenaltyChain(shared, 'shared');
  } else if (walk.length > shared.length) {
    // 丈量校园人多 → 共享出行玩家GPA+0.2，丈量校园玩家选惩罚
    for (const pid of shared) {
      this.engine.modifyPlayerGpa(pid, 0.2);
    }
    this.addLog('system', `丈量校园(${walk.length})人多，共享出行玩家GPA+0.2`);

    // 丈量校园玩家需要各自选择惩罚
    this.startTravelPenaltyChain(walk, 'walk');
  } else {
    // 相等 → 所有人GPA+0.1，探索+1
    for (const pid of [...shared, ...walk]) {
      this.engine.modifyPlayerGpa(pid, 0.1);
      this.engine.modifyPlayerExploration(pid, 1);
    }
    this.addLog('system', '出行方式：井然有序，所有玩家GPA+0.1，探索+1');
  }
  break;
}
```

**新方法 `startTravelPenaltyChain`：**

```typescript
/**
 * 出行方式：多数方玩家依次选择惩罚
 */
private startTravelPenaltyChain(playerIds: string[], side: 'shared' | 'walk'): void {
  if (playerIds.length === 0) {
    // 所有人已选完，继续游戏
    this.resumeAfterMultiInteraction();
    return;
  }

  const [currentId, ...remaining] = playerIds;
  const player = this.engine.getPlayer(currentId);
  if (!player) {
    this.startTravelPenaltyChain(remaining, side);
    return;
  }

  const penaltyOptions = side === 'shared'
    ? [
        { label: '金钱 -100', value: 'money_loss' },
        { label: '暂停一回合', value: 'skip_turn' },
      ]
    : [
        { label: '探索值 -1', value: 'exp_loss' },
        { label: '暂停一回合', value: 'skip_turn' },
      ];

  const state = this.engine.getState();
  state.pendingAction = {
    id: `travel_penalty_${Date.now()}`,
    playerId: currentId,
    type: 'choose_option',
    prompt: `出行方式：${player.name}，选择你的惩罚`,
    options: penaltyOptions,
    callbackHandler: 'travel_penalty_callback',
    timeoutMs: 30000,
  };

  this.engine.getEventHandler().registerHandler('travel_penalty_callback', (_eng, pid, choice) => {
    const p = this.engine.getPlayer(pid);
    if (p && choice) {
      if (choice === 'money_loss') {
        this.engine.modifyPlayerMoney(pid, -100);
        this.addLog(pid, `${p.name} 选择：金钱 -100`);
      } else if (choice === 'exp_loss') {
        this.engine.modifyPlayerExploration(pid, -1);
        this.addLog(pid, `${p.name} 选择：探索值 -1`);
      } else if (choice === 'skip_turn') {
        p.skipNextTurn = true;
        this.addLog(pid, `${p.name} 选择：暂停一回合`);
      }
    }
    this.startTravelPenaltyChain(remaining, side);
    return null;
  });

  this.broadcastState();
}
```

**Step 3: Commit**

```bash
git add server/src/data/cards.ts server/src/game/handlers/card-handlers.ts server/src/game/GameCoordinator.ts
git commit -m "feat: overhaul 出行方式 card with vote + penalty chain mechanism"
```

---

### Task 10: 重构 setup_plans 阶段（跳过初始抽取）

**Files:**
- Modify: `server/src/game/GameCoordinator.ts` (startGame, handleSetupDrawTrainingPlans)

**Step 1: 修改 startGame 方法**

找到 `startGame()` 中设置 `phase = 'setup_plans'` 并调用 `handleSetupDrawTrainingPlans()` 的部分，改为直接进入 `playing` 阶段：

```typescript
// 原来:
// state.phase = 'setup_plans';
// this.handleSetupDrawTrainingPlans();

// 改为:
state.phase = 'playing';
state.roundNumber = 1;  // 大一

// 广播大一buff信息
this.io.to(this.roomId).emit('game:announcement', {
  message: '大一开始！通用Buff生效：\n1. 所有GPA增加效果翻倍\n2. 鼓楼线所有正面收益翻倍',
  type: 'success',
});

// 设置第一个玩家掷骰子
const firstPlayer = state.players[state.currentPlayerIndex];
state.pendingAction = {
  id: `roll_dice_${Date.now()}`,
  playerId: firstPlayer.id,
  type: 'roll_dice',
  prompt: '请投骰子',
  timeoutMs: 60000,
};
this.broadcastState();
```

**Step 2: 保留 handleSetupDrawTrainingPlans 但标记为废弃**

或者直接删除（如果不再需要）。由于 setup_plans 阶段不再使用，可以安全删除相关代码。

**Step 3: 更新 setup_plans 相关的检查逻辑**

在 GameCoordinator 中搜索所有 `setup_plans` 引用，确保不会被错误触发。

**Step 4: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "feat: skip setup_plans phase, start directly in playing phase with freshman buffs"
```

---

### Task 11: 重构年度培养计划抽取流程（核心改动）

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:1069-1300` (plan redraw system)

这是最复杂的改动。需要重写 `startPlanRedrawForPlayer` 和相关方法。

**Step 1: 新增用于追踪当轮已抽计划的集合**

```typescript
/** 当轮升学阶段所有已被抽取的计划ID（保证全场不重复） */
private yearlyDrawnPlanIds: Set<string> = new Set();
```

**Step 2: 重写 advanceTurn 中的计划抽取触发**

在 `advanceTurn()` 中，当 `roundNumber` 变化时：
- `roundNumber === 1`: 不触发（大一无抽取）
- `roundNumber >= 2`: 触发新的培养计划流程

```typescript
// 原来判断 roundNumber 增加时触发 startPlanRedrawForPlayer
// 修改为只在 roundNumber >= 2 时触发
if (state.roundNumber >= 2) {
  this.yearlyDrawnPlanIds.clear();  // 清空当轮追踪
  this.startPlanSelectionForPlayer(eligiblePlayers, 0);
  return;
}
```

**Step 3: 新建 drawPlansForPlayer 方法（保证不重复）**

```typescript
/**
 * 为玩家抽取3张培养计划，保证：
 * 1. 不与玩家已加入列表的计划重复
 * 2. 不与当轮其他玩家已抽取的计划重复
 */
private drawPlansForPlayer(player: Player): TrainingPlan[] {
  const state = this.engine.getState();
  const existingIds = new Set([
    ...getPlayerPlanIds(player),
    ...this.yearlyDrawnPlanIds,
  ]);

  const drawn: TrainingPlan[] = [];
  const deck = state.cardDecks.training;

  for (let i = 0; i < INITIAL_TRAINING_DRAW && deck.length > 0; i++) {
    // 从牌堆中找一张不重复的
    let found = false;
    for (let j = 0; j < deck.length; j++) {
      if (!existingIds.has(deck[j].id)) {
        const [plan] = deck.splice(j, 1);
        drawn.push(plan);
        this.yearlyDrawnPlanIds.add(plan.id);
        existingIds.add(plan.id);
        found = true;
        break;
      }
    }
    if (!found) break;  // 没有可用的计划了
  }

  return drawn;
}
```

**Step 4: 重写 startPlanSelectionForPlayer**

```typescript
/**
 * 大二起：每年开始时的培养计划选择流程
 * 每个玩家顺序执行：抽3张 → 根据状态决定流程
 */
private startPlanSelectionForPlayer(eligiblePlayers: Player[], playerIdx: number): void {
  const state = this.engine.getState();

  if (playerIdx >= eligiblePlayers.length) {
    // 所有玩家完成 → 将未选择的计划放回牌堆
    this.returnUnselectedPlans();
    // 恢复正常游戏流程
    const currentPlayer = state.players[state.currentPlayerIndex];
    state.pendingAction = {
      id: `roll_dice_${Date.now()}`,
      playerId: currentPlayer.id,
      type: 'roll_dice',
      prompt: '请投骰子',
      timeoutMs: 60000,
    };
    this.broadcastState();
    return;
  }

  const player = eligiblePlayers[playerIdx];
  const drawnPlans = this.drawPlansForPlayer(player);

  if (drawnPlans.length === 0) {
    this.addLog(player.id, `${player.name} 升学阶段：牌堆已空，跳过`);
    this.startPlanSelectionForPlayer(eligiblePlayers, playerIdx + 1);
    return;
  }

  // 临时存储抽到的计划
  this.redrawDrawnPlanIds.set(player.id, drawnPlans.map(p => p.id));
  // 将抽到的计划暂存到玩家的 trainingPlans 中（方便UI展示）
  // 但不设置 major/minor
  const tempPlanIds = drawnPlans.map(p => p.id);
  for (const plan of drawnPlans) {
    if (!player.trainingPlans.find(p => p.id === plan.id)) {
      player.trainingPlans.push(plan);
    }
  }

  const hasPlan = player.majorPlan !== null;
  const ctx = { eligiblePlayers, playerIdx, drawnPlanIds: tempPlanIds };

  if (!hasPlan) {
    // 无培养计划：必须选1-2项加入
    this.showPlanSelection(player, drawnPlans, ctx, 1, Math.min(2, player.planSlotLimit));
  } else {
    // 有培养计划：先选择「不调整」或「调整」
    state.pendingAction = {
      id: `plan_adjust_${Date.now()}`,
      playerId: player.id,
      type: 'choose_option',
      prompt: `升学阶段：${player.name}，你已有培养计划（主修: ${player.trainingPlans.find(p => p.id === player.majorPlan)?.name || '无'}），是否调整？`,
      options: [
        { label: '不调整', value: 'keep', description: '保留当前主修和辅修方向' },
        { label: '调整培养计划', value: 'adjust', description: `从新抽到的${drawnPlans.length}张计划中选择加入` },
      ],
      callbackHandler: 'plan_adjust_choice',
      timeoutMs: 60000,
    };

    this.engine.getEventHandler().registerHandler('plan_adjust_choice', (_eng, pid, choice) => {
      if (choice === 'keep' || !choice) {
        // 不调整，放回抽到的计划
        this.discardTempDrawnPlans(pid, ctx.drawnPlanIds);
        this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
      } else {
        // 调整
        const p = this.engine.getPlayer(pid);
        if (p) {
          this.showPlanSelection(p, drawnPlans, ctx, 1, Math.min(2, p.planSlotLimit));
        }
      }
      return null;
    });

    this.broadcastState();
  }
}
```

**Step 5: showPlanSelection 方法**

```typescript
/**
 * 展示计划选择界面（选择1-N项加入培养列表）
 */
private showPlanSelection(
  player: Player,
  drawnPlans: TrainingPlan[],
  ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
  minSelect: number,
  maxSelect: number,
): void {
  const state = this.engine.getState();
  const options = drawnPlans.map(p => ({
    label: p.name,
    value: p.id,
    description: `胜利条件: ${p.winCondition}${p.passiveAbility ? '\n被动能力: ' + p.passiveAbility : ''}`,
  }));

  state.pendingAction = {
    id: `plan_select_${Date.now()}`,
    playerId: player.id,
    type: 'choose_option',
    prompt: `升学阶段：${player.name}，选择${minSelect}-${maxSelect}项培养计划加入`,
    options,
    maxSelections: maxSelect,
    minSelections: minSelect,
    callbackHandler: 'plan_select_handler',
    timeoutMs: 60000,
  };

  this.engine.getEventHandler().registerHandler('plan_select_handler', (_eng, pid, choice) => {
    this.handlePlanSelectionResponse(pid, choice, ctx);
    return null;
  });

  this.broadcastState();
}
```

**Step 6: handlePlanSelectionResponse 方法**

```typescript
private handlePlanSelectionResponse(
  playerId: string,
  choice: string | undefined,
  ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
): void {
  const selectedIds = (!choice || choice === 'skip') ? [] : choice.split(',');
  const player = this.engine.getPlayer(playerId);
  if (!player) {
    this.discardTempDrawnPlans(playerId, ctx.drawnPlanIds);
    this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
    return;
  }

  if (selectedIds.length === 0) {
    this.discardTempDrawnPlans(playerId, ctx.drawnPlanIds);
    this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
    return;
  }

  // 将选中的计划加入培养列表（暂不设置主修/辅修）
  // 先处理溢出：如果加入后超过 planSlotLimit
  const existingPlanIds = getPlayerPlanIds(player);
  const allPlanIds = [...existingPlanIds, ...selectedIds];

  if (allPlanIds.length > player.planSlotLimit) {
    // 需要选择保留哪些
    this.showPlanOverflowSelection(player, allPlanIds, ctx);
  } else {
    // 不超出，直接进入主修设置
    this.showMajorSelection(player, allPlanIds, ctx);
  }
}
```

**Step 7: showPlanOverflowSelection 方法**

```typescript
private showPlanOverflowSelection(
  player: Player,
  allPlanIds: string[],
  ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
): void {
  const state = this.engine.getState();
  const options = allPlanIds.map(id => {
    const plan = player.trainingPlans.find(p => p.id === id);
    return {
      label: plan?.name || id,
      value: id,
      description: plan ? `胜利条件: ${plan.winCondition}` : undefined,
    };
  });

  state.pendingAction = {
    id: `plan_overflow_${Date.now()}`,
    playerId: player.id,
    type: 'choose_option',
    prompt: `你有${allPlanIds.length}个计划（上限${player.planSlotLimit}），选择要保留的（1-${player.planSlotLimit}个）：`,
    options,
    maxSelections: player.planSlotLimit,
    minSelections: 1,
    callbackHandler: 'plan_overflow_handler',
    timeoutMs: 60000,
  };

  this.engine.getEventHandler().registerHandler('plan_overflow_handler', (_eng, pid, choice) => {
    const keepIds = (!choice || choice === 'skip') ? [] : choice.split(',');
    const p = this.engine.getPlayer(pid);
    if (p && keepIds.length > 0) {
      this.showMajorSelection(p, keepIds, ctx);
    } else {
      this.discardTempDrawnPlans(pid, ctx.drawnPlanIds);
      this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
    }
    return null;
  });

  this.broadcastState();
}
```

**Step 8: showMajorSelection 方法**

```typescript
/**
 * 让玩家从保留的计划中选择主修方向
 */
private showMajorSelection(
  player: Player,
  keepPlanIds: string[],
  ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
): void {
  const state = this.engine.getState();
  const oldMajor = player.majorPlan;

  if (keepPlanIds.length === 1) {
    // 只有一个计划，自动设为主修
    this.finalizePlanSelection(player, keepPlanIds[0], [], oldMajor, ctx);
    return;
  }

  const options = keepPlanIds.map(id => {
    const plan = player.trainingPlans.find(p => p.id === id);
    return {
      label: plan?.name || id,
      value: id,
      description: plan?.passiveAbility ? `被动能力: ${plan.passiveAbility}` : '无被动能力',
    };
  });

  state.pendingAction = {
    id: `plan_major_${Date.now()}`,
    playerId: player.id,
    type: 'choose_option',
    prompt: `选择你的主修方向（只有主修的被动效果生效）：`,
    options,
    maxSelections: 1,
    minSelections: 1,
    callbackHandler: 'plan_major_handler',
    timeoutMs: 60000,
  };

  this.engine.getEventHandler().registerHandler('plan_major_handler', (_eng, pid, choice) => {
    const p = this.engine.getPlayer(pid);
    if (p && choice) {
      const majorId = choice.split(',')[0];
      const minorIds = keepPlanIds.filter(id => id !== majorId);
      this.finalizePlanSelection(p, majorId, minorIds, oldMajor, ctx);
    } else {
      this.discardTempDrawnPlans(pid, ctx.drawnPlanIds);
      this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
    }
    return null;
  });

  this.broadcastState();
}
```

**Step 9: finalizePlanSelection 方法**

```typescript
/**
 * 最终确定培养计划选择：设置主修/辅修，清理临时计划，触发效果
 */
private finalizePlanSelection(
  player: Player,
  majorId: string,
  minorIds: string[],
  oldMajor: string | null,
  ctx: { eligiblePlayers: Player[]; playerIdx: number; drawnPlanIds: string[] },
): void {
  const keepIds = [majorId, ...minorIds];

  // 更新 trainingPlans：只保留选中的
  player.trainingPlans = player.trainingPlans.filter(p => keepIds.includes(p.id));
  player.majorPlan = majorId;
  player.minorPlans = minorIds;

  const majorName = player.trainingPlans.find(p => p.id === majorId)?.name || majorId;
  this.addLog(player.id, `${player.name} 设置主修方向: ${majorName}`);
  if (minorIds.length > 0) {
    const minorNames = minorIds.map(id => player.trainingPlans.find(p => p.id === id)?.name || id);
    this.addLog(player.id, `${player.name} 辅修方向: ${minorNames.join(', ')}`);
  }

  // 将未选中的抽取计划放回牌堆
  this.discardTempDrawnPlans(player.id, ctx.drawnPlanIds.filter(id => !keepIds.includes(id)));

  // 主修方向变化时触发 on_confirm 效果
  if (majorId !== oldMajor) {
    this.triggerPlanConfirmEffects(player.id, majorId);
    // 检查是否有 post-confirm action
    const postAction = this.createPostConfirmAction(player, player.id);
    if (postAction) {
      this.pendingConfirmContext = {
        ...ctx,
        needsGeneralMove: false,
      };
      const state = this.engine.getState();
      state.pendingAction = postAction;
      this.broadcastState();
      return;
    }
  }

  // 继续下一个玩家
  this.startPlanSelectionForPlayer(ctx.eligiblePlayers, ctx.playerIdx + 1);
}
```

**Step 10: discardTempDrawnPlans 辅助方法**

```typescript
/**
 * 将临时抽取的、未被选中的计划从玩家的 trainingPlans 中移除并放回牌堆
 */
private discardTempDrawnPlans(playerId: string, planIds: string[]): void {
  const player = this.engine.getPlayer(playerId);
  const state = this.engine.getState();
  if (!player) return;

  for (const planId of planIds) {
    const keepIds = getPlayerPlanIds(player);
    if (!keepIds.includes(planId)) {
      const idx = player.trainingPlans.findIndex(p => p.id === planId);
      if (idx >= 0) {
        const [plan] = player.trainingPlans.splice(idx, 1);
        state.cardDecks.training.push(plan);  // 放回牌堆底部
      }
    }
  }

  // 从当轮追踪中也移除（让后续玩家/年度可以再抽到）
  for (const planId of planIds) {
    const keepIds = getPlayerPlanIds(player);
    if (!keepIds.includes(planId)) {
      this.yearlyDrawnPlanIds.delete(planId);
    }
  }
}
```

**Step 11: returnUnselectedPlans 辅助方法**

```typescript
/**
 * 当轮所有玩家选择完毕后，将仍在临时区域的未选中计划放回牌堆
 */
private returnUnselectedPlans(): void {
  this.yearlyDrawnPlanIds.clear();
  this.redrawDrawnPlanIds.clear();
}
```

**Step 12: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "feat: overhaul yearly plan selection flow with major/minor direction system"
```

---

### Task 12: 更新 PlanAbilities 系统（只检查主修被动效果）

**Files:**
- Modify: `server/src/game/rules/PlanAbilities.ts:38-52` (checkAbilities)
- Modify: `server/src/game/handlers/plan-registry.ts` (如果需要)

**Step 1: 修改 checkAbilities 只检查主修计划**

```typescript
checkAbilities(player: Player, state: GameState, trigger: AbilityTrigger, context?: Partial<PlanAbilityContext>): PlanAbilityResult | null {
  // 只有主修方向的被动效果生效
  if (!player.majorPlan) return null;

  const ability = getPlanAbility(player.majorPlan);
  if (!ability || ability.trigger !== trigger) return null;

  const fullContext: PlanAbilityContext = {
    player,
    state,
    trigger,
    ...context,
  };

  const result = ability.check(fullContext);
  if (result.activated) return result;
  return null;
}
```

**Step 2: 更新其他检查主修计划的地方**

在 GameEngine.ts 中，所有 `player.confirmedPlans.includes('plan_xxx')` 需要改为 `player.majorPlan === 'plan_xxx'`：

- 哲学系 GPA 下限: `player.majorPlan === 'plan_zhexue'`
- 法学院 lawyer shield 等

**Step 3: Commit**

```bash
git add server/src/game/rules/PlanAbilities.ts server/src/game/GameEngine.ts
git commit -m "feat: restrict passive abilities to major plan only"
```

---

### Task 13: 更新胜利条件检查（主修+辅修+基础均可触发）

**Files:**
- Modify: `server/src/game/rules/WinConditionChecker.ts`

**Step 1: 修改 checkWinConditions 方法**

```typescript
checkWinConditions(player: Player, state: GameState, stateTracker: StateTracker): { won: boolean; condition: string } | null {
  if (player.isBankrupt || player.isDisconnected) return null;

  // 检查基础胜利条件
  if (!player.disabledWinConditions.includes('base')) {
    const score = player.gpa * 10 + player.exploration;
    const threshold = player.modifiedWinThresholds['base'] ?? BASE_WIN_THRESHOLD;
    if (score >= threshold) {
      return { won: true, condition: `基础条件达成 (得分 ${score} ≥ ${threshold})` };
    }
  }

  // 检查所有已加入列表的计划（主修+辅修均可触发胜利）
  const allPlanIds = getPlayerPlanIds(player);
  for (const planId of allPlanIds) {
    if (player.disabledWinConditions.includes(planId)) continue;
    const result = this.checkPlanWinCondition(planId, player, state, stateTracker);
    if (result) {
      const plan = player.trainingPlans.find(p => p.id === planId);
      const direction = planId === player.majorPlan ? '主修' : '辅修';
      return {
        won: true,
        condition: `${direction}培养计划「${plan?.name || planId}」: ${result}`,
      };
    }
  }

  return null;
}
```

**Step 2: Commit**

```bash
git add server/src/game/rules/WinConditionChecker.ts
git commit -m "feat: allow victory from major, minor, or base win conditions"
```

---

### Task 14: 全局替换 confirmedPlans 引用

**Files:**
- Modify: 所有引用 `confirmedPlans` 的文件

**Step 1: 搜索并替换所有引用**

使用全局搜索 `confirmedPlans`，在每个文件中按新逻辑更新：

**GameCoordinator.ts 中的引用（约20+处）：**
- `player.confirmedPlans.length` → `getPlayerPlanIds(player).length`
- `player.confirmedPlans.includes(id)` → `player.majorPlan === id || player.minorPlans.includes(id)`
- `player.confirmedPlans.push(id)` → 根据上下文设置 majorPlan 或 minorPlans
- `player.confirmedPlans = ...` → 更新 majorPlan + minorPlans
- `player.confirmedPlans.filter(...)` → 更新相应字段

**card-handlers.ts 中的引用：**
- 跨院准出、专业意向等已在 Task 6 中更新
- 其他引用同样更新

**TrainingPlanView.tsx 中的引用：**
- 在 Task 15 中统一处理

**Step 2: 验证编译通过**

```bash
cd server && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: replace all confirmedPlans references with majorPlan/minorPlans"
```

---

### Task 15: 更新前端 UI 组件

**Files:**
- Modify: `client/src/components/TrainingPlanView.tsx`
- Modify: `client/src/components/CompactHeader.tsx`
- Modify: `client/src/components/SettlementScreen.tsx`

**Step 1: 更新 TrainingPlanView.tsx**

重写组件以支持：
- **大一无计划时：** 显示大一通用buff卡片
- **有计划时：** 标记主修（高亮）和辅修（半透明），移除 confirm 按钮逻辑

核心变更：
```tsx
// 大一buff展示
function FreshmanBuffDisplay() {
  return (
    <div className="freshman-buffs">
      <div className="buff-card active">
        <span className="buff-icon">📚</span>
        <span className="buff-text">所有GPA增加效果翻倍</span>
      </div>
      <div className="buff-card active">
        <span className="buff-icon">🏛️</span>
        <span className="buff-text">鼓楼线所有正面收益翻倍</span>
      </div>
    </div>
  );
}

// 主修/辅修标记
function PlanCard({ plan, isMajor }: { plan: TrainingPlan; isMajor: boolean }) {
  return (
    <div className={`plan-card ${isMajor ? 'major' : 'minor'}`}>
      <div className="plan-header">
        <span className="plan-name">{plan.name}</span>
        <span className={`plan-badge ${isMajor ? 'major' : 'minor'}`}>
          {isMajor ? '主修' : '辅修'}
        </span>
      </div>
      <div className="plan-win">{plan.winCondition}</div>
      {isMajor && plan.passiveAbility && (
        <div className="plan-passive">{plan.passiveAbility}</div>
      )}
      {/* 进度条等 */}
    </div>
  );
}
```

逻辑判断：
```tsx
const currentPlayer = gameState.players.find(p => p.id === myPlayerId);
const hasPlan = currentPlayer?.majorPlan != null;
const isFreshman = gameState.roundNumber === 1;

return (
  <div className="training-plan-view">
    {isFreshman && !hasPlan ? (
      <FreshmanBuffDisplay />
    ) : (
      <>
        {isFreshman && <FreshmanBuffDisplay />}
        {currentPlayer?.trainingPlans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isMajor={plan.id === currentPlayer.majorPlan}
          />
        ))}
      </>
    )}
  </div>
);
```

**Step 2: 更新 CompactHeader.tsx**

在学年显示旁添加大一buff指示器：
```tsx
{gameState.roundNumber === 1 && (
  <span className="buff-indicator" title="大一通用Buff生效中">⚡</span>
)}
```

**Step 3: 更新 SettlementScreen.tsx**

在结算界面显示玩家的主修/辅修方向：
```tsx
// 在玩家详情中显示
<div className="player-plans">
  {player.majorPlan && (
    <span className="major-tag">主修: {player.trainingPlans.find(p => p.id === player.majorPlan)?.name}</span>
  )}
  {player.minorPlans.map(id => (
    <span key={id} className="minor-tag">辅修: {player.trainingPlans.find(p => p.id === id)?.name}</span>
  ))}
</div>
```

**Step 4: Commit**

```bash
git add client/src/components/TrainingPlanView.tsx client/src/components/CompactHeader.tsx client/src/components/SettlementScreen.tsx
git commit -m "feat: update UI for freshman buffs and major/minor plan display"
```

---

### Task 16: 更新测试和集成验证

**Files:**
- Modify: `server/src/game/__tests__/GameCoordinator.test.ts`
- Run existing tests

**Step 1: 更新测试中的 confirmedPlans 引用**

搜索测试文件中所有 `confirmedPlans` 引用，替换为 `majorPlan` / `minorPlans`。

**Step 2: 添加核心功能测试用例**

```typescript
describe('Training Plan Overhaul', () => {
  it('should apply freshman GPA buff (double GPA increase) in round 1', () => {
    // Setup: roundNumber = 1, apply GPA +0.2
    // Expect: actual GPA increase = 0.4
  });

  it('should not apply freshman GPA buff in round 2', () => {
    // Setup: roundNumber = 2, apply GPA +0.2
    // Expect: actual GPA increase = 0.2
  });

  it('should not double GPA decrease in round 1', () => {
    // Setup: roundNumber = 1, apply GPA -0.2
    // Expect: actual GPA decrease = 0.2
  });

  it('should skip setup_plans phase and start playing directly', () => {
    // Expect: game starts in 'playing' phase with roundNumber = 1
  });

  it('should only check major plan passive abilities', () => {
    // Setup: player with major and minor plans
    // Expect: only major plan passive triggers
  });

  it('should allow victory from minor plan win condition', () => {
    // Setup: player satisfies minor plan win condition
    // Expect: win is detected
  });
});
```

**Step 3: 运行测试**

```bash
cd server && npm test
```

**Step 4: Commit**

```bash
git add server/src/game/__tests__/
git commit -m "test: update tests for training plan overhaul"
```

---

### Task 17: 编译验证和最终清理

**Step 1: 全项目编译检查**

```bash
cd shared && npx tsc --noEmit
cd ../server && npx tsc --noEmit
cd ../client && npx tsc --noEmit
```

**Step 2: 清理遗留代码**

- 移除 `setup_plans` 相关的废弃代码
- 移除 `TrainingPlan.confirmed` 字段的所有引用
- 移除 `maxWinConditionSlots` 字段（如果不再需要）
- 确保没有遗留的 `confirmedPlans` 引用

**Step 3: 最终 commit**

```bash
git add -A
git commit -m "chore: final cleanup after training plan overhaul"
```
