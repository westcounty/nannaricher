// client/src/game/animations/FloatingText.ts
// Shows floating text that drifts upward and fades out (e.g. "+300 gold").

import { Container, Text, TextStyle } from 'pixi.js';
import { TweenEngine, EASINGS } from './TweenEngine';
import { AnimationConfig } from './AnimationConfig';

export function showFloatingText(
  layer: Container,
  x: number,
  y: number,
  text: string,
  color: string = '#D4AF37',
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

  if (tweenEngine) {
    // Use TweenEngine: drift up by 40px and fade alpha to 0
    Promise.all([
      tweenEngine.to(textObj, { y: y - 40 }, duration, EASINGS.easeOut),
      tweenEngine.to(textObj, { alpha: 0 }, duration, EASINGS.easeOut),
    ]).then(() => {
      if (textObj.parent) {
        textObj.parent.removeChild(textObj);
      }
      textObj.destroy();
    });
  } else {
    // Fallback: RAF-based animation (for backward compatibility)
    let elapsed = 0;
    const animate = () => {
      elapsed += 16.67;
      const progress = Math.min(elapsed / duration, 1);
      textObj.y = y - 40 * progress;
      textObj.alpha = 1 - progress;
      if (progress >= 1) {
        if (textObj.parent) {
          textObj.parent.removeChild(textObj);
        }
        textObj.destroy();
      } else {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }
}
