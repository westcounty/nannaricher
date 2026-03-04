// client/src/game/animations/AnimationConfig.ts
// Respects prefers-reduced-motion; provides duration scaling for all animations.

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export class AnimationConfig {
  static get durationMultiplier(): number {
    return prefersReducedMotion ? 0 : 1;
  }

  static shouldAnimate(): boolean {
    return !prefersReducedMotion;
  }

  static scaleDuration(ms: number): number {
    return ms * AnimationConfig.durationMultiplier;
  }
}
