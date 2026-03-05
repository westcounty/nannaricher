# 培养计划效果 & 手牌使用 完善设计

日期: 2026-03-05

## 概述

补全所有未实现的培养计划效果、手牌 handler、以及通用确认效果，确保游戏中所有机制都真正生效。

---

## Part A: 通用确认效果（缺失）

规则书原文：**"每确认一项培养计划，可以选择移动到任意一条线的起点处（需要交入场费），若经过发薪起点不领取工资"**

当前代码中只处理了各个计划的专属 on_confirm 效果（如商学院移动到赚在南哪），缺少这个通用效果。

**实现方案**：
- 在 `handleConfirmPlan` 中，所有计划确认后（专属效果之后），弹出 choose_option：
  - "移动到某条线起点（需交入场费）" — 列出8条线
  - "不移动"
- 如果计划专属效果已经有 moveToLine，则跳过此通用选项
- 移动时不触发经过起点的工资

---

## Part B: 培养计划 customEffect 补全 (10个需修复)

### B1. 物理学院 `wuli_double_move` (on_turn_start)
规则：**"下一回合你选择前进双倍点数或后退双倍点数"**

在 advanceTurn() on_turn_start 中：
- 创建 choose_option: "正常移动" / "双倍前进" / "双倍后退"
- 选择后添加 effect `{ type: 'custom', data: { moveModifier: 'double_forward' | 'double_backward' }, turnsRemaining: 1 }`
- handleRollDice 中检查此 effect，修改移动步数

### B2. 化学化工 `huaxue_disable` (on_turn_start)
规则：**"你可以选定一个格子和一条线，下一回合失效"**

- choose_option 列出可禁用目标（主路事件格 + 线路入口）
- 选择后在 state 添加 `disabledCells: string[]`
- handleCellLanding 检查此列表，跳过被禁用的事件
- 下回合开始清空

### B3. 数学系 `shuxue_set_dice` (on_dice_roll)
规则：**"可以指定下一回合自己的骰子点数"**

- 投骰后弹出 choose_option: "指定下回合点数" / "不指定"
- 如果选指定，再选 1-6
- 存为 effect `{ forcedDice: number, turnsRemaining: 1 }`
- 下回合 handleRollDice 直接用 forcedDice 值

### B4. 现代工程 `xiandai_assign_card` (on_card_draw)
规则：**"你可以立即抽取一张命运卡，并指定一位玩家执行该效果"**

注意：规则说的是确认时的效果，不是每次抽卡。需要修改 trigger 从 on_card_draw 改为 on_confirm。
- 确认时抽一张命运卡
- 创建 choose_player PendingAction
- 对选中玩家执行该命运卡

### B5. 大气科学 `daqi_draw_three` (on_card_draw)
规则：**"你可以立即抽取三张机会卡或命运卡，并至多选择其中一张执行"**

注意：规则说这也是确认时效果。需要修改 trigger 从 on_card_draw 改为 on_confirm。
- 确认时抽3张卡
- 创建 choose_option 列出3张卡名 + "不执行"
- 选择后执行选中的卡，其余放回

### B6. 社会学院 `shehuixue_reduce_threshold`
规则：**"你可以选择永久减少一个胜利条件位，将本培养计划的获胜条件修改为高15"**

这是确认时的一次性选择，不是每回合。
- trigger 改为 on_confirm
- 确认时询问 "降低阈值(20→15)?"
- 选择后 `player.modifiedWinThresholds['plan_shehuixue'] = 15`

### B7. 人工智能 `rengong_reduce_threshold`
同上，确认时一次性选择：
- "降低GPA差距阈值(2.0→1.5)?"
- `player.modifiedWinThresholds['plan_rengong'] = 1.5`

### B8. 电子学院 `dianzi_kechuang` (on_cell_enter)
规则：**"你在科创赛事只需要失去0.1的GPA即可执行投掷"**
- 在 handleCellLanding on_cell_enter 分支处理 `dianzi_kechuang`
- 到达科创赛事时，先应用 +0.2 GPA（补偿差额0.3→0.1）
- 让事件正常执行（扣0.3），净效果为-0.1

### B9. 艺术学院 `yishu_double_exp` (on_cell_enter)
规则：**"你在浦口线终点处可以执行双倍经验卡效果"**
- 在 exitLine 时检查：如果 lineId === 'pukou' 且有艺术学院
- 经验卡 handler 执行后，再执行一次（双倍奖励）
- 浦口经验卡奖励: +400金钱 + 移动选择，双倍 = 再+400金钱

### B10. 环境学院 `on_move` +2探索
规则：**"你每经历一次直接移动事件，获得2探索值"**
- 在 movePlayerTo() 中添加 planAbilities.checkAbilities on_move
- 如果返回 exploration 效果，调用 modifyPlayerExploration

### 无需修改:
- **软件学院** (B8): 破产阈值 -1000 已在 GameEngine.checkBankruptcy 正确实现 ✅
- **海外教育学院**: on_line_enter 食堂线可选已实现 ✅

---

## Part C: 手牌 Handler 注册 (20张)

当前所有20张holdable卡都没有注册 `card_${cardId}` handler，使用后什么都不发生。

### 命运卡 handler (14张)

| # | 卡牌ID | 名称 | handler 实现逻辑 |
|---|--------|------|-----------------|
| 1 | destiny_maimen_shield | 麦门护盾 | 添加 effect `foodShield`, turnsRemaining=999; 食堂线事件检查跳过负面 |
| 2 | destiny_stop_loss | 及时止损 | 添加 effect `cancelNextEvent`, turnsRemaining=1; handleCellLanding 检查跳过 |
| 3 | destiny_urgent_deadline | 工期紧迫 | 检查是否在医院/鼎 → setHospitalStatus/setDingStatus(false), 创建 roll_dice |
| 4 | destiny_negative_balance | 余额为负 | 添加 effect `negateExpense`, turnsRemaining=1; 下次金钱扣除时抵消 |
| 5 | destiny_inherited_papers | 祖传试卷 | 添加 effect `blockGpaLoss`, turnsRemaining=1 |
| 6 | destiny_throw_stone | 投石问路 | 添加 effect `blockMoneyLoss`, turnsRemaining=1 |
| 7 | destiny_campus_legend | 校园传说 | 添加 effect `blockExplorationLoss`, turnsRemaining=1 |
| 8 | destiny_alternative_path | 另辟蹊径 | 检查是否在支线内 → exitLine(playerId, false) 不领经验卡 |
| 9 | destiny_major_admission | 大类招生 | 添加 effect `delayPlanConfirm`, turnsRemaining=1; advanceTurn 检查跳过计划确认 |
| 10 | destiny_cross_college_exit | 跨院准出 | choose_option 列出 confirmedPlans → 选择后移除 |
| 11 | destiny_professional_intention | 专业意向 | choose_option 列出未确认计划 → 确认+0.1GPA+1探索 |
| 12 | destiny_familiar_route | 轻车熟路 | 添加 effect `reenterLine`, turnsRemaining=999; exitLine 检查后回到线起点 |
| 13 | destiny_how_to_explain | 如何解释 | 同 stop_loss: 添加 effect `cancelNextEvent`, turnsRemaining=1 |
| 14 | destiny_drum_beat_return | 鼓点重奏 | 添加 effect `doubleDiceChoice`, turnsRemaining=1; handleRollDice 投两次选一 |

### 机会卡 handler (6张)

| # | 卡牌ID | 名称 | handler 实现逻辑 |
|---|--------|------|-----------------|
| 1 | chance_info_blocked | 消息闭塞 | 添加全局 effect `blockChanceCard`; 下次任意玩家机会卡生效时抵消 |
| 2 | chance_false_move | 虚晃一枪 | 添加全局 effect `blockDestinyCard`; 下次任意玩家命运卡生效时抵消 |
| 3 | chance_pie_in_sky | 画饼充饥 | choose_player → 给目标添加 `cancelNextEvent` effect |
| 4 | chance_one_jump_relief | 一跃愁解 | choose_player → 给目标添加 `reverseEffects` effect |
| 5 | chance_water_power_outage | 停水停电 | choose_player → 给目标 skipNextTurn+不重复事件 |
| 6 | chance_mending_plan | 补天计划 | 特殊存储：当其他玩家胜利时检查持有者是否有此卡 |

---

## Part D: effect 检查点新增

在 GameEngine 的资源修改方法中添加 effect 检查：

1. **modifyPlayerMoney**: 检查 `blockMoneyLoss` / `negateExpense` effect (delta < 0 时)
2. **modifyPlayerGpa**: 检查 `blockGpaLoss` effect (delta < 0 时)
3. **modifyPlayerExploration**: 检查 `blockExplorationLoss` effect (delta < 0 时)
4. **handleCellLanding**: 检查 `cancelNextEvent` effect → 跳过事件
5. **handleRollDice**: 检查 `doubleDiceChoice` / `forcedDice` / `moveModifier` effect
6. **movePlayerTo**: 检查 `on_move` plan ability (+2探索)
7. **食堂线事件**: 检查 `foodShield` effect → 跳过负面
8. **advanceTurn**: 检查 `delayPlanConfirm` effect → 跳过计划确认
9. **exitLine**: 检查 `reenterLine` effect → 回到线起点
10. **checkWinCondition**: 检查 `补天计划` 卡 → 持有者插入行动

---

## Part E: GameState 新增字段

```typescript
// shared/src/types.ts
interface GameState {
  disabledCells?: string[];  // 化学化工学院禁用的格子/线路
}
```

---

## 实现顺序

1. **Batch 1**: effect 检查基础设施 (Part D 1-6) — 底层守卫
2. **Batch 2**: 20张手牌 handler (Part C) — 卡牌使用功能
3. **Batch 3**: 10个计划 customEffect (Part B) — 培养计划被动能力
4. **Batch 4**: 通用确认移动 (Part A) — 确认计划后选择移动
5. **Batch 5**: 验证构建
