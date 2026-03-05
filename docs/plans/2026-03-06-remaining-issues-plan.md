# Remaining Issues Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the remaining 8 issues (#21, #2, #3, #6, #13, #15, #23, #24) covering event dice UI, PC layout, device tracking, event popup content, chance card fallthrough, map label overlap, spectator info, and card usage confirmation.

**Architecture:** Client-side fixes in React components/CSS/PixiJS layers; server-side enrichment of `game:event-trigger` payloads and `resolveMultiVoteCard` default case; auth store enhancement for per-app device identification. All changes maintain existing Socket.IO broadcasting and Zustand state patterns.

**Tech Stack:** TypeScript, React 18, PixiJS 8, Socket.IO, Zustand, CSS

---

## Task 1: Issue #21 — Event Dice Animation UI

When `resolveMultiVoteCard` calls `rollAndBroadcast()`, the server emits `game:dice-result` but the client has no visible dice animation for these "event dice" rolls — only the normal turn-start dice is shown.

**Files:**
- Modify: `client/src/context/SocketProvider.tsx:227-230`
- Modify: `client/src/stores/gameStore.ts` (add `eventDice` state)
- Create: `client/src/components/EventDiceOverlay.tsx`
- Create: `client/src/styles/event-dice.css`
- Modify: `client/src/components/GameScreen.tsx` (render EventDiceOverlay)

**Step 1: Add eventDice state to gameStore**

In `client/src/stores/gameStore.ts`, add a new state field alongside existing `diceResult`:

```typescript
// In the state interface, add:
eventDice: { values: number[]; total: number } | null;

// In the store initial state, add:
eventDice: null,

// In the actions, add:
setEventDice: (data: { values: number[]; total: number } | null) => set({ eventDice: data }),
```

**Step 2: Modify handleDiceResult to distinguish event dice**

In `client/src/context/SocketProvider.tsx:227-230`, update `handleDiceResult`:

```typescript
const handleDiceResult = (data: { playerId: string; values: number[]; total: number }) => {
  if (data.playerId === 'system') {
    // Event dice (from resolveMultiVoteCard / server-side rolls)
    store.getState().setEventDice({ values: data.values, total: data.total });
    playSound('dice_land');
    // Auto-clear after 2.5 seconds
    setTimeout(() => store.getState().setEventDice(null), 2500);
  } else {
    store.getState().setDiceResult(data);
    playSound('dice_land');
  }
};
```

**Step 3: Create EventDiceOverlay component**

Create `client/src/components/EventDiceOverlay.tsx`:

```tsx
import { useGameStore } from '../stores/gameStore';
import '../styles/event-dice.css';

export function EventDiceOverlay() {
  const eventDice = useGameStore((s) => s.eventDice);
  if (!eventDice) return null;

  return (
    <div className="event-dice-overlay">
      <div className="event-dice-panel">
        <span className="event-dice-label">事件骰子</span>
        <div className="event-dice-values">
          {eventDice.values.map((v, i) => (
            <span key={i} className="event-dice-face">{v}</span>
          ))}
        </div>
        <span className="event-dice-total">= {eventDice.total}</span>
      </div>
    </div>
  );
}
```

**Step 4: Create event-dice.css**

Create `client/src/styles/event-dice.css`:

```css
.event-dice-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1050;
  pointer-events: none;
  animation: eventDiceFadeIn 0.3s ease;
}

.event-dice-panel {
  background: rgba(20, 20, 30, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.event-dice-label {
  font-size: 12px;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.event-dice-values {
  display: flex;
  gap: 8px;
}

.event-dice-face {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 215, 0, 0.6);
  border-radius: 8px;
  font-size: 24px;
  font-weight: 700;
  color: #FFD700;
  animation: eventDiceBounce 0.4s ease;
}

.event-dice-total {
  font-size: 14px;
  color: #ccc;
}

@keyframes eventDiceFadeIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes eventDiceBounce {
  0% { transform: scale(0.5) rotate(-10deg); }
  60% { transform: scale(1.15) rotate(3deg); }
  100% { transform: scale(1) rotate(0); }
}
```

**Step 5: Render EventDiceOverlay in GameScreen**

In `client/src/components/GameScreen.tsx`, add import and render:

```tsx
import { EventDiceOverlay } from './EventDiceOverlay';
// ... in the JSX, near VoteResultModal:
<EventDiceOverlay />
```

**Step 6: Commit**

```bash
git add client/src/stores/gameStore.ts client/src/context/SocketProvider.tsx client/src/components/EventDiceOverlay.tsx client/src/styles/event-dice.css client/src/components/GameScreen.tsx
git commit -m "feat: add event dice animation overlay for vote-related dice rolls (#21)"
```

---

## Task 2: Issue #2 — PC Wide-Screen Layout Optimization

On wide screens (>1440px), the game stretches edge-to-edge with no max-width constraint, making the UI feel sparse.

**Files:**
- Modify: `client/src/styles/game.css:438-456`

**Step 1: Add max-width and centering to desktop layout**

In `client/src/styles/game.css`, modify `.game-screen.layout-desktop` (line 450):

```css
.game-screen.layout-desktop {
  display: grid;
  grid-template-rows: 48px 1fr 28px 64px;
  height: 100vh;
  width: 100vw;
  max-width: 1600px;
  margin: 0 auto;
  overflow: hidden;
}
```

Also add a body/root background fallback so the sides aren't blank on ultra-wide:

```css
/* Add after .game-screen block (around line 447) */
@media (min-width: 1601px) {
  .game-screen {
    border-left: 1px solid var(--game-border);
    border-right: 1px solid var(--game-border);
  }
}
```

**Step 2: Commit**

```bash
git add client/src/styles/game.css
git commit -m "fix: constrain desktop game layout to max 1600px width (#2)"
```

---

## Task 3: Issue #3 — Per-App Device Tracking

The client sends a generic `deviceName: 'NannaRicher Web'` for all users. The tuchan-api backend tracks devices per user, but cannot distinguish NannaRicher sessions from other apps using the same auth service because the `deviceName` is identical.

**Fix:** Send a unique `appId` field and include browser/platform info in `deviceName` so the backend can apply per-app device limits and users can identify their sessions.

**Files:**
- Modify: `client/src/stores/authStore.ts:42-49,101-109,142-150,198-210,244-250`

**Step 1: Add helper function for device info**

In `client/src/stores/authStore.ts`, add after `getDeviceFingerprint()` (after line 49):

```typescript
function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `NannaRicher Web (${browser}/${os})`;
}

const APP_ID = 'nannaricher-web';
```

**Step 2: Update all auth request bodies**

Replace every occurrence of `deviceName: 'NannaRicher Web'` with `deviceName: getDeviceName()` and add `appId: APP_ID` to the request body.

There are 3 locations:

1. `login()` body (line ~104-109):
```typescript
body: JSON.stringify({
  username,
  password,
  deviceFingerprint: getDeviceFingerprint(),
  deviceName: getDeviceName(),
  appId: APP_ID,
}),
```

2. `register()` body (line ~145-150):
```typescript
body: JSON.stringify({
  username,
  password,
  deviceFingerprint: getDeviceFingerprint(),
  deviceName: getDeviceName(),
  appId: APP_ID,
}),
```

3. `loginWithSms()` body (line ~204-210):
```typescript
body: JSON.stringify({
  phone,
  code,
  smsToken,
  deviceFingerprint: getDeviceFingerprint(),
  deviceName: getDeviceName(),
  appId: APP_ID,
}),
```

4. `refreshAccessToken()` body (line ~247-250):
```typescript
body: JSON.stringify({
  refreshToken: currentRefreshToken,
  deviceFingerprint: getDeviceFingerprint(),
  appId: APP_ID,
}),
```

**Step 3: Commit**

```bash
git add client/src/stores/authStore.ts
git commit -m "fix: send per-app device identity to tuchan-api (#3)"
```

---

## Task 4: Issue #6 — Event Popup Shows Actual Event Content

Non-interactive events (where handler returns `null`) currently show a generic description like "玩家 触发了事件" instead of the actual event effect description. The server should include the actual event result text.

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:2265-2274,2302-2308`
- Modify: `server/src/game/handlers/event-handlers.ts` (return description from auto-resolved handlers)
- Modify: `server/src/game/EventHandler.ts` (capture last log)

**Step 1: Add lastExecutionLog to EventHandler**

First, check EventHandler's structure:

The simplest approach is to capture the engine's last log entry after handler execution. In `server/src/game/GameCoordinator.ts`, after `execute()` returns `null`, read the most recent game log entry to use as the event description.

In `server/src/game/GameCoordinator.ts:2265-2274` (main board auto-resolved events), replace:

```typescript
} else {
  // Event completed automatically — notify current player only
  const cell = boardData.mainBoard[position.index];
  if (cell) {
    this.io.to(this.roomId).emit('game:event-trigger', {
      title: cell.name || '事件',
      description: `${this.engine.getPlayer(playerId)?.name || '玩家'} 触发了事件`,
      playerId,
    });
  }
```

With:

```typescript
} else {
  // Event completed automatically — show actual effect
  const cell = boardData.mainBoard[position.index];
  if (cell) {
    const playerName = this.engine.getPlayer(playerId)?.name || '玩家';
    // Get the last log entry which contains the actual event effect description
    const logs = state.logs;
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
    const effectDesc = lastLog && lastLog.playerId === playerId
      ? lastLog.message
      : `${playerName} 触发了 ${cell.name}`;
    this.io.to(this.roomId).emit('game:event-trigger', {
      title: cell.name || '事件',
      description: effectDesc,
      playerId,
    });
  }
```

**Step 2: Same fix for line cell auto-resolved events**

In `server/src/game/GameCoordinator.ts:2302-2308`, replace:

```typescript
} else {
  // Line event completed automatically — notify current player only
  this.io.to(this.roomId).emit('game:event-trigger', {
    title: cell.name || '线路事件',
    description: `${this.engine.getPlayer(playerId)?.name || '玩家'} 触发了 ${cell.description || cell.name}`,
    playerId,
  });
```

With:

```typescript
} else {
  // Line event completed automatically — show actual effect
  const playerName = this.engine.getPlayer(playerId)?.name || '玩家';
  const logs = state.logs;
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const effectDesc = lastLog && lastLog.playerId === playerId
    ? lastLog.message
    : `${playerName} 触发了 ${cell.description || cell.name}`;
  this.io.to(this.roomId).emit('game:event-trigger', {
    title: cell.name || '线路事件',
    description: effectDesc,
    playerId,
  });
```

**Step 3: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "fix: show actual event effect in popup instead of generic text (#6)"
```

---

## Task 5: Issue #13 — Chance Card Vote Resolution Audit

The `resolveMultiVoteCard` switch statement has a `default` case that only logs "投票完成" with no effect. If a cardId doesn't match any case, the vote completes silently. Need to verify all multi-vote chance cards have handler cases and improve the default fallback.

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:1135-1138`

**Step 1: Improve the default case with a warning log**

In `server/src/game/GameCoordinator.ts:1135-1138`, replace the default case:

```typescript
default: {
  // Unhandled card type — log a warning so we can catch missing implementations
  console.warn(`[GameCoordinator] resolveMultiVoteCard: unhandled cardId="${cardId}"`);
  this.addLog('system', `投票完成 (${cardId})`);
  break;
}
```

**Step 2: Verify all multi_vote cards have cases**

Check `server/src/data/cards.ts` for all cards with `voteOptions` (which trigger multi_vote). Cross-reference with the switch cases in `resolveMultiVoteCard`. The current cases cover:
- chance_light_shadow, chance_course_group, chance_transfer_moment, chance_wit_words
- chance_school_sports_meet, chance_travel_method, destiny_four_schools
- chance_swimming_pool_regular, chance_meeting_is_fate, chance_first_snow
- chance_strange_tales, chance_delivery_theft, chance_root_finding_moment, chance_rest_moment

Run this verification:

```bash
cd server && grep -n "voteOptions" src/data/cards.ts | head -20
```

Compare the list of cards with `voteOptions` to the switch cases. If any are missing, add their case blocks.

**Step 3: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "fix: improve resolveMultiVoteCard default case with warning (#13)"
```

---

## Task 6: Issue #15 — Map Label Overlap on Branch Lines

Some station labels on branch lines visually overlap, especially where lines are close together. The PixiJS `PlayerLayer` already has a `+8` Y shift (line 328), but station name labels in `LineLayer` may still collide.

**Files:**
- Modify: `client/src/game/layers/LineLayer.ts:72` (adjust skip threshold or label offset)

**Step 1: Investigate current label rendering**

Read `client/src/game/layers/LineLayer.ts` fully to understand how line cell labels are positioned. Look for:
- Text creation and positioning logic
- Any existing collision avoidance
- The "skip cells that overlap with the center info area" logic at line 72

**Step 2: Add label offset based on line direction**

The fix depends on what the investigation reveals. Common approaches:
- Add alternating Y offsets for adjacent labels (odd/even index)
- Reduce font size for dense areas
- Truncate long names with ellipsis

In `client/src/game/layers/LineLayer.ts`, after creating each station label text, add an alternating offset:

```typescript
// After setting label position, add alternating offset to prevent overlap
const labelOffset = (cellIndex % 2 === 0) ? -12 : 12;
label.y += labelOffset;
```

The exact implementation depends on the line layout direction (horizontal vs vertical). For horizontal lines, offset Y; for vertical lines, offset X.

**Step 3: Verify visually**

Run the client dev server and check all 8 branch lines for label overlap:

```bash
cd client && npm run dev
```

Manually verify each branch line's label readability.

**Step 4: Commit**

```bash
git add client/src/game/layers/LineLayer.ts
git commit -m "fix: reduce map label overlap on branch lines (#15)"
```

---

## Task 7: Issue #23 — Spectator Event Popup Shows Acting Player Name

When a non-active player sees an event popup in read-only mode, the EventModal shows "观战中" badge but doesn't tell them WHO is performing the action. The acting player's name should be displayed prominently.

**Files:**
- Modify: `client/src/components/EventModal.tsx:44-46,160-164`
- Modify: `client/src/context/SocketProvider.tsx:249-253` (pass playerId to currentEvent)

**Step 1: Include playerId in currentEvent data**

In `client/src/context/SocketProvider.tsx:249-253`, update `setCurrentEvent` to include `playerId`:

```typescript
store.getState().setCurrentEvent({
  title: data.title,
  description: data.description,
  pendingAction: data.pendingAction,
  playerId: data.playerId || data.pendingAction?.playerId,
});
```

**Step 2: Update the currentEvent type in gameStore**

In `client/src/stores/gameStore.ts`, update the `currentEvent` type to include optional `playerId`:

```typescript
currentEvent: {
  title: string;
  description: string;
  pendingAction?: PendingAction;
  effects?: EffectPreview;
  playerId?: string;
} | null;
```

**Step 3: Show acting player name in EventModal read-only header**

In `client/src/components/EventModal.tsx`, add player name lookup:

After line 46 (`const pendingAction = currentEvent?.pendingAction;`), add:

```typescript
const gameState = useGameStore((s) => s.gameState);
const actingPlayerId = currentEvent?.playerId || pendingAction?.playerId;
const actingPlayerName = actingPlayerId && gameState
  ? gameState.players.find(p => p.id === actingPlayerId)?.name
  : undefined;
```

Then modify the read-only badge (line 162-164), replace:

```tsx
{isReadOnly && (
  <span className="read-only-badge">观战中</span>
)}
```

With:

```tsx
{isReadOnly && (
  <span className="read-only-badge">
    {actingPlayerName ? `${actingPlayerName} 的事件` : '观战中'}
  </span>
)}
```

**Step 4: Commit**

```bash
git add client/src/context/SocketProvider.tsx client/src/stores/gameStore.ts client/src/components/EventModal.tsx
git commit -m "fix: show acting player name in spectator event popup (#23)"
```

---

## Task 8: Issue #24 — Card Usage Confirmation Dialog

Currently clicking "使用卡牌" in CardDetail immediately uses the card with no confirmation. Players can accidentally waste cards. Add a two-step confirmation.

**Files:**
- Modify: `client/src/components/CardDetail.tsx:54-59,111-127`

**Step 1: Add confirmation state**

In `client/src/components/CardDetail.tsx`, add state after line 14:

```typescript
const [confirmingUse, setConfirmingUse] = useState(false);
```

**Step 2: Modify handleUse to require confirmation**

Replace the `handleUse` function (line 54-59):

```typescript
const handleUse = () => {
  if (needsTargetSelection && !selectedTarget) return;
  if (!confirmingUse) {
    setConfirmingUse(true);
    return;
  }
  onUse(card.id, selectedTarget);
};

const cancelUse = () => setConfirmingUse(false);
```

**Step 3: Update the button UI to show confirmation state**

Replace the card-actions section (line 111-127):

```tsx
<div className="card-actions">
  {canUse ? (
    confirmingUse ? (
      <div className="confirm-use-group">
        <button className="confirm-use-btn" onClick={handleUse}>
          确认使用
        </button>
        <button className="cancel-use-btn" onClick={cancelUse}>
          取消
        </button>
      </div>
    ) : (
      <button
        className="use-card-btn"
        onClick={handleUse}
        disabled={needsTargetSelection && !selectedTarget}
      >
        使用卡牌
      </button>
    )
  ) : (
    <span className="not-your-turn">非你的回合</span>
  )}
  <button className="cancel-btn" onClick={onClose}>
    关闭
  </button>
</div>
```

**Step 4: Add CSS for confirmation buttons (optional inline or in game.css)**

The confirm buttons should be visually distinct. Add to the existing card detail styles:

```css
.confirm-use-group {
  display: flex;
  gap: 8px;
  width: 100%;
}

.confirm-use-btn {
  flex: 1;
  padding: 8px 16px;
  background: #e53935;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  animation: pulse 1s ease infinite;
}

.cancel-use-btn {
  flex: 1;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  cursor: pointer;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}
```

**Step 5: Commit**

```bash
git add client/src/components/CardDetail.tsx
git commit -m "feat: add two-step confirmation for card usage (#24)"
```

---

## Summary

| Task | Issue | Priority | Scope |
|------|-------|----------|-------|
| 1 | #21 Event Dice UI | P2 | Client: new component + store + CSS |
| 2 | #2 PC Layout | P2 | Client: CSS only |
| 3 | #3 Device Tracking | P2 | Client: authStore |
| 4 | #6 Event Popup Content | P1 | Server: GameCoordinator |
| 5 | #13 Chance Card Audit | P1 | Server: GameCoordinator |
| 6 | #15 Map Label Overlap | P3 | Client: PixiJS LineLayer |
| 7 | #23 Spectator Info | P2 | Client: EventModal + store |
| 8 | #24 Card Confirmation | P2 | Client: CardDetail |

**Recommended execution order:** Task 4 → 5 → 7 → 8 → 1 → 3 → 2 → 6

Tasks 4 and 5 are server-side P1 fixes. Tasks 7, 8, 1 are independent client-side changes that can be parallelized. Tasks 2 and 6 are low-risk CSS/visual tweaks.

**Non-bugs confirmed (no action needed):**
- Issue #8 (card effects): Cards with empty `effects` array correctly use registered handlers
- Issue #20 (one-time cards): Cards are properly removed via splice and state broadcast
- Issue #19 (天文学院 win condition): Starting at 起点 correctly doesn't count as shared cell
