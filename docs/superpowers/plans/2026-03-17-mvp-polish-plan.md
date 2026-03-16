# MVP Polish 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用最少改动将菜根人生从"可玩"提升到"可发行给南大同学"的商业级水平

**Architecture:** 纯客户端 + shared 包改动，不碰服务端。4个独立工作流：新手引导、视觉一致性、音效补接、结算分享。每个工作流可独立完成和测试。

**Tech Stack:** React 18 + TypeScript, CSS Custom Properties, Web Audio API, Canvas API

**Spec:** `docs/superpowers/specs/2026-03-17-mvp-polish-design.md`

---

## Chunk 1: 新手引导 (Tasks 1-3)

### Task 1: 培养计划难度数据文件

**Files:**
- Create: `shared/src/plan-difficulty.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1:** 创建难度数据文件

```typescript
// shared/src/plan-difficulty.ts
export type PlanDifficulty = 'easy' | 'medium' | 'hard';

// 基于 5000 局 4人局模拟数据（2026-03-07）
// easy: 胜率 > 35%  |  medium: 20%-35%  |  hard: < 20%
export const PLAN_DIFFICULTY: Record<string, PlanDifficulty> = {
  plan_tianwen: 'easy',
  plan_zhengguan: 'easy',
  plan_wenxue: 'easy',
  plan_xiandai: 'easy',
  plan_wuli: 'easy',
  plan_diqiu: 'medium',
  plan_zhexue: 'medium',
  plan_shengming: 'medium',
  plan_makesi: 'medium',
  plan_xinxi: 'medium',
  plan_shangxue: 'medium',
  plan_dianzi: 'medium',
  plan_jianzhu: 'medium',
  plan_kuangyaming: 'medium',
  plan_lishi: 'medium',
  plan_huanjing: 'medium',
  plan_ruanjian: 'medium',
  plan_gongguan: 'medium',
  plan_shuxue: 'medium',
  plan_huaxue: 'medium',
  plan_xinwen: 'medium',
  plan_shehuixue: 'medium',
  plan_dili: 'medium',
  plan_faxue: 'medium',
  plan_jisuanji: 'medium',
  plan_guoji: 'medium',
  plan_daqi: 'hard',
  plan_yishu: 'hard',
  plan_waiguoyu: 'hard',
  plan_suzhou: 'hard',
  plan_yixue: 'hard',
  plan_rengong: 'hard',
  plan_haiwai: 'hard',
};

export const DIFFICULTY_LABEL: Record<PlanDifficulty, string> = {
  easy: '⭐ 简单',
  medium: '⭐⭐ 中等',
  hard: '⭐⭐⭐ 困难',
};

export const DIFFICULTY_COLOR: Record<PlanDifficulty, string> = {
  easy: 'var(--c-success)',
  medium: 'var(--c-accent)',
  hard: 'var(--c-danger)',
};
```

- [ ] **Step 2:** 在 shared/src/index.ts 中导出

在 `shared/src/index.ts` 末尾追加：
```typescript
export * from './plan-difficulty.js';
```

- [ ] **Step 3:** 构建 shared 包验证编译通过

Run: `cd shared && npm run build`
Expected: 编译成功，无报错

- [ ] **Step 4:** Commit

```bash
git add shared/src/plan-difficulty.ts shared/src/index.ts
git commit -m "feat(shared): add plan difficulty data based on 5000-game simulation"
```

---

### Task 2: 培养计划选择面板增加难度标签

**Files:**
- Modify: `client/src/components/PlanSelectionPanel.tsx`
- Modify: `client/src/styles/plan-selection.css`

- [ ] **Step 1:** 在 PlanSelectionPanel.tsx 顶部导入难度数据

在现有 import 区域添加：
```typescript
import { PLAN_DIFFICULTY, DIFFICULTY_LABEL, DIFFICULTY_COLOR } from '@nannaricher/shared';
```

- [ ] **Step 2:** 在计划卡片渲染中添加难度 badge

找到 `plan-selection__item` 的渲染位置（约 line 135-156 和 165-192），在每个计划名称旁添加难度标签。

在计划名称 `<span>` 后添加：
```tsx
{PLAN_DIFFICULTY[plan.id] && (
  <span
    className="plan-difficulty-badge"
    style={{
      color: DIFFICULTY_COLOR[PLAN_DIFFICULTY[plan.id]],
      borderColor: DIFFICULTY_COLOR[PLAN_DIFFICULTY[plan.id]],
    }}
  >
    {DIFFICULTY_LABEL[PLAN_DIFFICULTY[plan.id]]}
  </span>
)}
```

确保在 **两处** plan card 渲染位置（已有计划列表 + 新抽取计划列表）都添加。

- [ ] **Step 3:** 在 plan-selection.css 中添加 badge 样式

在文件末尾追加：
```css
.plan-difficulty-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px solid;
  background: transparent;
  white-space: nowrap;
  margin-left: 6px;
  vertical-align: middle;
}
```

- [ ] **Step 4:** 启动客户端验证渲染正常

Run: `cd client && npm run dev`
打开浏览器进入游戏，进入培养计划选择阶段，确认难度标签正确显示。

- [ ] **Step 5:** Commit

```bash
git add client/src/components/PlanSelectionPanel.tsx client/src/styles/plan-selection.css
git commit -m "feat: add difficulty labels to training plan selection cards"
```

---

### Task 3: 激活 Modal 教程（5步精简版）

**Files:**
- Modify: `client/src/tutorial/TutorialSystem.tsx`
- Modify: `client/src/components/GameScreen.tsx`

- [ ] **Step 1:** 精简 TutorialSystem.tsx 的步骤为5步

打开 `client/src/tutorial/TutorialSystem.tsx`，将 `TUTORIAL_STEPS` 数组（约 line 17-77）替换为：

```typescript
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: '🎓 欢迎来到菜根人生',
    content: '这是南大版大富翁——投骰子走格子，在4年大学生活中成长！',
    position: 'center',
  },
  {
    id: 'resources',
    title: '📊 三大资源',
    content: '💰金钱 📚GPA 🐋探索值——当 GPA×10 + 探索值 ≥ 60 即可获胜',
    position: 'center',
  },
  {
    id: 'board',
    title: '🗺️ 棋盘与支线',
    content: '主棋盘28格围成一圈，还有8条支线可以进入，各有独特事件和奖励',
    position: 'center',
  },
  {
    id: 'plans',
    title: '🎯 培养计划',
    content: '大二起每年选专业方向，每个专业有独特的被动能力和胜利条件——这是另一种赢法！',
    position: 'center',
  },
  {
    id: 'cards',
    title: '🃏 卡牌',
    content: '踩到机会/命运格会抽卡。有些卡立即生效，有些可保留在手中择机使用',
    position: 'center',
  },
];
```

注意：`TutorialStep` 接口要求 `id`（必填）和 `position`（可选），不支持 `icon` 字段。emoji 放在 title 中显示。

- [ ] **Step 2:** 重设 TutorialSystem 的 inline style 匹配奶油紫金主题

当前组件使用暗色 inline styles。修改组件内的样式常量，将颜色改为与设计系统一致：

- 背景：`#F5EDE0`（奶油色）→ `var(--c-bg)` 或直接 `#F5EDE0`
- 标题色：`#FFB300`（金色）
- 正文色：`#2A2018`（深棕）
- 按钮背景：`#5B2D8E`（品牌紫）
- 按钮文字：`#FFFFFF`
- 遮罩层：`rgba(42, 32, 24, 0.7)`
- 步骤指示器活跃色：`#FFB300`
- 步骤指示器非活跃色：`rgba(91, 45, 142, 0.3)`

具体需要修改组件内所有 `style={{ ... }}` 中的颜色值。由于这是 inline style 组件，直接在 JSX 中替换颜色即可。

- [ ] **Step 3:** 在 GameScreen.tsx 中导入并渲染 Modal 教程

在 `client/src/components/GameScreen.tsx` 顶部 import 区域（约 line 25 附近）添加：
```typescript
import { TutorialSystem as ModalTutorial } from '../tutorial/TutorialSystem';
```

注意：已有的 `import { TutorialSystem } from '../features/tutorial/TutorialSystem'` 保持不变（这是 Tooltip 版）。使用别名 `ModalTutorial` 避免命名冲突。

在组件内添加状态：
```typescript
const [showModalTutorial, setShowModalTutorial] = useState(() => {
  return !localStorage.getItem('tutorial_completed');
});
```

在 JSX 渲染区域（约 line 756 `<TutorialSystem />` 之前）添加：
```tsx
{showModalTutorial && (
  <ModalTutorial
    onComplete={() => {
      localStorage.setItem('tutorial_completed', 'true');
      setShowModalTutorial(false);
    }}
  />
)}
```

如果 `ModalTutorial` 的 `onComplete` prop 名称不同，根据实际组件代码调整。

- [ ] **Step 4:** 验证教程流程

Run: `cd client && npm run dev`
1. 清除 localStorage: 浏览器 DevTools → Application → Local Storage → 删除 `tutorial_completed`
2. 进入游戏，应自动弹出 Modal 教程
3. 点击"下一步"逐步浏览5个步骤
4. 完成后教程消失，刷新页面不再显示
5. 验证触发式 Tooltip（首次投骰等）仍正常工作

- [ ] **Step 5:** Commit

```bash
git add client/src/tutorial/TutorialSystem.tsx client/src/components/GameScreen.tsx
git commit -m "feat: activate 5-step modal tutorial for first-time players"
```

---

## Chunk 2: 视觉一致性修复 (Tasks 4-7)

### Task 4: 颜色 Token 补充

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1:** 在 `:root` 变量区域（约 line 97-110 资源颜色之后）补充新 Token

```css
/* 医院状态 */
--c-hospital: #42A5F5;

/* 卡牌渐变色 */
--c-card-chance-thumb-start: #1565C0;
--c-card-chance-thumb-end: #42A5F5;
--c-card-chance-header-start: #0D47A1;
--c-card-chance-header-mid: #1976D2;
--c-card-chance-header-end: #42A5F5;
--c-card-destiny-start: #4A148C;
--c-card-destiny-mid: #7B1FA2;
--c-card-destiny-thumb-end: #BA68C8;
--c-card-destiny-end: #AB47BC;

/* 卡牌效果药丸 RGB 值 */
--c-pill-money: 76, 175, 80;
--c-pill-gpa: 33, 150, 243;
--c-pill-exploration: 255, 152, 0;
--c-pill-special: 171, 71, 188;

/* 遮罩层背景色 */
--c-overlay-dark: rgba(0, 0, 0, 0.65);
--c-overlay-medium: rgba(0, 0, 0, 0.5);
```

- [ ] **Step 2:** Commit

```bash
git add client/src/index.css
git commit -m "feat: add missing CSS tokens for hospital, cards, pills, overlays"
```

---

### Task 5: cards.css 和 compact-player.css 硬编码颜色替换

**Files:**
- Modify: `client/src/styles/cards.css`
- Modify: `client/src/styles/compact-player.css`
- Modify: `client/src/styles/game.css`

- [ ] **Step 1:** 替换 cards.css 中的卡牌渐变硬编码

搜索并替换以下内容（注意精确匹配行内容）：

**thumbnail chance gradient（约 line 80-83）：**
- 将 `#1565C0` 替换为 `var(--c-card-chance-thumb-start)`
- 将 `#42A5F5` 替换为 `var(--c-card-chance-thumb-end)`

**thumbnail destiny gradient：**
- 将 `#7B1FA2` 替换为 `var(--c-card-destiny-mid)`
- 将 `#BA68C8` 保持不变（或新增 token `--c-card-destiny-thumb-end: #BA68C8`）

注意：thumbnail 使用 `#BA68C8` 而 header 使用 `#AB47BC`，两者不同。不要将 thumbnail 的颜色替换为 `var(--c-card-destiny-end)`（那是 `#AB47BC`），否则会导致可见的颜色偏移。

**detail header chance gradient（约 line 245-246）：**
- 将 `#0D47A1` 替换为 `var(--c-card-chance-header-start)`
- 将 `#1976D2` 替换为 `var(--c-card-chance-header-mid)`
- 将 `#42A5F5` 替换为 `var(--c-card-chance-header-end)`

**detail header destiny gradient（约 line 248-249）：**
- 将 `#4A148C` 替换为 `var(--c-card-destiny-start)`
- 将 `#7B1FA2` 替换为 `var(--c-card-destiny-mid)`
- 将 `#AB47BC` 替换为 `var(--c-card-destiny-end)`

- [ ] **Step 2:** 替换 cards.css 中的效果药丸硬编码

替换 `.effect-pill--money`（约 line 376-380）：
```css
.effect-pill--money {
  background: rgba(var(--c-pill-money), 0.12);
  color: #81C784;
  border: 1px solid rgba(var(--c-pill-money), 0.25);
}
```

替换 `.effect-pill--gpa`（约 line 381-385）：
```css
.effect-pill--gpa {
  background: rgba(var(--c-pill-gpa), 0.12);
  color: #64B5F6;
  border: 1px solid rgba(var(--c-pill-gpa), 0.25);
}
```

替换 `.effect-pill--exploration`（约 line 386-390）：
```css
.effect-pill--exploration {
  background: rgba(var(--c-pill-exploration), 0.12);
  color: #FFB74D;
  border: 1px solid rgba(var(--c-pill-exploration), 0.25);
}
```

替换 `.effect-pill--special`（约 line 391-395）：
```css
.effect-pill--special {
  background: rgba(var(--c-pill-special), 0.12);
  color: #CE93D8;
  border: 1px solid rgba(var(--c-pill-special), 0.25);
}
```

- [ ] **Step 3:** 替换 cards.css 中的遮罩层颜色

找到 `card-detail-overlay` 的 background `rgba(0,0,0,0.65)` 替换为 `var(--c-overlay-dark)`。

- [ ] **Step 4:** 替换 compact-player.css 和 game.css 中的医院蓝色

在 `compact-player.css` 中搜索 `#42A5F5` 替换为 `var(--c-hospital)`。
在 `game.css` 中搜索 `#42A5F5` 替换为 `var(--c-hospital)`。

- [ ] **Step 5:** 启动客户端验证视觉无变化

Run: `cd client && npm run dev`
验证：卡牌缩略图、卡牌详情、效果药丸、遮罩层、医院状态的颜色与修改前完全一致（Token 值与原硬编码值相同）。

- [ ] **Step 6:** Commit

```bash
git add client/src/styles/cards.css client/src/styles/compact-player.css client/src/styles/game.css
git commit -m "refactor: replace hardcoded colors with CSS tokens in card and player styles"
```

---

### Task 6: 桌面端动画去重

**Files:**
- Modify: `client/src/styles/action-bar.css`

- [ ] **Step 1:** 删除 action-bar.css 中的 `@keyframes pulse-glow` 定义

删除约 line 110-113 的整个 `@keyframes pulse-glow { ... }` 块。

- [ ] **Step 2:** 将引用 `pulse-glow` 的 animation-name 改为 `dice-btn-glow`

在 action-bar.css 中搜索 `pulse-glow`，将 `animation: pulse-glow` 改为 `animation: dice-btn-glow`（约 line 107）。

- [ ] **Step 3:** 验证桌面端骰子按钮光晕动画正常

Run: `cd client && npm run dev`
在桌面端浏览器中进入游戏，轮到自己时骰子按钮应有呼吸光晕效果。

- [ ] **Step 4:** Commit

```bash
git add client/src/styles/action-bar.css
git commit -m "refactor: deduplicate desktop dice button glow animation"
```

---

### Task 7: 字重修正

**Files:**
- Modify: 约 14 个 CSS 文件

- [ ] **Step 1:** 全局搜索 `font-weight: 600` 并逐一替换

搜索 `client/src` 目录下**所有** CSS 文件（包括 `styles/` 和 `components/` 子目录）中的 `font-weight: 600`。

实际数量约 77 处，分布在 `styles/` 和 `components/` 两个目录中的约 25 个 CSS 文件里。

**替换规则：**
- 如果是 heading/title/label 类元素 → `font-weight: 700`
- 如果是 badge/tag/caption/secondary 类元素 → `font-weight: 500`

逐一检查每个匹配项的上下文做判断。不可盲目全局替换。

- [ ] **Step 2:** 验证主要页面的文字粗细无明显视觉异常

Run: `cd client && npm run dev`
检查：大厅、等待房、游戏画面、卡牌详情、培养计划选择、结算页的文字粗细是否协调。

- [ ] **Step 3:** Commit

```bash
git add -u client/src/styles/ client/src/components/
git commit -m "refactor: normalize font-weight from 600 to 500/700 per design tokens"
```

---

## Chunk 3: 音效补接 + 结算分享 (Tasks 8-10)

### Task 8: 补接资源变化和卡牌使用音效

**Files:**
- Modify: `client/src/context/SocketProvider.tsx`
- Modify: `client/src/components/GameScreen.tsx`

- [ ] **Step 1:** 在 SocketProvider.tsx 的 `diffAndPlaySounds` 函数中增加资源变化音效

找到 `diffAndPlaySounds` 函数（约 line 28-88），在函数末尾（return 之前）添加资源变化检测：

修改方式：在函数开头声明 `let highPrioritySoundPlayed = false;`，在每个现有 `playSound(...)` 调用后加 `highPrioritySoundPlayed = true;`，然后在函数末尾添加资源变化检测（仅在无高优先级音效时播放）。

具体改动：

**Step 1a:** 在 `diffAndPlaySounds` 函数体开头（约 line 32）添加：
```typescript
let highPrioritySoundPlayed = false;
```

**Step 1b:** 在函数内每个现有 `playSound(...)` 调用后追加 `highPrioritySoundPlayed = true;`。例如：
```typescript
playSound('round_start');
highPrioritySoundPlayed = true;
```
对所有现有的 playSound 调用都做同样处理（约8-10处）。

**Step 1c:** 在函数末尾（return 之前）添加资源变化检测：
```typescript
// 资源变化音效 — 仅在无高优先级音效时播放
if (!highPrioritySoundPlayed) {
  const prevLocal = prev?.players.find(p => p.id === localPlayerId);
  const currLocal = next?.players.find(p => p.id === localPlayerId);
  if (prevLocal && currLocal) {
    const moneyDelta = currLocal.money - prevLocal.money;
    const gpaDelta = currLocal.gpa - prevLocal.gpa;
    const exploreDelta = currLocal.exploration - prevLocal.exploration;

    if (moneyDelta !== 0 || gpaDelta !== 0 || exploreDelta !== 0) {
      // 单次 diff 只播放一个资源音效，按归一化绝对值最大的选择
      const absChanges = [
        { key: 'money' as const, abs: Math.abs(moneyDelta), delta: moneyDelta },
        { key: 'gpa' as const, abs: Math.abs(gpaDelta * 1000), delta: gpaDelta },
        { key: 'explore' as const, abs: Math.abs(exploreDelta * 10), delta: exploreDelta },
      ];
      const biggest = absChanges.sort((a, b) => b.abs - a.abs)[0];
      if (biggest.key === 'money') {
        playSound(biggest.delta > 0 ? 'coin_gain' : 'coin_loss');
      } else if (biggest.key === 'gpa') {
        playSound(biggest.delta > 0 ? 'gpa_up' : 'gpa_down');
      } else if (biggest.delta > 0) {
        playSound('explore_up');
      }
    }
  }
}
```

注意：参数名是 `localPlayerId`（不是 `localId`），与函数签名一致。

- [ ] **Step 2:** 在 GameScreen.tsx 的 useCard 调用处添加乐观音效

找到 GameScreen.tsx 中调用 `useCard`（rawUseCard）的位置（约 line 95-98），在 emit 之前添加：

```typescript
import { playSound } from '../audio/AudioManager';

// 在 useCard wrapper 中：
playSound('card_use');
```

- [ ] **Step 3:** 验证音效播放

Run: `cd client && npm run dev`
1. 确保音频已开启（header 右上角喇叭图标）
2. 投骰子移动后，如果金钱/GPA/探索值变化，应听到对应音效
3. 使用手牌时应听到 card_use 音效
4. 确认高优先级音效（回合开始、投骰等）仍正常，不会被资源音效覆盖

- [ ] **Step 4:** Commit

```bash
git add client/src/context/SocketProvider.tsx client/src/components/GameScreen.tsx
git commit -m "feat: connect resource change and card use sound effects"
```

---

### Task 9: 结算页分享卡片

**Files:**
- Create: `client/src/components/ShareCard.tsx`
- Modify: `client/src/components/SettlementScreen.tsx`

- [ ] **Step 1:** 创建 ShareCard 组件

新建 `client/src/components/ShareCard.tsx`：

```tsx
import { useState, useRef, useCallback } from 'react';

interface ShareCardProps {
  winnerName: string;
  winCondition: string;
  money: number;
  gpa: number;
  exploration: number;
  roundNumber: number;
  playerCount: number;
  rankings: Array<{ name: string; rank: number }>;
  onClose: () => void;
}

export function ShareCard(props: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    // 等待字体加载
    await document.fonts.load('bold 28px "Noto Sans SC"');
    await document.fonts.ready;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 750, H = 1334;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // 背景
    ctx.fillStyle = '#F5EDE0';
    ctx.fillRect(0, 0, W, H);

    // 标题区（紫金渐变）
    const titleGrad = ctx.createLinearGradient(0, 0, W, 200);
    titleGrad.addColorStop(0, '#5B2D8E');
    titleGrad.addColorStop(1, '#7B4DB8');
    ctx.fillStyle = titleGrad;
    ctx.fillRect(0, 0, W, 200);

    ctx.fillStyle = '#FFB300';
    ctx.font = 'bold 42px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎓 菜根人生', W / 2, 90);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '22px "Noto Sans SC", sans-serif';
    ctx.fillText('南大版大富翁', W / 2, 140);

    // 胜者区
    ctx.fillStyle = '#2A2018';
    ctx.font = 'bold 36px "Noto Sans SC", sans-serif';
    ctx.fillText(`🏆 ${props.winnerName} 获胜！`, W / 2, 300);
    ctx.fillStyle = '#5B2D8E';
    ctx.font = '20px "Noto Sans SC", sans-serif';
    ctx.fillText(props.winCondition, W / 2, 350);

    // 数据区
    const y0 = 440;
    ctx.fillStyle = 'rgba(91,45,142,0.08)';
    roundRect(ctx, 60, y0 - 40, W - 120, 120, 16);
    ctx.fill();

    ctx.fillStyle = '#2A2018';
    ctx.font = 'bold 26px "Noto Sans SC", sans-serif';
    ctx.fillText(
      `💰 ${props.money}   📚 ${props.gpa.toFixed(1)}   🐋 ${props.exploration}`,
      W / 2, y0 + 10
    );
    ctx.font = '18px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(
      `⏱ ${props.roundNumber}回合  ·  👥 ${props.playerCount}人局`,
      W / 2, y0 + 50
    );

    // 排名区
    const ry = 620;
    ctx.textAlign = 'left';
    const medals = ['🥇', '🥈', '🥉'];
    props.rankings.slice(0, 6).forEach((r, i) => {
      ctx.fillStyle = '#2A2018';
      ctx.font = '24px "Noto Sans SC", sans-serif';
      const medal = i < 3 ? medals[i] : `${i + 1}.`;
      ctx.fillText(`  ${medal}  ${r.name}`, 120, ry + i * 50);
    });

    // 底部
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5B2D8E';
    ctx.font = 'bold 24px "Noto Sans SC", sans-serif';
    ctx.fillText('richer.nju.top', W / 2, H - 120);
    ctx.fillStyle = '#999';
    ctx.font = '18px "Noto Sans SC", sans-serif';
    ctx.fillText('来南大重走青春路', W / 2, H - 80);

    // 转为图片URL
    canvas.toBlob((blob) => {
      if (blob) setImageUrl(URL.createObjectURL(blob));
      setGenerating(false);
    }, 'image/png');
  }, [props]);

  const download = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = '菜根人生-战绩.png';
    a.click();
  };

  return (
    <div className="share-card-overlay" onClick={props.onClose}>
      <div className="share-card-modal" onClick={e => e.stopPropagation()}>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {!imageUrl ? (
          <button
            className="settlement-btn settlement-btn--primary"
            onClick={generate}
            disabled={generating}
          >
            {generating ? '生成中...' : '生成分享卡片'}
          </button>
        ) : (
          <>
            <img src={imageUrl} alt="分享卡片" style={{ maxWidth: '100%', borderRadius: 12 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="settlement-btn settlement-btn--primary" onClick={download}>
                保存图片
              </button>
              <button className="settlement-btn settlement-btn--secondary" onClick={props.onClose}>
                关闭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
```

- [ ] **Step 2:** 在 SettlementScreen.tsx 中集成分享功能

在 `client/src/components/SettlementScreen.tsx` 中：

1. 导入 ShareCard：
```typescript
import { ShareCard } from './ShareCard';
```

2. 添加状态：
```typescript
const [showShare, setShowShare] = useState(false);
```

3. 在 action buttons 区域（约 line 292-300）添加分享按钮：
```tsx
<button
  className="settlement-btn settlement-btn--secondary"
  onClick={() => setShowShare(true)}
>
  📤 分享结果
</button>
```

4. 在组件 JSX 末尾（return 的最后一个 `</div>` 之前）渲染 ShareCard：
```tsx
{showShare && winner && (() => {
  // winner 对象只有 { playerId, playerName, condition }
  // 资源数据需从 gameState.players 中查找
  const winnerPlayer = gameState.players.find(p => p.id === winner.playerId);
  return (
    <ShareCard
      winnerName={winner.playerName}
      winCondition={winner.condition || 'GPA×10 + 探索值 ≥ 60'}
      money={winnerPlayer?.money ?? 0}
      gpa={winnerPlayer?.gpa ?? 0}
      exploration={winnerPlayer?.exploration ?? 0}
      roundNumber={gameState.roundNumber}
      playerCount={gameState.players.length}
      rankings={rankPlayers().map((p, i) => ({ name: p.playerName, rank: i + 1 }))}
      onClose={() => setShowShare(false)}
    />
  );
})()}
```

注意：`winner` 类型是 `WinnerInfo { playerId, playerName, condition }`，不包含 money/gpa/exploration。需要从 `gameState.players` 中按 playerId 查找对应玩家的资源数据。变量名需根据 SettlementScreen 的实际代码调整。

- [ ] **Step 3:** 添加 ShareCard overlay 的最小 CSS

在 `client/src/styles/game.css` 末尾追加（或新建 share-card.css 并在 SettlementScreen 中 import）：

```css
.share-card-overlay {
  position: fixed;
  inset: 0;
  background: var(--c-overlay-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}
.share-card-modal {
  background: var(--c-surface);
  border-radius: 16px;
  padding: 20px;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
  text-align: center;
}
```

- [ ] **Step 4:** 验证分享卡片功能

Run: `cd client && npm run dev`
1. 完成一局游戏（或通过 admin 工具快速结束）
2. 在结算页点击"📤 分享结果"
3. 点击"生成分享卡片"
4. 确认图片正确显示：标题、胜者、数据、排名、域名
5. 点击"保存图片"确认下载正常
6. 检查中文字体是否正常渲染（不是方块或 fallback 字体）

- [ ] **Step 5:** Commit

```bash
git add client/src/components/ShareCard.tsx client/src/components/SettlementScreen.tsx client/src/styles/game.css
git commit -m "feat: add shareable result card generation on settlement screen"
```

---

### Task 10: 大厅规则速查入口

**Files:**
- Create: `client/src/components/RuleDrawer.tsx`
- Modify: `client/src/components/Lobby.tsx`

- [ ] **Step 1:** 创建 RuleDrawer 组件

新建 `client/src/components/RuleDrawer.tsx`：

```tsx
import { useState } from 'react';
import { PLAN_DIFFICULTY, DIFFICULTY_LABEL } from '@nannaricher/shared';

interface RuleDrawerProps {
  open: boolean;
  onClose: () => void;
}

type TabId = 'basics' | 'plans' | 'cards' | 'lines';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'basics', label: '基础规则' },
  { id: 'plans', label: '培养计划' },
  { id: 'cards', label: '卡牌' },
  { id: 'lines', label: '支线' },
];

export function RuleDrawer({ open, onClose }: RuleDrawerProps) {
  const [tab, setTab] = useState<TabId>('basics');

  if (!open) return null;

  return (
    <>
      <div className="rule-drawer-backdrop" onClick={onClose} />
      <div className="rule-drawer">
        <div className="rule-drawer__header">
          <h2>📖 游戏规则</h2>
          <button className="rule-drawer__close" onClick={onClose}>✕</button>
        </div>
        <div className="rule-drawer__tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`rule-drawer__tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="rule-drawer__content">
          {tab === 'basics' && <BasicsTab />}
          {tab === 'plans' && <PlansTab />}
          {tab === 'cards' && <CardsTab />}
          {tab === 'lines' && <LinesTab />}
        </div>
      </div>
    </>
  );
}

function BasicsTab() {
  return (
    <div className="rule-section">
      <h3>游戏流程</h3>
      <p>2-6名玩家参与，模拟4年南大校园生活。每年6回合，共24回合。</p>
      <p>每回合：投骰子→移动→触发格子事件→下一位玩家。</p>

      <h3>胜利条件</h3>
      <p><strong>基础胜利：</strong>GPA × 10 + 探索值 ≥ 60</p>
      <p><strong>计划胜利：</strong>完成你主修培养计划的专属胜利条件</p>

      <h3>三大资源</h3>
      <p>💰 <strong>金钱</strong> — 支付入场费、事件费用</p>
      <p>📚 <strong>GPA</strong> — 学业成绩，影响学费和胜利</p>
      <p>🐋 <strong>探索值</strong> — 课外活动积累，影响胜利</p>

      <h3>特殊格子</h3>
      <p>🏠 <strong>起点</strong> — 经过+500，停留+600</p>
      <p>🏥 <strong>校医院</strong> — 投≥3离开 或 付250</p>
      <p>🔔 <strong>鼎</strong> — 停留一回合</p>
      <p>🚏 <strong>候车厅</strong> — 付200可传送到任意格</p>
    </div>
  );
}

function PlansTab() {
  // 硬编码精简版计划列表（数据源于 server/src/data/trainingPlans.ts）
  const plans = [
    { id: 'plan_tianwen', name: '天文与空间科学学院', condition: '与每位其他玩家同格停留≥2次' },
    { id: 'plan_zhengguan', name: '政府管理学院', condition: '探索值≥20 且 金钱差≤666' },
    { id: 'plan_wenxue', name: '文学院', condition: '离开赚钱线时金钱未增加' },
    { id: 'plan_xiandai', name: '现代工程与应用科学学院', condition: '探索+GPA×10+金钱÷1000 ≥ 60' },
    { id: 'plan_wuli', name: '物理学院', condition: '任意两项指标之和≥85' },
    { id: 'plan_zhexue', name: '哲学系', condition: '完整进出支线且资源无变化' },
    { id: 'plan_shangxue', name: '商学院', condition: '金钱达到5555' },
    { id: 'plan_makesi', name: '马克思主义学院', condition: 'GPA达到4.5' },
    { id: 'plan_huaxue', name: '化学化工学院', condition: '连续6回合触发增益' },
    { id: 'plan_xinwen', name: '新闻传播学院', condition: '完整经过探索线且无GPA和探索扣减' },
    { id: 'plan_faxue', name: '法学院', condition: '场上出现破产玩家' },
    { id: 'plan_yixue', name: '医学院', condition: '进入医院3次' },
    { id: 'plan_jisuanji', name: '计算机科学与技术系', condition: '探索值和金钱仅含0和1' },
    { id: 'plan_kuangyaming', name: '匡亚明学院', condition: '满足2位其他玩家的计划条件' },
    { id: 'plan_shehuixue', name: '社会学院', condition: '探索值≥15且比最低玩家高20' },
    { id: 'plan_rengong', name: '人工智能学院', condition: 'GPA比最低玩家高2' },
    { id: 'plan_gongguan', name: '工程管理学院', condition: '连续6回合金钱≤500' },
    { id: 'plan_shengming', name: '生命科学学院', condition: '食堂线累计3次非负面效果' },
    { id: 'plan_diqiu', name: '地球科学与工程学院', condition: '进入过四个校区线' },
    { id: 'plan_waiguoyu', name: '外国语学院', condition: '抽到2张含英文卡' },
    { id: 'plan_daqi', name: '大气科学学院', condition: '15回合不持有最多金钱' },
    { id: 'plan_huanjing', name: '环境学院', condition: '仙林线5+事件' },
    { id: 'plan_dianzi', name: '电子科学与工程学院', condition: '经过特定格子组合' },
    { id: 'plan_ruanjian', name: '软件学院', condition: '特定资源条件达成' },
    { id: 'plan_xinxi', name: '信息管理学院', condition: '收集特定卡牌' },
    { id: 'plan_shuxue', name: '数学系', condition: '可指定骰子点数（被动）' },
    { id: 'plan_lishi', name: '历史学院', condition: '特定支线完成条件' },
    { id: 'plan_jianzhu', name: '建筑与城市规划学院', condition: '特定格子组合达成' },
    { id: 'plan_yishu', name: '艺术学院', condition: '特定资源比例达成' },
    { id: 'plan_guoji', name: '国际关系学院', condition: '特定外交条件' },
    { id: 'plan_suzhou', name: '苏州校区', condition: '苏州线特定条件' },
    { id: 'plan_haiwai', name: '海外教育学院', condition: '特定出国条件' },
    { id: 'plan_dili', name: '地理与海洋科学学院', condition: '特定地理条件' },
  ];

  return (
    <div className="rule-section">
      <p style={{ fontSize: '0.85rem', color: 'var(--c-text-dim)', marginBottom: 12 }}>
        大二起每年选择1-2个培养计划。主修计划的被动能力生效，达成胜利条件也可获胜。
      </p>
      {plans.map(p => {
        const diff = PLAN_DIFFICULTY[p.id];
        return (
          <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
            <strong>{p.name}</strong>
            {diff && <span className="plan-difficulty-badge" style={{ marginLeft: 6, fontSize: '0.7rem' }}>{DIFFICULTY_LABEL[diff]}</span>}
            <div style={{ fontSize: '0.85rem', color: 'var(--c-text-dim)', marginTop: 2 }}>{p.condition}</div>
          </div>
        );
      })}
    </div>
  );
}

function CardsTab() {
  return (
    <div className="rule-section">
      <h3>两种卡牌</h3>
      <p>🔵 <strong>机会卡</strong> — 踩到机会格抽取，多为资源增减</p>
      <p>🟣 <strong>命运卡</strong> — 踩到命运格抽取，效果更戏剧化</p>

      <h3>卡牌类型</h3>
      <p>⚡ <strong>即时卡</strong> — 抽到立即生效</p>
      <p>🎴 <strong>保留卡</strong> — 可保留在手中，择机使用</p>
      <p>🛡️ <strong>响应卡</strong> — 可在他人回合使用，抵消不利效果</p>
      <p>🗳️ <strong>投票卡</strong> — 触发全体投票决定结果</p>
      <p>🔗 <strong>连锁卡</strong> — 多人依次响应的连锁效果</p>
    </div>
  );
}

function LinesTab() {
  const lines = [
    { name: '浦口线', fee: '免费（强制）', desc: '浦口校区生活体验，事件丰富但风险较高' },
    { name: '食堂线', fee: '免费（强制）', desc: '各食堂美食探索，以探索值收益为主' },
    { name: '学在南哪', fee: '200', desc: 'GPA 提升专线，适合追求学术胜利' },
    { name: '赚在南哪', fee: '200', desc: '金钱收益最高的线路，但有损失风险' },
    { name: '乐在南哪', fee: '200', desc: '探索值收益最高，社团和活动丰富' },
    { name: '鼓楼线', fee: '200', desc: '鼓楼校区，大一GPA收益翻倍' },
    { name: '仙林线', fee: '200', desc: '仙林校区日常，收益偏低但稳定' },
    { name: '苏州线', fee: '200', desc: '苏州校区体验，综合收益均衡' },
  ];

  return (
    <div className="rule-section">
      <p style={{ fontSize: '0.85rem', color: 'var(--c-text-dim)', marginBottom: 12 }}>
        踩到支线入口时可选择是否进入（浦口/食堂为强制）。进入后依次经过支线格子，到达终点返回主棋盘。
      </p>
      {lines.map(l => (
        <div key={l.name} style={{ padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
          <strong>{l.name}</strong>
          <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>
            入场费: {l.fee}
          </span>
          <div style={{ fontSize: '0.85rem', color: 'var(--c-text-dim)', marginTop: 2 }}>{l.desc}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2:** 添加 RuleDrawer CSS

在 `client/src/styles/` 下新建或在 `game.css` 末尾追加：

```css
/* Rule Drawer */
.rule-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: var(--c-overlay-medium);
  z-index: var(--z-modal-backdrop);
}
.rule-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 380px;
  max-width: 100vw;
  background: var(--c-surface);
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 20px rgba(0,0,0,0.15);
}
.rule-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--c-border);
}
.rule-drawer__header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--c-brand);
}
.rule-drawer__close {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--c-text-muted);
  padding: 4px 8px;
}
.rule-drawer__tabs {
  display: flex;
  border-bottom: 1px solid var(--c-border);
  padding: 0 12px;
}
.rule-drawer__tab {
  flex: 1;
  padding: 10px 4px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 0.85rem;
  color: var(--c-text-dim);
  cursor: pointer;
  transition: all 0.2s;
}
.rule-drawer__tab.active {
  color: var(--c-brand);
  border-bottom-color: var(--c-brand);
  font-weight: 700;
}
.rule-drawer__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}
.rule-section h3 {
  color: var(--c-brand);
  font-size: 0.95rem;
  margin: 16px 0 8px;
}
.rule-section h3:first-child {
  margin-top: 0;
}
.rule-section p {
  font-size: 0.9rem;
  line-height: 1.6;
  margin: 4px 0;
}
@media (max-width: 767px) {
  .rule-drawer {
    width: 100vw;
  }
}
```

- [ ] **Step 3:** 在 Lobby.tsx 中添加规则按钮

在 `client/src/components/Lobby.tsx` 中：

1. 导入 RuleDrawer：
```typescript
import { RuleDrawer } from './RuleDrawer';
```

2. 添加状态：
```typescript
const [showRules, setShowRules] = useState(false);
```

3. 在 user-actions 区域（约 line 169-196 的按钮组中）添加规则按钮：
```tsx
<button
  className="user-action-btn"
  onClick={() => setShowRules(true)}
>
  📖 规则
</button>
```

注意：使用 `user-action-btn` 类名（与大厅其他按钮一致），不是 `lobby-action-btn`。

4. 在组件 JSX 末尾渲染 RuleDrawer：
```tsx
<RuleDrawer open={showRules} onClose={() => setShowRules(false)} />
```

- [ ] **Step 4:** 验证规则速查功能

Run: `cd client && npm run dev`
1. 在大厅页面看到"📖 规则"按钮
2. 点击后右侧滑入规则面板
3. 切换4个 Tab 确认内容正确显示
4. 培养计划 Tab 显示难度标签
5. 移动端下面板全屏显示
6. 点击遮罩层或关闭按钮可关闭

- [ ] **Step 5:** Commit

```bash
git add client/src/components/RuleDrawer.tsx client/src/components/Lobby.tsx client/src/styles/game.css
git commit -m "feat: add rule reference drawer in lobby with plans, cards, and lines info"
```
