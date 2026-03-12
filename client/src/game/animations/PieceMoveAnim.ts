// client/src/game/animations/PieceMoveAnim.ts
// Animates a player piece hopping along a path with arc trajectories and landing ripples.

import { Container, Graphics } from 'pixi.js';
import { TweenEngine, EASINGS } from './TweenEngine';
import { AnimationConfig } from './AnimationConfig';
import { playSound } from '../../audio/AudioManager';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';

export async function animatePieceMove(
  piece: Container,
  path: { x: number; y: number }[],
  tweenEngine: TweenEngine,
  effectLayer: Container,
  trailColor: number = hexToPixi(DESIGN_TOKENS.color.white),
): Promise<void> {
  const baseStep = 450;
  // Progressive acceleration: longer paths move faster per step
  const stepDuration = AnimationConfig.scaleDuration(
    path.length <= 4 ? baseStep :
    path.length <= 8 ? baseStep * 0.75 :
    baseStep * 0.55
  );

  // Initial squash anticipation for the first jump
  if (stepDuration > 0 && path.length > 0) {
    await tweenEngine.to(
      piece.scale,
      { x: 1.05, y: 0.9 },
      AnimationConfig.scaleDuration(50),
      EASINGS.easeOut,
    );
    await tweenEngine.to(
      piece.scale,
      { x: 1, y: 1 },
      AnimationConfig.scaleDuration(30),
      EASINGS.easeOut,
    );
  }

  // Trail dots: track active dots so we can limit count
  const activeTrailDots: Graphics[] = [];
  const MAX_TRAIL_DOTS = 6;

  console.log(`[PieceMoveAnim] path=${path.length} steps, stepDuration=${stepDuration}, piece at (${piece.x.toFixed(0)}, ${piece.y.toFixed(0)})`);
  for (let i = 0; i < path.length; i++) {
    const target = path[i];
    if (stepDuration <= 0) {
      piece.x = target.x;
      piece.y = target.y;
      continue;
    }

    // Spawn a trail dot at the piece's current position before it moves
    spawnTrailDot(effectLayer, piece.x, piece.y, trailColor, tweenEngine, activeTrailDots, MAX_TRAIL_DOTS);

    // For long paths, skip arc on middle stations (linear move), only arc on last 2
    const isLastTwo = i >= path.length - 2;
    const useArc = path.length <= 8 || isLastTwo;

    if (useArc) {
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
    } else {
      // Linear fast move for middle stations on long paths
      await tweenEngine.to(
        piece,
        { x: target.x, y: target.y },
        stepDuration * 0.7,
        EASINGS.easeInOut,
      );
    }

    // Play step sound after each hop completes
    playSound('piece_step');

    // Landing ripple only on last 2 steps for long paths, every step for short
    if (path.length <= 8 || isLastTwo) {
      createRipple(effectLayer, target.x, target.y, tweenEngine);
    }
  }

  // Play landing sound after all steps complete, then pause at destination
  if (path.length > 0) {
    playSound('piece_land');
    // Pause at destination so the player can see where the piece landed
    await new Promise(resolve => setTimeout(resolve, AnimationConfig.scaleDuration(1000)));
  }
}

/**
 * Spawn a semi-transparent trail dot that fades out over 800ms.
 * Limits the number of visible trail dots to maxDots.
 */
function spawnTrailDot(
  layer: Container,
  x: number,
  y: number,
  color: number,
  tweenEngine: TweenEngine,
  activeDots: Graphics[],
  maxDots: number,
): void {
  // Remove oldest dots if at the limit
  while (activeDots.length >= maxDots) {
    const oldest = activeDots.shift()!;
    if (oldest.parent) oldest.parent.removeChild(oldest);
    oldest.destroy();
  }

  const dot = new Graphics();
  dot.circle(0, 0, 4);
  dot.fill({ color, alpha: 0.4 });
  dot.x = x;
  dot.y = y;
  layer.addChild(dot);
  activeDots.push(dot);

  const fadeDuration = AnimationConfig.scaleDuration(800);
  if (fadeDuration <= 0) {
    // Reduced-motion: remove immediately
    if (dot.parent) dot.parent.removeChild(dot);
    dot.destroy();
    const idx = activeDots.indexOf(dot);
    if (idx !== -1) activeDots.splice(idx, 1);
    return;
  }

  tweenEngine.to(dot, { alpha: 0 }, fadeDuration, EASINGS.easeOut).then(() => {
    if (dot.parent) dot.parent.removeChild(dot);
    dot.destroy();
    const idx = activeDots.indexOf(dot);
    if (idx !== -1) activeDots.splice(idx, 1);
  });
}

function createRipple(layer: Container, x: number, y: number, tweenEngine: TweenEngine): void {
  const duration = AnimationConfig.scaleDuration(333); // ~20 frames at 60fps
  const ripple = new Graphics();
  ripple.circle(0, 0, 5);
  ripple.fill({ color: hexToPixi(DESIGN_TOKENS.color.white), alpha: 0.5 });
  ripple.x = x;
  ripple.y = y;
  layer.addChild(ripple);

  if (duration <= 0) {
    // Reduced-motion: just remove immediately
    layer.removeChild(ripple);
    ripple.destroy();
    return;
  }

  // Expand scale from 1 to 3 and fade alpha from 0.5 to 0 using TweenEngine
  Promise.all([
    tweenEngine.to(ripple.scale, { x: 3, y: 3 }, duration, EASINGS.easeOut),
    tweenEngine.to(ripple, { alpha: 0 }, duration, EASINGS.easeOut),
  ]).then(() => {
    if (ripple.parent) {
      ripple.parent.removeChild(ripple);
    }
    ripple.destroy();
  });
}
