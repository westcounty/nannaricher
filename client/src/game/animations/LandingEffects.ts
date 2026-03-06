// client/src/game/animations/LandingEffects.ts
// Celebratory particle effects when landing on special stations.
// Lightweight: max 12 Graphics objects, 400-600ms duration.

import { Container, Graphics } from 'pixi.js';
import { TweenEngine, EASINGS } from './TweenEngine';
import { AnimationConfig } from './AnimationConfig';

type EffectType = 'corner' | 'experience' | 'line_entry';

/**
 * Trigger a landing celebration effect at the given world coordinates.
 * - corner: colored particle burst (confetti-like)
 * - experience: gold star bloom
 * - line_entry: "door opening" horizontal expand
 */
export function playLandingEffect(
  layer: Container,
  x: number,
  y: number,
  type: EffectType,
  tweenEngine: TweenEngine,
  color = 0xE0C55E,
): void {
  const duration = AnimationConfig.scaleDuration(500);
  if (duration <= 0) return;

  switch (type) {
    case 'corner':
      spawnConfetti(layer, x, y, duration, tweenEngine, color);
      break;
    case 'experience':
      spawnStarBurst(layer, x, y, duration, tweenEngine);
      break;
    case 'line_entry':
      spawnDoorEffect(layer, x, y, duration, tweenEngine, color);
      break;
  }
}

function spawnConfetti(
  layer: Container, x: number, y: number,
  duration: number, tweenEngine: TweenEngine, baseColor: number,
): void {
  const count = 10;
  const colors = [baseColor, 0xE53935, 0x1E88E5, 0x43A047, 0xFB8C00];
  for (let i = 0; i < count; i++) {
    const particle = new Graphics();
    const size = 3 + Math.random() * 3;
    particle.rect(-size / 2, -size / 2, size, size);
    particle.fill({ color: colors[i % colors.length], alpha: 0.9 });
    particle.x = x;
    particle.y = y;
    particle.rotation = Math.random() * Math.PI * 2;
    layer.addChild(particle);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = 30 + Math.random() * 30;
    const targetX = x + Math.cos(angle) * dist;
    const targetY = y + Math.sin(angle) * dist - 20;

    Promise.all([
      tweenEngine.to(particle, { x: targetX, y: targetY, alpha: 0 }, duration, EASINGS.easeOut),
      tweenEngine.to(particle, { rotation: particle.rotation + Math.PI }, duration, EASINGS.linear),
    ]).then(() => cleanup(particle));
  }
}

function spawnStarBurst(
  layer: Container, x: number, y: number,
  duration: number, tweenEngine: TweenEngine,
): void {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const star = new Graphics();
    // Simple diamond star shape
    star.moveTo(0, -4);
    star.lineTo(2, 0);
    star.lineTo(0, 4);
    star.lineTo(-2, 0);
    star.closePath();
    star.fill({ color: 0xE0C55E, alpha: 0.9 });
    star.x = x;
    star.y = y;
    layer.addChild(star);

    const angle = (Math.PI * 2 * i) / count;
    const dist = 25 + Math.random() * 20;

    Promise.all([
      tweenEngine.to(star, {
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
      }, duration * 1.2, EASINGS.easeOut),
      tweenEngine.to(star.scale, { x: 2, y: 2 }, duration * 0.5, EASINGS.easeOut),
    ]).then(() => cleanup(star));
  }
}

function spawnDoorEffect(
  layer: Container, x: number, y: number,
  duration: number, tweenEngine: TweenEngine, color: number,
): void {
  // Two panels that slide open (enhanced)
  const panelW = 24;
  const panelH = 44;
  for (const side of [-1, 1]) {
    const panel = new Graphics();
    panel.rect(-panelW / 2, -panelH / 2, panelW, panelH);
    panel.fill({ color, alpha: 0.7 });
    panel.x = x;
    panel.y = y;
    layer.addChild(panel);

    tweenEngine.to(panel, {
      x: x + side * 30,
      alpha: 0,
    }, duration, EASINGS.easeOut).then(() => cleanup(panel));
  }

  // Theme color glow ring expanding outward
  const glow = new Graphics();
  glow.circle(0, 0, 8);
  glow.stroke({ width: 3, color, alpha: 0.6 });
  glow.x = x;
  glow.y = y;
  layer.addChild(glow);

  Promise.all([
    tweenEngine.to(glow.scale, { x: 5, y: 5 }, duration * 1.1, EASINGS.easeOut),
    tweenEngine.to(glow, { alpha: 0 }, duration * 1.1, EASINGS.easeOut),
  ]).then(() => cleanup(glow));

  // Small particles in line color
  for (let i = 0; i < 6; i++) {
    const dot = new Graphics();
    dot.circle(0, 0, 2);
    dot.fill({ color, alpha: 0.8 });
    dot.x = x;
    dot.y = y;
    layer.addChild(dot);

    const angle = (Math.PI * 2 * i) / 6;
    const dist = 15 + Math.random() * 15;
    tweenEngine.to(dot, {
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
    }, duration * 0.8, EASINGS.easeOut).then(() => cleanup(dot));
  }
}

function cleanup(obj: Graphics): void {
  if (obj.parent) obj.parent.removeChild(obj);
  obj.destroy();
}
