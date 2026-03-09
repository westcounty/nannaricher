// client/src/game/AnimationGate.ts
// Coordinates piece-move animations with UI events (modals, toasts).
// PlayerLayer increments/decrements the active count;
// SocketProvider awaits waitForIdle() before showing popups.

type Resolver = () => void;

let _activeCount = 0;
let _waiters: Resolver[] = [];

export const AnimationGate = {
  /** Call when a piece animation starts. */
  start(): void {
    _activeCount++;
  },

  /** Call when a piece animation ends. Flushes waiters when count hits 0. */
  end(): void {
    _activeCount = Math.max(0, _activeCount - 1);
    if (_activeCount === 0) {
      const resolvers = _waiters;
      _waiters = [];
      resolvers.forEach((r) => r());
    }
  },

  /** Resolves immediately if idle, otherwise waits for all animations to finish. */
  waitForIdle(): Promise<void> {
    if (_activeCount <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      _waiters.push(resolve);
    });
  },

  get isAnimating(): boolean {
    return _activeCount > 0;
  },
};
