// client/src/game/animations/FloatingText.ts
// Shows floating text that drifts upward and fades out (e.g. "+300 gold").
// Uses TweenEngine for consistency with PieceMoveAnim and DiceRollAnim.

import { Container, Text, TextStyle } from 'pixi.js';
import { AnimationConfig } from './AnimationConfig';
import { TweenEngine, EASINGS } from './TweenEngine';

export function showFloatingText(
  layer: Container,
  x: number,
  y: number,
  text: string,
  color: string = '#FFD700',
  tweenEngine?: TweenEngine,
): void {
  const duration = AnimationConfig.scaleDuration(1500);
  if (duration <= 0) return;

  const style = new TextStyle({
    fontSize: 16,
    fontWeight: 'bold',
    fill: color,
    stroke: { color: '#000000', width: 2 },
    dropShadow: { color: '#000000', blur: 2, distance: 1 },
  });

  const textObj = new Text({ text, style });
  textObj.anchor.set(0.5);
  textObj.x = x;
  textObj.y = y;
  layer.addChild(textObj);

  const cleanup = () => {
    if (textObj.parent) {
      layer.removeChild(textObj);
    }
    textObj.destroy();
  };

  if (tweenEngine) {
    // Use TweenEngine for drift-up and fade-out
    tweenEngine.to(textObj, { y: y - 40, alpha: 0 }, duration, EASINGS.easeOut).then(cleanup);
  } else {
    // Fallback to requestAnimationFrame if no TweenEngine provided
    const startY = y;
    let elapsed = 0;

    const animate = () => {
      elapsed += 16.67; // ~60fps step
      const progress = Math.min(elapsed / duration, 1);
      textObj.y = startY - 40 * progress;
      textObj.alpha = 1 - progress;
      if (progress >= 1) {
        cleanup();
      } else {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }
}
