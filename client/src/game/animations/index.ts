// client/src/game/animations/index.ts
// Barrel export for the animation system.

export { TweenEngine, EASINGS } from './TweenEngine';
export type { EasingFn } from './TweenEngine';
export { AnimationQueue } from './AnimationQueue';
export type { GameAnimation } from './AnimationQueue';
export { AnimationConfig } from './AnimationConfig';
export { animatePieceMove } from './PieceMoveAnim';
export { showFloatingText } from './FloatingText';
export { animateDiceResult } from './DiceRollAnim';
