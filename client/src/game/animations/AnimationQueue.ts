// client/src/game/animations/AnimationQueue.ts
// Sequential animation queue with parallel batch support.

export interface GameAnimation {
  type: string;
  play: () => Promise<void>;
  onComplete?: () => void;
}

export class AnimationQueue {
  private queue: GameAnimation[] = [];
  private playing = false;

  enqueue(anim: GameAnimation): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ ...anim, onComplete: resolve });
      if (!this.playing) {
        void this.playNext();
      }
    });
  }

  async parallel(anims: GameAnimation[]): Promise<void> {
    await Promise.all(anims.map((a) => a.play()));
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.playing = false;
      return;
    }
    this.playing = true;
    const anim = this.queue.shift()!;
    await anim.play();
    anim.onComplete?.();
    await this.playNext();
  }

  clear(): void {
    // Resolve all pending callbacks so awaiting code doesn't hang
    for (const a of this.queue) {
      a.onComplete?.();
    }
    this.queue = [];
    this.playing = false;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get length(): number {
    return this.queue.length;
  }
}
