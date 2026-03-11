type TokenState = 'pending' | 'started' | 'completed';

interface Entry {
  state: TokenState;
  waiters: Array<() => void>;
}

export class MovementEventGate {
  private nextId = 1;
  private entries = new Map<number, Entry>();
  private pendingTokens: number[] = [];

  nextToken(): number {
    return this.nextId++;
  }

  markPending(token: number): void {
    const entry = this.entries.get(token);
    if (entry) {
      entry.state = 'pending';
      if (!this.pendingTokens.includes(token)) {
        this.pendingTokens.push(token);
      }
      return;
    }
    this.entries.set(token, { state: 'pending', waiters: [] });
    this.pendingTokens.push(token);
  }

  markStarted(token: number): void {
    const entry = this.entries.get(token);
    if (entry) {
      entry.state = 'started';
      this.pendingTokens = this.pendingTokens.filter((item) => item !== token);
      return;
    }
    this.entries.set(token, { state: 'started', waiters: [] });
  }

  markCompleted(token: number): void {
    const entry = this.entries.get(token);
    if (!entry) return;

    entry.state = 'completed';
    const waiters = entry.waiters;
    this.entries.delete(token);
    waiters.forEach((resolve) => resolve());
  }

  waitFor(token: number): Promise<void> {
    const entry = this.entries.get(token);
    if (!entry || entry.state === 'completed') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      entry.waiters.push(resolve);
    });
  }

  reset(): void {
    this.entries.clear();
    this.pendingTokens = [];
    this.nextId = 1;
  }

  consumeNextPendingToken(): number | null {
    const token = this.pendingTokens.shift();
    if (token === undefined) {
      return null;
    }
    this.markStarted(token);
    return token;
  }
}

export const movementEventGate = new MovementEventGate();
