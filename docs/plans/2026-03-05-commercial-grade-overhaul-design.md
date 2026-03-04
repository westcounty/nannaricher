# 菜根人生 - 商业级改造设计文档

> 日期：2026-03-05
> 目标：音频全面接入 + 空壳代码治理 + UI重设计到商业游戏级

---

## 阶段一：音频全面接入 + 代码治理

### 1.1 音频接入计划

当前状态：AudioManager 定义了 27 种程序化合成音效，但只有 6 种被实际调用。

#### 接入位置清单

**A. 在 SocketProvider.tsx 添加（服务器事件驱动）：**

| 音效 | 触发时机 | 实现方式 |
|------|---------|---------|
| `turn_start` | `game:state-update` 检测 currentPlayerIndex 变化且为本玩家 | 在 state-update handler 中 diff |
| `turn_end` | `game:state-update` 检测 currentPlayerIndex 变化且离开本玩家 | 同上 |
| `round_start` | `game:state-update` 检测 roundNumber 递增 | 同上 |
| `hospital_enter` | `game:state-update` 检测本玩家 isInHospital 变为 true | diff players 数组 |
| `bankrupt` | `game:state-update` 检测本玩家 isBankrupt 变为 true | 同上 |
| `card_draw` | `game:card-drawn` 事件 | 已有事件监听，添加 playSound |
| `vote_start` | `game:state-update` 检测 pendingAction.type 变为 `multi_vote` | diff pendingAction |
| `vote_end` | `game:state-update` 检测 pendingAction 从 multi_vote 变为 null | 同上 |

实现：在 SocketProvider 的 `game:state-update` handler 中添加一个 `diffAndPlaySounds(prevState, newState, localPlayerId)` 函数，集中处理所有基于状态变化的音效。使用 ref 存储 prevState。

**B. 在 GameCanvas.tsx 添加（PixiJS 动画同步）：**

| 音效 | 触发时机 | 实现方式 |
|------|---------|---------|
| `piece_step` | 棋子移动动画每步回调 | PlayerLayer tween onStep 回调 |
| `piece_land` | 棋子移动动画结束 | PlayerLayer tween onComplete 回调 |
| `coin_gain` / `coin_loss` | 已有的 stat-diff 逻辑中金币变化时 | 在 showFloatingText 调用旁 |
| `gpa_up` / `gpa_down` | 已有的 stat-diff 逻辑中 GPA 变化时 | 同上 |
| `explore_up` | 已有的 stat-diff 逻辑中探索值变化时 | 同上 |

**C. 在 UI 组件中添加（用户交互驱动）：**

| 音效 | 触发时机 | 文件 |
|------|---------|------|
| `card_flip` | CardHand 中点击卡牌展开详情 | CardHand.tsx |
| `card_use` | CardDetail 中点击使用卡牌 | CardHand.tsx (CardDetail) |
| `vote_cast` | VotePanel 中投票 | VotePanel.tsx |
| `button_click` | 所有主要按钮点击（掷骰子按钮已有） | CurrentPlayerPanel.tsx, Lobby.tsx |
| `tab_switch` | 移动端底部 tab 切换 | GameScreen.tsx |

**D. 新增音量控制 UI：**

在 StatusBar 组件右侧添加音量图标按钮，点击展开简单的音量控制面板：
- 静音/取消静音切换
- 主音量滑块
- 音效音量滑块
- 使用 AudioManager.setVolume / toggleMute API

### 1.2 空壳代码治理

#### 删除清单（无价值或已被取代）

| 文件/目录 | 理由 |
|-----------|------|
| `client/src/hooks/useSound.ts` | AudioManager 的严格下位替代，volume 状态从未生效 |
| `client/src/components/BoardCanvas.tsx` | 旧版 Canvas2D 渲染器，被 PixiJS GameCanvas 取代 |
| `client/src/canvas/` 整个目录 | 仅被 BoardCanvas 引用，同上 |
| `client/src/game/SimpleGameCanvas.tsx` | 调试用红色矩形 |
| `client/src/components/GuideTooltip.tsx` + CSS | 被 TutorialSystem 完全取代，定位计算有 bug |
| `client/src/components/CellTooltip.tsx` | 仅被 BoardCanvas 引用 |
| `client/src/socket.ts` | 旧版 socket 单例，已被 SocketContext 取代 |
| `ResponsiveLayout.tsx` 中的 `GameLayout` 组件 | 硬编码 Tailwind 尺寸，与 GameScreen 实际 DOM 不兼容 |
| `package.json` 中的 `howler` + `@types/howler` | 从未使用 |

同时清理 `components/index.ts` 和 `hooks/index.ts` 中对已删除模块的 re-export。

#### 集成清单（有价值，应启用）

**1. LoadingScreen.tsx → 替换 3 处裸 HTML 加载状态**

- `App.tsx` 的 `isLoading` 状态 → `<LoadingScreen type="connecting" />`
- `App.tsx` 的 `Suspense fallback` → `<LoadingScreen type="loading" />`
- `GameScreen.tsx` 的 `!gameState` guard → `<LoadingScreen type="waiting" />`
- 修复：移除 props 中未使用的 `onComplete`

**2. AccessibilityProvider.tsx → 包装 App**

- 修复 `reducedMotion` 无限循环 bug（将 matchMedia 检查提取到独立 `useEffect(fn, [])`）
- 在 `App.tsx` 中将 `AccessibilityProvider` 添加为最外层 Provider
- `useKeyboardNavigation` 在 `GameScreen` 中激活
- `LiveRegion` 在 `GameScreen` 中用于播报游戏事件

**3. TrainingPlanView.tsx → 嵌入侧边栏**

- 在桌面端侧边栏 `CurrentPlayerPanel` 下方渲染 `TrainingPlanView`
- 在移动端/平板 "计划" tab 中渲染
- 补齐缺失的 CSS 样式

---

## 阶段二：UI 重设计 - 商业游戏级

### 2.1 设计理念

**风格：沉浸式校园暮色**

从 "毒紫 glassmorphism" 进化为更成熟的暗色系：
- 主色调不变（NJU 紫 `#5E3A8D`），但降低 UI 元素的紫色饱和度
- 背景从纯黑紫改为**深邃的暮色渐变**（深蓝紫到深靛，暗示校园夜景）
- 金色点缀保留（`#C9A227`），用于 CTA 和胜利高光
- UI 元素从全 glassmorphism 改为**实体卡片 + 微妙阴影**，仅模态框保留毛玻璃

**核心设计原则：**
1. **棋盘优先** — 棋盘永远是视觉焦点，占最大面积
2. **信息层级清晰** — 最重要的信息（当前状态、操作按钮）最醒目
3. **操作零迟疑** — 玩家永远知道"现在该做什么"
4. **动效有意义** — 每个动画都传递信息，没有装饰性动画

### 2.2 桌面端布局重设计

```
┌─────────────────────────────────────────────────────────────────┐
│ [NJU Logo] 菜根人生  │ 第3轮 第12回合 │ [🔊] [⚙️] [❓]         │ ← 顶栏（精简）
├────────────────────────────────────────────────┬────────────────┤
│                                                │ ┌────────────┐ │
│                                                │ │ 😀 张三    │ │
│             ┌──────────────────┐               │ │ 💰1200 📚3.2│ │
│             │                  │               │ │ 🗺️45       │ │
│             │    GAME BOARD    │               │ └────────────┘ │
│             │   (PixiJS 棋盘)  │               │ ┌────────────┐ │
│             │                  │               │ │ 😎 李四    │ │
│             │                  │               │ │ 💰800  📚2.8│ │
│             └──────────────────┘               │ └────────────┘ │
│                                                │ ┌────────────┐ │
│                                                │ │ 📋 培养计划 │ │
│                                                │ └────────────┘ │
│                                                │ ┌────────────┐ │
│                                                │ │ 💬 聊天/日志 │ │
│                                                │ └────────────┘ │
├────────────────────────────────────────────────┴────────────────┤
│ ┌─[我的信息]──────────┐  ┌─[手牌]─────────────┐ [🎲 掷骰子]   │ ← 底部操作栏
│ │ 💰2000 📚3.5 🗺️60  │  │ 🃏🃏🃏               │               │
│ └─────────────────────┘  └─────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

**关键变化：**

1. **顶栏精简** — 只保留游戏名、轮次/回合、功能图标（音量、设置、帮助）。移除房间ID等非关键信息（需要时点设置可看）。
2. **棋盘区**（左侧 ~75%宽度）— 棋盘居中，周围留出呼吸空间。
3. **信息侧栏**（右侧 ~25%，280-320px）— 改为可折叠的分段面板：
   - 对手信息（紧凑卡片，当前回合玩家高亮）
   - 培养计划面板（新增 TrainingPlanView 集成）
   - 聊天/日志（tab 切换，默认折叠只显示最新1条）
4. **底部操作栏（全新）** — 固定在底部的操作中心：
   - 左侧：当前玩家核心数据（金钱/GPA/探索值），紧凑一行
   - 中间：手牌区，水平滚动，卡牌悬停放大预览
   - 右侧：主操作按钮（掷骰子），大号醒目，带状态文字
   - 非自己回合时操作按钮变灰并显示"等待 XXX 操作..."

### 2.3 移动端布局重设计

```
┌──────────────────────────┐
│ 菜根人生  第3轮-12回合    │ ← 精简顶栏
├──────────────────────────┤
│                          │
│                          │
│      GAME BOARD          │
│     (全屏棋盘区)          │ ← 棋盘占满可用空间
│      可缩放/拖拽          │
│                          │
│                          │
├──────────────────────────┤
│ 💰2000 │ 📚3.5 │ 🗺️60   │ ← 我的状态条（始终可见）
├──────────────────────────┤
│[🎲掷骰子]  [🃏3] [👥] [⋯]│ ← 底部操作栏
└──────────────────────────┘
```

**移动端交互模式：**
- 底栏4个按钮：掷骰子（主操作）、手牌（badge显示数量）、玩家列表、更多（日志/聊天/设置）
- 点击手牌/玩家/更多 → 从底部弹出 sheet（高度 60% 屏幕）
- 事件/选择/投票 → 全屏底部 sheet，不可关闭直到操作完成
- 棋盘支持双指缩放和拖拽

### 2.4 平板端布局

与桌面端类似但右侧面板默认折叠，通过按钮展开为 overlay。底部操作栏与移动端类似但更宽松。

### 2.5 组件重设计细节

#### StatusBar → CompactHeader
- 高度降低到 48px（当前约 56px）
- 左侧：游戏 logo/名称（小尺寸）
- 中间：轮次-回合信息 + StatusIndicator 合并
- 右侧：音量按钮、设置按钮

#### PlayerPanel → CompactPlayerCard
- 改为更紧凑的水平布局：头像色块 | 名字 | 三个核心数值
- 当前回合玩家：左边框金色高亮 + 微妙脉冲动画
- 破产/住院状态：整卡片变灰/变蓝，半透明覆盖
- 悬停展开详细信息（培养计划、手牌数等）

#### CurrentPlayerPanel → 融入底部操作栏
- 不再是独立面板
- 核心数据嵌入底部操作栏左侧
- 掷骰子按钮放大到底部操作栏右侧

#### CardHand → 底部操作栏内的卡牌区
- 桌面端：水平滚动在底部操作栏中间
- 悬停时卡牌向上弹起 + 预览
- 移动端：点击 tab 弹出 sheet

#### EventModal / ChoiceDialog → 保持 glassmorphism
- 这些模态框适合毛玻璃效果
- 添加入场/退场动画（scale + fade）
- 添加音效（event_trigger/event_positive/event_negative 已有）

#### WinnerModal → 增强庆祝效果
- 添加 confetti 粒子特效（可用 PixiJS effectContainer）
- 胜利音效已有（victory_fanfare）
- 排行榜展示所有玩家最终数据

### 2.6 新增 UI 组件

#### AudioControl 音量控制组件
- 位置：顶栏右侧图标
- 点击展开下拉面板
- 内容：静音开关 + 主音量滑块 + 音效音量滑块
- 使用 AudioManager API

#### SettingsPanel 设置面板
- 位置：顶栏右侧齿轮图标
- 内容：
  - 音量控制（内嵌 AudioControl）
  - 无障碍设置（高对比、色盲模式、减少动效 — 来自 AccessibilityProvider）
  - 房间信息（房间ID、玩家列表）
  - 字体大小调节

---

## 实现风险与注意事项

1. **GameContext 双重状态** — 当前 SocketProvider 和 GameContext 同时监听部分相同事件。音频 diff 逻辑应统一放在 SocketProvider 中，避免重复播放。
2. **PixiJS 音频同步** — piece_step 等音效需要与 PixiJS tween 精确同步，需要通过 tween 回调而非状态变化触发。
3. **移动端性能** — 程序化音频合成在低端设备上可能有延迟，需要测试。考虑添加 "低性能模式" 开关减少音效数量。
4. **CSS 重构范围** — UI 重设计涉及 `game.css`（1241行）+ `mobile.css` + 各组件内联样式的大幅重写。建议新建 `game-v2.css` 渐进替换。

---

## 交付标准

- [ ] 27 种音效全部在正确时机播放
- [ ] 音量控制 UI 可用
- [ ] 删除所有空壳代码，零死代码
- [ ] LoadingScreen / AccessibilityProvider / TrainingPlanView 完成集成
- [ ] 桌面端新布局实现并可用
- [ ] 移动端新布局实现并可用
- [ ] 所有模态框有入场/退场动画
- [ ] 构建无报错，TypeScript 类型检查通过
