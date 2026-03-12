// client/src/game/animations/DiceRollAnim.ts
// Displays an animated dice result with bounce-in and fade-out.

import { Container, Text, TextStyle, Graphics } from 'pixi.js';
import { TweenEngine, EASINGS } from './TweenEngine';
import { AnimationConfig } from './AnimationConfig';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';

export async function animateDiceResult(
  layer: Container,
  _values: number[],
  total: number,
  tweenEngine: TweenEngine,
  centerX: number,
  centerY: number,
): Promise<void> {
  const duration = AnimationConfig.scaleDuration(600);
  if (duration <= 0) return;

  // Background circle
  const bg = new Graphics();
  bg.circle(0, 0, 30);
  bg.fill({ color: hexToPixi(DESIGN_TOKENS.color.brand.primary), alpha: 0.9 });
  bg.stroke({ color: hexToPixi(DESIGN_TOKENS.color.brand.accent), width: 2 });
  bg.x = centerX;
  bg.y = centerY;
  bg.scale.set(0);
  layer.addChild(bg);

  // Total number
  const style = new TextStyle({
    fontSize: 28,
    fontWeight: 'bold',
    fill: DESIGN_TOKENS.color.brand.accent,
  });
  const text = new Text({ text: String(total), style });
  text.anchor.set(0.5);
  text.x = centerX;
  text.y = centerY;
  text.scale.set(0);
  layer.addChild(text);

  // Bounce-in animation
  await tweenEngine.to(bg.scale, { x: 1.2, y: 1.2 }, duration * 0.6, EASINGS.bounce);
  await tweenEngine.to(text.scale, { x: 1, y: 1 }, duration * 0.4, EASINGS.bounce);

  // Hold
  await new Promise<void>((r) => setTimeout(r, 800));

  // Fade out
  await tweenEngine.to(bg, { alpha: 0 }, 300, EASINGS.easeOut);
  await tweenEngine.to(text, { alpha: 0 }, 300, EASINGS.easeOut);

  layer.removeChild(bg);
  layer.removeChild(text);
  bg.destroy();
  text.destroy();
}
