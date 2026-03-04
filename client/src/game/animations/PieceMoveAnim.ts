// client/src/game/animations/PieceMoveAnim.ts
// Animates a player piece hopping along a path with arc trajectories and landing ripples.

import { Container, Graphics } from 'pixi.js';
import { TweenEngine, EASINGS } from './TweenEngine';
import { AnimationConfig } from './AnimationConfig';
import { playSound } from '../../audio/AudioManager';

export async function animatePieceMove(
  piece: Container,
  path: { x: number; y: number }[],
  tweenEngine: TweenEngine,
  effectLayer: Container,
): Promise<void> {
  const stepDuration = AnimationConfig.scaleDuration(300);

  for (const target of path) {
    if (stepDuration <= 0) {
      piece.x = target.x;
      piece.y = target.y;
      continue;
    }

    // Arc: rise to midpoint then descend
    const midY = Math.min(piece.y, target.y) - 15;
    await tweenEngine.to(
      piece,
      { x: (piece.x + target.x) / 2, y: midY },
      stepDuration / 2,
      EASINGS.easeOut,
    );
    await tweenEngine.to(
      piece,
      { x: target.x, y: target.y },
      stepDuration / 2,
      EASINGS.easeInOut,
    );

    // Landing ripple at each step
    createRipple(effectLayer, target.x, target.y, tweenEngine);
    playSound('piece_step');
  }

  // Final landing sound
  if (path.length > 0) {
    playSound('piece_land');
  }
}

function createRipple(layer: Container, x: number, y: number, tweenEngine: TweenEngine): void {
  const ripple = new Graphics();
  ripple.circle(0, 0, 5);
  ripple.fill({ color: 0xffffff, alpha: 0.5 });
  ripple.x = x;
  ripple.y = y;
  layer.addChild(ripple);

  // Expand and fade out using tweenEngine for consistency
  tweenEngine.to(ripple, { alpha: 0 }, 333, EASINGS.easeOut).then(() => {
    layer.removeChild(ripple);
    ripple.destroy();
  });
  tweenEngine.to(ripple.scale, { x: 3, y: 3 }, 333, EASINGS.easeOut);
}
