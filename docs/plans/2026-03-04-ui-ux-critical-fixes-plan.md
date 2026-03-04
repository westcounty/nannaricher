# UI/UX 关键体验优化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three critical UX issues: unreadable modal text, invisible dice button, and wasted screen space on PC.

**Architecture:** Pure CSS changes for modals and layout; minimal TSX change for dice button text. No logic changes, no new components, no new dependencies.

**Tech Stack:** CSS3 (backdrop-filter, gradients, animations), React TSX (minor text change)

**Design Doc:** `docs/plans/2026-03-04-ui-ux-critical-fixes-design.md`

---

### Task 1: EventModal — Dark Glassmorphism Theme

**Files:**
- Modify: `client/src/components/EventModal.css` (full file rewrite)

**Step 1: Rewrite EventModal.css with dark theme**

Replace the entire contents of `client/src/components/EventModal.css` with:

```css
.event-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  transition: opacity 0.15s ease-out;
}

.event-modal-overlay.closing {
  opacity: 0;
}

.event-modal {
  background: rgba(26, 18, 48, 0.92);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(139, 95, 191, 0.3);
  box-shadow:
    0 25px 50px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(94, 58, 141, 0.3);
  max-width: 450px;
  width: 90%;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.15s ease-out, opacity 0.15s ease-out;
}

.event-modal.closing {
  transform: scale(0.95);
  opacity: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(139, 95, 191, 0.3);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.modal-title {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0;
  color: white;
}

.modal-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  font-size: 1.5rem;
  line-height: 1;
  color: white;
  cursor: pointer;
  transition: background 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.modal-body {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.modal-description {
  font-size: 1rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 20px 0;
}

.effects-preview {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  margin-top: 8px;
}

.effects-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.effects-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.effect-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border-left: 4px solid rgba(255, 255, 255, 0.15);
}

.effect-item.positive {
  border-left-color: #22c55e;
  background: linear-gradient(90deg, rgba(34, 197, 94, 0.12) 0%, rgba(255, 255, 255, 0.05) 50%);
}

.effect-item.negative {
  border-left-color: #ef4444;
  background: linear-gradient(90deg, rgba(239, 68, 68, 0.12) 0%, rgba(255, 255, 255, 0.05) 50%);
}

.effect-icon {
  font-size: 1.3rem;
}

.effect-label {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.7);
  flex: 1;
}

.effect-value {
  font-size: 1.1rem;
  font-weight: 600;
}

.effect-item.positive .effect-value {
  color: #4ade80;
}

.effect-item.negative .effect-value {
  color: #f87171;
}

.effect-item.cards-effect {
  border-left-color: #8b5cf6;
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.12) 0%, rgba(255, 255, 255, 0.05) 50%);
}

.effect-item.cards-effect .effect-value {
  color: #a78bfa;
  font-size: 0.9rem;
}

.effect-item.status-effect {
  border-left-color: #f59e0b;
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(255, 255, 255, 0.05) 50%);
}

.effect-item.status-effect .effect-value {
  color: #fbbf24;
  font-size: 0.9rem;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(139, 95, 191, 0.2);
  display: flex;
  justify-content: center;
  gap: 12px;
}

.confirm-button {
  padding: 12px 48px;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.confirm-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
}

.confirm-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.confirm-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Options Container */
.options-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}

.option-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: rgba(139, 95, 191, 0.12);
  border: 2px solid rgba(139, 95, 191, 0.25);
  border-radius: 10px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  color: rgba(255, 255, 255, 0.9);
}

.option-button:hover:not(:disabled) {
  border-color: rgba(139, 95, 191, 0.5);
  background: rgba(139, 95, 191, 0.25);
  box-shadow: 0 0 15px rgba(139, 95, 191, 0.15);
}

.option-button.selected {
  border-color: #C9A227;
  background: linear-gradient(135deg, rgba(201, 162, 39, 0.25) 0%, rgba(224, 197, 94, 0.15) 100%);
}

.option-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.option-checkmark {
  color: #C9A227;
  font-size: 1.2rem;
  font-weight: bold;
}

/* Modal with options styling */
.event-modal.has-options {
  max-width: 500px;
}

.event-modal.has-options .modal-body {
  padding: 20px 24px;
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .event-modal {
    width: 95%;
    margin: 16px;
  }

  .modal-header {
    padding: 16px 20px;
  }

  .modal-body {
    padding: 20px;
  }

  .modal-title {
    font-size: 1.2rem;
  }

  .effect-item {
    padding: 8px 12px;
  }
}
```

**Step 2: Visual verification**

Run the dev server and trigger an event modal to verify:
- Dark glassmorphism background is visible
- All text is readable (white on dark)
- Effect items show colored left borders on dark background
- Option buttons are clearly visible with purple borders
- Selected state uses gold highlight

Run: `cd client && npm run dev`

**Step 3: Commit**

```bash
git add client/src/components/EventModal.css
git commit -m "fix(ui): EventModal dark glassmorphism theme — fix white-on-white text"
```

---

### Task 2: ChoiceDialog — Dark Glassmorphism Theme

**Files:**
- Modify: `client/src/components/ChoiceDialog.css` (full file rewrite)

**Step 1: Rewrite ChoiceDialog.css with dark theme**

Replace the entire contents of `client/src/components/ChoiceDialog.css` with:

```css
.choice-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  backdrop-filter: blur(6px);
  transition: opacity 0.2s ease-out;
}

.choice-dialog-overlay.closing {
  opacity: 0;
}

.choice-dialog {
  background: rgba(26, 18, 48, 0.92);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(139, 95, 191, 0.3);
  box-shadow:
    0 25px 50px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(94, 58, 141, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}

.choice-dialog.closing {
  transform: scale(0.95);
  opacity: 0;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(139, 95, 191, 0.3);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.dialog-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
  color: white;
}

.timeout-badge {
  background: rgba(255, 255, 255, 0.25);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  min-width: 40px;
  text-align: center;
  transition: background 0.2s ease, color 0.2s ease;
}

.timeout-badge.urgent {
  background: #ef4444;
  color: white;
  animation: pulse-urgent 0.5s ease-in-out infinite;
}

@keyframes pulse-urgent {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.dialog-body {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.dialog-prompt {
  font-size: 1.05rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 20px 0;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(139, 95, 191, 0.2);
}

.timeout-message {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  color: #f87171;
  text-align: center;
  font-weight: 500;
  margin-bottom: 16px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(139, 95, 191, 0.12);
  border: 2px solid rgba(139, 95, 191, 0.25);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  color: rgba(255, 255, 255, 0.9);
  animation: slide-in 0.3s ease-out backwards;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.option-button:hover:not(:disabled) {
  background: rgba(139, 95, 191, 0.25);
  border-color: rgba(139, 95, 191, 0.5);
  box-shadow: 0 4px 15px rgba(139, 95, 191, 0.2);
  transform: translateX(4px);
}

.option-button.hovered {
  background: rgba(139, 95, 191, 0.2);
  border-color: rgba(139, 95, 191, 0.4);
}

.option-button.selected {
  background: linear-gradient(135deg, rgba(201, 162, 39, 0.3) 0%, rgba(224, 197, 94, 0.2) 100%);
  border-color: #C9A227;
  color: white;
}

.option-button.selected .option-description {
  color: rgba(255, 255, 255, 0.7);
}

.option-button.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.option-label {
  font-size: 1rem;
  font-weight: 600;
  color: inherit;
}

.option-description {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}

.option-checkmark {
  font-size: 1.3rem;
  color: #C9A227;
  margin-left: 12px;
  animation: pop-in 0.2s ease-out;
}

@keyframes pop-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}

.dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(139, 95, 191, 0.2);
  display: flex;
  justify-content: center;
}

.cancel-button {
  padding: 10px 32px;
  font-size: 0.95rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

.cancel-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive adjustments */
@media (max-width: 480px) {
  .choice-dialog {
    width: 95%;
    margin: 16px;
  }

  .dialog-header {
    padding: 16px 20px;
  }

  .dialog-body {
    padding: 20px;
  }

  .dialog-title {
    font-size: 1.1rem;
  }

  .option-button {
    padding: 14px 16px;
  }

  .option-label {
    font-size: 0.95rem;
  }

  .option-description {
    font-size: 0.8rem;
  }
}

/* Multi-select dialog specific styles */
.multi-select .dialog-footer {
  justify-content: flex-end;
  gap: 12px;
}

.confirm-button {
  padding: 10px 32px;
  font-size: 0.95rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.confirm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.selection-hint {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  margin: -12px 0 16px 0;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  text-align: center;
}

.option-checkbox {
  font-size: 1.2rem;
  margin-right: 12px;
  width: 20px;
  text-align: center;
}

.multi-select .option-content {
  flex-direction: row;
  align-items: center;
}
```

**Step 2: Visual verification**

Trigger a choice dialog (e.g., land on an event cell with choices) and verify:
- Dark glassmorphism background matches EventModal
- Options are clearly visible with purple-tinted borders
- Selected state uses gold accent
- Timeout badge still works with urgent animation
- Text is fully readable

**Step 3: Commit**

```bash
git add client/src/components/ChoiceDialog.css
git commit -m "fix(ui): ChoiceDialog dark glassmorphism theme — fix white-on-white text"
```

---

### Task 3: Dice Button CTA Styling

**Files:**
- Modify: `client/src/styles/game.css` (append new styles)
- Modify: `client/src/components/CurrentPlayerPanel.tsx:79-84` (button text)

**Step 1: Add roll-dice-btn styles to game.css**

Append the following block before the `/* RESPONSIVE BREAKPOINTS */` section in `client/src/styles/game.css` (after line 109, before line 112):

```css
/* ============================================
   ROLL DICE BUTTON — Primary CTA
   ============================================ */

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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.roll-dice-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(94, 58, 141, 0.5), 0 0 30px rgba(201, 162, 39, 0.25);
}

.roll-dice-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 2px 10px rgba(94, 58, 141, 0.3);
}

.roll-dice-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: rgba(94, 58, 141, 0.3);
  box-shadow: none;
}

.my-turn .roll-dice-btn:not(:disabled) {
  animation: dice-btn-glow 2s ease-in-out infinite;
}

@keyframes dice-btn-glow {
  0%, 100% {
    box-shadow: 0 4px 15px rgba(94, 58, 141, 0.4), 0 0 20px rgba(201, 162, 39, 0.15);
  }
  50% {
    box-shadow: 0 4px 20px rgba(94, 58, 141, 0.6), 0 0 35px rgba(201, 162, 39, 0.3);
  }
}
```

**Step 2: Update button text in CurrentPlayerPanel.tsx**

In `client/src/components/CurrentPlayerPanel.tsx`, change the `getRollButtonText` function (lines 79-84) from:

```tsx
  const getRollButtonText = () => {
    if (isRolling) return '掷骰子中...';
    if (player.isInHospital) return '投骰子出院';
    if (player.isAtDing) return '投骰子移动';
    return '掷骰子';
  };
```

to:

```tsx
  const getRollButtonText = () => {
    if (isRolling) return '🎲 掷骰子中...';
    if (player.isInHospital) return '🎲 投骰子出院';
    if (player.isAtDing) return '🎲 投骰子移动';
    return '🎲 掷骰子';
  };
```

**Step 3: Visual verification**

Check that:
- Button is now a large, prominent gradient button (purple→gold)
- Has glow animation when it's the player's turn
- Hover lifts the button with deeper shadow
- Disabled state is clearly grayed out
- Dice emoji is visible before text

**Step 4: Commit**

```bash
git add client/src/styles/game.css client/src/components/CurrentPlayerPanel.tsx
git commit -m "feat(ui): prominent dice roll CTA button with glow animation"
```

---

### Task 4: PC Full-Width Layout

**Files:**
- Modify: `client/src/styles/game.css` (layout changes)

**Step 1: Update board canvas container**

In `client/src/styles/game.css`, change `.left-column .board-canvas-container` (around lines 896-902) from:

```css
.left-column .board-canvas-container {
  aspect-ratio: 1;
  max-height: 100%;
  margin: 0 auto;
  overflow: hidden;
  border: 1px solid var(--game-border);
}
```

to:

```css
.left-column .board-canvas-container {
  max-height: 100%;
  overflow: hidden;
  border: 1px solid var(--game-border);
}
```

(Removed `aspect-ratio: 1` and `margin: 0 auto`)

**Step 2: Update side panel width**

Change `.side-panel` width (line 83) from `width: 300px` to `width: 280px`.

**Step 3: Update desktop log area height**

Change `.desktop-log-area` (line 74) `max-height` from `180px` to `150px`.

**Step 4: Add ultrawide support**

Append after the tablet media query section (after the `@media (max-width: 1024px)` block, around line 223):

```css
/* Ultrawide: >= 1440px */
@media (min-width: 1440px) {
  .side-panel {
    width: 320px;
  }
}
```

**Step 5: Visual verification on wide screen**

Check on a 1920px-wide browser that:
- Board fills the available width (no forced square)
- Side panel is 280px (or 320px on ultrawide)
- Log area is more compact, giving more space to the board
- No horizontal scrolling or overflow issues

**Step 6: Commit**

```bash
git add client/src/styles/game.css
git commit -m "fix(ui): full-width PC layout — remove square constraint, optimize space"
```

---

### Task 5: Final Verification & Combined Commit

**Step 1: Run dev server and full test**

```bash
cd client && npm run dev
```

Test all three fixes together:
- [ ] Open game, verify board fills available width on PC
- [ ] Trigger an event — verify dark glassmorphism modal with readable text
- [ ] Trigger a choice — verify dark dialog with visible options
- [ ] Check dice button is prominent with glow animation
- [ ] Resize to tablet (768-1023px) — verify no layout breakage
- [ ] Resize to mobile (<768px) — verify modals still work

**Step 2: Run build to verify no errors**

```bash
cd client && npm run build
```

Expected: Build succeeds with no errors.

**Step 3: Final commit if any fixes needed**

If any adjustments were made during verification:

```bash
git add -A
git commit -m "fix(ui): polish dark theme modals and layout after visual review"
```
