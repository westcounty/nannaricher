# 菜根人生 · 最小可发行版优化设计 (MVP Polish)

> 日期: 2026-03-17
> 目标: 用最少改动达到"能发给南大同学玩"的商业级水平
> 前提: 不碰游戏逻辑和平衡性数值，不改服务端
> 工作量: ~3-5 天

## 背景

基于 5000 局 e2e 平衡性模拟 + 全代码库深度审查，从顶级游戏策划和顶级玩家双重视角识别出以下阻断发行的问题：

1. 新手引导严重不足（33个计划+8支线+90+卡牌，仅4条触发Tooltip）
2. 视觉一致性问题（15+处硬编码颜色绕过Token，重复动画，阴影混乱）
3. 音效系统未充分接入（27种定义仅~16种已接入，资源变化等关键时刻静默）
4. 结算页缺乏传播动力（无分享卡片、无情感高潮设计）

本方案聚焦上述问题的最小有效修复，明确排除经济系统重平衡、卡牌系统增强、等待体验优化等需要改动游戏逻辑的工作（留给后续方案B）。

---

## 1. 新手引导强化

### 1a. 激活并精简 Modal 教程

**现状:** 存在两套独立的教程系统：
- `client/src/tutorial/TutorialSystem.tsx` — 9步 Modal 教程（未激活的死代码），localStorage key: `tutorial_completed`
- `client/src/features/tutorial/TutorialSystem.tsx` — 4步触发式 Tooltip 系统（已激活），localStorage key: `nannaricher_tutorial_completed`

GameScreen.tsx 当前仅导入 `features/tutorial/TutorialSystem`（Tooltip 版）。

**改动:**

激活 `client/src/tutorial/TutorialSystem.tsx`（Modal 版），精简为5步，在首次进入游戏时自动弹出：

| 步骤 | 标题 | 内容（1-2句话） |
|------|------|----------------|
| 1 | 欢迎来到菜根人生 | "这是南大版大富翁——投骰子走格子，在4年大学生活中成长！" |
| 2 | 三大资源 | "💰金钱 📚GPA 🐋探索值——当 GPA×10 + 探索值 ≥ 60 即可获胜" |
| 3 | 棋盘与支线 | "主棋盘28格围成一圈，还有8条支线可以进入，各有独特事件和奖励" |
| 4 | 培养计划 | "大二起每年选专业方向，每个专业有独特的被动能力和胜利条件——这是另一种赢法！" |
| 5 | 卡牌 | "踩到机会/命运格会抽卡。有些卡立即生效，有些可保留在手中择机使用" |

**实现细节:**
- 修改 `client/src/tutorial/TutorialSystem.tsx`（Modal 版），将 steps 数组从9步裁剪为上述5步
- 重新设计 Modal 样式以匹配奶油紫金主题（当前 TutorialSystem 使用暗色 inline style，与设计系统冲突）
- 在 `GameScreen.tsx` 中**新增**导入 `client/src/tutorial/TutorialSystem`（注意路径：`../tutorial/TutorialSystem`，非 `../features/tutorial/TutorialSystem`）
- 当 `localStorage` 无 `tutorial_completed` 标记时自动渲染 Modal 教程
- 保留"跳过教程"按钮，完成/跳过后写入 `localStorage` key `tutorial_completed`
- 触发式 Tooltip（`features/tutorial/TutorialSystem`，key `nannaricher_tutorial_completed`）保持不变，两系统使用不同 key 互不干扰

**涉及文件:**
- `client/src/tutorial/TutorialSystem.tsx` — 修改 steps 内容 + 重新设计样式匹配主题
- `client/src/components/GameScreen.tsx` — 新增 Modal 教程导入和首次渲染逻辑

### 1b. 大厅增加规则速查入口

**现状:** Lobby 页面无任何规则说明入口。

**改动:**

在 Lobby 页面增加一个 📖 图标按钮，点击打开 `RuleDrawer` 侧边抽屉。

**RuleDrawer 内容结构（4个 Tab）：**

| Tab | 内容 | 数据来源 |
|-----|------|---------|
| 基础规则 | 游戏流程、胜利条件、资源说明、角落格效果 | 硬编码文案 |
| 培养计划 | 33个计划列表：名称 + 胜利条件 + 难度标签 | 硬编码文案（从 `菜根人生.md` 规则文档提取） + `plan-difficulty.ts` |
| 卡牌一览 | 按类型分组的卡牌列表：名称 + 简要效果 | 硬编码文案（从 `菜根人生.md` 规则文档提取） |
| 支线介绍 | 8条支线：名称 + 入场费 + 特色描述 | 硬编码文案 |

**实现细节:**
- 新建 `client/src/components/RuleDrawer.tsx`
- 从右侧滑入，宽度 360px（桌面）/ 全屏（移动端）
- 使用现有 CSS 变量和组件风格（奶油背景 + 紫色标题）
- 计划和卡牌数据硬编码在 RuleDrawer 中（计划定义仅存在于服务端 `server/src/data/trainingPlans.ts`，卡牌定义在 `server/src/data/cards.ts`，为避免服务端改动，此处直接硬编码精简版文案）
- 难度标签从 `shared/src/plan-difficulty.ts` 导入

**涉及文件:**
- 新建 `client/src/components/RuleDrawer.tsx`
- `client/src/components/Lobby.tsx` — 增加 📖 按钮

### 1c. 培养计划选择阶段增加难度标签

**现状:** PlanSelectionPanel 展示计划名称和胜利条件，但玩家无法判断难度。

**改动:**

在每个计划卡片上增加难度标签 badge：

| 等级 | 条件（基于5000局胜率） | 颜色 | 计划 |
|------|----------------------|------|------|
| ⭐ 简单 | 胜率 > 35% | 绿色 `--c-success` | 天文、政府管理、文学、现代工程、物理 |
| ⭐⭐ 中等 | 胜率 20%-35% | 金色 `--c-accent` | 哲学、地球科学、生命科学、马克思、信息管理、商学、电子、建筑、匡亚明、历史、环境、软件、工程管理、数学、化工、新闻、社会、地海、法学、计算机、国际关系 |
| ⭐⭐⭐ 困难 | 胜率 < 20% | 红色 `--c-danger` | 大气、艺术、外国语、苏州、医学、人工智能、海外教育 |

**实现细节:**
- 新建 `shared/src/plan-difficulty.ts`，导出 `PLAN_DIFFICULTY: Record<string, 'easy' | 'medium' | 'hard'>`
- 在 `PlanSelectionPanel.tsx` 中每个计划卡片右上角渲染对应 badge
- Badge 样式：圆角 pill，背景用上述颜色的 alpha 变体，文字用对应实色

**涉及文件:**
- 新建 `shared/src/plan-difficulty.ts`
- `client/src/components/PlanSelectionPanel.tsx` — 渲染难度 badge

---

## 2. 视觉一致性修复

### 2a. 颜色 Token 统一

**现状:** `cards.css` 中 15+ 处硬编码颜色绕过 `index.css` 定义的 Token 系统。

**改动:**

**补充缺失 Token（在 `index.css` `:root` 中添加）：**

```css
/* 医院状态颜色 */
--c-hospital: #42A5F5;

/* 卡牌渐变色 — 机会卡用蓝色系，命运卡用紫色系 */
/* 注意：thumbnail 和 detail-header 使用不同的起始色（thumbnail 较浅，header 较深） */
--c-card-chance-thumb-start: #1565C0;
--c-card-chance-thumb-end: #42A5F5;
--c-card-chance-header-start: #0D47A1;
--c-card-chance-header-mid: #1976D2;
--c-card-chance-header-end: #42A5F5;
--c-card-destiny-start: #4A148C;
--c-card-destiny-mid: #7B1FA2;
--c-card-destiny-end: #AB47BC;

/* 卡牌效果药丸色 — 这些与资源Token色不同（money药丸用绿色、gpa药丸用蓝色），保留卡牌原有视觉风格 */
--c-pill-money: 76, 175, 80;        /* 绿色 rgb */
--c-pill-gpa: 33, 150, 243;         /* 蓝色 rgb */
--c-pill-exploration: 255, 152, 0;   /* 橙色 rgb */
--c-pill-special: 171, 71, 188;      /* 紫色 rgb */

/* 遮罩层背景色（注意：--shadow-overlay 已存在且是 box-shadow 值，此处用不同命名） */
--c-overlay-dark: rgba(0, 0, 0, 0.65);
--c-overlay-medium: rgba(0, 0, 0, 0.5);
```

**替换 cards.css 中的硬编码：**

| 位置 | 当前值 | 替换为 |
|------|--------|--------|
| `.card-thumbnail.chance::before` gradient | `#1565C0, #42A5F5` | `var(--c-card-chance-thumb-start), var(--c-card-chance-thumb-end)` |
| `.card-thumbnail.destiny::before` gradient | `#7B1FA2, #BA68C8` | `var(--c-card-destiny-mid), var(--c-card-destiny-end)` |
| `.card-detail .card-header.chance::before` gradient | `#0D47A1, #1976D2, #42A5F5` | `var(--c-card-chance-header-start), var(--c-card-chance-header-mid), var(--c-card-chance-header-end)` |
| `.card-detail .card-header.destiny::before` gradient | `#4A148C, #7B1FA2, #AB47BC` | `var(--c-card-destiny-start), var(--c-card-destiny-mid), var(--c-card-destiny-end)` |
| `.effect-pill--money` background | `rgba(76, 175, 80, 0.12)` | `rgba(var(--c-pill-money), 0.12)` |
| `.effect-pill--money` color | `#81C784` | 保持不变 |
| `.effect-pill--money` border | `rgba(76, 175, 80, 0.25)` | `rgba(var(--c-pill-money), 0.25)` |
| `.effect-pill--gpa` background | `rgba(33, 150, 243, 0.12)` | `rgba(var(--c-pill-gpa), 0.12)` |
| `.effect-pill--exploration` background | `rgba(255, 152, 0, 0.12)` | `rgba(var(--c-pill-exploration), 0.12)` |
| `.effect-pill--special` background | `rgba(171, 71, 188, 0.12)` | `rgba(var(--c-pill-special), 0.12)` |
| card overlay background | `rgba(0,0,0,0.65)` | `var(--c-overlay-dark)` |

**替换 compact-player.css 中的硬编码：**

| 位置 | 当前值 | 替换为 |
|------|--------|--------|
| `.compact-player-card--hospital` border-left | `#42A5F5` | `var(--c-hospital)` |

**替换 game.css 中的硬编码：**

| 位置 | 当前值 | 替换为 |
|------|--------|--------|
| 医院相关蓝色 | `#42A5F5` | `var(--c-hospital)` |

**注意:** 使用 `rgba(var(--c-pill-money), 0.12)` 语法要求 token 值为裸 RGB 数值（不含 `rgb()` 包裹），如上定义。

**涉及文件:**
- `client/src/styles/index.css` — 补充 Token
- `client/src/styles/cards.css` — 替换硬编码颜色
- `client/src/styles/compact-player.css` — 替换医院颜色
- `client/src/styles/game.css` — 替换医院颜色

### 2b. 桌面端动画去重

**现状:** 三个骰子按钮 glow 动画：
- `dice-btn-glow` (game.css) — 桌面端游戏页骰子，中等强度
- `pulse-glow` (action-bar.css) — 桌面端 Action Bar 骰子，较强
- `mobile-dice-glow` (mobile-nav.css) — 移动端底栏骰子，较弱（有意为之：小按钮防溢出）

**改动:**
- 合并 `pulse-glow`（action-bar.css）→ 引用 `dice-btn-glow`（game.css），删除 `pulse-glow` 的 `@keyframes` 声明
- 将 action-bar.css 中引用 `pulse-glow` 的 `animation-name` 改为 `dice-btn-glow`
- **保留** `mobile-dice-glow` 不动（移动端光晕强度有意降低）
- DiceRoller 的 `@keyframes dice-tumble` 翻滚动画完全不受影响

**涉及文件:**
- `client/src/styles/action-bar.css` — 删除 `@keyframes pulse-glow`，引用改为 `dice-btn-glow`

### 2c. 阴影规范化

**现状:** 阴影值在不同文件中硬编码，未使用 Token。

**改动:**

将以下硬编码值替换为 Token 引用：

| 文件 | 属性 | 当前值 | 替换为 | 备注 |
|------|------|--------|--------|------|
| cards.css (overlay) | background | `rgba(0,0,0,0.65)` | `var(--c-overlay-dark)` | 新增 token |
| plan-selection.css (modal backdrop) | background | `rgba(0,0,0,0.5)` | `var(--c-overlay-medium)` | 新增 token |

**不替换的阴影（视觉差异过大）：**
- cards.css thumbnail `box-shadow: 0 2px 8px rgba(0,0,0,0.3)` — 当前 `--shadow-md` 为 `0 4px 12px rgba(91,45,142,0.10)`（紫色调、更轻），替换会导致卡牌缩略图阴影几乎不可见。如需统一，应新增 `--shadow-card: 0 2px 8px rgba(0,0,0,0.3)` token，但这超出 MVP 范围。
- plan-selection.css modal `box-shadow: 0 8px 32px rgba(0,0,0,0.5)` — 同理，`--shadow-lg` 为 `0 8px 24px rgba(91,45,142,0.12)`，过轻。保留原值。

**涉及文件:**
- `client/src/styles/cards.css`
- `client/src/styles/plan-selection.css`

### 2d. 字重修正

**现状:** Token 定义 400/500/700/900 四档，但代码中有约 48 处（14个文件）使用 `font-weight: 600`。

**改动:**

全局搜索 `font-weight: 600`，按上下文替换：
- 标题/强调性文本 → `font-weight: 700`（bold）
- 次要强调文本 → `font-weight: 500`（medium）

判断标准：如果元素是 heading 或 primary label → 700；如果是 badge/tag/secondary text → 500。

**涉及文件:** 约 14 个 CSS 文件，48 处替换。每处需逐一判断上下文决定用 500 还是 700，不可盲目全局替换。

---

## 3. 音效补接

### 3a. 补接6种高价值音效

**现状:** 27种音效已定义在 `sounds.ts`，SocketProvider.tsx 已接入约16种。以下关键时刻仍静默：

| 音效 | 触发时机 | 当前状态 |
|------|---------|---------|
| `coin_gain` | 金钱增加 | ❌ 未接入 |
| `coin_loss` | 金钱减少 | ❌ 未接入 |
| `gpa_up` | GPA增加 | ❌ 未接入 |
| `gpa_down` | GPA减少 | ❌ 未接入 |
| `explore_up` | 探索值增加 | ❌ 未接入 |
| `card_use` | 玩家使用手牌 | ❌ 未接入 |

**改动:**

**资源变化音效（5种）— 在 `stateNotifications.ts` 或 `SocketProvider.tsx` 的 state diff 逻辑中接入：**

在 `SocketProvider.tsx` 的 `diffAndPlaySounds` 函数中，增加对本地玩家资源变化的检测：

```typescript
// 资源变化音效
if (localPlayer && prevLocal) {
  if (localPlayer.money > prevLocal.money) playSound('coin_gain');
  else if (localPlayer.money < prevLocal.money) playSound('coin_loss');

  if (localPlayer.gpa > prevLocal.gpa) playSound('gpa_up');
  else if (localPlayer.gpa < prevLocal.gpa) playSound('gpa_down');

  if (localPlayer.exploration > prevLocal.exploration) playSound('explore_up');
}
```

**卡牌使用音效（1种）— 乐观播放：**

服务端无 `game:card-used` 确认事件。卡牌使用成功通过 state update（heldCards 减少）反映。采用乐观播放策略：在客户端 `useCard` 调用处（GameScreen.tsx 中调用 socket emit 的位置）直接播放 `playSound('card_use')`。如果使用失败（收到 `game:card-use-error`），音效已播放但不会造成问题（失败是低频场景）。

**防刷机制：** 资源变化可能在单次 state update 中同时触发多种音效。在 `diffAndPlaySounds` 中使用优先级去重：单次 diff 只播放优先级最高的一个音效。优先级（高→低）：victory/victory_fanfare > bankrupt > hospital_enter > round_start > turn_start/turn_end > vote_start/vote_end > coin_gain/coin_loss/gpa_up/gpa_down/explore_up。资源变化类音效之间也取优先级最高的一个（避免同时播放 coin_gain + gpa_up + explore_up）。

**暂不接入的音效及理由：**

| 音效 | 理由 |
|------|------|
| `piece_step` / `piece_land` | 需深入 PixiJS 动画层，改动大且频繁触发可能造成噪音 |
| `card_flip` | 需配合卡牌翻转动画，当前无此动画 |
| `vote_cast` | 投票场景出现频率低 |
| `button_click` / `tab_switch` | UI 音效容易令人烦躁，留给后续迭代收集反馈后决定 |

**涉及文件:**
- `client/src/context/SocketProvider.tsx` — diffAndPlaySounds 增加资源变化检测 + card_use 事件

---

## 4. 结算页与收尾

### 4a. 结算页增加分享卡片生成

**现状:** SettlementScreen 仅有排名表 + 重新开始/返回大厅按钮，缺乏传播动力。

**改动:**

在结算页底部增加 **"生成分享卡片"** 按钮，点击后生成一张可保存的图片。

**分享卡片规格：**
- 尺寸：750×1334px（竖版，适配微信朋友圈）
- 技术：使用 Canvas API 直接绘制（不引入 html2canvas 等新依赖）

**卡片布局（从上到下）：**

```
┌──────────────────────────┐
│                          │
│   🎓 菜根人生            │  标题区：游戏名 + "南大版大富翁"
│   南大版大富翁            │  背景：紫金渐变
│                          │
├──────────────────────────┤
│                          │
│   🏆 [玩家名] 获胜！     │  胜者区：大字显示
│                          │
│   凭借 [胜利条件] 获胜    │  胜利条件文案
│                          │
├──────────────────────────┤
│                          │
│   💰 3400  📚 3.8  🐋 15 │  终局数据区
│   ⏱ 12回合  👥 4人局     │
│                          │
├──────────────────────────┤
│                          │
│   1. 🥇 Alice            │  排名区（简化版）
│   2. 🥈 Bob              │
│   3. 🥉 Carol            │
│   4.    Dave              │
│                          │
├──────────────────────────┤
│                          │
│   richer.nju.top          │  底部：域名/邀请文案
│   "来南大重走青春路"       │
│                          │
└──────────────────────────┘
```

**实现细节：**
- 新建 `client/src/components/ShareCard.tsx`
- 使用 `<canvas>` 元素 offscreen 绘制，绘制完成后转为 Blob
- "保存图片"按钮触发 `canvas.toBlob()` → `URL.createObjectURL()` → `<a download>` 触发下载
- 颜色复用 DESIGN_TOKENS 中的值（品牌紫、金色、奶油白）
- **CJK 字体加载：** Canvas 绘制前必须确保 `Noto Sans SC` 字体已加载，使用 `await document.fonts.ready` 或 `document.fonts.load('bold 28px "Noto Sans SC"')` 等待字体就绪后再调用 `ctx.fillText()`，否则 Canvas 会用 fallback 字体渲染中文
- 不引入第三方分享 SDK，用户在微信内长按保存图片即可分享

**涉及文件：**
- 新建 `client/src/components/ShareCard.tsx`
- `client/src/components/SettlementScreen.tsx` — 增加"生成分享卡片"按钮 + 预览弹窗

### 4b. 培养计划难度数据文件

**改动:**

新建 `shared/src/plan-difficulty.ts`：

```typescript
export type PlanDifficulty = 'easy' | 'medium' | 'hard';

// 基于 5000 局 4人局模拟数据（2026-03-07）
// easy: 胜率 > 35%  |  medium: 20%-35%  |  hard: < 20%
export const PLAN_DIFFICULTY: Record<string, PlanDifficulty> = {
  plan_tianwen: 'easy',        // 天文与空间科学学院 46.2%
  plan_zhengguan: 'easy',      // 政府管理学院 39.6%
  plan_wenxue: 'easy',         // 文学院 39.0%
  plan_xiandai: 'easy',        // 现代工程与应用科学学院 38.1%
  plan_wuli: 'easy',           // 物理学院 35.6%
  plan_diqiu: 'medium',        // 地球科学与工程学院 31.9%
  plan_zhexue: 'medium',       // 哲学系 31.9%
  plan_shengming: 'medium',    // 生命科学学院 29.3%
  plan_makesi: 'medium',       // 马克思主义学院 27.8%
  plan_xinxi: 'medium',        // 信息管理学院 27.1%
  plan_shangxue: 'medium',     // 商学院 27.1%
  plan_dianzi: 'medium',       // 电子科学与工程学院 25.8%
  plan_jianzhu: 'medium',      // 建筑与城市规划学院 25.5%
  plan_kuangyaming: 'medium',  // 匡亚明学院 25.4%
  plan_lishi: 'medium',        // 历史学院 25.0%
  plan_huanjing: 'medium',     // 环境学院 23.8%
  plan_ruanjian: 'medium',     // 软件学院 23.5%
  plan_gongguan: 'medium',     // 工程管理学院 23.3%
  plan_shuxue: 'medium',       // 数学系 23.1%
  plan_huaxue: 'medium',       // 化学化工学院 23.0%
  plan_xinwen: 'medium',       // 新闻传播学院 22.8%
  plan_shehuixue: 'medium',    // 社会学院 22.2%
  plan_dili: 'medium',         // 地理与海洋科学学院 21.2%
  plan_faxue: 'medium',        // 法学院 21.2%
  plan_jisuanji: 'medium',     // 计算机科学与技术系 20.9%
  plan_guoji: 'medium',        // 国际关系学院 20.8%
  plan_daqi: 'hard',           // 大气科学学院 18.6%
  plan_yishu: 'hard',          // 艺术学院 17.6%
  plan_waiguoyu: 'hard',       // 外国语学院 17.5%
  plan_suzhou: 'hard',         // 苏州校区 15.4%
  plan_yixue: 'hard',          // 医学院 15.0%
  plan_rengong: 'hard',        // 人工智能学院 14.6%
  plan_haiwai: 'hard',         // 海外教育学院 10.3%
};

export const DIFFICULTY_LABEL: Record<PlanDifficulty, string> = {
  easy: '⭐ 简单',
  medium: '⭐⭐ 中等',
  hard: '⭐⭐⭐ 困难',
};
```

**涉及文件:**
- 新建 `shared/src/plan-difficulty.ts`
- `shared/src/index.ts` — 导出新模块

---

## 明确排除项

以下改动**不在本方案范围内**，留给后续方案B（核心体验修复）：

- ❌ 经济系统重平衡（金钱对胜率影响提升）
- ❌ 卡牌系统增强（增加使用场景和收益）
- ❌ 天文学院等偏强计划数值调整
- ❌ 游戏节奏优化（后期加速机制）
- ❌ 等待体验 / 旁观者互动系统
- ❌ 移动端手势优化（长按预览等）
- ❌ 赛季 / 排位系统
- ❌ 交互式引导局（AI陪练）

---

## 完整改动清单

| # | 改动 | 涉及文件 | 新建文件 | 估计量 |
|---|------|---------|---------|--------|
| 1a | 激活5步 Modal 教程 + 重设样式 | tutorial/TutorialSystem.tsx, GameScreen.tsx | — | 中 |
| 1b | 大厅规则速查入口 | Lobby.tsx | RuleDrawer.tsx | 中 |
| 1c | 计划难度标签 | PlanSelectionPanel.tsx | shared/plan-difficulty.ts | 小 |
| 2a | 颜色 Token 统一 | index.css, cards.css, compact-player.css, game.css | — | 中 |
| 2b | 桌面端动画去重 | action-bar.css | — | 小 |
| 2c | 阴影规范化 | cards.css, plan-selection.css | — | 小 |
| 2d | 字重修正 | 14个 CSS 文件（48处） | — | 中 |
| 3a | 补接6种音效 | SocketProvider.tsx, GameScreen.tsx | — | 小 |
| 4a | 结算页分享卡片 | SettlementScreen.tsx | ShareCard.tsx | 中 |
| 4b | 计划难度数据 | shared/index.ts | shared/plan-difficulty.ts | 小 |

**总计：修改约 12 个现有文件，新建 3 个文件。无破坏性改动，不碰游戏逻辑和服务端。**
