# 培养计划系统大改设计文档

## 概述

重构培养计划（TrainingPlan）系统，还原南京大学培养体系：大一共享公共buff，大二起按年抽取培养计划并支持主修/辅修方向。同时移除5张卡牌，修改9张卡牌效果。

---

## 一、数据结构变更

### Player 类型变更

```typescript
interface Player {
  // 移除 confirmedPlans: string[]
  // 新增：
  majorPlan: string | null;      // 主修方向的计划ID
  minorPlans: string[];           // 辅修方向的计划ID列表
  planSlotLimit: number;          // 培养计划槽位上限（默认2，专业意向可+1）
  trainingPlans: TrainingPlan[];  // 已加入培养列表的计划（保留）
}
```

**兼容性说明：**
- `confirmedPlans` 被替换为 `majorPlan` + `minorPlans`
- `trainingPlans` 含义从"已抽取的计划"变为"已加入培养列表的计划"
- `TrainingPlan.confirmed` 字段不再需要，所有在列表中的都是已加入的
- `maxWinConditionSlots` 不再需要（胜利条件不再受槽位限制）

### constants.ts 变更

```typescript
export const DEFAULT_PLAN_SLOTS = 2;     // 默认培养计划槽位
export const INITIAL_TRAINING_DRAW = 3;  // 每次抽取数量（保留）
// MAX_TRAINING_PLANS 语义变更：从"最大确认数"改为由 planSlotLimit 控制
```

---

## 二、大一通用Buff系统

### 实现方式：roundNumber 判断（方案A）

**GPA翻倍：** 在 `GameEngine.modifyPlayerGpa()` 中，当 `roundNumber === 1` 且 `delta > 0` 时，`delta *= 2`。

**鼓楼线收益翻倍：** 在鼓楼线每个格子的事件处理中，当 `roundNumber === 1` 时，所有正面数值效果（探索+、GPA+、金钱+）翻倍，负面效果不变。具体实现：
- 在 `executeLineCell` 或各事件 handler 中检查 `state.roundNumber === 1 && lineId === 'gulou'`
- 对 delta > 0 的 modifyPlayerExploration/Money 调用翻倍

**大二失效：** `roundNumber >= 2` 时自动不满足条件，无需额外清理。

### UI 展示

- 大一期间：培养计划区域显示「大一通用Buff」卡片：
  - "所有GPA增加效果翻倍"
  - "鼓楼线所有收益翻倍"
- 大二起：显示主修/辅修培养计划

---

## 三、培养计划流程重构

### 游戏开始（setup_plans 阶段）

**变更：** 跳过初始培养计划抽取，直接进入游戏。所有玩家初始无培养计划。

### 大二起每年开始

**触发时机：** `advanceTurn()` 中 `roundNumber` 从 1→2、2→3、3→4 时。

**流程（per player 顺序执行）：**

1. **抽取3张计划**（全场不重复：维护 `redrawUsedPlanIds: Set<string>` 追踪当轮所有玩家已抽的计划）
2. **判断玩家状态：**

   **A. 无培养计划的玩家：**
   - 展示3张计划，选择1-2项加入培养列表
   - 设置主修方向（选1张为主修，其余为辅修）
   - 触发主修方向的 on_confirm 效果

   **B. 已有培养计划的玩家：**
   - 选择「不调整」或「调整培养计划」
   - **不调整：** 保留当前主修/辅修，跳过
   - **调整：**
     1. 从3张新计划中选1-2项加入列表
     2. 如果列表总数 > planSlotLimit，选择保留哪些（至少1个至多planSlotLimit个）
     3. 重新设置主修方向
     4. 如果主修方向变化 → 触发新主修的 on_confirm 效果
     5. 如果主修方向未变 → 不重复触发

3. **未被任何玩家选择的计划：** 放回牌堆（可被后续玩家/后续年度抽到）

### 卡牌获取培养计划（大一期间）

通过强基计划/国家专项/二次选拔等卡牌获得的计划：
- 立即加入培养列表
- 需设置主修/辅修方向
- 主修方向的被动效果和一次性效果立即生效
- 与大一通用buff叠加

---

## 四、主修/辅修效果规则

| 效果类型 | 主修 | 辅修 |
|---------|------|------|
| 被动效果（passive） | 生效 | 不生效 |
| 获得时一次性效果（on_confirm） | 生效 | 不生效 |
| 胜利条件 | 可触发胜利 | 可触发胜利 |

**胜利条件检查顺序：** 基础条件 → 主修条件 → 辅修条件，任一满足即获胜。

---

## 五、卡牌变更

### 移除的卡牌（5张）

| ID | 名称 | 移除原因 |
|----|------|---------|
| chance_flag_raising | 升旗仪式 | 需要线下玩家信息 |
| chance_clustering_algorithm | 聚类算法 | 需要线下玩家信息 |
| chance_internship_referral | 实习内推 | 需要线下玩家信息 |
| chance_southbound_rose | 南行玫瑰 | 需要线下玩家信息 |
| destiny_major_admission | 大类招生 | 与新培养计划机制冲突 |

### 修改的卡牌（9张）

#### 1. 跨院准出
- **旧效果：** 取消一个已确认的培养计划
- **新效果：** 单次使用，立即交换主修和辅修培养计划。无辅修则无事发生。不放回，待使用后放回命运卡堆
- **实现：** swap majorPlan 和 minorPlans[0]，不触发 on_confirm（因为是交换不是新获得）

#### 2. 专业意向
- **旧效果：** 提前1回合确认计划
- **新效果：** 单次使用，永久增加1个培养计划槽位（planSlotLimit++），然后获得0.1GPA和1探索值。不放回，待使用后放回命运卡堆
- **实现：** planSlotLimit += 1, modifyPlayerGpa(0.1), modifyPlayerExploration(1)

#### 3. 强基计划
- **新效果：** 立即再抽取一张培养计划并选择一项加入，不能超过上限，若超过可选保留并重设主修，然后获得0.2GPA
- **实现：** drawTrainingPlan → 选择加入 → checkPlanOverflow → modifyPlayerGpa(0.2)

#### 4. 国家专项
- **新效果：** 同强基计划，但奖励为200金钱
- **实现：** drawTrainingPlan → 选择加入 → checkPlanOverflow → modifyPlayerMoney(200)

#### 5. 二次选拔
- **新效果：** 同强基计划，但奖励为2探索值
- **实现：** drawTrainingPlan → 选择加入 → checkPlanOverflow → modifyPlayerExploration(2)

#### 6. 联合培养
- **新效果：** 选择一位其他玩家，将你们各自的一张辅修培养计划交换
- **实现：** choose_player → 双方各选一张辅修 → swap

#### 7. 学科评估
- **新效果：** 抽取一张培养计划并选择一位玩家，替换其一张辅修培养计划（若无辅修则无事发生）
- **实现：** drawTrainingPlan → choose_player → 替换目标辅修

#### 8. 经费均摊
- **旧效果：** 所有玩家金钱重置为800
- **新效果：** 所有玩家金钱重置为2000
- **实现：** 改 800 → 2000

#### 9. 出行方式
- **新效果：** 所有玩家选择【共享出行】或【丈量校园】：
  - 共享出行多：丈量校园玩家探索+2，共享出行玩家各自选（-100金 or 暂停1回合）
  - 丈量校园多：共享出行玩家GPA+0.2，丈量校园玩家各自选（-1探索 or 暂停1回合）
  - 相等：所有人GPA+0.1，探索+1
- **实现：** multi_vote → 统计 → 多数方 chain_action 各自选惩罚

---

## 六、UI 变更

### CompactHeader / StatusBar
- 大一显示「通用Buff」标签
- 大二起显示当前学年

### TrainingPlanView（核心改动）
- **大一无计划时：** 显示两张buff卡片
- **有计划时：** 标记主修/辅修，主修高亮，辅修半透明
- **年度选择UI：** 支持"不调整/调整"选择，主修设置交互

### SettlementScreen
- 显示玩家的主修/辅修方向
- 胜利条件标注来源（基础/主修/辅修）
