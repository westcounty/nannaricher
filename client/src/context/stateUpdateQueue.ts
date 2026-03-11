import type { GameState } from '@nannaricher/shared';
import { AnimationGate } from '../game/AnimationGate';

interface ShouldDeferStateUpdateArgs {
  hasActiveMovementToken: boolean;
  prevState: GameState | null;
  nextState: GameState;
}

function positionsEqual(
  a: GameState['players'][number]['position'],
  b: GameState['players'][number]['position'],
): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'main' && b.type === 'main') return a.index === b.index;
  if (a.type === 'line' && b.type === 'line') {
    return a.lineId === b.lineId && a.index === b.index;
  }
  return false;
}

function startsNewMovement(prevState: GameState | null, nextState: GameState): boolean {
  if (!prevState) return false;

  const prevCurrent = prevState.players[prevState.currentPlayerIndex];
  const nextCurrent = nextState.players[nextState.currentPlayerIndex];

  if (!prevCurrent || !nextCurrent) return false;
  if (prevCurrent.id !== nextCurrent.id) return false;

  return !positionsEqual(prevCurrent.position, nextCurrent.position);
}

export function shouldDeferStateUpdateDuringMovement({
  hasActiveMovementToken,
  prevState,
  nextState,
}: ShouldDeferStateUpdateArgs): boolean {
  // Defer if we have an active movement token (existing logic)
  if (hasActiveMovementToken) {
    return !startsNewMovement(prevState, nextState);
  }

  // Also defer if ANY piece animation is in flight (covers bot/AFK moves
  // where the local client didn't initiate the movement token)
  if (AnimationGate.isAnimating) {
    return !startsNewMovement(prevState, nextState);
  }

  return false;
}
