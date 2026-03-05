# 11 Issues Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 11 gameplay bugs and missing features: dice lock, 6-round plan confirmation, duplicate event popups, skip-turn timing, re-roll dice, hospital mechanics, card usage, event broadcasting, resource change display, game logging, and line exit rewards.

**Architecture:** Server-side fixes in GameCoordinator.ts and GameEngine.ts for core logic; client-side changes in GameContext.tsx and modal components for UI; new GameLogger class for persistent logging; new socket events for broadcasting.

**Tech Stack:** TypeScript, Socket.io, React, Zustand, PixiJS

---

### Task 1: Fix dice animation button lock (Issue 1)

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:1048-1125` (handleRollDice)
- Modify: `client/src/context/GameContext.tsx:148-161` (handleEventTrigger)

**Step 1: Add server-side guard against double roll**

In `GameCoordinator.handleRollDice()`, add a guard at the top to prevent processing if no roll_dice pending action exists:

```typescript
// At start of handleRollDice, after phase check (line 1050)
handleRollDice(playerId: string): void {
    const state = this.engine.getState();
    if (state.phase !== 'playing') return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return;

    // NEW: Guard against double-roll — only process if pending action is roll_dice
    if (!state.pendingAction || state.pendingAction.type !== 'roll_dice') return;

    // NEW: Clear pending action immediately to prevent double-clicks
    state.pendingAction = null;

    // ... rest of existing handleRollDice logic
```

**Step 2: Run build to verify no errors**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "fix: prevent double dice roll with server-side guard"
```

---

### Task 2: Implement 6-round plan confirmation cycle (Issue 2)

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:98-222` (advanceTurn)
- Modify: `shared/src/types.ts` (add planConfirmationPhase field to GameState if needed)

**Step 1: Add plan confirmation check in advanceTurn**

In `GameCoordinator.advanceTurn()`, after setting the roll_dice pendingAction (around line 205-212), add a check for plan confirmation:

```typescript
// After incrementing turnNumber (line 136-138), before setting pendingAction:
// Check if this is a plan confirmation round
if (state.turnNumber > 0 && state.turnNumber % PLAN_CONFIRM_INTERVAL === 0 && nextIndex === 0) {
    // Find players who have unconfirmed training plans available
    const playersWithPlans = state.players.filter(p =>
        !p.isBankrupt && !p.isDisconnected &&
        p.trainingPlans.length > 0 &&
        p.confirmedPlans.length < MAX_TRAINING_PLANS
    );

    if (playersWithPlans.length > 0) {
        this.addLog('system', `第 ${Math.floor(state.turnNumber / PLAN_CONFIRM_INTERVAL)} 轮升学阶段！可以确认培养方案`);

        // Create plan confirmation pending action for the first eligible player
        const firstPlayer = playersWithPlans[0];
        state.pendingAction = {
            id: `plan_confirm_${Date.now()}`,
            playerId: firstPlayer.id,
            type: 'choose_option',
            prompt: `升学阶段：是否确认一个培养方案？(${firstPlayer.confirmedPlans.length}/${MAX_TRAINING_PLANS})`,
            options: [
                ...firstPlayer.trainingPlans
                    .filter(p => !firstPlayer.confirmedPlans.includes(p.id))
                    .map(p => ({ label: `确认: ${p.name}`, value: `confirm_plan_${p.id}` })),
                { label: '跳过', value: 'skip_plan_confirm' },
            ],
            callbackHandler: 'plan_confirmation_handler',
            timeoutMs: 60000,
        };

        // Register the handler if not already registered
        if (!this.engine.getEventHandler().hasHandler('plan_confirmation_handler')) {
            this.engine.getEventHandler().registerHandler('plan_confirmation_handler', (eng, pid, choice) => {
                if (choice && choice.startsWith('confirm_plan_')) {
                    const planId = choice.replace('confirm_plan_', '');
                    const player = eng.getPlayer(pid);
                    if (player && !player.confirmedPlans.includes(planId)) {
                        player.confirmedPlans.push(planId);
                        const plan = player.trainingPlans.find(p => p.id === planId);
                        eng.log(`确认培养方案: ${plan?.name || planId}`, pid);
                    }
                }
                return null;
            });
        }

        // Broadcast announcement to all players
        this.io.to(this.roomId).emit('game:announcement', {
            message: `升学阶段开始！第 ${Math.floor(state.turnNumber / PLAN_CONFIRM_INTERVAL)} 轮`,
            type: 'info',
        });

        this.broadcastState();
        return; // Don't set roll_dice yet
    }
}
```

**Step 2: Handle plan confirmation completion to advance to next player or continue**

In `_processAction()`, after the plan confirmation handler returns null, we need to check if more players need to confirm:

```typescript
// In the `if (isPlanBonus)` check area (around line 1187-1204), add:
const isPlanConfirm = pendingActionId.startsWith('plan_confirm_');
// ...
if (isPlanConfirm) {
    // Check if more players need to confirm
    const playersWithPlans = state.players.filter(p =>
        !p.isBankrupt && !p.isDisconnected &&
        p.trainingPlans.length > 0 &&
        p.confirmedPlans.length < MAX_TRAINING_PLANS &&
        p.id !== playerId  // Exclude the player who just confirmed
    );
    // TODO: track which players already had their chance this round
    // For now, advance to normal turn
    this.advanceTurn();
} else if (isPlanBonus) {
    // existing plan bonus logic
}
```

**Step 3: Run build**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "feat: implement 6-round plan confirmation cycle"
```

---

### Task 3: Fix duplicate event popup (Issue 3)

**Files:**
- Modify: `client/src/context/GameContext.tsx:148-161` (handleEventTrigger)
- Modify: `server/src/game/GameCoordinator.ts:972-999` (handleCellLanding event trigger emission)

**Step 1: Add dedup logic on client**

In `GameContext.tsx`, the `handleEventTrigger` function should deduplicate by checking if a pending action with the same ID is already being shown:

```typescript
const lastEventActionId = useRef<string | null>(null);

const handleEventTrigger = (data: { title: string; description: string; pendingAction?: PendingAction; playerId?: string }) => {
    // Dedup: skip if same pendingAction.id as last event
    if (data.pendingAction?.id && data.pendingAction.id === lastEventActionId.current) {
        return;
    }
    if (data.pendingAction?.id) {
        lastEventActionId.current = data.pendingAction.id;
    }

    // Show to ALL players (Issue 7 fix will handle read-only vs interactive)
    setCurrentEvent({
        title: data.title,
        description: data.description,
        pendingAction: data.pendingAction,
    });
    playSound('event_trigger');
};
```

**Step 2: Remove redundant server-side event-trigger emissions**

In `GameCoordinator.handleCellLanding()`, the event handler already emits `game:event-trigger` after a pendingAction is returned (lines 979-983). But there's ALSO an emission at lines 986-993 for events that complete automatically. Check that these don't double-fire.

Review the flow: when a handler returns a PendingAction, the code at line 974-983 fires. When it returns null, lines 985-998 fire. These are mutually exclusive. So the server is fine — the bug is likely on the client side with duplicate listeners.

**Step 3: Clean up event listener registration**

Check if there are duplicate `game:event-trigger` listeners in GameContext.tsx. The `useEffect` cleanup (lines 194-204) should properly `off` all listeners. Verify no other component also listens to `game:event-trigger`.

**Step 4: Commit**

```bash
git add client/src/context/GameContext.tsx
git commit -m "fix: deduplicate event trigger popups on client"
```

---

### Task 4: Fix skip-turn timing (Issue 9)

**Files:**
- Modify: `server/src/game/GameEngine.ts:702-707` (skipPlayerTurn)
- Modify: `server/src/game/GameCoordinator.ts:117-128` (advanceTurn skip logic)

**Step 1: Fix skipPlayerTurn to support multi-turn skips**

```typescript
skipPlayerTurn(playerId: string, turns: number): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    // Support multi-turn skips by adding/stacking effects
    player.skipNextTurn = true;

    // Add or update skip_turn effect
    const existingSkip = player.effects.find(e => e.type === 'skip_turn');
    if (existingSkip) {
        existingSkip.turnsRemaining = Math.max(existingSkip.turnsRemaining, turns);
    } else if (turns > 1) {
        player.effects.push({
            id: `skip_${Date.now()}`,
            type: 'skip_turn',
            turnsRemaining: turns,
        });
    }

    this.log(`暂停 ${turns} 回合`, playerId);
}
```

**Step 2: Fix advanceTurn to properly handle multi-turn skips**

In `GameCoordinator.advanceTurn()`, the skip logic (lines 117-128) should:

```typescript
// Check if player should skip turn
if (nextPlayer.skipNextTurn) {
    nextPlayer.skipNextTurn = false;

    // Decrement skip_turn effect and check if more skips remain
    const skipEffect = nextPlayer.effects.find(e => e.type === 'skip_turn');
    if (skipEffect) {
        skipEffect.turnsRemaining--;
        if (skipEffect.turnsRemaining > 0) {
            // Still has more turns to skip — keep skipNextTurn true for next round
            nextPlayer.skipNextTurn = true;
        } else {
            // Remove the depleted effect
            nextPlayer.effects = nextPlayer.effects.filter(e => e.type !== 'skip_turn');
        }
    }

    this.addLog(nextPlayer.id, `${nextPlayer.name} 暂停回合（跳过）`);
    continue;
}
```

**Step 3: Verify all skipPlayerTurn call sites set skip for NEXT turn, not current**

Check that when `skipPlayerTurn` is called during a player's turn (e.g., event_qingong, corner_ding), the skip takes effect on the NEXT occurrence of that player's turn, not the current one. The current advanceTurn logic processes skip at the START of a player's turn, which is correct — the player's current turn is already in progress when skip is set.

**Step 4: Commit**

```bash
git add server/src/game/GameEngine.ts server/src/game/GameCoordinator.ts
git commit -m "fix: correct skip-turn timing and support multi-turn skips"
```

---

### Task 5: Fix re-roll dice effects (Issue 10)

**Files:**
- Modify: `server/src/game/handlers/event-handlers.ts` (handlers that need re-roll)
- Modify: `server/src/game/GameCoordinator.ts` (add dice broadcast helper)

**Step 1: Add helper method for event-internal dice rolls with broadcasting**

In `GameCoordinator`, add a method that handlers can use for event-internal dice rolls:

```typescript
// Add to GameCoordinator
broadcastDiceRoll(playerId: string, values: number[], total: number): void {
    this.io.to(this.roomId).emit('game:dice-result', {
        playerId,
        values,
        total,
    });
}
```

**Step 2: Update event handlers that roll dice internally**

Event handlers like `event_society`, `event_retake`, `event_kechuang` currently call `engine.rollDice()` but don't broadcast the result. Since handlers don't have access to the coordinator's IO, we need a pattern.

Option: Add a `broadcastDiceResult` callback to the engine that the coordinator sets:

```typescript
// In GameEngine, add:
private diceResultCallback: ((playerId: string, values: number[], total: number) => void) | null = null;

setDiceResultCallback(cb: (playerId: string, values: number[], total: number) => void): void {
    this.diceResultCallback = cb;
}

// Override rollDice to optionally broadcast:
rollDiceAndBroadcast(playerId: string, count?: number): number[] {
    const values = this.rollDice(count);
    const total = values.reduce((a, b) => a + b, 0);
    if (this.diceResultCallback) {
        this.diceResultCallback(playerId, values, total);
    }
    return values;
}
```

Then in GameCoordinator constructor:
```typescript
this.engine.setDiceResultCallback((pid, vals, total) => {
    this.io.to(this.roomId).emit('game:dice-result', { playerId: pid, values: vals, total });
});
```

**Step 3: Update event handlers to use rollDiceAndBroadcast**

In `event-handlers.ts`, replace `engine.rollDice()` calls with `engine.rollDiceAndBroadcast(playerId)` for:
- `society_money` (line ~88): `const dice = eng.rollDiceAndBroadcast(pid, 1);`
- `society_gpa` (line ~96): `const dice = eng.rollDiceAndBroadcast(pid, 1);`
- `retake` (line ~62): `const dice = eng.rollDiceAndBroadcast(pid, 1);`
- `kechuang_join` (line ~168): `const dice = eng.rollDiceAndBroadcast(pid, 1);`
- `corner_hospital_roll` (line ~37): Already handled in handleRollDice, skip.

Similarly update line handlers that roll dice.

**Step 4: Commit**

```bash
git add server/src/game/GameEngine.ts server/src/game/GameCoordinator.ts server/src/game/handlers/event-handlers.ts
git commit -m "fix: broadcast dice results for event-internal re-rolls"
```

---

### Task 6: Fix hospital one-roll-per-turn mechanics (Issue 11)

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:1056-1077` (hospital case in handleRollDice)

**Step 1: Fix hospital exit to allow normal movement**

After successfully exiting hospital (rolling >= 3), the player should get a normal roll to move:

```typescript
// Hospital case in handleRollDice (lines 1056-1077)
if (currentPlayer.isInHospital) {
    const values = this.engine.rollDice(1);
    const total = values[0];

    this.io.to(this.roomId).emit('game:dice-result', {
        playerId,
        values,
        total,
    });

    if (total >= 3) {
        this.engine.setPlayerHospitalStatus(playerId, false);
        this.addLog(playerId, `${currentPlayer.name} 投出 ${total}，成功出院！`);

        // NEW: After exiting hospital, set up normal dice roll for movement
        state.pendingAction = {
            id: `roll_dice_${Date.now()}`,
            playerId: currentPlayer.id,
            type: 'roll_dice',
            prompt: '已出院，请投骰子移动',
            timeoutMs: 60000,
        };
        this.broadcastState();
        return;
    } else {
        this.addLog(playerId, `${currentPlayer.name} 投出 ${total}，未能出院，等待下一回合`);
        this.broadcastState();
        this.advanceTurn();
        return;
    }
}
```

**Step 2: Also fix the hospital entry handler**

In `corner-handlers.ts`, `corner_hospital_enter` sets `isInHospital = true` and returns a PendingAction with options (roll or pay). But in `handleRollDice`, the hospital check uses `isInHospital` directly. The `corner_hospital_roll` handler (line ~37) also rolls dice. This could cause confusion.

Verify: When a player lands on hospital:
1. `handleCellLanding` → `corner_hospital_enter` → sets `isInHospital = true`, returns PendingAction
2. Player chooses "roll" → `handleChooseAction` → executes `corner_hospital_roll` → rolls dice
3. If success → `isInHospital = false`
4. If fail → stays in hospital

Then on NEXT turn:
1. `advanceTurn` → sets `roll_dice` pendingAction
2. `handleRollDice` → detects `isInHospital`, rolls to escape
3. If success → set another `roll_dice` for movement
4. If fail → `advanceTurn`

This flow is correct. The issue was only in the "success" path of the second-turn roll.

**Step 3: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "fix: hospital exit allows normal movement roll"
```

---

### Task 7: Enable card usage from hand (Issue 5)

**Files:**
- Modify: `server/src/game/GameCoordinator.ts:1328+` (handleUseCard)
- Modify: `client/src/components/CardDetail.tsx` (use button logic)

**Step 1: Enhance handleUseCard for cards requiring interaction**

The current `handleUseCard` only applies simple stat effects. For cards that need target selection or complex logic, route to the card's handler:

```typescript
handleUseCard(playerId: string, cardId: string, targetPlayerId?: string): void {
    const state = this.engine.getState();
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const cardIndex = player.heldCards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const card = player.heldCards[cardIndex];

    // Check if there's a registered handler for this card
    const handlerId = `card_${card.id}`;
    if (this.engine.getEventHandler().hasHandler(handlerId)) {
        // Remove card from hand first
        player.heldCards.splice(cardIndex, 1);
        this.addLog(playerId, `${player.name} 使用手牌: ${card.name}`);

        // Execute card handler (may return PendingAction for further interaction)
        const pendingAction = this.engine.getEventHandler().execute(handlerId, playerId, targetPlayerId);

        if (card.returnToDeck) {
            state.discardPiles[card.deckType].push(card);
        }

        if (pendingAction) {
            state.pendingAction = pendingAction;
            this.io.to(this.roomId).emit('game:event-trigger', {
                title: `使用手牌: ${card.name}`,
                description: pendingAction.prompt,
                pendingAction,
            });
        }

        this.broadcastState();
        if (this.checkAndEmitWin()) return;
        return;
    }

    // Fallback: apply simple effects (existing code)
    // ... keep existing simple effect logic

    // Remove card from hand after applying effects
    player.heldCards.splice(cardIndex, 1);
    if (card.returnToDeck) {
        state.discardPiles[card.deckType].push(card);
    }

    this.addLog(playerId, `${player.name} 使用手牌: ${card.name}`);
    this.broadcastState();
}
```

**Step 2: Verify CardDetail.tsx use button works**

The client-side CardDetail already has a "Use" button that calls `useCard(cardId, targetPlayerId)`. Verify it passes the correct parameters.

**Step 3: Commit**

```bash
git add server/src/game/GameCoordinator.ts
git commit -m "feat: enable full card usage from hand with handler routing"
```

---

### Task 8: Broadcast events to all players (Issue 7)

**Files:**
- Modify: `client/src/context/GameContext.tsx:148-161` (remove player filter)
- Modify: `server/src/game/GameCoordinator.ts` (add broadcast event with player info)
- Modify: `client/src/components/EventModal.tsx` (read-only mode for non-active player)

**Step 1: Remove client-side event filter**

In `GameContext.tsx`, the `handleEventTrigger` currently filters events for the current player only (line 152). Change it to show events to ALL players:

```typescript
const handleEventTrigger = (data: { title: string; description: string; pendingAction?: PendingAction; playerId?: string }) => {
    // Dedup check (from Task 3)
    if (data.pendingAction?.id && data.pendingAction.id === lastEventActionId.current) {
        return;
    }
    if (data.pendingAction?.id) {
        lastEventActionId.current = data.pendingAction.id;
    }

    // Show event to ALL players — EventModal will handle read-only vs interactive
    setCurrentEvent({
        title: data.title,
        description: data.description,
        pendingAction: data.pendingAction,
    });
    playSound('event_trigger');
};
```

**Step 2: Add server-side event result broadcast**

After a player makes a choice (in `_processAction`), broadcast the result:

```typescript
// After processing a choose_option action, before advancing turn:
this.io.to(this.roomId).emit('game:event-trigger', {
    title: '事件结果',
    description: `${this.engine.getPlayer(playerId)?.name} 的选择已生效`,
    playerId,
});
```

**Step 3: Modify EventModal for read-only mode**

In `EventModal.tsx`, add logic: if the pending action's `playerId` is not the current user, show the event in read-only mode (no action buttons, auto-dismiss after a few seconds):

```typescript
// In EventModal component:
const isMyAction = currentEvent?.pendingAction?.playerId === playerId ||
                   currentEvent?.pendingAction?.playerId === 'all';

// If not my action, show read-only view with auto-dismiss
useEffect(() => {
    if (currentEvent && !isMyAction && !currentEvent.pendingAction) {
        const timer = setTimeout(() => clearEvent(), 4000);
        return () => clearTimeout(timer);
    }
}, [currentEvent, isMyAction]);

// In render: only show option buttons if isMyAction
{isMyAction && currentEvent.pendingAction?.options?.map(...)}

// For non-active player, show a read-only banner:
{!isMyAction && (
    <div className="event-readonly-banner">
        {currentEvent.pendingAction?.playerId &&
            `等待 ${getPlayerName(currentEvent.pendingAction.playerId)} 做出选择...`}
    </div>
)}
```

**Step 4: Commit**

```bash
git add client/src/context/GameContext.tsx client/src/components/EventModal.tsx server/src/game/GameCoordinator.ts
git commit -m "feat: broadcast game events to all players with read-only view"
```

---

### Task 9: Add resource change broadcasting (Issue 8)

**Files:**
- Modify: `server/src/game/GameEngine.ts:198-260` (modifyPlayer* methods)
- Modify: `server/src/game/GameCoordinator.ts` (add IO callback)
- Modify: `client/src/context/GameContext.tsx` (listen to new event)
- Modify: `client/src/stores/gameStore.ts` (add resource change state)

**Step 1: Add resource change broadcast callback to GameEngine**

```typescript
// In GameEngine, add:
private resourceChangeCallback: ((data: {
    playerId: string;
    playerName: string;
    stat: 'money' | 'gpa' | 'exploration';
    delta: number;
    current: number;
}) => void) | null = null;

setResourceChangeCallback(cb: typeof this.resourceChangeCallback): void {
    this.resourceChangeCallback = cb;
}
```

**Step 2: Call the callback in modifyPlayer* methods**

In `modifyPlayerMoney`:
```typescript
// After line 229 (after modifying money):
if (this.resourceChangeCallback) {
    this.resourceChangeCallback({
        playerId,
        playerName: player.name,
        stat: 'money',
        delta,
        current: player.money,
    });
}
```

Similarly for `modifyPlayerGpa` and `modifyPlayerExploration`.

**Step 3: Wire the callback in GameCoordinator constructor**

```typescript
// In GameCoordinator constructor:
this.engine.setResourceChangeCallback((data) => {
    this.io.to(this.roomId).emit('game:resource-change', data);
});
```

**Step 4: Listen on client**

In `GameContext.tsx`, add listener:

```typescript
const handleResourceChange = (data: { playerId: string; playerName: string; stat: string; delta: number; current: number }) => {
    // Store resource change for FloatingText display
    // This can be handled by the Zustand store or a local state
    setAnnouncement({
        message: `${data.playerName}: ${data.stat === 'money' ? '金钱' : data.stat === 'gpa' ? 'GPA' : '探索值'} ${data.delta >= 0 ? '+' : ''}${data.delta} (${data.current})`,
        type: data.delta >= 0 ? 'success' : 'warning',
        timestamp: Date.now(),
    });
};

socket.on('game:resource-change', handleResourceChange);
// In cleanup: socket.off('game:resource-change', handleResourceChange);
```

**Step 5: Commit**

```bash
git add server/src/game/GameEngine.ts server/src/game/GameCoordinator.ts client/src/context/GameContext.tsx
git commit -m "feat: broadcast resource changes to all players"
```

---

### Task 10: Add persistent game logging (Issue 4)

**Files:**
- Create: `server/src/game/GameLogger.ts`
- Modify: `server/src/game/GameCoordinator.ts` (integrate logger)

**Step 1: Create GameLogger class**

```typescript
// server/src/game/GameLogger.ts
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface GameLogRecord {
    timestamp: number;
    turn: number;
    playerId: string;
    type: 'dice_roll' | 'move' | 'event' | 'card' | 'resource_change' | 'choice' | 'phase_change' | 'system';
    message: string;
    data?: Record<string, unknown>;
}

export class GameLogger {
    private records: GameLogRecord[] = [];
    private roomId: string;
    private startTime: number;

    constructor(roomId: string) {
        this.roomId = roomId;
        this.startTime = Date.now();
    }

    log(record: Omit<GameLogRecord, 'timestamp'>): void {
        this.records.push({ ...record, timestamp: Date.now() });
    }

    async persist(): Promise<string> {
        const dir = join(process.cwd(), 'logs');
        await mkdir(dir, { recursive: true });

        const filename = `game-${this.roomId}-${this.startTime}.json`;
        const filepath = join(dir, filename);

        await writeFile(filepath, JSON.stringify({
            roomId: this.roomId,
            startTime: this.startTime,
            endTime: Date.now(),
            totalRecords: this.records.length,
            records: this.records,
        }, null, 2));

        return filepath;
    }

    getRecords(): GameLogRecord[] {
        return [...this.records];
    }
}
```

**Step 2: Integrate GameLogger into GameCoordinator**

```typescript
// In GameCoordinator:
private logger: GameLogger;

constructor(engine: GameEngine, io: GameServer, roomId: string) {
    this.engine = engine;
    this.io = io;
    this.roomId = roomId;
    this.logger = new GameLogger(roomId);
}

// In addLog:
private addLog(playerId: string, message: string): void {
    const state = this.engine.getState();
    state.log.push({ turn: state.turnNumber, playerId, message, timestamp: Date.now() });
    this.logger.log({ turn: state.turnNumber, playerId, type: 'system', message });
}

// Add detailed logging calls throughout:
// - In handleRollDice: logger.log({ type: 'dice_roll', ... })
// - In handleCellLanding: logger.log({ type: 'event', ... })
// - In _processAction: logger.log({ type: 'choice', ... })

// When game ends (in checkAndEmitWin or forceEndGame):
// this.logger.persist().catch(err => console.error('Failed to persist game log:', err));
```

**Step 3: Commit**

```bash
git add server/src/game/GameLogger.ts server/src/game/GameCoordinator.ts
git commit -m "feat: add persistent game logging for replay"
```

---

### Task 11: Verify and fix line exit rewards (Issue 6)

**Files:**
- Modify: `server/src/game/handlers/line-handlers.ts` (verify/fix all 8 experience card handlers)
- Modify: `server/src/game/GameEngine.ts:467-518` (exitLine)

**Step 1: Verify all 8 experience card handlers**

From the exploration, all 8 handlers are registered:
- `pukou_exp_card` ✓ (returns PendingAction for choosing campus)
- `study_exp_card` ✓ (+0.2 GPA + random line entry)
- `money_exp_card` ✓ (+500 money, conditional donation)
- `suzhou_exp_card` ✓ (choose player to move)
- `explore_exp_card` ✓ (+2×remaining_players exploration, skip 2 turns)
- `gulou_exp_card` ✓ (+3 exploration, skip 1 turn)
- `xianlin_exp_card` ✓ (+3 exploration, move to start)
- `food_exp_card` ⚠️ (has TODO: "标记玩家已获得食堂线免进卡")

**Step 2: Fix food_exp_card TODO**

```typescript
// In line-handlers.ts, food_exp_card handler:
this.registerHandler('food_exp_card', (eng, pid) => {
    const player = eng.getPlayer(pid);
    if (!player) return null;

    // 宠辱不惊: food line becomes optional for this player
    // Mark player so food line entry is no longer forced
    if (!player.effects.find(e => e.type === 'custom' && e.data?.foodLineOptional)) {
        player.effects.push({
            id: `food_optional_${Date.now()}`,
            type: 'custom',
            turnsRemaining: 999, // permanent
            data: { foodLineOptional: true },
        });
    }
    eng.log('获得经验卡: 宠辱不惊 — 食堂线不再强制进入', pid);
    return null;
});
```

**Step 3: Check exitLine correctly calls experience card**

In `GameEngine.exitLine()` (line 516-518):
```typescript
if (line?.experienceCard && moveToMainBoard) {
    this.eventHandler.execute(line.experienceCard.handlerId, playerId);
}
```

This only executes if `moveToMainBoard` is true (normal exit at end of line). Verify this is always called when reaching end of line. In `movePlayerInLine` (line 357-360):
```typescript
if (newIndex >= line.cells.length) {
    this.exitLine(playerId, true);
    return;
}
```
This is correct.

**Step 4: Verify pukou_exp_card handler properly broadcasts**

The pukou_exp_card returns a PendingAction. When `exitLine()` calls `eventHandler.execute()`, it gets the PendingAction back, but `exitLine()` ignores the return value! This is a bug.

Fix in `exitLine()`:

```typescript
if (line?.experienceCard && moveToMainBoard) {
    const expCardAction = this.eventHandler.execute(line.experienceCard.handlerId, playerId);
    if (expCardAction) {
        // Store the pending action — GameCoordinator will pick it up
        this.state.pendingAction = expCardAction;
    }
}
```

**Step 5: Commit**

```bash
git add server/src/game/handlers/line-handlers.ts server/src/game/GameEngine.ts
git commit -m "fix: properly execute line exit experience cards and fix food line"
```

---

### Task 12: Integration testing and final verification

**Step 1: Build both server and client**

Run: `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit`
Expected: No type errors

**Step 2: Start dev server and test manually**

Run: `npm run dev` (or equivalent)

Test scenarios:
1. Roll dice → verify button locks during animation
2. Play 6 rounds → verify plan confirmation popup appears
3. Land on 蒋公的面子 → verify only ONE choice popup appears
4. Land on 勤工助学 → verify player skips NEXT turn, not current
5. Land on event with dice roll → verify dice animation shows
6. Land on hospital → verify one roll per turn, success allows movement
7. Use a holdable card from hand → verify it works
8. Any event → verify ALL players see the popup
9. Any resource change → verify all players see the notification
10. Complete a game → verify log file created in `logs/` directory
11. Exit a branch line → verify experience card reward triggers

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix: resolve 11 gameplay issues - dice lock, plan confirmation, event dedup, skip-turn, re-roll, hospital, card usage, event broadcast, resource display, logging, line rewards"
```
