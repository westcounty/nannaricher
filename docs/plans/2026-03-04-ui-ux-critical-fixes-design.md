# UI/UX 关键体验优化设计方案

**日期**: 2026-03-04
**状态**: 已批准

## 问题概述

从顶级游戏策划和资深玩家角度审查，发现三个严重影响游戏体验的问题：

1. **弹窗白底白字** — EventModal 和 ChoiceDialog 使用白色背景，但游戏整体暗色主题导致文字继承白色，选项完全不可读
2. **骰子按钮像文字链** — CurrentPlayerPanel 中的 `.roll-dice-btn` 没有 CSS 样式定义，显示为裸按钮
3. **PC 端宽度浪费** — 地图被 `aspect-ratio: 1` 强制正方形，大量屏幕空间浪费

## 方案一: 弹窗暗色毛玻璃改造

### 涉及文件
- `client/src/components/EventModal.css`
- `client/src/components/ChoiceDialog.css`

### 设计规格

| 元素 | 当前值 | 目标值 |
|------|--------|--------|
| 弹窗背景 | `white` | `rgba(26, 18, 48, 0.92)` + `backdrop-filter: blur(20px)` |
| 弹窗边框 | 无 | `1px solid rgba(139, 95, 191, 0.3)` |
| 弹窗阴影 | 普通黑色 | `0 25px 50px rgba(0,0,0,0.5), 0 0 40px rgba(94,58,141,0.3)` |
| 标题栏 | 紫蓝渐变 | 保持，分割线改为 `rgba(139,95,191,0.3)` |
| 正文文字 | `#333` | `rgba(255, 255, 255, 0.9)` |
| 次要文字 | `#666` | `rgba(255, 255, 255, 0.6)` |
| 选项按钮背景 | `#f8f9fa` / `white` | `rgba(139, 95, 191, 0.12)` |
| 选项按钮边框 | `#e5e7eb` | `rgba(139, 95, 191, 0.25)` |
| 选项 hover | 浅蓝边框 | `rgba(139, 95, 191, 0.25)` 背景 + 紫色边框发光 |
| 选项 selected | 紫蓝渐变白字 | 金色渐变 `linear-gradient(135deg, #C9A227, #E0C55E)` + 深色文字 |
| 效果预览区 | `#f8f9fa` | `rgba(255, 255, 255, 0.05)` |
| 效果项背景 | `white` | `rgba(255, 255, 255, 0.05)` |
| 正面效果渐变 | 绿→白 | 绿→透明深色 |
| 负面效果渐变 | 红→白 | 红→透明深色 |
| 分割线 | `#eee` / `#f0f0f0` | `rgba(139, 95, 191, 0.2)` |
| 选项文字色 | `#333` | `rgba(255, 255, 255, 0.9)` |
| 选项描述色 | `#666` | `rgba(255, 255, 255, 0.6)` |
| 超时消息背景 | `#fef2f2` | `rgba(239, 68, 68, 0.15)` |
| 超时消息边框 | `#fecaca` | `rgba(239, 68, 68, 0.3)` |
| 取消按钮 | `#f0f0f0` 灰底 | `rgba(255,255,255,0.1)` + 白字 |
| 选择提示 | `#f8f9fa` | `rgba(255,255,255,0.05)` |

## 方案二: 骰子按钮 CTA 改造

### 涉及文件
- `client/src/styles/game.css` — 新增 `.roll-dice-btn` 样式

### 设计规格

```css
.roll-dice-btn {
  width: 100%;
  padding: 14px 24px;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(94, 58, 141, 0.4), 0 0 20px rgba(201, 162, 39, 0.15);
  transition: all 0.2s ease;
  min-height: 52px;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 我的回合时脉冲发光 */
.my-turn .roll-dice-btn:not(:disabled) {
  animation: dice-btn-glow 2s ease-in-out infinite;
}

@keyframes dice-btn-glow {
  0%, 100% { box-shadow: 0 4px 15px rgba(94,58,141,0.4), 0 0 20px rgba(201,162,39,0.15); }
  50% { box-shadow: 0 4px 20px rgba(94,58,141,0.6), 0 0 35px rgba(201,162,39,0.3); }
}

/* hover/active/disabled 状态 */
```

### 按钮文字变更
- 在 `CurrentPlayerPanel.tsx` 中给按钮文字添加骰子 emoji 前缀

## 方案三: PC 端全宽布局

### 涉及文件
- `client/src/styles/game.css`

### 改动点

1. **移除正方形约束**: `.left-column .board-canvas-container` 删除 `aspect-ratio: 1`
2. **面板宽度**: `.side-panel` 从 300px 改为 280px
3. **日志区**: `.desktop-log-area` 从 `max-height: 180px` 改为 `max-height: 150px`
4. **超宽屏**: `@media (min-width: 1440px)` 面板可扩展到 320px
5. **地图容器**: 移除 `margin: 0 auto`，让地图完全填充

## 不变的部分

- Winner Modal — 已经使用暗色主题，不需要改
- StatusBar — 已经使用暗色主题
- Loading Screen — 不影响游戏体验
- Tutorial System — 保持不变
- 动画系统 — 保持现有动画
