// client/src/hooks/index.ts
export { useChat } from './useChat';
export { useGameState } from './useGameState';
export { useSocket } from './useSocket';
export {
  useAnimation,
  useShakeAnimation,
  useBounceAnimation,
  useFadeAnimation,
  useAnimatedValue,
  usePieceMovement,
  useCardFlip,
  useDiceRoll,
  useScalePulse,
} from './useAnimation';
export type { AnimatedValueOptions, Position } from './useAnimation';
export { useSound } from './useSound';
export type { SoundType } from './useSound';
