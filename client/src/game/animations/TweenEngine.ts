// client/src/game/animations/TweenEngine.ts
// Lightweight tween engine driven by PixiJS Ticker. Zero external dependencies.

import { Ticker } from 'pixi.js';

export type EasingFn = (t: number) => number;

export const EASINGS = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  bounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

interface TweenEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: Record<string, any>;
  props: Record<string, number>;
  startValues: Record<string, number>;
  duration: number;
  easing: EasingFn;
  elapsed: number;
  resolve: () => void;
}

function canReadTweenTargetValue(target: Record<string, any>, key: string): boolean {
  try {
    void target[key];
    return true;
  } catch {
    return false;
  }
}

function canWriteTweenTargetValue(target: Record<string, any>, key: string, value: number): boolean {
  try {
    target[key] = value;
    return true;
  } catch {
    return false;
  }
}

export class TweenEngine {
  private tweens: TweenEntry[] = [];
  private boundUpdate: () => void;

  constructor(private ticker: Ticker) {
    this.boundUpdate = () => this.update();
    ticker.add(this.boundUpdate);
  }

  to(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: Record<string, any>,
    props: Record<string, number>,
    duration: number,
    easing: EasingFn = EASINGS.easeOut,
  ): Promise<void> {
    if (duration <= 0) {
      for (const [key, val] of Object.entries(props)) {
        if (!canWriteTweenTargetValue(target, key, val)) {
          return Promise.resolve();
        }
      }
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const startValues: Record<string, number> = {};
      for (const key of Object.keys(props)) {
        if (!canReadTweenTargetValue(target, key)) {
          resolve();
          return;
        }
        startValues[key] = target[key] as number;
      }
      this.tweens.push({
        target,
        props,
        duration,
        easing,
        startValues,
        elapsed: 0,
        resolve,
      });
    });
  }

  private update(): void {
    const dt = this.ticker.deltaMS;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.elapsed += dt;
      const progress = Math.min(tw.elapsed / tw.duration, 1);
      const eased = tw.easing(progress);
      let targetInvalid = false;

      for (const [key, endVal] of Object.entries(tw.props)) {
        const nextValue = tw.startValues[key] + (endVal - tw.startValues[key]) * eased;
        if (!canWriteTweenTargetValue(tw.target, key, nextValue)) {
          targetInvalid = true;
          break;
        }
      }

      if (targetInvalid || progress >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
  }

  /** Cancel all tweens targeting a specific object. */
  cancelTarget(target: Record<string, unknown>): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      if (this.tweens[i].target === target) {
        this.tweens[i].resolve();
        this.tweens.splice(i, 1);
      }
    }
  }

  destroy(): void {
    this.ticker.remove(this.boundUpdate);
    // Resolve all pending tweens so awaiting code doesn't hang
    for (const tw of this.tweens) {
      tw.resolve();
    }
    this.tweens = [];
  }
}
