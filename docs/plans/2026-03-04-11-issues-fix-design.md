# 菜根人生游戏 — 11个问题修复设计

日期: 2026-03-04

## 概述

修复游戏中11个已知问题，涵盖服务端核心逻辑、客户端展示交互、日志系统、分支路线奖励。

## 问题清单

### 第一批: 服务端核心逻辑 (Issues 1,2,3,9,10,11)

#### Issue 1: 骰子动画期间按钮锁定
- **根因**: `handleRollDice()` 处理投骰后没有清除 pendingAction，客户端动画期间仍可发送请求
- **修复**:
  - 服务端: 投骰后立即将 `state.pendingAction = null`，广播状态，再处理移动和事件
  - 客户端: DiceRoller 在 `isRolling` 期间禁用所有操作按钮
  - 服务端: 在 `handleRollDice` 开头添加 `if (state.pendingAction?.type !== 'roll_dice') return` 检查
- **文件**: `GameCoordinator.ts`, `DiceRoller.tsx`, `GameContext.tsx`

#### Issue 2: 六回合升学（培养方案确认）
- **根因**: `advanceTurn()` 中没有检查回合数触发方案确认
- **修复**:
  - 在 `advanceTurn()` 中，当 `turnNumber > 0 && turnNumber % PLAN_CONFIRM_INTERVAL === 0` 时
  - 为每个有未确认方案的玩家创建 `draw_training_plan` 类型的 pendingAction
  - 使用顺序处理：一次一个玩家确认
  - 添加全局广播: "第N轮升学阶段开始"
- **文件**: `GameCoordinator.ts`, `shared/src/types.ts`

#### Issue 3: 事件弹窗重复（如蒋公的面子弹两次选择窗口）
- **根因**: `handleCellLanding()` 中 event handler 返回 pendingAction 后 emit `game:event-trigger`，但 handler 可能在内部也发起了弹窗
- **修复**:
  - 统一事件触发链：handler 只返回 PendingAction，不直接 emit
  - `handleCellLanding()` 检查 pendingAction 前先清除旧的 pendingAction
  - 添加 dedup 机制：记录最后一次 event-trigger 的 actionId，避免重复
- **文件**: `GameCoordinator.ts`, `event-handlers.ts`

#### Issue 9: 停一回合效果时机
- **根因**: `skipPlayerTurn(playerId, turns)` 直接设置 `skipNextTurn = true`，但在某些场景下当前回合就被跳过
- **修复**:
  - 确保 `skipNextTurn` 在 `advanceTurn()` 中检查和消耗
  - 验证所有调用处：设置 skipNextTurn 后不应立即跳到下一玩家
  - 如果在当前回合设置了 skip，应该完成当前回合后下回合才跳过
- **文件**: `GameEngine.ts`, `GameCoordinator.ts`

#### Issue 10: 需要重新投骰子的效果
- **根因**: 某些事件需要 re-roll（如重修、社团的投骰判定），但使用原始 diceResult
- **修复**:
  - 为 "事件内投骰" 创建新的 `event_roll_dice` pendingAction 类型
  - 或直接在 handler 中调用 `engine.rollDice()` 并 emit `game:dice-result`
  - 确保 re-roll 的结果广播给所有玩家
- **文件**: `GameCoordinator.ts`, `event-handlers.ts`, `line-handlers.ts`

#### Issue 11: 校医院每回合只投一次
- **根因**: 当前代码中，出院成功后缺少后续动作（没有移动的机会）
- **修复**:
  - 出院成功后: 设置新的 `roll_dice` pendingAction 让玩家正常投骰移动
  - 出院失败: 已正确 `advanceTurn()`
  - 验证校医院 handler 的完整流程
- **文件**: `GameCoordinator.ts`

### 第二批: 客户端展示和交互 (Issues 5,7,8)

#### Issue 5: 手牌使用功能
- **根因**: `handleUseCard` 只处理简单 effects，缺少完整的交互流程（如选择目标玩家）
- **修复**:
  - 服务端: 扩展 `handleUseCard`，对需要目标的卡牌返回 `choose_player` pendingAction
  - 客户端: 在 PlayerPanel 或 GameScreen 中添加手牌展示和使用按钮
  - 使用时检查: 只在自己回合或特定条件下允许使用
- **文件**: `GameCoordinator.ts`, `client/components/PlayerPanel.tsx` 或新建 `HandPanel.tsx`

#### Issue 7: 事件弹窗全员广播
- **根因**: `handleEventTrigger` 第152行过滤了非当前玩家
- **修复**:
  - 新增 `game:event-broadcast` socket 事件，发送事件标题、描述、当前玩家信息
  - 所有玩家收到 broadcast，当前玩家看到可操作弹窗，其他人看到只读弹窗
  - 当事件结果产生后（玩家做出选择），广播选择结果
  - 弹窗显示: "{玩家名} 触发了 {事件名}" + 事件描述 + 结果
- **文件**: `GameCoordinator.ts`, `GameContext.tsx`, `EventModal.tsx` 或相关客户端组件

#### Issue 8: 资源变更强展示
- **根因**: 服务端 `modifyPlayerMoney/Gpa/Exploration` 只记录日志，没有广播专用事件
- **修复**:
  - 新增 `game:resource-change` socket 事件: `{ playerId, playerName, stat, delta, current }`
  - 客户端监听此事件，展示 FloatingText 动画（已有 FloatingText 组件）
  - 所有玩家都能看到资源变更（自己和他人的）
  - 手牌变更: 在 addCardToPlayer/removeCardFromPlayer 时也广播
- **文件**: `GameEngine.ts` 或 `GameCoordinator.ts`, `GameContext.tsx`, FloatingText 相关组件

### 第三批: 日志和分支路线奖励 (Issues 4,6)

#### Issue 4: 详细游戏日志持久化
- **修复**:
  - 在 GameCoordinator 中添加日志缓冲区
  - 每回合结束后追加写入 `logs/game-{roomId}-{timestamp}.jsonl`
  - 游戏结束后生成完整日志摘要
  - 日志包含: 回合号、玩家、动作、资源变化、骰子结果、事件触发
- **文件**: `GameCoordinator.ts`, 新建 `server/src/game/GameLogger.ts`

#### Issue 6: 分支路线退出奖励
- **修复**:
  - 验证所有 8 条线的 `experienceCard.handlerId` 是否已注册
  - 补充缺失的 handler
  - 确保 `exitLine()` 正确调用经验卡 handler
- **文件**: `line-handlers.ts`, 各 line 定义文件

## 新增 Socket 事件

| 事件 | 方向 | 数据 | 用途 |
|------|------|------|------|
| `game:event-broadcast` | S→C | `{ playerId, playerName, title, description, result? }` | 事件全员广播 |
| `game:resource-change` | S→C | `{ playerId, playerName, stat, delta, current }` | 资源变更通知 |

## 修改的类型 (shared/src/types.ts)

- `PendingAction` 可能新增 `confirm_plan` 类型
- `GameState` 添加 `planConfirmationPhase?: boolean` 标识升学阶段
