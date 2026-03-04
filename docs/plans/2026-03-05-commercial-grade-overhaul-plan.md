# Commercial-Grade Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire all 27 audio effects, clean up dead code, integrate orphaned features, and redesign the game UI to commercial quality for both desktop and mobile.

**Architecture:** Two-phase approach. Phase 1 (Tasks 1-7) handles audio integration, dead code cleanup, and orphaned feature integration — low risk, high impact. Phase 2 (Tasks 8-15) redesigns the UI layout from "programmer layout" to "commercial game UI" with a new bottom action bar, compact header, and immersive board-first design.

**Tech Stack:** React 18, TypeScript, PixiJS 8, Zustand 5, Web Audio API, Tailwind CSS 4, Vite 6

---

## Phase 1: Audio + Code Governance

### Task 1: Delete Dead Code (Orphaned Files)

**Files:**
- Delete: `client/src/hooks/useSound.ts`
- Delete: `client/src/components/BoardCanvas.tsx`
- Delete: `client/src/components/CellTooltip.tsx`
- Delete: `client/src/components/GuideTooltip.tsx`
- Delete: `client/src/components/GuideTooltip.css` (if exists)
- Delete: `client/src/canvas/BoardRenderer.ts`
- Delete: `client/src/canvas/CanvasController.ts`
- Delete: `client/src/canvas/colors.ts`
- Delete: `client/src/canvas/types.ts`
- Delete: `client/src/canvas/index.ts` (if exists)
- Delete: `client/src/game/SimpleGameCanvas.tsx`
- Delete: `client/src/socket.ts`
- Modify: `client/src/components/index.ts`
- Modify: `client/src/hooks/index.ts`
- Modify: `client/src/ui/layouts/ResponsiveLayout.tsx` (remove GameLayout)

**Step 1: Delete orphaned files**

```bash
cd client/src
rm -f hooks/useSound.ts
rm -f components/BoardCanvas.tsx
rm -f components/CellTooltip.tsx
rm -f components/GuideTooltip.tsx
rm -f components/GuideTooltip.css
rm -rf canvas/
rm -f game/SimpleGameCanvas.tsx
rm -f socket.ts
```

**Step 2: Clean up barrel exports in `client/src/components/index.ts`**

Remove these lines:
```typescript
// DELETE these lines:
export { TrainingPlanView } from './TrainingPlanView';  // keep file, remove from barrel (will re-add when integrated)
export { CellTooltip } from './CellTooltip';
export { GuideTooltip, useGuideCompleted, useResetGuide } from './GuideTooltip';
```

**Step 3: Clean up barrel exports in `client/src/hooks/index.ts`**

Remove these lines:
```typescript
// DELETE these lines:
export { useSound } from './useSound';
export type { SoundType } from './useSound';
```

**Step 4: Remove `GameLayout` from `client/src/ui/layouts/ResponsiveLayout.tsx`**

Delete the `GameLayout` component function and its related types. Keep `ResponsiveProvider` and `useResponsive`.

**Step 5: Remove unused dependencies**

```bash
cd client && npm uninstall howler @types/howler
```

**Step 6: Verify build succeeds**

```bash
cd client && npx tsc --noEmit
```

Expected: No type errors referencing deleted files. If errors appear, trace each import and update/remove.

**Step 7: Commit**

```bash
git add -A && git commit -m "chore: delete orphaned code (useSound, BoardCanvas, canvas/, GuideTooltip, CellTooltip, SimpleGameCanvas, socket.ts, GameLayout, howler)"
```

---

### Task 2: Wire Audio into SocketProvider (State-Diff Sounds)

**Files:**
- Modify: `client/src/context/SocketProvider.tsx`

**Step 1: Add a state-diff audio helper**

Add a `diffAndPlaySounds` function above the `SocketProvider` component:

```typescript
import type { GameState } from '@nannaricher/shared';

/**
 * Compare previous and new game states, play appropriate sounds.
 * Called on every game:state-update.
 */
function diffAndPlaySounds(
  prev: GameState | null,
  next: GameState,
  localPlayerId: string | null,
): void {
  if (!prev || !localPlayerId) return;

  // Round change
  if (next.roundNumber > prev.roundNumber) {
    playSound('round_start');
  }

  // Turn change
  if (next.currentPlayerIndex !== prev.currentPlayerIndex) {
    const currentPlayer = next.players[next.currentPlayerIndex];
    if (currentPlayer?.id === localPlayerId) {
      playSound('turn_start');
    } else {
      // Another player's turn started — our turn ended
      const prevPlayer = prev.players[prev.currentPlayerIndex];
      if (prevPlayer?.id === localPlayerId) {
        playSound('turn_end');
      }
    }
  }

  // Vote started/ended
  const prevVoting = prev.pendingAction?.type === 'multi_vote';
  const nextVoting = next.pendingAction?.type === 'multi_vote';
  if (!prevVoting && nextVoting) playSound('vote_start');
  if (prevVoting && !nextVoting) playSound('vote_end');

  // Player status changes (for local player)
  const prevMe = prev.players.find(p => p.id === localPlayerId);
  const nextMe = next.players.find(p => p.id === localPlayerId);
  if (prevMe && nextMe) {
    if (!prevMe.isInHospital && nextMe.isInHospital) playSound('hospital_enter');
    if (!prevMe.isBankrupt && nextMe.isBankrupt) playSound('bankrupt');
  }
}
```

**Step 2: Wire it into the `game:state-update` handler**

Add a `prevStateRef` to SocketProvider and call `diffAndPlaySounds`:

```typescript
// Inside SocketProvider, before the useEffect:
const prevStateRef = useRef<GameState | null>(null);

// Inside the game:state-update listener:
socket.on('game:state-update', (state) => {
  const localPlayerId = store.getState().playerId;
  diffAndPlaySounds(prevStateRef.current, state, localPlayerId);
  prevStateRef.current = state;
  store.getState().setGameState(state);
});
```

**Step 3: Add `card_draw` sound to `game:card-drawn` listener**

Add a new listener (if not already present):

```typescript
socket.on('game:card-drawn', (data) => {
  playSound('card_draw');
  store.getState().setDrawnCard(data);
});
```

Note: Check if `setDrawnCard` exists on the store. If not, the `game:card-drawn` handler may only exist in `GameContext.tsx`. In that case, just add `playSound('card_draw')` to the existing handler in `GameContext.tsx`.

**Step 4: Verify build**

```bash
cd client && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add client/src/context/SocketProvider.tsx && git commit -m "feat(audio): wire turn/round/vote/status sounds via state-diff in SocketProvider"
```

---

### Task 3: Wire Audio into GameCanvas (Stat Change Sounds)

**Files:**
- Modify: `client/src/game/GameCanvas.tsx`

**Step 1: Import playSound**

```typescript
import { playSound } from '../audio/AudioManager';
```

**Step 2: Add sound triggers alongside floating text**

In the `useEffect` that detects stat changes (around line 148-183), add `playSound` calls next to each `showFloatingText`:

```typescript
// Money change
if (player.money !== prevPlayer.money) {
  const delta = player.money - prevPlayer.money;
  const text = delta > 0 ? `+$${delta}` : `-$${Math.abs(delta)}`;
  const color = delta > 0 ? '#4ade80' : '#ef4444';
  showFloatingText(effectLayerRef.current!, pos.x, pos.y - 30, text, color);
  playSound(delta > 0 ? 'coin_gain' : 'coin_loss');
}

// GPA change
if (player.gpa !== prevPlayer.gpa) {
  const delta = player.gpa - prevPlayer.gpa;
  const text = `GPA ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
  const color = '#60a5fa';
  showFloatingText(effectLayerRef.current!, pos.x, pos.y - 50, text, color);
  playSound(delta > 0 ? 'gpa_up' : 'gpa_down');
}

// Exploration change
if (player.exploration !== prevPlayer.exploration) {
  const delta = player.exploration - prevPlayer.exploration;
  const text = `探索 ${delta > 0 ? '+' : ''}${delta}`;
  const color = '#fbbf24';
  showFloatingText(effectLayerRef.current!, pos.x, pos.y - 70, text, color);
  playSound('explore_up');
}
```

**Important:** Only play sounds for the local player's stat changes to avoid audio spam. Add a guard:

```typescript
// Only play audio for local player's changes
const isLocalPlayer = player.id === currentPlayerId;

if (player.money !== prevPlayer.money) {
  // ... floating text for all players ...
  if (isLocalPlayer) playSound(delta > 0 ? 'coin_gain' : 'coin_loss');
}
```

**Step 3: Commit**

```bash
git add client/src/game/GameCanvas.tsx && git commit -m "feat(audio): wire coin/gpa/exploration sounds on stat changes in GameCanvas"
```

---

### Task 4: Wire Audio into UI Components

**Files:**
- Modify: `client/src/components/CardHand.tsx`
- Modify: `client/src/components/VotePanel.tsx`
- Modify: `client/src/components/GameScreen.tsx`

**Step 1: CardHand — card_flip on open detail, card_use on use**

In `CardHand.tsx`, import playSound and add to card click and use handlers:

```typescript
import { playSound } from '../audio/AudioManager';

// In the card thumbnail click handler (opens detail):
onClick={() => {
  setSelectedCard(card);
  playSound('card_flip');
}}

// In the use card handler (inside CardDetail or wherever onUseCard is called):
const handleUseCard = (cardId: string, targetPlayerId?: string) => {
  playSound('card_use');
  onUseCard(cardId, targetPlayerId);
};
```

**Step 2: VotePanel — vote_cast on vote submit**

In `VotePanel.tsx`, import playSound and add to `handleVote`:

```typescript
import { playSound } from '../audio/AudioManager';

// In handleVote callback:
const handleVote = useCallback(
  (value: string) => {
    if (isSubmitted || hasVoted) return;
    setSelectedOption(value);
    setIsSubmitted(true);
    playSound('vote_cast');
    onVote(pendingAction.id, value);
  },
  [isSubmitted, hasVoted, onVote, pendingAction.id]
);
```

**Step 3: GameScreen — tab_switch on mobile tab click**

In `GameScreen.tsx`, import playSound and add to tab handler:

```typescript
import { playSound } from '../audio/AudioManager';

// In handleTabClick:
const handleTabClick = (tabId: TabId) => {
  playSound('tab_switch');
  setActiveTab((prev) => (prev === tabId ? null : tabId));
};
```

**Step 4: Commit**

```bash
git add client/src/components/CardHand.tsx client/src/components/VotePanel.tsx client/src/components/GameScreen.tsx
git commit -m "feat(audio): wire card/vote/tab sounds into UI components"
```

---

### Task 5: Add AudioControl Component

**Files:**
- Create: `client/src/components/AudioControl.tsx`
- Modify: `client/src/components/StatusBar.tsx`

**Step 1: Create AudioControl component**

```typescript
// client/src/components/AudioControl.tsx
import { useState, useCallback } from 'react';
import { AudioManager } from '../audio/AudioManager';
import { playSound } from '../audio/AudioManager';
import { DESIGN_TOKENS } from '../styles/tokens';

export function AudioControl() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(AudioManager.isMuted());
  const [masterVol, setMasterVol] = useState(AudioManager.getVolume('master'));
  const [sfxVol, setSfxVol] = useState(AudioManager.getVolume('sfx'));

  const toggleMute = useCallback(() => {
    const newMuted = AudioManager.toggleMute();
    setIsMuted(newMuted);
  }, []);

  const handleMasterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    AudioManager.setVolume('master', val);
    setMasterVol(val);
  }, []);

  const handleSfxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    AudioManager.setVolume('sfx', val);
    setSfxVol(val);
  }, []);

  const handleToggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
    playSound('button_click');
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={handleToggleOpen}
        style={{
          background: 'transparent',
          border: 'none',
          color: DESIGN_TOKENS.color.text.primary,
          fontSize: '1.2rem',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: DESIGN_TOKENS.radius.sm,
        }}
        title="音量控制"
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          background: DESIGN_TOKENS.color.bg.elevated,
          border: `1px solid rgba(139, 95, 191, 0.3)`,
          borderRadius: DESIGN_TOKENS.radius.lg,
          padding: '16px',
          minWidth: '200px',
          zIndex: 1000,
          boxShadow: DESIGN_TOKENS.shadow.lg,
        }}>
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={toggleMute}
              style={{
                width: '100%',
                padding: '8px',
                background: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(94, 58, 141, 0.3)',
                border: 'none',
                borderRadius: DESIGN_TOKENS.radius.md,
                color: DESIGN_TOKENS.color.text.primary,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              {isMuted ? '🔇 取消静音' : '🔊 静音'}
            </button>
          </div>

          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: DESIGN_TOKENS.color.text.secondary }}>
            主音量: {Math.round(masterVol * 100)}%
          </label>
          <input
            type="range" min="0" max="1" step="0.05"
            value={masterVol}
            onChange={handleMasterChange}
            style={{ width: '100%', marginBottom: '12px' }}
          />

          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', color: DESIGN_TOKENS.color.text.secondary }}>
            音效: {Math.round(sfxVol * 100)}%
          </label>
          <input
            type="range" min="0" max="1" step="0.05"
            value={sfxVol}
            onChange={handleSfxChange}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add AudioControl to StatusBar**

In `StatusBar.tsx`, import and render `<AudioControl />` in the right section of the status bar.

**Step 3: Commit**

```bash
git add client/src/components/AudioControl.tsx client/src/components/StatusBar.tsx
git commit -m "feat(audio): add AudioControl volume/mute UI to status bar"
```

---

### Task 6: Integrate LoadingScreen

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/GameScreen.tsx`
- Modify: `client/src/components/LoadingScreen.tsx` (fix unused `onComplete` prop)

**Step 1: Fix LoadingScreen — remove unused `onComplete` from destructured props**

Read `LoadingScreen.tsx`, find the `onComplete` in the props destructuring, and remove it if it's never called in the function body.

**Step 2: Replace loading states in App.tsx**

```typescript
import { LoadingScreen } from './components/LoadingScreen';

// Replace isLoading block:
if (isLoading) {
  return <LoadingScreen type="connecting" />;
}

// Replace GameScreenFallback:
function GameScreenFallback() {
  return <LoadingScreen type="loading" />;
}
```

**Step 3: Replace loading state in GameScreen.tsx**

```typescript
import { LoadingScreen } from './LoadingScreen';

// Replace the !gameState guard:
if (!gameState) {
  return <LoadingScreen type="waiting" />;
}
```

**Step 4: Verify the LoadingScreen CSS is imported**

Check if `LoadingScreen.tsx` imports its own CSS file. If it does, ensure it exists. If not, styles may be inline.

**Step 5: Commit**

```bash
git add client/src/App.tsx client/src/components/GameScreen.tsx client/src/components/LoadingScreen.tsx
git commit -m "feat(ui): integrate LoadingScreen with tips, progress bar, and skeleton states"
```

---

### Task 7: Integrate AccessibilityProvider

**Files:**
- Modify: `client/src/a11y/AccessibilityProvider.tsx` (fix infinite loop bug)
- Modify: `client/src/App.tsx`

**Step 1: Fix the reducedMotion infinite-loop bug**

In `AccessibilityProvider.tsx`, find the `useEffect` that runs on `[settings]` and contains `window.matchMedia('(prefers-reduced-motion: reduce)')`. Extract the `matchMedia` check into its own separate `useEffect` with empty deps `[]`:

```typescript
// Run once on mount: sync with OS reduced motion preference
useEffect(() => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.matches) {
    setSettings(prev => ({ ...prev, reducedMotion: true }));
  }
}, []);
```

Remove that same logic from the `[settings]` effect.

**Step 2: Wrap App with AccessibilityProvider**

In `App.tsx`:

```typescript
import { AccessibilityProvider } from './a11y/AccessibilityProvider';

export default function App() {
  return (
    <AccessibilityProvider>
      <SocketProvider>
        <GameProvider>
          <ResponsiveProvider>
            <div className="app">
              <GameRouter />
            </div>
          </ResponsiveProvider>
        </GameProvider>
      </SocketProvider>
    </AccessibilityProvider>
  );
}
```

**Step 3: Verify build**

```bash
cd client && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add client/src/a11y/AccessibilityProvider.tsx client/src/App.tsx
git commit -m "feat(a11y): integrate AccessibilityProvider with reduced-motion fix"
```

---

## Phase 2: UI Redesign

### Task 8: Create New CompactHeader Component

**Files:**
- Create: `client/src/components/CompactHeader.tsx`
- Create: `client/src/styles/compact-header.css`

**Step 1: Create CompactHeader**

Replace the current `StatusBar` with a thinner 48px header:
- Left: Game name "菜根人生" (small)
- Center: Round/turn indicator + StatusIndicator merged (e.g., "第3轮 · 第12回合 · 等待张三掷骰子")
- Right: AudioControl + settings gear icon

```typescript
// client/src/components/CompactHeader.tsx
import { AudioControl } from './AudioControl';
import type { GameState } from '@nannaricher/shared';
import '../styles/compact-header.css';

interface CompactHeaderProps {
  gameState: GameState;
  playerId: string | null;
  isMyTurn: boolean;
  currentPlayerName?: string;
}

export function CompactHeader({ gameState, playerId, isMyTurn, currentPlayerName }: CompactHeaderProps) {
  const statusText = isMyTurn
    ? '你的回合 — 请操作'
    : `等待 ${currentPlayerName || '...'} 操作`;

  return (
    <header className="compact-header">
      <div className="compact-header__brand">菜根人生</div>
      <div className="compact-header__center">
        <span className="compact-header__round">第{gameState.roundNumber}轮 · 第{gameState.turnNumber}回合</span>
        <span className={`compact-header__status ${isMyTurn ? 'compact-header__status--my-turn' : ''}`}>
          {statusText}
        </span>
      </div>
      <div className="compact-header__actions">
        <AudioControl />
      </div>
    </header>
  );
}
```

**Step 2: Create compact-header.css**

```css
.compact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--game-border);
  flex-shrink: 0;
}

.compact-header__brand {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-accent);
  white-space: nowrap;
}

.compact-header__center {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
}

.compact-header__round {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.compact-header__status {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  padding: 2px 10px;
  border-radius: 9999px;
  background: rgba(139, 95, 191, 0.15);
}

.compact-header__status--my-turn {
  color: var(--color-accent);
  background: rgba(201, 162, 39, 0.15);
  font-weight: 600;
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: none; }
  50% { box-shadow: 0 0 12px rgba(201, 162, 39, 0.3); }
}

.compact-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .compact-header {
    height: 40px;
    padding: 0 12px;
  }
  .compact-header__brand { font-size: 0.85rem; }
  .compact-header__round { display: none; }
  .compact-header__status { font-size: 0.8rem; }
}
```

**Step 3: Commit**

```bash
git add client/src/components/CompactHeader.tsx client/src/styles/compact-header.css
git commit -m "feat(ui): create CompactHeader component (48px slim header)"
```

---

### Task 9: Create Bottom Action Bar Component

**Files:**
- Create: `client/src/components/ActionBar.tsx`
- Create: `client/src/styles/action-bar.css`

**Step 1: Create ActionBar — the core interaction hub**

This component replaces the current `CurrentPlayerPanel` as the primary action area. It sits fixed at the bottom:

```typescript
// client/src/components/ActionBar.tsx
import { useGameState } from '../context/GameContext';
import { CardHand } from './CardHand';
import { playSound } from '../audio/AudioManager';
import type { Player, GameState } from '@nannaricher/shared';
import '../styles/action-bar.css';

interface ActionBarProps {
  myPlayer: Player | undefined;
  isMyTurn: boolean;
  gameState: GameState;
  useCard: (cardId: string, targetPlayerId?: string) => void;
}

export function ActionBar({ myPlayer, isMyTurn, gameState, useCard }: ActionBarProps) {
  const { rollDice, isRolling, diceResult } = useGameState();

  if (!myPlayer) return null;

  const canRollDice = isMyTurn &&
    !myPlayer.isBankrupt &&
    !isRolling &&
    gameState.phase === 'playing' &&
    (!gameState.pendingAction || gameState.pendingAction.type === 'roll_dice');

  const handleRoll = () => {
    if (canRollDice) {
      playSound('button_click');
      rollDice();
    }
  };

  return (
    <div className="action-bar">
      {/* Left: My stats */}
      <div className="action-bar__stats">
        <span className="action-bar__stat">
          <span className="action-bar__stat-icon">💰</span>
          <span className={`action-bar__stat-value ${myPlayer.money < 100 ? 'danger' : ''}`}>
            {myPlayer.money}
          </span>
        </span>
        <span className="action-bar__stat">
          <span className="action-bar__stat-icon">📚</span>
          <span className="action-bar__stat-value">{myPlayer.gpa.toFixed(1)}</span>
        </span>
        <span className="action-bar__stat">
          <span className="action-bar__stat-icon">🗺️</span>
          <span className="action-bar__stat-value">{myPlayer.exploration}</span>
        </span>
      </div>

      {/* Center: Cards */}
      <div className="action-bar__cards">
        <CardHand
          player={myPlayer}
          onUseCard={useCard}
          isCurrentPlayer={isMyTurn}
          players={gameState.players}
        />
      </div>

      {/* Right: Roll dice button */}
      <button
        className={`action-bar__roll ${isMyTurn ? 'action-bar__roll--active' : ''}`}
        onClick={handleRoll}
        disabled={!canRollDice}
      >
        {isRolling ? '🎲...' : `🎲 ${diceResult ? diceResult.total : '掷骰子'}`}
      </button>
    </div>
  );
}
```

**Step 2: Create action-bar.css**

```css
.action-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--game-border);
  height: 64px;
  flex-shrink: 0;
}

.action-bar__stats {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.action-bar__stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-bar__stat-icon {
  font-size: 0.9rem;
}

.action-bar__stat-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.action-bar__stat-value.danger {
  color: var(--color-danger);
}

.action-bar__cards {
  flex: 1;
  overflow: hidden;
  min-width: 0;
}

/* Override CardHand styles when inside action bar */
.action-bar__cards .card-hand {
  position: static;
  padding: 0;
  background: transparent;
  border: none;
  backdrop-filter: none;
  z-index: auto;
}

.action-bar__roll {
  flex-shrink: 0;
  padding: 10px 24px;
  font-size: 1.1rem;
  font-weight: 700;
  color: white;
  background: rgba(94, 58, 141, 0.4);
  border: 2px solid rgba(139, 95, 191, 0.3);
  border-radius: 12px;
  cursor: not-allowed;
  opacity: 0.5;
  transition: all 0.2s ease;
  min-width: 120px;
  text-align: center;
}

.action-bar__roll--active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  border-color: transparent;
  cursor: pointer;
  opacity: 1;
  box-shadow: 0 4px 15px rgba(94, 58, 141, 0.4), 0 0 20px rgba(201, 162, 39, 0.15);
  animation: dice-btn-glow 2s ease-in-out infinite;
}

.action-bar__roll--active:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(94, 58, 141, 0.5), 0 0 30px rgba(201, 162, 39, 0.25);
}

.action-bar__roll:disabled {
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 768px) {
  .action-bar {
    height: 56px;
    padding: 6px 12px;
    gap: 8px;
  }

  .action-bar__stats {
    display: none; /* Stats shown in dedicated bar above */
  }

  .action-bar__roll {
    min-width: 100px;
    padding: 8px 16px;
    font-size: 1rem;
  }
}
```

**Step 3: Commit**

```bash
git add client/src/components/ActionBar.tsx client/src/styles/action-bar.css
git commit -m "feat(ui): create ActionBar bottom component (stats + cards + dice)"
```

---

### Task 10: Create CompactPlayerCard Component

**Files:**
- Create: `client/src/components/CompactPlayerCard.tsx`
- Create: `client/src/styles/compact-player.css`

**Step 1: Create compact horizontal player card**

Replace the current vertical `PlayerPanel` with a more compact horizontal card:

```typescript
// client/src/components/CompactPlayerCard.tsx
import type { Player } from '@nannaricher/shared';
import '../styles/compact-player.css';

interface CompactPlayerCardProps {
  player: Player;
  isCurrentTurn?: boolean;
  isLocalPlayer?: boolean;
}

export function CompactPlayerCard({ player, isCurrentTurn, isLocalPlayer }: CompactPlayerCardProps) {
  const statusClass = player.isBankrupt ? 'bankrupt' : player.isInHospital ? 'hospital' : '';

  return (
    <div className={`compact-player ${isCurrentTurn ? 'compact-player--active' : ''} ${statusClass}`}>
      <div className="compact-player__avatar" style={{ backgroundColor: player.color }}>
        {player.name.charAt(0)}
      </div>
      <div className="compact-player__info">
        <div className="compact-player__name">
          {player.name}
          {isLocalPlayer && <span className="compact-player__you">(你)</span>}
          {player.isBankrupt && <span className="compact-player__badge badge-bankrupt">破产</span>}
          {player.isInHospital && <span className="compact-player__badge badge-hospital">校医院</span>}
        </div>
        <div className="compact-player__stats">
          <span>💰{player.money}</span>
          <span>📚{player.gpa.toFixed(1)}</span>
          <span>🗺️{player.exploration}</span>
          {player.heldCards && player.heldCards.length > 0 && (
            <span>🃏{player.heldCards.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create compact-player.css**

```css
.compact-player {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--color-bg-elevated);
  border-radius: 10px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.compact-player--active {
  border-color: var(--color-accent);
  box-shadow: 0 0 12px rgba(201, 162, 39, 0.2);
}

.compact-player.bankrupt {
  opacity: 0.5;
}

.compact-player.hospital {
  border-color: #42A5F5;
}

.compact-player__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
  color: white;
  flex-shrink: 0;
}

.compact-player__info {
  flex: 1;
  min-width: 0;
}

.compact-player__name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.compact-player__you {
  font-size: 0.7rem;
  color: var(--color-accent);
  font-weight: 400;
}

.compact-player__badge {
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 9999px;
  font-weight: 500;
}

.badge-bankrupt { background: var(--color-danger); color: #000; }
.badge-hospital { background: #42A5F5; color: #000; }

.compact-player__stats {
  display: flex;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-top: 2px;
}
```

**Step 3: Commit**

```bash
git add client/src/components/CompactPlayerCard.tsx client/src/styles/compact-player.css
git commit -m "feat(ui): create CompactPlayerCard horizontal player display"
```

---

### Task 11: Create Mobile Status Bar and Bottom Nav

**Files:**
- Create: `client/src/components/MobileStatusBar.tsx`
- Create: `client/src/components/MobileBottomNav.tsx`
- Create: `client/src/styles/mobile-nav.css`

**Step 1: Create MobileStatusBar (always-visible stat strip)**

```typescript
// client/src/components/MobileStatusBar.tsx
import type { Player } from '@nannaricher/shared';
import '../styles/mobile-nav.css';

interface MobileStatusBarProps {
  player: Player | undefined;
}

export function MobileStatusBar({ player }: MobileStatusBarProps) {
  if (!player) return null;

  return (
    <div className="mobile-status-bar">
      <span className={`mobile-stat ${player.money < 100 ? 'danger' : ''}`}>
        💰 {player.money}
      </span>
      <span className="mobile-stat">📚 {player.gpa.toFixed(1)}</span>
      <span className="mobile-stat">🗺️ {player.exploration}</span>
    </div>
  );
}
```

**Step 2: Create MobileBottomNav**

```typescript
// client/src/components/MobileBottomNav.tsx
import { playSound } from '../audio/AudioManager';
import type { Player, GameState } from '@nannaricher/shared';
import '../styles/mobile-nav.css';

interface MobileBottomNavProps {
  isMyTurn: boolean;
  isRolling: boolean;
  canRollDice: boolean;
  cardCount: number;
  onRollDice: () => void;
  onOpenCards: () => void;
  onOpenPlayers: () => void;
  onOpenMore: () => void;
}

export function MobileBottomNav({
  isMyTurn, isRolling, canRollDice, cardCount,
  onRollDice, onOpenCards, onOpenPlayers, onOpenMore,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav">
      <button
        className={`mobile-nav__btn mobile-nav__btn--primary ${canRollDice ? 'active' : ''}`}
        onClick={() => { playSound('button_click'); onRollDice(); }}
        disabled={!canRollDice}
      >
        {isRolling ? '🎲...' : '🎲 掷骰子'}
      </button>
      <button className="mobile-nav__btn" onClick={() => { playSound('tab_switch'); onOpenCards(); }}>
        🃏
        {cardCount > 0 && <span className="mobile-nav__badge">{cardCount}</span>}
      </button>
      <button className="mobile-nav__btn" onClick={() => { playSound('tab_switch'); onOpenPlayers(); }}>
        👥
      </button>
      <button className="mobile-nav__btn" onClick={() => { playSound('tab_switch'); onOpenMore(); }}>
        ⋯
      </button>
    </nav>
  );
}
```

**Step 3: Create mobile-nav.css**

```css
.mobile-status-bar {
  display: flex;
  justify-content: space-around;
  padding: 6px 16px;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--game-border);
}

.mobile-stat {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.mobile-stat.danger {
  color: var(--color-danger);
}

.mobile-bottom-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--game-border);
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}

.mobile-nav__btn {
  flex: 1;
  height: 44px;
  border: none;
  border-radius: 10px;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  font-size: 1.1rem;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mobile-nav__btn--primary {
  flex: 2;
  background: rgba(94, 58, 141, 0.3);
  opacity: 0.5;
}

.mobile-nav__btn--primary.active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
  opacity: 1;
  font-weight: 700;
  box-shadow: 0 2px 12px rgba(94, 58, 141, 0.4);
}

.mobile-nav__badge {
  position: absolute;
  top: 4px;
  right: 8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-danger);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**Step 4: Commit**

```bash
git add client/src/components/MobileStatusBar.tsx client/src/components/MobileBottomNav.tsx client/src/styles/mobile-nav.css
git commit -m "feat(ui): create MobileStatusBar and MobileBottomNav components"
```

---

### Task 12: Rewrite GameScreen Layout (Desktop)

**Files:**
- Modify: `client/src/components/GameScreen.tsx`
- Modify: `client/src/styles/game.css`

**Step 1: Refactor GameScreen desktop layout**

Replace the desktop layout section in `GameScreen.tsx` with the new structure:
- CompactHeader at top
- Main area: Board (75%) + Sidebar (25%)
- Sidebar: CompactPlayerCards + ChatPanel/GameLog tabs
- ActionBar at bottom

The full implementation involves:
1. Import new components (CompactHeader, ActionBar, CompactPlayerCard)
2. Replace `<StatusBar>` with `<CompactHeader>`
3. Replace desktop left-column/side-panel with new board-first + slim sidebar
4. Replace `<CurrentPlayerPanel>` with `<ActionBar>` at bottom
5. Use `<CompactPlayerCard>` for player list

**Step 2: Update game.css**

Create new layout classes. The core change is:
- `.game-screen` becomes a CSS Grid: `grid-template-rows: 48px 1fr 64px`
- `.game-main` becomes `grid-template-columns: 1fr 280px`
- Remove old `.left-column`, `.desktop-log-area` styles
- New `.game-sidebar` for the right panel

Key CSS changes:

```css
.game-screen.layout-desktop {
  display: grid;
  grid-template-rows: 48px 1fr 64px;
  height: 100vh;
  width: 100vw;
}

.game-main.layout-desktop {
  display: grid;
  grid-template-columns: 1fr 280px;
  overflow: hidden;
}

.game-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: var(--color-bg-surface);
  border-left: 1px solid var(--game-border);
  overflow-y: auto;
}

.board-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  position: relative;
  overflow: hidden;
}
```

**Step 3: Verify rendering**

```bash
cd client && npm run build
```

**Step 4: Commit**

```bash
git add client/src/components/GameScreen.tsx client/src/styles/game.css
git commit -m "feat(ui): redesign desktop GameScreen with compact header, board-first layout, and action bar"
```

---

### Task 13: Rewrite GameScreen Layout (Mobile)

**Files:**
- Modify: `client/src/components/GameScreen.tsx`
- Modify: `client/src/styles/game.css` (or `mobile.css`)

**Step 1: Replace mobile layout in GameScreen**

For mobile layout:
- CompactHeader (40px)
- Board area (fills remaining space)
- MobileStatusBar (my stats strip)
- MobileBottomNav (action buttons)
- Sheet overlays for cards/players/more

Replace the mobile tab bar and sheet sections with:

```typescript
{layout === 'mobile' && (
  <>
    <MobileStatusBar player={myPlayer} />
    <MobileBottomNav
      isMyTurn={isMyTurn}
      isRolling={isRolling}
      canRollDice={canRollDice}
      cardCount={myPlayer?.heldCards?.length || 0}
      onRollDice={() => rollDice()}
      onOpenCards={() => handleTabClick('hand')}
      onOpenPlayers={() => handleTabClick('plans')}
      onOpenMore={() => handleTabClick('log')}
    />
    {/* ... sheet overlays unchanged ... */}
  </>
)}
```

**Step 2: Commit**

```bash
git add client/src/components/GameScreen.tsx client/src/styles/game.css
git commit -m "feat(ui): redesign mobile GameScreen with status bar and bottom nav"
```

---

### Task 14: Integrate TrainingPlanView

**Files:**
- Modify: `client/src/components/TrainingPlanView.tsx` (add missing CSS)
- Create: `client/src/styles/training-plan.css`
- Modify: `client/src/components/GameScreen.tsx` (add to sidebar)

**Step 1: Create training-plan.css**

Style the TrainingPlanView component to match the new design system. Use the class names already used in the component (`training-plans`, `plan-item`, etc.).

**Step 2: Import TrainingPlanView in GameScreen sidebar**

In the desktop sidebar, after the player cards:

```typescript
import { TrainingPlanView } from './TrainingPlanView';

// In sidebar:
{myPlayer && myPlayer.trainingPlans.length > 0 && (
  <TrainingPlanView />
)}
```

**Step 3: Add to mobile "plans" tab**

In the TabSheetContent, the `plans` case should also include TrainingPlanView.

**Step 4: Commit**

```bash
git add client/src/components/TrainingPlanView.tsx client/src/styles/training-plan.css client/src/components/GameScreen.tsx
git commit -m "feat(ui): integrate TrainingPlanView with CSS into sidebar and mobile tabs"
```

---

### Task 15: Final Polish and Verification

**Files:**
- Various cleanup across modified files

**Step 1: Run TypeScript check**

```bash
cd client && npx tsc --noEmit
```

Fix any type errors.

**Step 2: Run build**

```bash
cd client && npm run build
```

Fix any build errors.

**Step 3: Verify all 27 sounds are wired**

Do a grep to confirm every sound name from `sounds.ts` appears in at least one `playSound()` call:

```bash
# For each sound name, verify it appears in a playSound call:
grep -r "playSound" client/src/ --include="*.ts" --include="*.tsx" | grep -v "sounds.ts" | grep -v "AudioManager.ts" | grep -v "useSound.ts"
```

**Step 4: Verify no dead imports remain**

```bash
# Check for imports of deleted files
grep -r "BoardCanvas\|CellTooltip\|GuideTooltip\|SimpleGameCanvas\|useSound\|socket'" client/src/ --include="*.ts" --include="*.tsx"
```

Should return no results.

**Step 5: Final commit**

```bash
git add -A && git commit -m "fix: resolve type errors and polish from UI overhaul"
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Delete dead code | Low |
| 2 | Wire audio state-diff (SocketProvider) | Medium |
| 3 | Wire audio stat-change (GameCanvas) | Low |
| 4 | Wire audio UI components | Low |
| 5 | AudioControl component | Medium |
| 6 | Integrate LoadingScreen | Low |
| 7 | Integrate AccessibilityProvider | Low |
| 8 | CompactHeader component | Medium |
| 9 | ActionBar component | Medium |
| 10 | CompactPlayerCard component | Medium |
| 11 | MobileStatusBar + MobileBottomNav | Medium |
| 12 | Rewrite GameScreen desktop layout | High |
| 13 | Rewrite GameScreen mobile layout | High |
| 14 | Integrate TrainingPlanView | Medium |
| 15 | Final polish + verification | Low |
