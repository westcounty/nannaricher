# Animation Timing & Visual Polish Fix Design

**Date**: 2026-03-11
**Scope**: Client animation timing, camera tracking, map readability, step choice UX

## Problems

1. **Camera jumps to destination** — viewport pans to target position instantly while piece animates step-by-step
2. **Bot/AFK pieces teleport** — rapid state updates cancel in-flight animations
3. **Popups appear during animation** — some event paths bypass `deferUntilMovementSettles`
4. **Map tiles hard to read** — low opacity + small fonts make station names illegible
5. **Step choices lack destination info** — "前进 N 格" without showing where you'll land

## Design

### Fix 1: Camera follows animating piece

**File**: `PlayerLayer.ts`, `GameCanvas.tsx`

- `PlayerLayer` exposes `getAnimatingPieceId(): string | null` and keeps `animatingPieces` set
- `GameCanvas` state-change auto-focus (lines 305-320): when detecting a position change that triggers animation, instead of calling `focusOnPlayer(destination)` immediately, register a ticker callback that reads the animating piece's real-time `container.x/y` and calls `viewportController.focusOnPlayer()` each frame
- When animation completes (`AnimationGate` goes idle), remove the ticker callback
- User manual drag/pan interrupts tracking (set a flag in ViewportController)

### Fix 2: Bot animation queue

**File**: `stateUpdateQueue.ts`, `SocketProvider.tsx`

Current `shouldDeferStateUpdateDuringMovement` only defers when `hasActiveMovementToken` and the update is NOT a new movement. Problem: for bots, multiple rapid state-updates (dice result → position change → landing event) arrive faster than animation duration.

Fix: broaden the defer condition — while ANY animation is in flight (`AnimationGate.isAnimating`), queue ALL state updates that don't start a new movement for the current player. The queued state gets applied when `AnimationGate` goes idle.

Additionally, `PlayerLayer.update()` must not cancel an in-flight animation when receiving a state update where the piece's tracked `lastPosition` already matches the new position (because we updated `lastPosition` eagerly at animation start).

### Fix 3: All popups defer until animation idle

**File**: `SocketProvider.tsx`

Every path that calls `store.getState().setCurrentEvent()` must go through `deferUntilMovementSettles`:
- `parallel_plan_selection` (line 332-341) — currently returns directly
- Event trigger normal/epic path (line 393)
- Any `setCurrentEvent` from `applyStateUpdate`

Also: `handleCardDrawn` already defers — good. But `handleDiceResult` shows immediately — for event dice this is fine (overlay, not modal), but verify no edge cases.

### Fix 4: Map tile readability

**File**: `StationLayer.ts`

Changes to main ring stations:
- Glass overlay alpha: `0.6` → `0.82`
- Card base alpha: `0.95` → `1.0`
- Station name font: `9px` → `11px` (regular), `13px` unchanged (corners)
- Add `dropShadow` to text styles for contrast

Changes to branch line stations:
- Glass overlay alpha: `0.6` → `0.82`
- Card alpha: `0.95` → `1.0`
- Station name font: `10px` → `11px` (regular), `12px` → `13px` (experience)
- Add `dropShadow` to text styles

### Fix 5: Destination names in step choices

**File**: `server/src/game/handlers/card-handlers.ts`

For `civil_aviation_overspeed` and similar step-selection handlers:
- Calculate destination position: `(currentIndex + i) % MAIN_BOARD_SIZE`
- Look up station name via `boardData.mainBoard[destIndex].name`
- Include in option: `{ label: '前进 ${i} 格', description: '→ ${destName}' }`

## Testing Plan

Playwright E2E:
1. Start game with 2+ bots, observe bot turns — pieces must animate, no teleporting
2. During any piece animation, verify no popup/modal appears
3. Camera viewport center should track moving piece, not jump ahead
4. Read station names at default zoom — verify legibility
5. Trigger civil_aviation card — verify step choices show destination names
