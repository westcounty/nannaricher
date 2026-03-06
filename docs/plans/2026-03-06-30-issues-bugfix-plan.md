# 30 Issues Comprehensive Bugfix Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 30 reported bugs across server and client, covering game logic, UI/UX, and connectivity issues.

**Architecture:** Server-side fixes in GameCoordinator/GameEngine/handlers, client-side fixes in React components and Zustand stores. Shared type changes in `shared/src/types.ts`. All changes maintain the existing Socket.IO state broadcasting pattern.

**Tech Stack:** TypeScript, React 18, PixiJS 8, Socket.IO, Zustand, Node.js/Express

---

## Batch 1: P0 Critical Issues

### Task 1: Server-side pendingAction timeout enforcement (Issue #16)

Disconnected players with a pending action cause the game to freeze because `timeoutMs` is never enforced server-side.

**Files:**
- Modify: `server/src/game/GameCoordinator.ts`
- Modify: `server/src/rooms/RoomManager.ts:137-162`

**Step 1: Add timeout timer management to GameCoordinator**

In `server/src/game/GameCoordinator.ts`, add a private field and helper methods after the existing private fields (around line 50):

```typescript
private pendingActionTimer: ReturnType<typeof setTimeout> | null = null;
```

Add a method to start/clear the timeout:

```typescript
private startPendingActionTimeout(): void {
  this.clearPendingActionTimeout();
  const state = this.engine.getState();
  const pa = state.pendingAction;
  if (!pa || !pa.timeoutMs) return;

  this.pendingActionTimer = setTimeout(() => {
    const currentPa = this.engine.getState().pendingAction;
    if (!currentPa || currentPa.id !== pa.id) return;

    this.addLog(pa.playerId, `操作超时，自动处理`);

    if (currentPa.type === 'roll_dice') {
      this.handleRollDice(pa.playerId);
    } else if (currentPa.type === 'multi_vote') {
      // Auto-fill missing votes with first option
      const responses = currentPa.responses || {};
      const firstOption = currentPa.options?.[0]?.value || 'skip';
      for (const p of this.engine.getState().players) {
        if (!p.isBankrupt && !p.isDisconnected && !responses[p.id]) {
          responses[p.id] = firstOption;
        }
      }
      currentPa.responses = responses;
      this._processAction(pa.id, pa.playerId, firstOption);
    } else {
      // Default: pick first option or 'skip'
      const defaultChoice = currentPa.options?.[0]?.value || 'skip';
      this._processAction(pa.id, pa.playerId, defaultChoice);
    }
  }, pa.timeoutMs + 3000); // 3s grace period beyond client timer
}

private clearPendingActionTimeout(): void {
  if (this.pendingActionTimer) {
    clearTimeout(this.pendingActionTimer);
    this.pendingActionTimer = null;
  }
}
```

**Step 2: Call startPendingActionTimeout in broadcastState**

In `broadcastState()` (line 122), add at the end before the final emit:

```typescript
// Start server-side timeout for current pending action
this.startPendingActionTimeout();
```

**Step 3: Clear timeout when action is processed**

In `handleChooseAction` (around line 2422) and `handleRollDice` (around line 2270), add at the start:

```typescript
this.clearPendingActionTimeout();
```

**Step 4: Auto-skip disconnected player's pending action immediately**

In `RoomManager.handleDisconnect` (line 137-162), after setting `player.isDisconnected = true` and broadcasting, add:

```typescript
// If the disconnected player has an active pending action, trigger timeout
if (state.pendingAction?.playerId === player.id) {
  // Short delay to let the broadcast go out first
  setTimeout(() => {
    const coord = this.coordinators.get(room.roomId);
    if (coord) {
      const currentState = coord.getState();
      if (currentState.pendingAction?.playerId === player.id) {
        coord.handleDisconnectedPlayerAction();
      }
    }
  }, 2000);
}
```

Add a public method `handleDisconnectedPlayerAction()` in `GameCoordinator`:

```typescript
handleDisconnectedPlayerAction(): void {
  const state = this.engine.getState();
  const pa = state.pendingAction;
  if (!pa) return;

  this.clearPendingActionTimeout();
  this.addLog(pa.playerId, `玩家断连，自动处理操作`);

  if (pa.type === 'roll_dice') {
    this.handleRollDice(pa.playerId);
  } else {
    const defaultChoice = pa.options?.[0]?.value || 'skip';
    this._processAction(pa.id, pa.playerId, defaultChoice);
  }
}
```

**Step 5: Commit**

```bash
git add server/src/game/GameCoordinator.ts server/src/rooms/RoomManager.ts
git commit -m "fix: add server-side pending action timeout enforcement (issue #16)"
```

---

### Task 2: Fix event popup double-triggering (Issue #4 & #11)

**Files:**
- Modify: `client/src/context/SocketProvider.tsx:219-233`

**Step 1: Strengthen deduplication in handleEventTrigger**

Replace the existing `handleEventTrigger` function with a time-window based approach:

```typescript
// Add outside the component, at module level:
let lastEventKey = '';
let lastEventTime = 0;

// Inside handleEventTrigger:
const handleEventTrigger = (data: any) => {
  const store = useGameStore.getState();
  const pa = data.pendingAction;
  if (!pa) return;

  // Deduplicate by pendingAction.id
  if (pa.id === store.currentEvent?.pendingAction?.id) return;

  // Time-window dedup: same player + same type within 500ms
  const eventKey = `${pa.playerId}:${pa.type}:${pa.prompt}`;
  const now = Date.now();
  if (eventKey === lastEventKey && now - lastEventTime < 500) return;
  lastEventKey = eventKey;
  lastEventTime = now;

  store.setCurrentEvent({
    title: data.title,
    description: data.description,
    pendingAction: pa,
  });
};
```

**Step 2: Commit**

```bash
git add client/src/context/SocketProvider.tsx
git commit -m "fix: strengthen event popup deduplication (issue #4, #11)"
```

---

### Task 3: Fix training plan overflow selection (Issue #27)

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:1375-1387`

**Step 1: Fix existingPlanIds calculation**

The issue is in `handlePlanSelectionResponse`. When a player already has plans via cards during 大一 but they're stored in `trainingPlans` without being in `majorPlan`/`minorPlans`, `getPlayerPlanIds` returns empty. Fix: use `trainingPlans` directly when the player already has confirmed plans.

Check line 1377-1378. The `existingPlanIds` should include all plans the player currently has in their major/minor slots:

```typescript
// Current (potentially buggy):
const existingPlanIds = getPlayerPlanIds(player);
const allPlanIds = [...existingPlanIds, ...selectedIds.filter(id => !existingPlanIds.includes(id))];

// Fixed — also consider plans that are in trainingPlans but not yet assigned:
const existingPlanIds = getPlayerPlanIds(player);
// selectedIds are from the newly drawn plans that player chose
const allPlanIds = [...new Set([...existingPlanIds, ...selectedIds])];
```

This should already be correct. The real issue may be that the `discardTempDrawnPlans` is removing plans from `trainingPlans` that should be kept. Verify `discardTempDrawnPlans`:

Read `discardTempDrawnPlans` and `finalizePlanSelection` to check the flow end-to-end. If the issue is that old plans get dropped, ensure `finalizePlanSelection` preserves existing confirmed plans when setting the new plan list.

**Step 2: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "fix: training plan overflow selection preserves existing plans (issue #27)"
```

---

## Batch 2: P1 Core Issues

### Task 4: Fix GPA buff display showing original delta (Issue #10)

**Files:**
- Modify: `server/src/game/GameEngine.ts:310-319`

**Step 1: Update log and resourceChangeCallback to use actualDelta**

At line 310, change:
```typescript
// FROM:
this.log(`GPA ${delta >= 0 ? '+' : ''}${delta} (当前: ${player.gpa})`, playerId);
// TO:
this.log(`GPA ${actualDelta >= 0 ? '+' : ''}${actualDelta} (当前: ${player.gpa})`, playerId);
```

At line 317, change the callback delta:
```typescript
// FROM:
delta,
// TO:
delta: actualDelta,
```

**Step 2: Commit**

```bash
git add server/src/game/GameEngine.ts
git commit -m "fix: GPA log and callback use actualDelta with freshman buff (issue #10)"
```

---

### Task 5: Fix tuition event to charge all players (Issue #14)

**Files:**
- Modify: `server/src/game/handlers/event-handlers.ts:6-26`

**Step 1: Update event_tuition to charge all players**

Replace the handler:
```typescript
eventHandler.registerHandler('event_tuition', (engine, playerId) => {
  const state = engine.getState();

  // First check if current player has software school ability
  const player = engine.getPlayer(playerId);
  if (player && (player.majorPlan === 'plan_ruanjian' || player.minorPlans.includes('plan_ruanjian'))) {
    // Software school gets special option first, then everyone else pays
    // Handle this via callback
    return engine.createPendingAction(
      playerId, 'choose_option',
      '软件学院能力：是否支付3200金钱？不破产即获胜！（其余玩家照常交学费）',
      [
        { label: `支付3200金钱 (当前: ${player.money})`, value: 'tuition_ruanjian_3200_all' },
        { label: '正常交学费', value: 'tuition_normal_all' },
      ]
    );
  }

  // All players pay tuition
  for (const p of state.players) {
    if (p.isBankrupt) continue;
    const tuition = Math.round((5.0 - p.gpa) * 100);
    engine.modifyPlayerMoney(p.id, -tuition);
    engine.log(`${p.name} 交学费 ${(5.0 - p.gpa).toFixed(1)} * 100 = ${tuition} 金钱`, p.id);
  }
  return null;
});
```

Add new callback handlers for the "all" variants:
```typescript
eventHandler.registerHandler('tuition_ruanjian_3200_all', (engine, playerId) => {
  // Software school player pays 3200
  engine.modifyPlayerMoney(playerId, -3200);
  engine.log('软件学院：支付3200金钱交学费', playerId);
  const player = engine.getPlayer(playerId);
  if (player && !player.isBankrupt) {
    const disabled = player.disabledWinConditions ?? [];
    if (!disabled.includes('plan_ruanjian')) {
      engine.declareWinner(playerId, '软件学院：交学费3200金钱后未破产');
    }
  }
  // Other players pay normal tuition
  const state = engine.getState();
  for (const p of state.players) {
    if (p.id === playerId || p.isBankrupt) continue;
    const tuition = Math.round((5.0 - p.gpa) * 100);
    engine.modifyPlayerMoney(p.id, -tuition);
    engine.log(`${p.name} 交学费 ${(5.0 - p.gpa).toFixed(1)} * 100 = ${tuition} 金钱`, p.id);
  }
  return null;
});

eventHandler.registerHandler('tuition_normal_all', (engine, playerId) => {
  // All players pay normal tuition (including the software school player who declined)
  const state = engine.getState();
  for (const p of state.players) {
    if (p.isBankrupt) continue;
    const tuition = Math.round((5.0 - p.gpa) * 100);
    engine.modifyPlayerMoney(p.id, -tuition);
    engine.log(`${p.name} 交学费 ${(5.0 - p.gpa).toFixed(1)} * 100 = ${tuition} 金钱`, p.id);
  }
  return null;
});
```

**Step 2: Commit**

```bash
git add server/src/game/handlers/event-handlers.ts
git commit -m "fix: tuition event now charges all players (issue #14)"
```

---

### Task 6: Persist roomId/playerId for page refresh reconnection (Issue #9)

**Files:**
- Modify: `client/src/context/SocketProvider.tsx`
- Modify: `client/src/context/SocketContext.tsx`

**Step 1: Save roomId/playerId to sessionStorage on room:created and room:joined**

In `SocketProvider.tsx`, after receiving `room:created` and `room:joined` events:

```typescript
// After setting roomId/playerId in gameStore:
sessionStorage.setItem('nannaricher_roomId', roomId);
sessionStorage.setItem('nannaricher_playerId', playerId);
```

**Step 2: Auto-reconnect on socket connect**

In `SocketContext.tsx`, inside the `connect` event handler (line 46-50):

```typescript
newSocket.on('connect', () => {
  setIsConnected(true);
  setIsConnecting(false);
  setConnectionError(null);
  console.log('[Socket] Connected:', newSocket.id);

  // Auto-reconnect to room if session data exists
  const savedRoomId = sessionStorage.getItem('nannaricher_roomId');
  const savedPlayerId = sessionStorage.getItem('nannaricher_playerId');
  if (savedRoomId && savedPlayerId) {
    newSocket.emit('room:reconnect', { roomId: savedRoomId, playerId: savedPlayerId });
  }
});
```

**Step 3: Clear session on logout/leave room**

Clear sessionStorage when leaving:
```typescript
sessionStorage.removeItem('nannaricher_roomId');
sessionStorage.removeItem('nannaricher_playerId');
```

**Step 4: Commit**

```bash
git add client/src/context/SocketProvider.tsx client/src/context/SocketContext.tsx
git commit -m "fix: persist roomId/playerId in sessionStorage for reconnection (issue #9)"
```

---

### Task 7: Card use timing by card type (Issue #5)

**Files:**
- Modify: `shared/src/types.ts` (Card interface)
- Modify: `server/src/data/cards.ts`
- Modify: `client/src/components/CardHand.tsx:102`
- Modify: `server/src/game/GameCoordinator.ts:2693` (handleUseCard validation)

**Step 1: Add `useTiming` field to Card interface**

In `shared/src/types.ts`, add to the Card interface:

```typescript
export interface Card {
  id: string;
  name: string;
  description: string;
  deckType: 'chance' | 'destiny';
  holdable: boolean;
  singleUse: boolean;
  returnToDeck: boolean;
  effects: CardEffect[];
  useTiming?: 'own_turn' | 'any_turn' | 'passive'; // when card can be used from hand
}
```

**Step 2: Set useTiming on all holdable cards in cards.ts**

Destiny cards (own_turn): 麦门护盾, 及时止损, 工期紧迫, 另辟蹊径, 轻车熟路, 如何解释, 鼓点重奏
Destiny cards (any_turn): 跨院准出, 专业意向
Destiny cards (passive/own_turn): 余额为负, 祖传试卷, 投石问路, 校园传说 — set as `own_turn` since they add effects preemptively

Chance cards (any_turn): 消息闭塞, 虚晃一枪, 画饼充饥, 一跃愁解, 停水停电, 补天计划

Add `useTiming: 'own_turn'` or `useTiming: 'any_turn'` to each holdable card accordingly.

**Step 3: Update CardHand to allow use based on useTiming**

In `CardHand.tsx`, change line 102:

```typescript
// FROM:
canUse={isCurrentPlayer}
// TO:
canUse={
  selectedCard.useTiming === 'any_turn'
    ? true
    : isCurrentPlayer
}
```

**Step 4: Update server handleUseCard to validate timing**

In `GameCoordinator.ts:handleUseCard`, after checking card exists, add validation:

```typescript
// Validate use timing
const isCurrentTurn = state.players[state.currentPlayerIndex]?.id === playerId;
if (card.useTiming !== 'any_turn' && !isCurrentTurn) {
  // Re-add the card (it was already spliced)
  // Actually, move the splice AFTER validation
  return;
}
```

Move the `splice` (line 2703) to after validation.

**Step 5: Commit**

```bash
git add shared/src/types.ts server/src/data/cards.ts client/src/components/CardHand.tsx server/src/game/GameCoordinator.ts
git commit -m "feat: card use timing varies by card type (issue #5)"
```

---

### Task 8: Vote result display (Issue #18)

**Files:**
- Modify: `client/src/context/SocketProvider.tsx`
- Modify: `client/src/stores/gameStore.ts`
- Create: `client/src/components/VoteResultModal.tsx`
- Modify: `client/src/components/GameScreen.tsx`

**Step 1: Add voteResult state to gameStore**

```typescript
// In gameStore state:
voteResult: {
  cardId: string;
  results: Record<string, string[]>;
  winnerOption: string;
} | null;

// Action:
setVoteResult: (result: any) => void;
clearVoteResult: () => void;
```

**Step 2: Listen for game:vote-result in SocketProvider**

```typescript
socket.on('game:vote-result', (data) => {
  useGameStore.getState().setVoteResult(data);
});
```

**Step 3: Create VoteResultModal component**

Simple modal that shows vote results grouped by option, auto-dismisses after 5 seconds.

**Step 4: Render VoteResultModal in GameScreen**

```tsx
{gameState.voteResult && <VoteResultModal result={gameState.voteResult} onClose={() => clearVoteResult()} />}
```

**Step 5: Commit**

```bash
git add client/src/context/SocketProvider.tsx client/src/stores/gameStore.ts client/src/components/VoteResultModal.tsx client/src/components/GameScreen.tsx
git commit -m "feat: display vote results in modal (issue #18)"
```

---

### Task 9: Interactive dice roll for events (Issue #21)

**Files:**
- Modify: `shared/src/types.ts` (PendingAction type union)
- Modify: `server/src/game/GameCoordinator.ts`
- Modify: `client/src/components/GameScreen.tsx`
- Modify: `client/src/context/SocketProvider.tsx`

**Step 1: Add 'event_roll_dice' to PendingAction type union**

In `shared/src/types.ts:89`:

```typescript
type: 'choose_option' | 'roll_dice' | 'event_roll_dice' | 'choose_player' | 'choose_line'
  | 'choose_card' | 'multi_player_choice' | 'draw_training_plan'
  | 'multi_vote' | 'chain_action';
```

**Step 2: Update event handlers that need dice rolls**

In `card-handlers.ts` and `card-registry.ts`, change handlers that currently use `type: 'roll_dice'` for EVENT purposes (not movement) to use `type: 'event_roll_dice'`. These include:
- `destiny_boss_recruit` (BOSS直聘)
- `destiny_swallowing_elevator` (吞噬电梯)
- `destiny_limited_supply` (限量供应)
- `destiny_seven_year_itch` (七年之痒)
- `destiny_four_schools` (四校联动)
- Corner hospital dice handler

**Step 3: Handle event_roll_dice on server**

In `GameCoordinator`, add handling for `event_roll_dice` type in `handleChooseAction`:

```typescript
if (pa.type === 'event_roll_dice') {
  // Player clicked roll — generate dice result
  const diceCount = pa.diceCount || 1;
  const values = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
  const total = values.reduce((a, b) => a + b, 0);

  // Broadcast dice animation
  this.io.to(this.roomId).emit('game:dice-result', {
    playerId,
    values,
    total,
    isEventDice: true, // flag: don't trigger movement
  });

  // Pass dice result to callback handler
  if (pa.callbackHandler) {
    const result = this.engine.getEventHandler().execute(pa.callbackHandler, playerId, String(total));
    // ... handle result
  }
}
```

**Step 4: Client-side: show dice roller for event_roll_dice**

In `GameScreen.tsx`, when `pendingAction.type === 'event_roll_dice'` and it's my turn, show the DiceRoller component with a "roll" button. On click, send `game:choose-action` with `choice: 'roll'`.

**Step 5: Commit**

```bash
git add shared/src/types.ts server/src/game/GameCoordinator.ts server/src/game/handlers/card-handlers.ts server/src/game/handlers/card-registry.ts client/src/components/GameScreen.tsx client/src/context/SocketProvider.tsx
git commit -m "feat: interactive dice roll for events with animation (issue #21)"
```

---

### Task 10: Translate LoadingScreen text to Chinese (Issue #12)

**Files:**
- Modify: `client/src/components/LoadingScreen.tsx:26-63`

**Step 1: Replace English text with Chinese**

```typescript
const DEFAULT_MESSAGES: Record<LoadingType, { title: string; subtitle: string }> = {
  connecting: {
    title: '正在连接服务器',
    subtitle: '建立连接中...',
  },
  waiting: {
    title: '等待玩家',
    subtitle: '等待其他玩家加入...',
  },
  calculating: {
    title: '处理中',
    subtitle: '计算游戏状态...',
  },
  loading: {
    title: '加载中',
    subtitle: '请稍候...',
  },
  custom: {
    title: '',
    subtitle: '',
  },
};

const GAME_TIPS = [
  '提示：平衡你的GPA和金钱——两者都很重要！',
  '提示：访问不同类型的格子可以提高探索值。',
  '提示：事件卡牌可以扭转局势——在关键时刻使用！',
  '提示：与其他玩家走到同一格子可能触发特殊事件。',
  '提示：培养计划提供长期收益——谨慎选择！',
  '提示：高GPA可以获得奖学金。',
  '提示：管好你的钱包是避免破产的关键。',
  '提示：校医院格子会让你暂停行动。',
  '提示：探索值可以解锁特殊结局。',
  '提示：注意对手的行动——他们可能影响你的策略！',
];
```

**Step 2: Commit**

```bash
git add client/src/components/LoadingScreen.tsx
git commit -m "fix: translate LoadingScreen text to Chinese (issue #12)"
```

---

## Batch 3: P1 Experience Issues

### Task 11: Improve room code visibility in WaitingRoom (Issue #1)

**Files:**
- Modify: `client/src/components/WaitingRoom.tsx:83-84`

**Step 1: Enhance room code display**

Find the room code display section and add copy-to-clipboard functionality and larger styling:

```tsx
<div className="room-code-display" style={{
  fontSize: '28px',
  fontWeight: 'bold',
  letterSpacing: '4px',
  padding: '12px 24px',
  background: 'rgba(33, 150, 243, 0.15)',
  border: '2px solid rgba(33, 150, 243, 0.4)',
  borderRadius: '12px',
  cursor: 'pointer',
  userSelect: 'all',
  textAlign: 'center',
}}
  onClick={() => {
    navigator.clipboard.writeText(roomId);
    // show toast
  }}
  title="点击复制"
>
  {roomId}
  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>点击复制房间号</div>
</div>
```

**Step 2: Commit**

```bash
git add client/src/components/WaitingRoom.tsx
git commit -m "fix: improve room code visibility and add copy button (issue #1)"
```

---

### Task 12: Increase OpponentToast auto-dismiss time (Issue #7)

**Files:**
- Modify: `client/src/components/OpponentToast.tsx:8`

**Step 1: Change AUTO_DISMISS_MS from 3000 to 5500**

```typescript
const AUTO_DISMISS_MS = 5500;
```

**Step 2: Commit**

```bash
git add client/src/components/OpponentToast.tsx
git commit -m "fix: increase opponent toast duration to 5.5s (issue #7)"
```

---

### Task 13: Fix viewport drag issues (Issue #17)

**Files:**
- Modify: `client/src/game/interaction/ViewportController.ts`

**Step 1: Add pointer capture on drag start**

In the `onPointerDown` handler, add:
```typescript
(e.target as HTMLElement).setPointerCapture?.(e.pointerId);
```

**Step 2: Replace pointerleave handler**

Remove the `pointerleave` -> `onPointerUp` binding. Instead use `lostpointercapture`:
```typescript
canvas.addEventListener('lostpointercapture', this.onPointerUp);
```

Remove or comment out:
```typescript
// canvas.addEventListener('pointerleave', this.onPointerUp);
```

**Step 3: Commit**

```bash
git add client/src/game/interaction/ViewportController.ts
git commit -m "fix: use pointer capture for reliable map dragging (issue #17)"
```

---

### Task 14: Fix popup click-through to map (Issue #26)

**Files:**
- Modify: `client/src/components/EventModal.tsx`
- Modify: `client/src/components/ChoiceDialog.tsx`

**Step 1: Add backdrop overlay with pointer-events blocking**

Ensure modal wrapper has:
```tsx
<div className="modal-overlay" style={{
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  zIndex: 1000,
  pointerEvents: 'auto',
}} onClick={e => e.stopPropagation()}>
  {/* modal content */}
</div>
```

Check all modal/dialog components for proper overlay coverage.

**Step 2: Commit**

```bash
git add client/src/components/EventModal.tsx client/src/components/ChoiceDialog.tsx
git commit -m "fix: prevent click-through from modal overlays to map (issue #26)"
```

---

### Task 15: Center map initially (Issue #22)

**Files:**
- Modify: `client/src/game/interaction/ViewportController.ts`

**Step 1: Add centerOnBoard method**

After the viewport is initialized, calculate the bounding box of all cells and center the camera:

```typescript
centerOnBoard(): void {
  // Calculate center of all station positions
  const stations = this.stationPositions;
  if (stations.length === 0) return;
  let sumX = 0, sumY = 0;
  for (const s of stations) { sumX += s.x; sumY += s.y; }
  const cx = sumX / stations.length;
  const cy = sumY / stations.length;
  this.container.x = this.width / 2 - cx * this.container.scale.x;
  this.container.y = this.height / 2 - cy * this.container.scale.y;
}
```

Call this once after initial render.

**Step 2: Commit**

```bash
git add client/src/game/interaction/ViewportController.ts
git commit -m "fix: center map viewport on board initially (issue #22)"
```

---

## Batch 4: P2 and Remaining Issues

### Task 16: Fix 大一 buff display not showing (Issue #29)

**Files:**
- Modify: `client/src/components/GameScreen.tsx:240`

**Step 1: Show TrainingPlanView during 大一 even with no plans**

Change the condition at line 240:

```tsx
// FROM:
{myPlayer && myPlayer.trainingPlans.length > 0 && (
// TO:
{myPlayer && (myPlayer.trainingPlans.length > 0 || gameState.roundNumber === 1) && (
```

This ensures TrainingPlanView renders during 大一 so the freshman buff cards are visible.

**Step 2: Commit**

```bash
git add client/src/components/GameScreen.tsx
git commit -m "fix: show TrainingPlanView during freshman year for buff display (issue #29)"
```

---

### Task 17: Fix "暂无培养计划" showing with temp plans (Issue #30)

**Files:**
- Modify: `client/src/components/TrainingPlanView.tsx:99`

**Step 1: Update the condition to check trainingPlans array**

```tsx
// FROM:
{!hasPlan && !isFreshman && (
  <p className="no-plans">暂无培养计划</p>
)}
// TO:
{!hasPlan && !isFreshman && player.trainingPlans.length === 0 && (
  <p className="no-plans">暂无培养计划</p>
)}
```

**Step 2: Commit**

```bash
git add client/src/components/TrainingPlanView.tsx
git commit -m "fix: hide '暂无培养计划' when temp plans exist (issue #30)"
```

---

### Task 18: Show whose turn it is during plan selection (Issue #28)

**Files:**
- Modify: `client/src/components/CompactHeader.tsx:70-87`

**Step 1: Detect plan selection phase in getStatusText**

```typescript
function getStatusText(
  gameState: GameState,
  isMyTurn: boolean,
  currentPlayerName?: string,
): string {
  const { phase, pendingAction } = gameState;

  if (phase === 'finished') return '游戏结束';
  if (phase === 'waiting') return '等待开始';

  if (pendingAction?.type === 'multi_vote') return '投票中';
  if (pendingAction?.type === 'chain_action') return '连锁行动';

  // Plan selection phase detection
  if (pendingAction?.id?.startsWith('plan_')) {
    const selectingPlayer = gameState.players.find(p => p.id === pendingAction.playerId);
    const name = selectingPlayer?.name || '玩家';
    if (pendingAction.playerId === gameState.players[gameState.currentPlayerIndex]?.id && isMyTurn) {
      return '升学选择 — 请选择培养计划';
    }
    return `升学选择 — 等待 ${name} 选择培养计划`;
  }

  if (isMyTurn) return '你的回合 — 请操作';
  if (currentPlayerName) return `等待 ${currentPlayerName} 操作`;

  return '';
}
```

**Step 2: Commit**

```bash
git add client/src/components/CompactHeader.tsx
git commit -m "fix: show plan selection status in header (issue #28)"
```

---

### Task 19: Fix VotePanel first click issue (Issue #25)

**Files:**
- Modify: `client/src/components/VotePanel.tsx:62-69`

**Step 1: Ensure vote state is properly initialized**

Check if the `handleVote` function has a race condition. The likely fix is ensuring the socket emit happens synchronously:

```typescript
const handleVote = (option: string) => {
  if (hasVoted) return; // prevent double-vote
  setHasVoted(true);
  setSelectedOption(option);
  onVote(option);
};
```

If `hasVoted` is being set before `onVote` runs, ensure `onVote` is called first. Also check if initial render sets `hasVoted` incorrectly by examining the `useEffect` that checks existing responses.

**Step 2: Commit**

```bash
git add client/src/components/VotePanel.tsx
git commit -m "fix: ensure first vote click registers correctly (issue #25)"
```

---

### Task 20: Remaining issues batch (Issues #2, #6, #8, #15, #20, #23, #24)

These issues require case-by-case investigation during implementation:

- **#2 (PC layout):** Check responsive CSS breakpoints in `game.css` and `mobile.css`
- **#6 (Event popup content):** Verify EventModal receives complete data from server
- **#8 (Card effects):** Audit each card handler in `card-handlers.ts` against card description in `cards.ts`
- **#15 (Map cell overlap):** Check station coordinate calculations in `StationLayer.ts` and board data
- **#20 (One-time cards not disappearing):** Verify `broadcastState` sends updated `heldCards` after splice, check client React key
- **#23 (Spectator popup info):** Add more context to read-only EventModal (player name, event details)
- **#24 (Card usage popup):** Improve CardDetail with confirmation dialog and better descriptions

Each of these should be a separate commit after investigation and fix.

**Note on Issue #3 (Per-app device tracking):** This is a tuchan-api backend concern. The richer client already sends `deviceName: 'NannaRicher Web'` in auth requests. Device limits should be configured per-app on the backend. No client changes needed unless the backend API changes.

**Note on Issue #13 (Chance cards not working):** This overlaps with Issue #8. Audit the `resolveMultiVoteCard` method in GameCoordinator (line 813-1082) to ensure all chance card types have complete handler branches.

**Note on Issue #19 (天文学院 win condition):** No change needed — starting at 起点 not counting towards shared cells is correct behavior.

---

## Execution Order Summary

| Batch | Tasks | Issues Covered |
|-------|-------|---------------|
| 1 (P0) | 1-3 | #16, #4, #11, #27 |
| 2 (P1 Core) | 4-9 | #10, #14, #9, #5, #18, #21 |
| 3 (P1 UX) | 10-15 | #12, #1, #7, #17, #26, #22 |
| 4 (P2) | 16-20 | #29, #30, #28, #25, +remaining |
