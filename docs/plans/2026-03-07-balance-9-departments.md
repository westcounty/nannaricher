# 9院系平衡性调整 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 调整9个院系的胜利条件和被动能力以改善游戏平衡性

**Architecture:** 修改服务端胜利条件检查、被动能力注册、卡牌定义和游戏协调器中的处理逻辑，同步更新规则书文本

**Tech Stack:** TypeScript (server), Socket.IO, Pixi.js (client)

---

### Task 1: 匡亚明学院 — 满足≥2个不同玩家的计划条件

**Files:**
- Modify: `server/src/game/rules/WinConditionChecker.ts:446-457` (checkMatchAnyOtherPlanWin)
- Modify: `server/src/data/trainingPlans.ts:197` (winCondition text)

**Changes:**
- checkMatchAnyOtherPlanWin: 改为统计满足了多少个不同玩家的计划条件，需 ≥2
- trainingPlans: 更新 winCondition 描述

---

### Task 2: 哲学系 — 胜利条件增加金钱未减少

**Files:**
- Modify: `server/src/game/rules/WinConditionChecker.ts:388-392` (checkLineNoGpaExpChange)
- Modify: `server/src/data/trainingPlans.ts:22` (winCondition text)

**Changes:**
- checkLineNoGpaExpChange: 增加 `exit.moneyAfter >= exit.moneyBefore` 条件
- 方法名可改为 checkLineNoGpaExpMoneyLossChange
- trainingPlans: 更新描述

---

### Task 3: 化学化工学院 — 禁用效果持久化

**Files:**
- Modify: `server/src/game/handlers/plan-registry.ts:271-284` (trigger 从 on_turn_start 改为 on_confirm)
- Modify: `server/src/game/GameCoordinator.ts:686-687` (不再每回合清空 disabledCells)
- Modify: `server/src/game/GameCoordinator.ts:798-828` (huaxue_disable 改为 on_confirm 时触发)
- Modify: `server/src/game/GameCoordinator.ts` (年度计划调整时重新选择禁用目标)
- Modify: `shared/src/types.ts:147` (disabledCells 注释更新)
- Modify: `server/src/data/trainingPlans.ts:107` (passiveAbility text)

**Changes:**
- plan-registry: trigger 改为 on_confirm
- GameCoordinator: 删除每回合清空 disabledCells 的逻辑（行687），改为：
  - 设主修时弹窗选择禁用目标，持久生效
  - 主修方向变更（不再是化工）时清空 disabledCells
  - 新学年确认计划时如果化工仍是主修，重新弹窗选择

---

### Task 4: 社会学院 — 增加自身探索≥15条件

**Files:**
- Modify: `server/src/game/rules/WinConditionChecker.ts:245-252`
- Modify: `server/src/data/trainingPlans.ts:78`

**Changes:**
- 在差距检查前增加 `player.exploration >= 15` 条件
- 更新描述文本

---

### Task 5: 环境学院 — 5/7事件 + 被动改为进线路+1探索

**Files:**
- Modify: `server/src/game/rules/WinConditionChecker.ts:159-164` (7→5)
- Modify: `server/src/game/handlers/plan-registry.ts:361-374` (on_move→on_line_enter, +2→+1)
- Modify: `server/src/data/trainingPlans.ts:148-149`

---

### Task 6: 信息管理学院 — 5张→4张

**Files:**
- Modify: `server/src/game/rules/WinConditionChecker.ts:237-241` (5→4)
- Modify: `server/src/data/trainingPlans.ts:71`

---

### Task 7: 数学系 — 3次→2次

**Files:**
- Modify: `server/src/game/rules/WinConditionChecker.ts:116-119` (3→2)
- Modify: `server/src/data/trainingPlans.ts:85`

---

### Task 8: 外国语学院 — 新增持续被动(抽到英文卡+2探索)

**Files:**
- Modify: `server/src/game/handlers/plan-registry.ts:133-146` (保留 on_confirm + 新增 on_card_draw)
- Modify: `server/src/game/GameEngine.ts:793-796` (drawCard 中添加触发)
- Modify: `server/src/data/trainingPlans.ts:44`

**Changes:**
- 在 GameEngine.drawCard 中，检测到含英文卡时触发外院被动
- plan-registry 新增 on_card_draw trigger 或直接在 GameEngine 中处理

---

### Task 9: 工程管理学院 — 金钱0-200+专属卡「资金调度令」

**Files:**
- Modify: `server/src/game/rules/WinConditionChecker.ts:108-113` (money===0 → 0<=money<=200 && !isBankrupt)
- Modify: `server/src/game/handlers/plan-registry.ts:456-469` (新卡名和效果)
- Modify: `server/src/game/GameCoordinator.ts:2111-2124` (分发新卡)
- Modify: `server/src/game/GameCoordinator.ts` (新增卡牌使用处理)
- Modify: `server/src/game/GameEngine.ts:268-276` (moneyZeroCount → moneyInRangeCount)
- Modify: `server/src/data/trainingPlans.ts:190-191`
- Modify: `shared/src/types.ts` (Player 字段更新)

---

### Task 10: 更新规则书

**Files:**
- Modify: `菜根人生.md` (所有9个院系的描述)

---

### Task 11: 更新 balance-test strategies

**Files:**
- Modify: `balance-test/strategies.mjs` (适配新规则)

---

### Task 12: 部署更新服务器并提交

- Build, deploy, commit, push
