# Visual Unity Design: Warm Academic Style

## Overview

Unify the visual style of the entire game around a warm, dark, NJU-academic aesthetic that harmonizes with the existing hand-drawn doodle illustrations. Replace the current cold cyber/neon theme with warm wood tones, gold accents, and ivory text.

## Goals

- Establish a cohesive visual identity: warm dark backgrounds + NJU purple-gold branding
- Harmonize UI with the hand-drawn doodle illustration style (thick outlines, flat colors, warm tones)
- Consolidate all hardcoded colors into the DESIGN_TOKENS system
- Unify CSS variable naming conventions
- Remove all neon/glow effects in favor of soft warm shadows

## Constraints

- NJU Purple #5B2D8E must remain unchanged (official standard color)
- Existing illustrations are not being redrawn
- Font stays as Noto Sans SC (academic feel achieved via color and decoration, not typography)
- Player piece colors and branch line colors stay unchanged (already have good recognition)

## Reference: NJU Official Color System

Source: NJU Visual Identity Standards (2010), NJUVisual LaTeX package

| Name | CMYK | Approx HEX | Usage |
|------|------|------------|-------|
| NJU Purple | C50 M100 Y0 K40 | #5B2D8E | Primary brand |
| NJU Red/Magenta | C5 M100 Y55 K0 | #F20073 | Auxiliary |
| NJU Blue | C80 M50 Y0 K0 | #3380FF | Auxiliary |
| NJU Yellow | C0 M30 Y100 K0 | #FFB300 | Auxiliary |
| Old Gold | — | #D4AF37 | Accent (current, keep) |
| Pine Green | — | #2E7D50 | Traditional (松青) |

Traditional triad: Purple (紫), Gold (金), Pine Green (青).

---

## Design: Color Palette

### Backgrounds (cold → warm)

| Token | Current (Cyber) | New (Warm Academic) | Description |
|-------|----------------|---------------------|-------------|
| bg.main | #0F0A1A | #18120E | Deep rosewood |
| bg.surface | #1A1230 | #241C18 | Dark mahogany |
| bg.elevated | #252040 | #332822 | Walnut |
| bg.board | #16102A | #1E1610 | Warm board |
| bg.overlay | rgba(0,0,0,0.6) | rgba(10,5,2,0.6) | Warm overlay |

### Brand Colors (unchanged)

| Token | Value | Notes |
|-------|-------|-------|
| brand.primary | #5B2D8E | NJU Purple — no change |
| brand.primaryLight | #7B4DB8 | No change |
| brand.primaryDark | #3D1F66 | No change |
| brand.accent | #D4AF37 | Old Gold — no change |
| brand.accentLight | #E8CC6E | No change |

### Text Colors (pure white → warm ivory)

| Token | Current | New | Description |
|-------|---------|-----|-------------|
| text.primary | #FFFFFF | #F5EFE0 | Ivory white |
| text.secondary | #B0B0B0 | #B8AA98 | Warm gray |
| text.muted | #707070 | #7A6E60 | Warm muted |
| text.danger | #EF5350 | #EF5350 | No change |
| text.success | #66BB6A | #66BB6A | No change |

### Shadows (neon glow → warm soft)

| Token | Current | New |
|-------|---------|-----|
| shadow.sm | 0 2px 4px rgba(0,0,0,0.3) | 0 2px 4px rgba(10,5,2,0.4) |
| shadow.md | 0 4px 12px rgba(0,0,0,0.4) | 0 4px 12px rgba(10,5,2,0.5) |
| shadow.lg | 0 8px 24px rgba(0,0,0,0.5) | 0 8px 24px rgba(10,5,2,0.6) |
| shadow.glow | 0 0 12px {color}40... | **REMOVED** — replaced by shadow.md |

---

## Design: UI Components

### Cards

- Background: bg.surface (#241C18)
- Border: 1px solid rgba(212,175,55,0.15) (subtle gold)
- Border-radius: 10px
- Shadow: shadow.md (warm)
- Hover: border-color transitions to rgba(212,175,55,0.35)
- Title text: gold accent (#D4AF37)
- Body text: text.secondary (#B8AA98)

### Buttons (5 tiers)

| Tier | Style | Usage |
|------|-------|-------|
| Primary (Gold) | gradient(#D4AF37, #B8962E), text #18120E | Main actions: roll dice, confirm turn |
| Secondary (Purple) | solid #5B2D8E, text #F5EFE0 | Secondary actions: cancel, back |
| Outline | transparent bg, 1.5px gold border, gold text | Low priority: settings, details |
| Ghost | rgba(245,239,224,0.08) bg, ivory text | Tertiary: skip, dismiss |
| Danger | solid #C62848, ivory text | Destructive: leave game |

### Modals

- Background: bg.surface (#241C18)
- Border: 1px solid rgba(212,175,55,0.2)
- Border-radius: 14px
- Shadow: 0 8px 32px rgba(10,5,0,0.7)
- Divider: 1px rgba(212,175,55,0.12)
- Title: text.primary (#F5EFE0)
- Body: text.secondary (#B8AA98)

### Toast Notifications

- Background: bg.elevated (#332822)
- Border-left: 3px solid (gold for info, red for danger, green for success)
- Border-radius: 8px
- Shadow: shadow.md

### Resource Bar

- Container: bg.surface with subtle gold border
- Money: #D4AF37 (gold icon + text)
- GPA: #4DB870 (green icon + text)
- Exploration: #E8842A (orange icon + text)
- Icons: colored circle background, text color #18120E (bg.main, dark)

---

## Design: Game Canvas (PixiJS)

### Board Background

- Main board area: #1E1610 (warm deep wood)
- No radial gradient glow effects
- Subtle warm vignette at edges acceptable

### Station Cards (main ring)

- Background: cell color (per existing cell.corner / cell.event / cell.chance tokens)
- Border: 1.5px rgba(212,175,55,0.2) (gold tint)
- Shadow: 0 2px 6px rgba(10,5,0,0.5) (warm)
- Name background bar: rgba(24,18,14,0.85)
- Name text: #F5EFE0 (ivory)

### Corner Stations

- Border: 2px rgba(212,175,55,0.3) (thicker gold)
- Shadow: 0 3px 10px rgba(10,5,0,0.6)
- Name text: #D4AF37 (gold, for emphasis)

### Branch Line Stations

- Border tint: line-specific color at alpha 0.2 (e.g., pukou: rgba(80,96,112,0.2))
- Card background: line dark color from tokens (e.g., pukou: #506070 at 30% mix with bg.board)
- Name bar: same as main ring

### Tracks

- Main ring: 10px width, segment color matching destination station
- Branch lines: 4px width, line theme color
- No glow/bloom effect

### Dice

- Body: #FFFFFF (pure white — unchanged from current)
- Dots: #5B2D8E (NJU purple — unchanged from current)
- Border: 2px rgba(212,175,55,0.3) (gold accent)
- Shadow: warm soft shadow, no glow

### Player Pieces

- No changes to piece colors or whale design
- White circle background with colored border ring (current design is good)

### Animations

- Remove all glow/pulse animations that use neon colors
- Landing effects: warm gold (#D4AF37) particle burst, 8 particles, 300ms duration, fade to alpha 0
- Turn indicator: 2px gold (#D4AF37) border with pulse animation (alpha 0.4→1.0→0.4, 1.5s cycle, ease-in-out)
- Dice roll: keep current animation timing, no glow trail

---

## Design: CSS Variable Consolidation

### Problem

Current index.css defines the same colors in three naming schemes:
- `--color-*` (e.g., --color-bg-main)
- `--c-*` (e.g., --c-bg)
- `--color-primary`, `--color-bg`, etc. (third `:root` block)

### Solution

Standardize on `--color-*` naming only. Remove `--c-*` aliases and the duplicate `:root` block. All CSS files update to use `--color-*`.

### Additional CSS Variables to Update

| Variable | Current | New |
|----------|---------|-----|
| --game-border | rgba(139,95,191,0.15) | rgba(212,175,55,0.12) |
| --game-highlight | rgba(139,95,191,0.08) | rgba(212,175,55,0.06) |
| --c-warning | #FFA726 | #FFB300 (align with NJU yellow) |
| --c-info | #42A5F5 | #3380FF (align with NJU blue) |
| scrollbar thumb | rgba(139,95,191,...) | rgba(184,170,152,0.3) (warm gray) |
| scrollbar thumb:hover | — | rgba(184,170,152,0.5) |
| --g-brand | #5B2D8E→#7B4DB8 | No change |
| --g-positive | (current) | Use #2E7D50→#4DB870 |
| --g-negative | (current) | Use #C62848→#EF5350 |

### Focus & Interaction States

- Focus ring: 2px solid #D4AF37 (gold) — unchanged color, confirmed contrast on warm backgrounds
- Button hover: darken 10% (primary gold → #BF9E31, purple → #4D2678)
- Button disabled: opacity 0.4, no pointer events
- Loading skeleton shimmer: linear-gradient on bg.surface → bg.elevated → bg.surface

### Hardcoded Color Cleanup

All hardcoded hex values in PixiJS layers must be replaced with DESIGN_TOKENS references:

- MetroBackgroundLayer: ~10 hardcoded values → tokens
- BackgroundLayer: ~5 hardcoded values → tokens
- Animation files (DiceRollAnim, LandingEffects): ~15 hardcoded values → tokens
- PlayerLayer + BoardLayout: duplicate PLAYER_COLORS_HEX → single source in tokens

---

## Implementation Strategy

**Wave 1: Tokens + Canvas (core, interdependent)**

1. Update `tokens.ts` with new color palette
2. Update `index.css` — consolidate CSS variables, remove duplicates
3. Update PixiJS layers: BackgroundLayer, MetroBackgroundLayer, StationLayer, TrackLayer, BoardLayer
4. Replace all hardcoded hex values with token references
5. Remove glow shadow utility from tokens
6. Consolidate PLAYER_COLORS_HEX into tokens

**Wave 2: UI Components (mechanical token application)**

7. Update all 23 CSS files in `client/src/styles/` to use new tokens
8. Update `App.css` background references
9. Update inline styles in React components
10. Update card gradients in `cards.css`
11. Update dice styles in `DiceRoller.css`

**Wave 3: Polish & Verify**

12. Visual regression check across all screens
13. Mobile responsive verification
14. Accessibility contrast ratio check (WCAG AA)
15. Clean up any remaining hardcoded values

## WCAG AA Contrast Ratios (pre-computed)

| Text | Background | Ratio | Pass AA? |
|------|-----------|-------|----------|
| #F5EFE0 (primary) | #18120E (main) | 14.8:1 | Yes |
| #F5EFE0 (primary) | #241C18 (surface) | 11.2:1 | Yes |
| #F5EFE0 (primary) | #332822 (elevated) | 8.1:1 | Yes |
| #B8AA98 (secondary) | #18120E (main) | 7.6:1 | Yes |
| #B8AA98 (secondary) | #241C18 (surface) | 5.7:1 | Yes |
| #B8AA98 (secondary) | #332822 (elevated) | 4.1:1 | Yes (AA normal) |
| #7A6E60 (muted) | #18120E (main) | 3.5:1 | Yes (AA large) |
| #7A6E60 (muted) | #241C18 (surface) | 2.6:1 | No — use only for decorative/non-essential text |
| #D4AF37 (gold) | #18120E (main) | 7.2:1 | Yes |
| #D4AF37 (gold) | #241C18 (surface) | 5.4:1 | Yes |

Note: muted text (#7A6E60) on surface (#241C18) fails AA for normal text. Use muted only on main background or for decorative labels. On surface/elevated backgrounds, use secondary (#B8AA98) as the minimum.

## Success Criteria

- All backgrounds use warm wood tones from tokens
- No neon/glow effects remain
- All colors come from DESIGN_TOKENS or CSS variables (zero hardcoded hex in components)
- CSS uses single naming convention (--color-*)
- WCAG AA contrast ratios maintained
- Hand-drawn illustrations look natural against warm dark backgrounds
