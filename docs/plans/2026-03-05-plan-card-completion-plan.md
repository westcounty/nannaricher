# 培养计划效果 & 手牌使用 完善 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 补全所有培养计划被动效果、胜利条件、手牌使用handler，以及通用确认效果，确保游戏中所有机制真正生效。

**Architecture:** 分5个批次实现：(1)effect检查基础设施，(2)20张手牌handler注册，(3)10个计划customEffect实现，(4)通用确认移动+确认流程修复，(5)构建验证。所有修改集中在server端GameEngine/GameCoordinator/card-handlers和shared types中。

**Tech Stack:** TypeScript, Socket.io, Vitest

---

## 重要发现

### 确认流程当前Bug
1. `plan_confirmation_handler`（GameCoordinator.ts:212）直接 push confirmedPlans，没有调用 `handleConfirmPlan()`，所以所有 `on_confirm` 效果（商学院移动、外国语抽卡等）在6回合确认时不会触发
2. 只有第一个eligible玩家能确认，后续玩家被跳过
3. setup_plans 阶段的 handleConfirmPlan 可以正常触发效果（因为走了不同路径）

### 确认结算顺序设计
当多个玩家在同一轮升学阶段确认计划时：
- 按玩家顺序（从当前玩家开始）逐个确认
- 每个玩家确认后，先执行专属 on_confirm 效果，再提供通用移动选项
- 一个玩家的所有确认效果完成后，才轮到下一个玩家
- 所有玩家确认完毕后，回到当前玩家的正常 roll_dice

---

### Task 1: Effect 检查基础设施 — GameEngine 资源守卫

**Files:**
- Modify: `server/src/game/GameEngine.ts:206-295`

**Step 1: 在 modifyPlayerMoney 中添加 effect 检查**

在 `modifyPlayerMoney`（line 206）的 `delta < 0` 分支中，在法学院护盾检查之后、实际修改之前，添加：

```typescript
// After lawyerShield check (line 225), before line 227:

// Card effect: blockMoneyLoss (投石问路)
if (delta < 0) {
  const blockEffect = player.effects.find(
    e => e.type === 'custom' && e.data?.blockMoneyLoss
  );
  if (blockEffect) {
    player.effects = player.effects.filter(e => e !== blockEffect);
    this.log('投石问路：抵消本次金钱损失', playerId);
    return;
  }

  // Card effect: negateExpense (余额为负) — only if expense >= current money
  const negateEffect = player.effects.find(
    e => e.type === 'custom' && e.data?.negateExpense
  );
  if (negateEffect && Math.abs(delta) >= player.money) {
    player.effects = player.effects.filter(e => e !== negateEffect);
    this.log('余额为负：抵消本次大额支出', playerId);
    return;
  }
}
```

**Step 2: 在 modifyPlayerGpa 中添加 effect 检查**

在 `modifyPlayerGpa`（line 255）的哲学系检查之前，添加：

```typescript
// Before line 262 (philosophy check):
if (delta < 0) {
  const blockEffect = player.effects.find(
    e => e.type === 'custom' && e.data?.blockGpaLoss
  );
  if (blockEffect) {
    player.effects = player.effects.filter(e => e !== blockEffect);
    this.log('祖传试卷：抵消本次GPA损失', playerId);
    return;
  }
}
```

**Step 3: 在 modifyPlayerExploration 中添加 effect 检查**

在 `modifyPlayerExploration`（line 282）的修改之前，添加：

```typescript
// Before line 286:
if (delta < 0) {
  const blockEffect = player.effects.find(
    e => e.type === 'custom' && e.data?.blockExplorationLoss
  );
  if (blockEffect) {
    player.effects = player.effects.filter(e => e !== blockEffect);
    this.log('校园传说：抵消本次探索值损失', playerId);
    return;
  }
}
```

**Step 4: 在 movePlayerTo 中添加环境学院 on_move 检查**

在 `movePlayerTo`（line 304）中，position 赋值后、checkAndUpdateSharedCells 之前，添加：

```typescript
// After line 309 (player.position = position):
// 环境学院能力: +2探索 on direct move
if (player.confirmedPlans.includes('plan_huanjing')) {
  this.modifyPlayerExploration(playerId, 2);
  this.log('环境学院能力：直接移动 +2探索值', playerId);
}
```

**Step 5: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add server/src/game/GameEngine.ts
git commit -m "feat: add effect guards in GameEngine resource modifiers"
```

---

### Task 2: 手牌 Handler — 命运卡 (14张)

**Files:**
- Modify: `server/src/game/handlers/card-handlers.ts` (在 line 1300 `console.log` 之前添加)

**Step 1: 添加所有14张命运卡的 handler**

在 `registerCardHandlers` 函数中，`console.log('[CardHandlers]...')` 之前，添加：

```typescript
  // ==========================================
  // Holdable Destiny Card Handlers (14 cards)
  // ==========================================

  // 麦门护盾 — 食堂线屏蔽负面效果
  eventHandler.registerHandler('card_destiny_maimen_shield', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `food_shield_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { foodShield: true },
    });
    engine.log('使用麦门护盾：下次食堂线屏蔽负面效果', playerId);
    return null;
  });

  // 及时止损 — 取消自己即将执行的事件
  eventHandler.registerHandler('card_destiny_stop_loss', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `cancel_event_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 1,
      data: { cancelNextEvent: true },
    });
    engine.log('使用及时止损：取消下一次格子事件', playerId);
    return null;
  });

  // 工期紧迫 — 直接离开医院/鼎
  eventHandler.registerHandler('card_destiny_urgent_deadline', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    if (player.isInHospital) {
      engine.setPlayerHospitalStatus(playerId, false);
      engine.log('使用工期紧迫：直接出院', playerId);
    } else if (player.isAtDing) {
      engine.setPlayerDingStatus(playerId, false);
      engine.log('使用工期紧迫：直接离开鼎', playerId);
    } else {
      engine.log('工期紧迫：当前不在医院或鼎，无效果', playerId);
    }
    return null;
  });

  // 余额为负 — 抵消一次大额支出
  eventHandler.registerHandler('card_destiny_negative_balance', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `negate_expense_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { negateExpense: true },
    });
    engine.log('使用余额为负：可抵消一次大额支出', playerId);
    return null;
  });

  // 祖传试卷 — 抵消一次GPA负面
  eventHandler.registerHandler('card_destiny_inherited_papers', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `block_gpa_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { blockGpaLoss: true },
    });
    engine.log('使用祖传试卷：可抵消一次GPA损失', playerId);
    return null;
  });

  // 投石问路 — 抵消一次金钱负面
  eventHandler.registerHandler('card_destiny_throw_stone', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `block_money_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { blockMoneyLoss: true },
    });
    engine.log('使用投石问路：可抵消一次金钱损失', playerId);
    return null;
  });

  // 校园传说（手牌版）— 抵消一次探索值负面
  eventHandler.registerHandler('card_destiny_campus_legend', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `block_explore_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { blockExplorationLoss: true },
    });
    engine.log('使用校园传说：可抵消一次探索值损失', playerId);
    return null;
  });

  // 另辟蹊径 — 在线内直接移到终点，不领经验卡
  eventHandler.registerHandler('card_destiny_alternative_path', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    if (player.position.type !== 'line') {
      engine.log('另辟蹊径：当前不在支线内，无法使用', playerId);
      return null;
    }
    engine.exitLine(playerId, false); // false = 不领取经验卡
    engine.log('使用另辟蹊径：直接离开支线，不领取经验卡', playerId);
    return null;
  });

  // 大类招生 — 延迟一回合选定培养计划
  eventHandler.registerHandler('card_destiny_major_admission', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `delay_plan_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 1,
      data: { delayPlanConfirm: true },
    });
    engine.log('使用大类招生：延迟一回合选定培养计划', playerId);
    return null;
  });

  // 跨院准出 — 取消一个已固定的培养方案
  eventHandler.registerHandler('card_destiny_cross_college_exit', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player || player.confirmedPlans.length === 0) {
      engine.log('跨院准出：没有已确认的培养方案', playerId);
      return null;
    }
    const options = player.confirmedPlans.map(planId => {
      const plan = player.trainingPlans.find(p => p.id === planId);
      return { label: `取消: ${plan?.name || planId}`, value: planId };
    });
    return engine.createPendingAction(
      playerId, 'choose_option', '选择要取消的培养方案', options
    );
  });

  // 跨院准出 — 回调
  eventHandler.registerHandler('card_cross_college_choice', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (!player || !choice) return null;
    player.confirmedPlans = player.confirmedPlans.filter(id => id !== choice);
    const plan = player.trainingPlans.find(p => p.id === choice);
    if (plan) plan.confirmed = false;
    engine.log(`跨院准出：取消了培养方案 ${plan?.name || choice}`, playerId);
    return null;
  });

  // 专业意向 — 提前一回合固定培养方案
  eventHandler.registerHandler('card_destiny_professional_intention', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    const unconfirmed = player.trainingPlans.filter(p => !player.confirmedPlans.includes(p.id));
    if (unconfirmed.length === 0) {
      engine.log('专业意向：没有可确认的培养方案', playerId);
      return null;
    }
    const options = unconfirmed.map(p => ({ label: `确认: ${p.name}`, value: p.id }));
    const action = engine.createPendingAction(
      playerId, 'choose_option', '选择要提前确认的培养方案', options
    );
    if (action) action.callbackHandler = 'card_professional_intention_choice';
    return action;
  });

  eventHandler.registerHandler('card_professional_intention_choice', (engine, playerId, choice) => {
    const player = engine.getPlayer(playerId);
    if (!player || !choice) return null;
    const plan = player.trainingPlans.find(p => p.id === choice);
    if (plan) {
      plan.confirmed = true;
      if (!player.confirmedPlans.includes(plan.id)) {
        player.confirmedPlans.push(plan.id);
      }
      engine.modifyPlayerGpa(playerId, 0.1);
      engine.modifyPlayerExploration(playerId, 1);
      engine.log(`专业意向：提前确认 ${plan.name}，+0.1GPA +1探索`, playerId);
    }
    return null;
  });

  // 轻车熟路 — exitLine 后回到线起点重新进入
  eventHandler.registerHandler('card_destiny_familiar_route', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `reenter_line_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { reenterLine: true },
    });
    engine.log('使用轻车熟路：下次离开线路后可重新进入', playerId);
    return null;
  });

  // 如何解释 — 取消本次格子事件
  eventHandler.registerHandler('card_destiny_how_to_explain', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `cancel_event_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 1,
      data: { cancelNextEvent: true },
    });
    engine.log('使用如何解释：取消本次格子事件', playerId);
    return null;
  });

  // 鼓点重奏 — 投两次骰子选一次
  eventHandler.registerHandler('card_destiny_drum_beat_return', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `double_dice_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 1,
      data: { doubleDiceChoice: true },
    });
    engine.log('使用鼓点重奏：下次投骰可投两次选一', playerId);
    return null;
  });
```

注意：`card_destiny_cross_college_exit` 的 PendingAction 需要设置 `callbackHandler`。创建PendingAction后手动设置：

```typescript
  // 修改 card_destiny_cross_college_exit handler 的 return:
  // 在 createPendingAction 之后添加
  // action.callbackHandler = 'card_cross_college_choice';
```

**Step 2: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add server/src/game/handlers/card-handlers.ts
git commit -m "feat: register handlers for 14 holdable destiny cards"
```

---

### Task 3: 手牌 Handler — 机会卡 (6张)

**Files:**
- Modify: `server/src/game/handlers/card-handlers.ts`

**Step 1: 添加6张机会卡的 handler**

在命运卡handlers之后、`console.log` 之前添加：

```typescript
  // ==========================================
  // Holdable Chance Card Handlers (6 cards)
  // ==========================================

  // 消息闭塞 — 抵消一次机会卡效果（全局effect，暂简化为给自己添加屏蔽）
  eventHandler.registerHandler('card_chance_info_blocked', (engine, playerId) => {
    const state = engine.getState();
    state.players.forEach(p => {
      if (p.id !== playerId && !p.isBankrupt) {
        p.effects.push({
          id: `block_chance_${Date.now()}`,
          type: 'custom',
          turnsRemaining: 999,
          data: { blockNextChanceCard: true },
        });
      }
    });
    engine.log('使用消息闭塞：下次任意玩家的机会卡效果将被抵消', playerId);
    return null;
  });

  // 虚晃一枪 — 抵消一次命运卡效果
  eventHandler.registerHandler('card_chance_false_move', (engine, playerId) => {
    const state = engine.getState();
    state.players.forEach(p => {
      if (p.id !== playerId && !p.isBankrupt) {
        p.effects.push({
          id: `block_destiny_${Date.now()}`,
          type: 'custom',
          turnsRemaining: 999,
          data: { blockNextDestinyCard: true },
        });
      }
    });
    engine.log('使用虚晃一枪：下次任意玩家的命运卡效果将被抵消', playerId);
    return null;
  });

  // 画饼充饥 — 取消他人的下次事件
  eventHandler.registerHandler('card_chance_pie_in_sky', (engine, playerId) => {
    const state = engine.getState();
    const others = state.players
      .filter(p => p.id !== playerId && !p.isBankrupt)
      .map(p => ({ label: p.name, value: p.id }));
    if (others.length === 0) return null;
    const action = engine.createPendingAction(
      playerId, 'choose_option', '画饼充饥：选择一位玩家取消其下次事件', others
    );
    if (action) action.callbackHandler = 'card_pie_in_sky_target';
    return action;
  });

  eventHandler.registerHandler('card_pie_in_sky_target', (engine, playerId, targetId) => {
    if (!targetId) return null;
    const target = engine.getPlayer(targetId);
    if (!target) return null;
    target.effects.push({
      id: `cancel_event_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { cancelNextEvent: true },
    });
    engine.log(`画饼充饥：${target.name} 的下次事件将被取消`, playerId);
    return null;
  });

  // 一跃愁解 — 指定一位玩家，下次事件增减反转
  eventHandler.registerHandler('card_chance_one_jump_relief', (engine, playerId) => {
    const state = engine.getState();
    const others = state.players
      .filter(p => p.id !== playerId && !p.isBankrupt)
      .map(p => ({ label: p.name, value: p.id }));
    if (others.length === 0) return null;
    const action = engine.createPendingAction(
      playerId, 'choose_option', '一跃愁解：选择一位玩家，其下次事件效果反转', others
    );
    if (action) action.callbackHandler = 'card_one_jump_target';
    return action;
  });

  eventHandler.registerHandler('card_one_jump_target', (engine, playerId, targetId) => {
    if (!targetId) return null;
    const target = engine.getPlayer(targetId);
    if (!target) return null;
    target.effects.push({
      id: `reverse_effects_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { reverseEffects: true },
    });
    engine.log(`一跃愁解：${target.name} 的下次事件效果将反转`, playerId);
    return null;
  });

  // 停水停电 — 禁止一位玩家行动
  eventHandler.registerHandler('card_chance_water_power_outage', (engine, playerId) => {
    const state = engine.getState();
    const others = state.players
      .filter(p => p.id !== playerId && !p.isBankrupt)
      .map(p => ({ label: p.name, value: p.id }));
    if (others.length === 0) return null;
    const action = engine.createPendingAction(
      playerId, 'choose_option', '停水停电：选择一位玩家跳过其下次行动', others
    );
    if (action) action.callbackHandler = 'card_water_power_target';
    return action;
  });

  eventHandler.registerHandler('card_water_power_target', (engine, playerId, targetId) => {
    if (!targetId) return null;
    const target = engine.getPlayer(targetId);
    if (!target) return null;
    engine.skipPlayerTurn(targetId, 1);
    engine.log(`停水停电：${target.name} 将跳过下次行动`, playerId);
    return null;
  });

  // 补天计划 — 当其他玩家胜利时你可以行动
  // 这张卡的效果是存储性的：持有即生效，在 checkWinCondition 时检查
  eventHandler.registerHandler('card_chance_mending_plan', (engine, playerId) => {
    const player = engine.getPlayer(playerId);
    if (!player) return null;
    player.effects.push({
      id: `mending_plan_${Date.now()}`,
      type: 'custom',
      turnsRemaining: 999,
      data: { mendingPlan: true },
    });
    engine.log('使用补天计划：当其他玩家即将胜利时，你可以行动', playerId);
    return null;
  });
```

**Step 2: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit`

**Step 3: Commit**

```bash
git add server/src/game/handlers/card-handlers.ts
git commit -m "feat: register handlers for 6 holdable chance cards"
```

---

### Task 4: handleCellLanding — cancelNextEvent 和 foodShield 检查

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:892-996`

**Step 1: 在 handleCellLanding 开头添加 cancelNextEvent 检查**

在 `handleCellLanding` 方法中，on_cell_enter plan ability 检查之前（约line 897），添加：

```typescript
    // Check cancelNextEvent effect (及时止损/如何解释/画饼充饥)
    if (player) {
      const cancelIdx = player.effects.findIndex(
        e => e.type === 'custom' && e.data?.cancelNextEvent
      );
      if (cancelIdx >= 0) {
        player.effects.splice(cancelIdx, 1);
        this.addLog(playerId, '事件被取消（及时止损/如何解释/画饼充饥）');
        this.broadcastState();
        if (state.phase === 'playing') {
          if (this.checkAndEmitWin()) return;
          this.advanceTurn();
        }
        return;
      }
    }
```

**Step 2: 在食堂线事件触发处添加 foodShield 检查**

在处理 line cell 事件的部分（handleCellLanding 中 position.type === 'line' 分支），在执行 handler 之前添加：

```typescript
    // Check foodShield for food line negative events
    if (player && position.lineId === 'food') {
      const shieldIdx = player.effects.findIndex(
        e => e.type === 'custom' && e.data?.foodShield
      );
      if (shieldIdx >= 0) {
        // Shield blocks negative events on food line
        player.effects.splice(shieldIdx, 1);
        this.addLog(playerId, '麦门护盾：屏蔽食堂线负面效果');
        this.broadcastState();
        if (state.phase === 'playing') {
          if (this.checkAndEmitWin()) return;
          this.advanceTurn();
        }
        return;
      }
    }
```

注意：实际游戏中食堂线有正面也有负面事件，这里简化为护盾屏蔽所有食堂线事件（与规则书"屏蔽负面效果"一致，但判断正负需要事件handler自身报告）。简化为：使用护盾后跳过当前食堂线格子事件。

**Step 3: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit`

**Step 4: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "feat: add cancelNextEvent and foodShield checks in handleCellLanding"
```

---

### Task 5: handleRollDice — doubleDiceChoice 和 forcedDice 检查

**Files:**
- Modify: `server/src/game/GameCoordinator.ts` (handleRollDice 方法)

**Step 1: 在 handleRollDice 中添加 doubleDiceChoice 检查**

在 `handleRollDice` 中，投骰后（`engine.rollDice` 调用之后，移动之前），检查鼓点重奏effect：

```typescript
    // Check doubleDiceChoice effect (鼓点重奏)
    const doubleDiceEffect = currentPlayer.effects.find(
      e => e.type === 'custom' && e.data?.doubleDiceChoice
    );
    if (doubleDiceEffect) {
      currentPlayer.effects = currentPlayer.effects.filter(e => e !== doubleDiceEffect);
      // Roll a second set of dice
      const values2 = this.engine.rollDice(currentPlayer.diceCount);
      const total2 = values2.reduce((a, b) => a + b, 0);
      this.io.to(this.roomId).emit('game:dice-result', {
        playerId, values: values2, total: total2,
      });
      // Create a choice between the two rolls
      state.pendingAction = {
        id: `drum_beat_choice_${Date.now()}`,
        playerId,
        type: 'choose_option',
        prompt: `鼓点重奏：选择一次结果 (第一次: ${total}, 第二次: ${total2})`,
        options: [
          { label: `使用第一次 (${total})`, value: `drum_${total}` },
          { label: `使用第二次 (${total2})`, value: `drum_${total2}` },
        ],
        callbackHandler: 'drum_beat_choice',
        timeoutMs: 30000,
      };
      // Register handler
      if (!this.engine.getEventHandler().hasHandler('drum_beat_choice')) {
        this.engine.getEventHandler().registerHandler('drum_beat_choice', (eng, pid, choice) => {
          if (!choice) return null;
          const chosenTotal = parseInt(choice.replace('drum_', ''), 10);
          eng.movePlayerForward(pid, chosenTotal);
          return null;
        });
      }
      this.broadcastState();
      return;
    }

    // Check forcedDice effect (数学系: 指定骰子点数)
    const forcedDiceEffect = currentPlayer.effects.find(
      e => e.type === 'custom' && e.data?.forcedDice
    );
    if (forcedDiceEffect) {
      const forcedValue = forcedDiceEffect.data.forcedDice as number;
      currentPlayer.effects = currentPlayer.effects.filter(e => e !== forcedDiceEffect);
      total = forcedValue;
      values = [forcedValue];
      this.addLog(playerId, `数学系能力：使用指定骰子点数 ${forcedValue}`);
      this.io.to(this.roomId).emit('game:dice-result', {
        playerId, values, total,
      });
    }

    // Check moveModifier effect (物理学院: 双倍前进/后退)
    const moveModifier = currentPlayer.effects.find(
      e => e.type === 'custom' && e.data?.moveModifier
    );
    if (moveModifier) {
      currentPlayer.effects = currentPlayer.effects.filter(e => e !== moveModifier);
      const mod = moveModifier.data.moveModifier as string;
      if (mod === 'double_forward') {
        total = total * 2;
        this.addLog(playerId, `物理学院能力：双倍前进 ${total} 步`);
      } else if (mod === 'double_backward') {
        this.engine.movePlayerBackward(playerId, total * 2);
        this.addLog(playerId, `物理学院能力：后退 ${total * 2} 步`);
        this.handleCellLanding(playerId, this.engine.getPlayer(playerId)!.position);
        this.broadcastState();
        return;
      }
    }
```

**Step 2: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit`

**Step 3: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "feat: add doubleDice, forcedDice, moveModifier checks in handleRollDice"
```

---

### Task 6: 培养计划 on_turn_start customEffect 实现 (物理学院 + 化学化工)

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:238-294` (advanceTurn on_turn_start 分支)

**Step 1: 添加 wuli_double_move 和 huaxue_disable 处理**

在 `advanceTurn()` 中，kuangyaming_bonus 的 if 块之后（约line 293），`// wuli/huaxue: complex effects` 注释替换为：

```typescript
      if (ce === 'wuli_double_move') {
        state.pendingAction = {
          id: `wuli_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'choose_option',
          prompt: '物理学院能力：选择本回合移动方式',
          options: [
            { label: '正常移动', value: 'wuli_normal' },
            { label: '双倍前进', value: 'wuli_double_forward' },
            { label: '双倍后退', value: 'wuli_double_backward' },
          ],
          callbackHandler: 'plan_wuli_choice',
          timeoutMs: 15000,
        };
        if (!this.engine.getEventHandler().hasHandler('plan_wuli_choice')) {
          this.engine.getEventHandler().registerHandler('plan_wuli_choice', (eng, pid, choice) => {
            const p = eng.getPlayer(pid);
            if (!p) return null;
            if (choice === 'wuli_double_forward') {
              p.effects.push({ id: `wuli_mod_${Date.now()}`, type: 'custom', turnsRemaining: 1, data: { moveModifier: 'double_forward' } });
            } else if (choice === 'wuli_double_backward') {
              p.effects.push({ id: `wuli_mod_${Date.now()}`, type: 'custom', turnsRemaining: 1, data: { moveModifier: 'double_backward' } });
            }
            return null;
          });
        }
        this.broadcastState();
        return;
      }
      if (ce === 'huaxue_disable') {
        const cellOptions = [
          { label: '起点', value: 'disable_start' },
          { label: '校医院', value: 'disable_hospital' },
          { label: '鼎', value: 'disable_ding' },
          { label: '候车厅', value: 'disable_waiting_room' },
          { label: '浦口线入口', value: 'disable_line_pukou' },
          { label: '学习线入口', value: 'disable_line_study' },
          { label: '赚钱线入口', value: 'disable_line_money' },
          { label: '苏州线入口', value: 'disable_line_suzhou' },
          { label: '探索线入口', value: 'disable_line_explore' },
          { label: '鼓楼线入口', value: 'disable_line_gulou' },
          { label: '仙林线入口', value: 'disable_line_xianlin' },
          { label: '食堂线入口', value: 'disable_line_food' },
          { label: '不禁用', value: 'disable_none' },
        ];
        state.pendingAction = {
          id: `huaxue_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'choose_option',
          prompt: '化学化工学院能力：选择禁用一个格子或线路入口',
          options: cellOptions,
          callbackHandler: 'plan_huaxue_choice',
          timeoutMs: 15000,
        };
        if (!this.engine.getEventHandler().hasHandler('plan_huaxue_choice')) {
          this.engine.getEventHandler().registerHandler('plan_huaxue_choice', (eng, pid, choice) => {
            if (!choice || choice === 'disable_none') return null;
            const s = eng.getState();
            if (!s.disabledCells) s.disabledCells = [];
            s.disabledCells.push(choice.replace('disable_', ''));
            eng.log(`化学化工学院：禁用 ${choice.replace('disable_', '')} 本回合`, pid);
            return null;
          });
        }
        this.broadcastState();
        return;
      }
```

**Step 2: 在 advanceTurn 开头清空 disabledCells**

在 advanceTurn 的开头部分添加：

```typescript
    // Clear per-turn disabled cells (huaxue ability)
    state.disabledCells = [];
```

**Step 3: 在 shared/src/types.ts 的 GameState 接口中添加 disabledCells**

```typescript
  disabledCells?: string[];
```

**Step 4: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit && npx tsc -p shared/tsconfig.json --noEmit`

**Step 5: Commit**

```bash
git add server/src/game/GameCoordinator.ts shared/src/types.ts
git commit -m "feat: implement wuli_double_move and huaxue_disable plan abilities"
```

---

### Task 7: 培养计划 on_dice_roll (数学系) + on_confirm 一次性效果 (现代工程、大气科学、社会学院、人工智能)

**Files:**
- Modify: `server/src/game/GameCoordinator.ts` (handleRollDice + handleConfirmPlan)
- Modify: `server/src/game/handlers/plan-registry.ts` (修改 trigger 类型)

**Step 1: 数学系 — 投骰后弹出指定选项**

在 handleRollDice 中的 `shuxue_set_dice` 检查处（约line 1231），替换为：

```typescript
    if (diceAbility?.effects?.customEffect === 'shuxue_set_dice') {
      // 数学系: 投骰后提供指定下回合点数的选项
      this.addLog(playerId, diceAbility.message || '数学系能力触发');
      // After completing current move, offer dice control for next turn
      // We add the choice after the current turn's move is complete
      currentPlayer.effects.push({
        id: `shuxue_pending_${Date.now()}`,
        type: 'custom',
        turnsRemaining: 1,
        data: { shuxuePendingChoice: true },
      });
    }
```

然后在 advanceTurn 的 on_turn_start 检查之前，添加数学系的上回合未执行选择检查：

```typescript
    // 数学系: check if player has pending dice control choice from last roll
    const shuxuePending = currentPlayer.effects.find(
      e => e.type === 'custom' && e.data?.shuxuePendingChoice
    );
    if (shuxuePending) {
      currentPlayer.effects = currentPlayer.effects.filter(e => e !== shuxuePending);
      // Offer choice was already triggered, skip here — the forced dice effect was set
    }
```

实际上，更简单的方式是在 handleRollDice 完成移动之后（advanceTurn 之前），检查数学系 effect 并弹出选择。但由于回合流程复杂，简化方案：在 on_dice_roll 触发时直接弹出选择框：

在 handleRollDice 的 shuxue 检查处之后，移动之前：

```typescript
    if (diceAbility?.effects?.customEffect === 'shuxue_set_dice') {
      this.addLog(playerId, diceAbility.message || '数学系能力触发');
      // Store that we need to ask after this turn
      // Will be handled after move completion
    }
```

考虑到复杂性，数学系的实现简化为：每次投骰后自动弹出一个非阻塞的选择（在本回合结束后的 advanceTurn 中）。

**最终简化方案**：在 advanceTurn on_turn_start 分支添加数学系处理：

```typescript
      if (ce === 'shuxue_set_dice') {
        // 数学系实际上是 on_turn_start 类型: 每回合开始选择是否指定下回合骰子
        state.pendingAction = {
          id: `shuxue_${Date.now()}`,
          playerId: currentPlayer.id,
          type: 'choose_option',
          prompt: '数学系能力：是否指定下回合骰子点数？',
          options: [
            { label: '不指定', value: 'shuxue_skip' },
            { label: '指定1', value: 'shuxue_1' },
            { label: '指定2', value: 'shuxue_2' },
            { label: '指定3', value: 'shuxue_3' },
            { label: '指定4', value: 'shuxue_4' },
            { label: '指定5', value: 'shuxue_5' },
            { label: '指定6', value: 'shuxue_6' },
          ],
          callbackHandler: 'plan_shuxue_choice',
          timeoutMs: 15000,
        };
        if (!this.engine.getEventHandler().hasHandler('plan_shuxue_choice')) {
          this.engine.getEventHandler().registerHandler('plan_shuxue_choice', (eng, pid, choice) => {
            if (!choice || choice === 'shuxue_skip') return null;
            const val = parseInt(choice.replace('shuxue_', ''), 10);
            if (val >= 1 && val <= 6) {
              const p = eng.getPlayer(pid);
              if (p) {
                p.effects.push({ id: `forced_dice_${Date.now()}`, type: 'custom', turnsRemaining: 1, data: { forcedDice: val } });
                eng.log(`数学系：指定下回合骰子点数为 ${val}`, pid);
              }
            }
            return null;
          });
        }
        this.broadcastState();
        return;
      }
```

同时修改 plan-registry.ts 中数学系的 trigger 从 `on_dice_roll` 改为 `on_turn_start`。

**Step 2: 现代工程 — 修改为 on_confirm 一次性效果**

在 plan-registry.ts 中修改 `plan_xiandai` 的 trigger 从 `on_card_draw` 改为 `on_confirm`。

在 handleConfirmPlan 的 customEffect 分支添加：

```typescript
      if (fx.customEffect === 'xiandai_assign_card') {
        // 现代工程: 抽一张命运卡并指定玩家执行
        const card = this.engine.drawCard(playerId, 'destiny');
        if (card) {
          this.addLog(playerId, `现代工程学院：抽到命运卡 ${card.name}`);
          const others = state.players
            .filter(p => p.id !== playerId && !p.isBankrupt)
            .map(p => ({ label: `${p.name} 执行`, value: p.id }));
          others.push({ label: '自己执行', value: playerId });
          state.pendingAction = {
            id: `xiandai_${Date.now()}`,
            playerId,
            type: 'choose_option',
            prompt: `选择谁执行命运卡: ${card.name}`,
            options: others,
            callbackHandler: 'plan_xiandai_target',
            timeoutMs: 30000,
          };
          // Store card for later execution
          if (!this.engine.getEventHandler().hasHandler('plan_xiandai_target')) {
            const cardToExecute = card;
            this.engine.getEventHandler().registerHandler('plan_xiandai_target', (eng, pid, targetId) => {
              if (targetId) {
                eng.getEventHandler().execute(`card_${cardToExecute.id}`, targetId);
              }
              return null;
            });
          }
        }
      }
```

**Step 3: 大气科学 — 修改为 on_confirm 一次性效果**

在 plan-registry.ts 中修改 `plan_daqi` 的 trigger 从 `on_card_draw` 改为 `on_confirm`。

在 handleConfirmPlan customEffect 分支添加：

```typescript
      if (fx.customEffect === 'daqi_draw_three') {
        // 大气科学: 抽3张卡选1张执行
        const cards: Card[] = [];
        for (let i = 0; i < 3; i++) {
          const deckType = Math.random() > 0.5 ? 'chance' : 'destiny';
          const card = this.engine.drawCard(playerId, deckType);
          if (card) cards.push(card);
        }
        if (cards.length > 0) {
          const options = cards.map((c, i) => ({ label: `${c.name}: ${c.description}`, value: `daqi_${i}` }));
          options.push({ label: '不执行任何卡', value: 'daqi_none' });
          state.pendingAction = {
            id: `daqi_${Date.now()}`,
            playerId,
            type: 'choose_option',
            prompt: '大气科学学院能力：选择一张卡执行',
            options,
            callbackHandler: 'plan_daqi_pick',
            timeoutMs: 30000,
          };
          if (!this.engine.getEventHandler().hasHandler('plan_daqi_pick')) {
            const savedCards = cards;
            this.engine.getEventHandler().registerHandler('plan_daqi_pick', (eng, pid, choice) => {
              if (choice && choice !== 'daqi_none') {
                const idx = parseInt(choice.replace('daqi_', ''), 10);
                if (idx >= 0 && idx < savedCards.length) {
                  const card = savedCards[idx];
                  eng.getEventHandler().execute(`card_${card.id}`, pid);
                }
              }
              // Put unpicked cards back
              savedCards.forEach((c, i) => {
                if (choice !== `daqi_${i}`) {
                  eng.getState().discardPiles[c.deckType].push(c);
                }
              });
              return null;
            });
          }
        }
      }
```

**Step 4: 社会学院/人工智能 — on_confirm 一次性阈值调整**

修改 plan-registry.ts 中两个计划的 trigger 从 `passive` 改为 `on_confirm`。

在 handleConfirmPlan customEffect 分支添加：

```typescript
      if (fx.customEffect === 'shehuixue_reduce_threshold') {
        // 社会学院: 降低探索值差距阈值 20→15
        player.modifiedWinThresholds = player.modifiedWinThresholds || {};
        player.modifiedWinThresholds['plan_shehuixue'] = 15;
        this.addLog(playerId, '社会学院能力：胜利条件修改为探索值领先15');
      }
      if (fx.customEffect === 'rengong_reduce_threshold') {
        // 人工智能: 降低GPA差距阈值 2.0→1.5
        player.modifiedWinThresholds = player.modifiedWinThresholds || {};
        player.modifiedWinThresholds['plan_rengong'] = 1.5;
        this.addLog(playerId, '人工智能学院能力：胜利条件修改为GPA领先1.5');
      }
```

**Step 5: 修改 plan-registry.ts 中的 trigger 类型**

```
plan_shuxue: trigger: 'on_dice_roll' → 'on_turn_start'
plan_xiandai: trigger: 'on_card_draw' → 'on_confirm'
plan_daqi: trigger: 'on_card_draw' → 'on_confirm'
plan_shehuixue: trigger: 'passive' → 'on_confirm'
plan_rengong: trigger: 'passive' → 'on_confirm'
```

**Step 6: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit`

**Step 7: Commit**

```bash
git add server/src/game/GameCoordinator.ts server/src/game/handlers/plan-registry.ts
git commit -m "feat: implement shuxue, xiandai, daqi, shehuixue, rengong plan abilities"
```

---

### Task 8: 培养计划 on_cell_enter (电子学院 + 艺术学院) + exitLine 轻车熟路

**Files:**
- Modify: `server/src/game/GameCoordinator.ts` (handleCellLanding + exitLine 相关)
- Modify: `server/src/game/GameEngine.ts` (exitLine)

**Step 1: 电子学院 — handleCellLanding on_cell_enter 分支**

在 handleCellLanding 的 on_cell_enter customEffect 处理中（约line 923），wenxue_jiang_gong 之后添加：

```typescript
          // dianzi: 科创赛事GPA消耗减少
          if (fx.customEffect === 'dianzi_kechuang') {
            // 补偿0.2 GPA（实际扣0.3，净效果-0.1）
            if (fx.gpa) this.engine.modifyPlayerGpa(playerId, fx.gpa);
            this.addLog(playerId, '电子学院能力：科创赛事GPA消耗减少');
            // 继续执行正常的科创赛事事件（不 return）
          }
```

**Step 2: 艺术学院 — exitLine 时双倍经验卡**

在 `GameEngine.exitLine()` 中，经验卡执行之后，添加：

```typescript
    // 艺术学院: 浦口线经验卡双倍效果
    if (lineId === 'pukou' && player.confirmedPlans.includes('plan_yishu') && moveToMainBoard) {
      // Execute experience card handler again for double effect
      if (line?.experienceCard) {
        const doubleAction = this.eventHandler.execute(line.experienceCard.handlerId, playerId);
        if (doubleAction) {
          this.state.pendingAction = doubleAction;
        }
        this.log('艺术学院能力：浦口线经验卡双倍效果', playerId);
      }
    }
```

**Step 3: 轻车熟路 — exitLine 后回到线起点**

在 exitLine 中，主板移动之后，添加 `reenterLine` effect 检查：

```typescript
    // 轻车熟路: 离开线路后重新进入
    const reenterEffect = player.effects.find(
      e => e.type === 'custom' && e.data?.reenterLine
    );
    if (reenterEffect && moveToMainBoard) {
      player.effects = player.effects.filter(e => e !== reenterEffect);
      // After exit, offer to re-enter the same line
      const reenterAction = this.createPendingAction(
        playerId, 'choose_option', `轻车熟路：是否重新进入 ${lineId} 线？（需要交入场费）`,
        [
          { label: '重新进入', value: `reenter_${lineId}` },
          { label: '不进入', value: 'reenter_skip' },
        ]
      );
      if (reenterAction) {
        reenterAction.callbackHandler = 'card_familiar_route_choice';
        this.state.pendingAction = reenterAction;
      }
    }
```

注册 handler:

```typescript
    if (!this.eventHandler.hasHandler('card_familiar_route_choice')) {
      this.eventHandler.registerHandler('card_familiar_route_choice', (eng, pid, choice) => {
        if (choice && choice.startsWith('reenter_') && choice !== 'reenter_skip') {
          const lineToReenter = choice.replace('reenter_', '');
          eng.enterLine(pid, lineToReenter, true); // true = pay fee
        }
        return null;
      });
    }
```

**Step 4: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit`

**Step 5: Commit**

```bash
git add server/src/game/GameCoordinator.ts server/src/game/GameEngine.ts
git commit -m "feat: implement dianzi, yishu plan abilities and familiar_route card effect"
```

---

### Task 9: 通用确认移动 + 确认流程修复

**Files:**
- Modify: `server/src/game/GameCoordinator.ts` (plan_confirmation_handler + handleConfirmPlan + _processAction)

**Step 1: 修复 plan_confirmation_handler 调用 handleConfirmPlan**

替换 advanceTurn 中的 `plan_confirmation_handler` 注册代码（line 212-223），改为调用 handleConfirmPlan：

```typescript
          if (!this.engine.getEventHandler().hasHandler('plan_confirmation_handler')) {
            this.engine.getEventHandler().registerHandler('plan_confirmation_handler', (eng, pid, choice) => {
              if (choice === 'skip_plan_confirm') {
                eng.log('跳过本轮培养方案确认', pid);
              } else if (choice && choice.startsWith('confirm_plan_')) {
                const planId = choice.replace('confirm_plan_', '');
                // Call handleConfirmPlan to trigger on_confirm effects
                this.handleConfirmPlan(pid, planId);
              }
              return null;
            });
          }
```

注意：这里的 `this` 引用了 GameCoordinator 的上下文。由于 registerHandler 的 callback 接收的是 GameEngine interface，需要用箭头函数捕获 `this`。如果已经在箭头函数中，`this` 会自动绑定。

**Step 2: 在 handleConfirmPlan 结尾添加通用移动选项**

在 handleConfirmPlan 的 on_confirm 效果处理完毕后（所有 customEffect 处理之后），如果专属效果没有包含 moveToLine，则提供通用移动选项：

```typescript
    // 通用确认效果：每确认一项可选择移动到任意线起点（需交入场费）
    // 跳过已有 moveToLine 的专属效果
    const hasMovedToLine = confirmResult?.effects?.moveToLine;
    if (!hasMovedToLine) {
      const lineOptions = [
        { label: '不移动', value: 'confirm_move_skip' },
        { label: '浦口线 (免费)', value: 'confirm_move_pukou' },
        { label: '学习线 (200金)', value: 'confirm_move_study' },
        { label: '赚钱线 (200金)', value: 'confirm_move_money' },
        { label: '苏州线 (200金)', value: 'confirm_move_suzhou' },
        { label: '探索线 (200金)', value: 'confirm_move_explore' },
        { label: '鼓楼线 (200金)', value: 'confirm_move_gulou' },
        { label: '仙林线 (200金)', value: 'confirm_move_xianlin' },
        { label: '食堂线 (免费)', value: 'confirm_move_food' },
      ];
      state.pendingAction = {
        id: `confirm_move_${Date.now()}`,
        playerId,
        type: 'choose_option',
        prompt: '确认培养方案后，可选择移动到任意线起点（需交入场费），经过起点不领工资',
        options: lineOptions,
        callbackHandler: 'confirm_plan_move',
        timeoutMs: 30000,
      };
      if (!this.engine.getEventHandler().hasHandler('confirm_plan_move')) {
        this.engine.getEventHandler().registerHandler('confirm_plan_move', (eng, pid, choice) => {
          if (choice && choice !== 'confirm_move_skip') {
            const lineId = choice.replace('confirm_move_', '');
            eng.enterLine(pid, lineId, true); // true = pay fee
          }
          return null;
        });
      }
    }
```

**Step 3: 修复多玩家确认链 — _processAction 中 isPlanConfirm 后检查下一个玩家**

在 _processAction 中，当 isPlanConfirm 为 true 时，不直接设置 roll_dice，而是检查是否还有其他玩家需要确认：

```typescript
          if (isPlanConfirm) {
            // Check if there are more players who need to confirm
            const morePlayersToConfirm = state.players.filter(p =>
              !p.isBankrupt && !p.isDisconnected &&
              p.trainingPlans.length > 0 &&
              p.confirmedPlans.length < MAX_TRAINING_PLANS &&
              p.id !== playerId // Skip current player who just confirmed
            );

            // Also check delayPlanConfirm effect
            const nextPlayer = morePlayersToConfirm.find(p => {
              const delayEffect = p.effects.find(e => e.type === 'custom' && e.data?.delayPlanConfirm);
              if (delayEffect) {
                p.effects = p.effects.filter(e => e !== delayEffect);
                return false; // Skip this player (delayed)
              }
              return true;
            });

            if (nextPlayer) {
              const unconfirmedPlans = nextPlayer.trainingPlans
                .filter(p => !nextPlayer.confirmedPlans.includes(p.id));
              if (unconfirmedPlans.length > 0) {
                state.pendingAction = {
                  id: `plan_confirm_${Date.now()}`,
                  playerId: nextPlayer.id,
                  type: 'choose_option',
                  prompt: `升学阶段：${nextPlayer.name}，是否确认一个培养方案？(已确认 ${nextPlayer.confirmedPlans.length}/${MAX_TRAINING_PLANS})`,
                  options: [
                    ...unconfirmedPlans.map(p => ({ label: `确认: ${p.name}`, value: `confirm_plan_${p.id}` })),
                    { label: '跳过', value: 'skip_plan_confirm' },
                  ],
                  callbackHandler: 'plan_confirmation_handler',
                  timeoutMs: 60000,
                };
                this.broadcastState();
                return; // Don't proceed to roll_dice yet
              }
            }

            // All players done confirming, proceed to normal turn
            const currentPlayer = state.players[state.currentPlayerIndex];
            state.pendingAction = {
              id: `roll_dice_${Date.now()}`,
              playerId: currentPlayer.id,
              type: 'roll_dice',
              prompt: '请投骰子',
              timeoutMs: 60000,
            };
            this.broadcastState();
          }
```

**Step 4: 在 advanceTurn 中添加 delayPlanConfirm 检查**

在 advanceTurn 的确认阶段（line 176-229），firstPlayer 选择前检查是否有延迟效果：

```typescript
        // Filter out players with delayPlanConfirm effect
        const eligiblePlayers = playersWithPlans.filter(p => {
          const delayEffect = p.effects.find(e => e.type === 'custom' && e.data?.delayPlanConfirm);
          if (delayEffect) {
            p.effects = p.effects.filter(e => e !== delayEffect);
            this.addLog(p.id, '大类招生：延迟本轮培养方案确认');
            return false;
          }
          return true;
        });
```

**Step 5: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit`

**Step 6: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "feat: fix plan confirmation flow — call handleConfirmPlan, chain players, add general move option"
```

---

### Task 10: disabledCells 检查 + 苏州校区特殊效果

**Files:**
- Modify: `server/src/game/GameCoordinator.ts` (handleCellLanding)

**Step 1: 在 handleCellLanding 中检查 disabledCells**

在 cancelNextEvent 检查之后，plan ability on_cell_enter 之前：

```typescript
    // Check if this cell/line is disabled (huaxue ability)
    if (state.disabledCells && state.disabledCells.length > 0) {
      if (position.type === 'main') {
        const cell = boardData.mainBoard[position.index];
        if (cell && state.disabledCells.includes(cell.id || cell.cornerType || '')) {
          this.addLog(playerId, '该格子本回合被化学化工学院禁用');
          this.broadcastState();
          if (state.phase === 'playing') {
            if (this.checkAndEmitWin()) return;
            this.advanceTurn();
          }
          return;
        }
        // Check if line entry is disabled
        if (cell.type === 'line_entry' && cell.lineId && state.disabledCells.includes(`line_${cell.lineId}`)) {
          this.addLog(playerId, `${cell.lineId} 线入口本回合被化学化工学院禁用`);
          this.broadcastState();
          if (state.phase === 'playing') {
            if (this.checkAndEmitWin()) return;
            this.advanceTurn();
          }
          return;
        }
      }
    }
```

**Step 2: 苏州校区计划 — 其它校区起点花300金移动到苏州线**

这个效果需要在玩家到达其它校区线入口时额外提供选项。在 handleCellLanding 的 line_entry 处理中，检查玩家是否有 plan_suzhou：

```typescript
    // 苏州校区计划: 在其它校区线入口可花300金移动到苏州线
    if (player && player.confirmedPlans.includes('plan_suzhou') &&
        position.type === 'main' && cell?.type === 'line_entry' &&
        cell.lineId && ['pukou', 'gulou', 'xianlin'].includes(cell.lineId)) {
      // Add extra option to jump to suzhou
      // This is handled in the line_entry choice options
    }
```

这个效果比较复杂，需要在line_entry的选择弹窗中添加额外选项。简化实现：在 on_turn_start 中如果玩家在校区线入口格，提供选项。但由于位置检查时机不同，暂时标记为未来增强。

**Step 3: 构建验证**

Run: `cd D:/work/nannaricher && npx tsc -p server/tsconfig.json --noEmit`

**Step 4: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "feat: add disabledCells check in handleCellLanding"
```

---

### Task 11: 完整构建 + 部署

**Step 1: 完整构建**

Run: `cd D:/work/nannaricher && npm run build`
Expected: All packages build successfully

**Step 2: 运行测试**

Run: `cd D:/work/nannaricher && npx vitest run`
Expected: All tests pass

**Step 3: 最终提交**

如有构建修复：
```bash
git add -A
git commit -m "fix: resolve build issues from plan/card completion"
```

**Step 4: 部署（按用户要求）**

使用 nannaricher-ops 技能部署。
