# Visual Unity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the game's visual theme from cold cyber/neon to warm NJU academic style, unifying tokens, CSS, PixiJS canvas, and React components.

**Architecture:** Wave-based approach — Wave 1 updates the core token system and PixiJS canvas (tightly coupled), Wave 2 applies new tokens to all CSS/UI components, Wave 3 handles React inline styles, Wave 4 verifies and polishes.

**Tech Stack:** TypeScript, PixiJS 8, React 19, CSS custom properties, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-12-visual-unity-design.md`

---

## Chunk 1: Wave 1 — Core Tokens & Canvas

### Task 1: Update DESIGN_TOKENS color palette

**Files:**
- Modify: `client/src/styles/tokens.ts`

- [ ] **Step 1: Update background colors**

In `tokens.ts`, change `color.bg` values:

```typescript
bg: {
  main: '#18120E',          // 深檀木 (was #0F0A1A)
  surface: '#241C18',       // 暗红木 (was #1A1230)
  elevated: '#332822',      // 胡桃木 (was #252040)
  board: '#1E1610',         // 温暖棋盘 (was #16102A)
  overlay: 'rgba(10,5,2,0.6)', // 暖色遮罩 (was rgba(0,0,0,0.6))
},
```

- [ ] **Step 2: Update text colors**

```typescript
text: {
  primary: '#F5EFE0',     // 象牙白 (was #FFFFFF)
  secondary: '#B8AA98',   // 暖灰 (was #B0B0B0)
  muted: '#7A6E60',       // 暖哑色 (was #707070)
  danger: '#EF5350',      // no change
  success: '#66BB6A',     // no change
},
```

- [ ] **Step 3: Update shadow definitions, remove glow**

```typescript
shadow: {
  sm: '0 2px 4px rgba(10,5,2,0.4)',
  md: '0 4px 12px rgba(10,5,2,0.5)',
  lg: '0 8px 24px rgba(10,5,2,0.6)',
  // glow function REMOVED
},
```

- [ ] **Step 4: Run build to verify no TypeScript errors**

Run: `cd D:/work/nannaricher && npx tsc --noEmit -p client/tsconfig.json 2>&1 | head -20`

If `glow` removal causes errors, find and remove all call sites first.

- [ ] **Step 5: Commit**

```bash
git add client/src/styles/tokens.ts
git commit -m "feat(theme): update DESIGN_TOKENS to warm academic palette"
```

---

### Task 2: Find and remove all glow() references

**Files:**
- Modify: any file referencing `DESIGN_TOKENS.shadow.glow` or `shadow.glow`

- [ ] **Step 1: Search for glow references**

Run: `grep -rn "shadow\.glow\|\.glow(" client/src/ --include="*.ts" --include="*.tsx"`

- [ ] **Step 2: Replace each glow() call with shadow.md**

For each file found, replace `DESIGN_TOKENS.shadow.glow(color)` with `DESIGN_TOKENS.shadow.md`.

- [ ] **Step 3: Run build to verify**

Run: `cd D:/work/nannaricher && npx tsc --noEmit -p client/tsconfig.json 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(theme): remove glow shadow utility, use warm shadows"
```

---

### Task 3: Consolidate index.css variables

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Update the first :root block (lines 56-110) with new values**

Update these variables:
```css
--color-bg-main: #18120E;
--color-bg-surface: #241C18;
--color-bg-elevated: #332822;
--color-text-primary: #F5EFE0;
--color-text-secondary: #B8AA98;
--color-text-muted-design: #7A6E60;
```

- [ ] **Step 2: Update --c-* block with matching values**

```css
--c-bg: #18120E;
--c-surface: #241C18;
--c-elevated: #332822;
--c-text: #F5EFE0;
--c-text-dim: #B8AA98;
--c-text-muted: #7A6E60;
--c-warning: #FFB300;
--c-info: #3380FF;
```

- [ ] **Step 3: Update game border/highlight variables**

Find `--game-border` and `--game-highlight` in the third :root block and update:
```css
--game-border: rgba(212, 175, 55, 0.12);
--game-highlight: rgba(212, 175, 55, 0.06);
```

- [ ] **Step 4: Update scrollbar colors**

Find the scrollbar styling section and update thumb colors:
```css
/* scrollbar thumb */
rgba(184, 170, 152, 0.3)   /* was rgba(139, 95, 191, 0.3) */
/* scrollbar thumb:hover */
rgba(184, 170, 152, 0.5)   /* was rgba(139, 95, 191, 0.5) */
```

- [ ] **Step 5: Update third :root block duplicate values**

In the third :root block (around line 161), update:
```css
--color-bg: #18120E;
--color-text: #F5EFE0;
--color-text-muted: #7A6E60;
```

- [ ] **Step 6: Verify gradient variables**

Check `--g-brand`, `--g-positive`, `--g-negative` in index.css. Ensure:
- `--g-positive` uses `#2E7D50 → #4DB870` (pine green)
- `--g-negative` uses `#C62848 → #EF5350` (danger red)
- `--g-brand` uses `#5B2D8E → #7B4DB8` (NJU purple, no change)

Update if they don't match.

- [ ] **Step 7: Note on --c-* aliases**

The `--c-*` aliases are kept with updated values for now. Full removal and migration to `--color-*` only is deferred to a follow-up cleanup task (requires auditing all CSS consumers). The values are correct and consistent.

- [ ] **Step 8: Verify app loads**

Run: `cd D:/work/nannaricher && npm run build 2>&1 | tail -5`

- [ ] **Step 7: Commit**

```bash
git add client/src/index.css
git commit -m "feat(theme): update CSS variables to warm academic palette"
```

---

### Task 4: Update BackgroundLayer.ts

**Files:**
- Modify: `client/src/game/layers/BackgroundLayer.ts`

- [ ] **Step 1: Replace hardcoded hex colors**

Find and replace these values:
- `0x16102A` → `0x1E1610` (board bg)
- `0x1A1230` → `0x241C18` (surface)
- `0xB0B0B0` → `0xB8AA98` (warm gray text)

Keep unchanged: `0x5B2D8E` (NJU purple), `0xE8CC6E` (gold), `0xD4AF37` (gold)

- [ ] **Step 2: Verify build**

Run: `cd D:/work/nannaricher && npx tsc --noEmit -p client/tsconfig.json 2>&1 | head -10`

- [ ] **Step 3: Commit**

```bash
git add client/src/game/layers/BackgroundLayer.ts
git commit -m "feat(theme): warm colors in BackgroundLayer"
```

---

### Task 5: Update MetroBackgroundLayer.ts

**Files:**
- Modify: `client/src/game/layers/MetroBackgroundLayer.ts`

- [ ] **Step 1: Update outer/inner gradient colors**

Replace:
- `0x080515` → `0x0D0A06` (outermost dark, warm)
- Gradient outerColor RGB `{ r: 0x08, g: 0x05, b: 0x15 }` → `{ r: 0x0D, g: 0x0A, b: 0x06 }`
- Gradient innerColor RGB matching `0x16102A` → `{ r: 0x1E, g: 0x16, b: 0x10 }`

- [ ] **Step 2: Update surface/panel colors**

Replace:
- `0x1E1E32` → `0x241C18` (waiting overlay)
- `0x1A1230` → `0x241C18` (panel bg)
- `0xB0B0B0` → `0xB8AA98` (warm gray text, all occurrences)
- `0x8B8B8B` → `0x7A6E60` (muted text)

Keep unchanged: `0x5B2D8E`, `0xD4AF37`, `0xE8CC6E`, `0x7B4DB8`

- [ ] **Step 3: Verify build**

Run: `cd D:/work/nannaricher && npx tsc --noEmit -p client/tsconfig.json 2>&1 | head -10`

- [ ] **Step 4: Commit**

```bash
git add client/src/game/layers/MetroBackgroundLayer.ts
git commit -m "feat(theme): warm colors in MetroBackgroundLayer"
```

---

### Task 6: Update StationLayer.ts

**Files:**
- Modify: `client/src/game/layers/StationLayer.ts`

- [ ] **Step 1: Update surface/glass colors**

Replace:
- `0x1A1230` → `0x241C18` (branch card glass overlay)

Keep unchanged: `0xE8CC6E` (gold), `0xFFFFFF` (white on dark bg), `0x000000` (black bg bar)

- [ ] **Step 2: Verify build and commit**

```bash
git add client/src/game/layers/StationLayer.ts
git commit -m "feat(theme): warm surface color in StationLayer"
```

---

### Task 7: Update TrackLayer.ts

**Files:**
- Modify: `client/src/game/layers/TrackLayer.ts`

- [ ] **Step 1: Update track shadow/highlight colors**

Replace cold gray-blue track colors with warm equivalents:
- `0x4A4A5A` → `0x4A4238` (warm shadow gray)
- `0x2A2A3A` → `0x2A2420` (warm dark)
- `0x5A5A6A` → `0x5A5248` (warm track)

Keep: `0xffffff` (white highlight)

- [ ] **Step 2: Verify build and commit**

```bash
git add client/src/game/layers/TrackLayer.ts
git commit -m "feat(theme): warm track colors in TrackLayer"
```

---

### Task 8: Update animation files

**Files:**
- Modify: `client/src/game/animations/DiceRollAnim.ts`
- Modify: `client/src/game/animations/LandingEffects.ts`
- Modify: `client/src/game/animations/FloatingText.ts` (if exists)

- [ ] **Step 1: Update DiceRollAnim.ts**

Replace:
- `0x5e3a8d` → `0x5B2D8E` (standardize to exact NJU purple)
- `'#FFD700'` → `'#D4AF37'` (standardize to design gold)

- [ ] **Step 2: Update LandingEffects.ts**

Replace hardcoded player color arrays with import from DESIGN_TOKENS:
```typescript
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';
// Use DESIGN_TOKENS.color.player for confetti colors
```

- [ ] **Step 3: Update FloatingText.ts (if exists)**

Replace: `'#FFD700'` → `'#D4AF37'` (standardize to design gold)

- [ ] **Step 4: Verify BoardLayer.ts and LineLayer.ts**

Run: `grep -n "0x0F0A1A\|0x1A1230\|0x252040\|0x16102A\|0xB0B0B0\|0x707070" client/src/game/layers/BoardLayer.ts client/src/game/layers/LineLayer.ts 2>/dev/null`

If any cold colors found, replace with warm equivalents per token table.

- [ ] **Step 5: Verify build and commit**

```bash
git add client/src/game/animations/
git commit -m "feat(theme): standardize animation colors to tokens"
```

---

### Task 9: Consolidate PLAYER_COLORS_HEX

**Files:**
- Modify: `client/src/game/layers/PlayerLayer.ts`
- Modify: `client/src/game/layout/BoardLayout.ts`

- [ ] **Step 1: Check if PLAYER_COLORS_HEX exists in both files**

Run: `grep -rn "PLAYER_COLORS_HEX" client/src/ --include="*.ts"`

- [ ] **Step 2: Keep one canonical source, import in the other**

If duplicated, remove from one file and import from the other (or both import from tokens.ts).

- [ ] **Step 3: Verify build and commit**

```bash
git add -u
git commit -m "refactor(theme): consolidate PLAYER_COLORS_HEX to single source"
```

---

## Chunk 2: Wave 2 — CSS Component Files

### Task 10: Update game.css

**Files:**
- Modify: `client/src/styles/game.css`

- [ ] **Step 1: Replace purple shadow rgba values**

Find all `rgba(94, 58, 141, ...)` and `rgba(139, 95, 191, ...)` and replace:
- `rgba(94, 58, 141, 0.4)` → `rgba(10, 5, 2, 0.4)` (warm shadow)
- `rgba(139, 95, 191, 0.3)` → `rgba(212, 175, 55, 0.12)` (gold tint)
- `rgba(139, 95, 191, 0.15)` → `rgba(212, 175, 55, 0.1)` (gold tint light)

- [ ] **Step 2: Replace cold background colors**

- `rgba(26, 18, 48, 0.95)` → `rgba(36, 28, 24, 0.95)` (warm surface)
- `rgba(15, 10, 26, ...)` → `rgba(24, 18, 14, ...)` (warm bg)
- `#1A1230` → `#241C18` in any hardcoded references
- `#0F0A1A` → `#18120E`

- [ ] **Step 3: Replace cold borders**

- `rgba(123, 77, 184, 0.3)` → `rgba(212, 175, 55, 0.2)` (gold border)

- [ ] **Step 4: Update radial gradient**

- `radial-gradient(ellipse at center, #1A1230 0%, #0F0A1A 100%)` → `radial-gradient(ellipse at center, #241C18 0%, #18120E 100%)`

- [ ] **Step 5: Commit**

```bash
git add client/src/styles/game.css
git commit -m "feat(theme): warm colors in game.css"
```

---

### Task 11: Update cards.css

**Files:**
- Modify: `client/src/styles/cards.css`

- [ ] **Step 1: Replace cold gradients**

- `linear-gradient(170deg, #1e1840 0%, #0f0a1a 100%)` → `linear-gradient(170deg, #241C18 0%, #18120E 100%)`
- `linear-gradient(175deg, #1e1840 0%, #110c22 100%)` → `linear-gradient(175deg, #241C18 0%, #18120E 100%)`

- [ ] **Step 2: Replace purple borders with gold**

- `rgba(139, 95, 191, 0.25)` → `rgba(212, 175, 55, 0.15)`
- `rgba(139, 95, 191, 0.3)` → `rgba(212, 175, 55, 0.2)`
- `rgba(139, 95, 191, 0.2)` → `rgba(212, 175, 55, 0.12)`

- [ ] **Step 3: Replace purple shadows**

- `rgba(94, 58, 141, 0.4)` → `rgba(10, 5, 2, 0.4)`

- [ ] **Step 4: Commit**

```bash
git add client/src/styles/cards.css
git commit -m "feat(theme): warm colors in cards.css"
```

---

### Task 12: Update action-bar.css and action-prompt.css

**Files:**
- Modify: `client/src/styles/action-bar.css`
- Modify: `client/src/styles/action-prompt.css`

- [ ] **Step 1: Replace purple shadows/glows in action-bar.css**

All `rgba(94, 58, 141, ...)` → `rgba(10, 5, 2, ...)` (same alpha)

- [ ] **Step 2: Replace cold overlays in action-prompt.css**

- `rgba(15, 10, 26, 0.7)` → `rgba(24, 18, 14, 0.7)`
- `rgba(139, 95, 191, 0.15)` → `rgba(212, 175, 55, 0.12)`

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/action-bar.css client/src/styles/action-prompt.css
git commit -m "feat(theme): warm colors in action-bar and action-prompt"
```

---

### Task 13: Batch update remaining CSS files in styles/

**Files:**
- Modify: all other CSS files in `client/src/styles/`

- [ ] **Step 1: Search all remaining CSS for purple rgba patterns**

Run: `grep -rn "rgba(139, 95, 191\|rgba(94, 58, 141\|rgba(123, 77, 184\|rgba(15, 10, 26\|rgba(26, 18, 48\|#1A1230\|#0F0A1A\|#252040\|#1e1840\|#110c22" client/src/styles/ --include="*.css"`

- [ ] **Step 2: Apply replacements in each file found**

Standard replacements (apply to all):
- Purple shadows → warm shadows
- Purple borders → gold tint borders
- Cold bg hex → warm bg hex
- Cold overlay rgba → warm overlay rgba

- [ ] **Step 3: Update App.css fallback colors**

- `var(--color-bg-main, #0F0A1A)` → `var(--color-bg-main, #18120E)`

- [ ] **Step 4: Verify build**

Run: `cd D:/work/nannaricher && npm run build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add client/src/styles/ client/src/App.css
git commit -m "feat(theme): warm colors in all remaining CSS files"
```

---

### Task 13b: Update CSS files in components/

**Files:**
- Modify: `client/src/components/Lobby.css`
- Modify: `client/src/components/AuthScreen.css`
- Modify: `client/src/components/ChoiceDialog.css`
- Modify: `client/src/components/BattleHistory.css`
- Modify: `client/src/components/EventModal.css`
- Modify: `client/src/components/ChatPanel.css`
- Modify: `client/src/components/DiceRoller.css`
- Modify: any other `.css` files found in `client/src/components/`

- [ ] **Step 1: Search all component CSS for cold colors**

Run: `grep -rn "rgba(139, 95, 191\|rgba(94, 58, 141\|rgba(123, 77, 184\|rgba(15, 10, 26\|rgba(26, 18, 48\|#1A1230\|#0F0A1A\|#252040\|#1e1840\|#110c22\|#5e3a8d" client/src/components/ --include="*.css"`

- [ ] **Step 2: Apply standard warm replacements in each file**

Same replacement table as Task 13 Step 2. Additionally for DiceRoller.css:
- Dice stroke color `#D4AF37` → keep (already gold)
- Dice fill `#5B2D8E` → keep (NJU purple)
- Any `#FFFFFF` fill for dice body → keep (pure white per spec)

- [ ] **Step 3: Verify build and commit**

```bash
git add client/src/components/*.css
git commit -m "feat(theme): warm colors in component CSS files"
```

---

## Chunk 3: Wave 3 — React Inline Styles & Wave 4 — Polish

### Task 14: Update React components with inline hardcoded colors

**Files:**
- Modify: various `.tsx` files in `client/src/components/`

- [ ] **Step 1: Search for inline hardcoded colors**

Run: `grep -rn "color:.*#\|backgroundColor:.*#\|borderColor:.*#\|background:.*#" client/src/components/ --include="*.tsx" | grep -v node_modules`

- [ ] **Step 2: For each file found, replace hardcoded values**

Common replacements:
- `'#FFFFFF'` or `'#fff'` → `DESIGN_TOKENS.color.text.primary` or CSS var
- `'#B0B0B0'` → `DESIGN_TOKENS.color.text.secondary`
- `'#0F0A1A'` → `DESIGN_TOKENS.color.bg.main`
- `'#1A1230'` → `DESIGN_TOKENS.color.bg.surface`
- `'#E8CC6E'` → `DESIGN_TOKENS.color.brand.accentLight`

- [ ] **Step 3: Verify build**

Run: `cd D:/work/nannaricher && npm run build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add client/src/components/
git commit -m "feat(theme): replace inline hardcoded colors with tokens"
```

---

### Task 15: Visual verification and contrast check

- [ ] **Step 1: Build and deploy locally**

Run: `cd D:/work/nannaricher && npm run build && npm run dev`

- [ ] **Step 2: Check all screens visually**

Verify in browser:
- Lobby/room page
- Game board (zoom in/out, check LOD levels)
- Event/chance card modals
- Settlement screen
- Mobile viewport

- [ ] **Step 3: Verify no remaining cold purple/neon artifacts**

Run: `grep -rn "rgba(139, 95, 191\|rgba(94, 58, 141\|0x0F0A1A\|0x1A1230\|0x252040\|0x16102A\|#0F0A1A\|#1A1230\|#252040" client/src/ --include="*.ts" --include="*.tsx" --include="*.css"`

Any hits should be investigated and fixed.

- [ ] **Step 4: Final commit and deploy**

```bash
git add -u
git commit -m "fix(theme): clean up remaining cold color artifacts"
```

Deploy using nannaricher-ops skill.
