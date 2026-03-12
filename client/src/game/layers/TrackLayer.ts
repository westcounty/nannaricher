// client/src/game/layers/TrackLayer.ts
// Renders the metro tracks: main ring line + 8 branch bezier curves.
// Multi-layer rendering for premium "neon tube" effect.

import { Container, Graphics } from 'pixi.js';
import type { GameState } from '@nannaricher/shared';
import { LINE_CONFIGS } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import {
  METRO_BOARD_WIDTH,
  METRO_BOARD_HEIGHT,
  getRingPath,
  getLineSmoothPath,
  getLineThemeColor,
  getLineThemeColorDark,
  MAIN_TRACK_WIDTH,
  LINE_TRACK_WIDTH,
} from '../layout/MetroLayout';

export class TrackLayer implements RenderLayer {
  private container: Container | null = null;

  init(stage: Container): void {
    this.container = new Container();
    this.container.x = METRO_BOARD_WIDTH / 2;
    this.container.y = METRO_BOARD_HEIGHT / 2;
    stage.addChild(this.container);

    this.drawMainRing();
    this.drawBranchTracks();
  }

  // Static layer — no update needed
  update(_state: GameState, _currentPlayerId: string | null): void {
    // no-op
  }

  destroy(): void {
    if (this.container) {
      if (this.container.parent) {
        this.container.parent.removeChild(this.container);
      }
      this.container.destroy({ children: true });
      this.container = null;
    }
  }

  // ------ Private Drawing Methods ------

  private drawMainRing(): void {
    // Use smooth rounded-corner ring path instead of straight lines between stations
    const ringPath = getRingPath(12);

    // 4-layer neon tube effect
    const layers: { width: number; color: number; alpha: number }[] = [
      { width: MAIN_TRACK_WIDTH + 10, color: 0x4A4238, alpha: 0.15 },
      { width: MAIN_TRACK_WIDTH + 4, color: 0x2A2420, alpha: 0.9 },
      { width: MAIN_TRACK_WIDTH, color: 0x5A5248, alpha: 0.9 },
      { width: 2, color: 0xffffff, alpha: 0.15 },
    ];

    for (const layer of layers) {
      const gfx = new Graphics();
      gfx.moveTo(ringPath[0].x, ringPath[0].y);
      for (let i = 1; i < ringPath.length; i++) {
        gfx.lineTo(ringPath[i].x, ringPath[i].y);
      }
      gfx.stroke({ width: layer.width, color: layer.color, alpha: layer.alpha });
      this.container!.addChild(gfx);
    }
  }

  private drawBranchTracks(): void {
    for (const line of LINE_CONFIGS) {
      const smoothPath = getLineSmoothPath(line.id);
      if (smoothPath.length < 2) continue;

      const lineColor = getLineThemeColor(line.id);
      const lineColorDark = getLineThemeColorDark(line.id);

      // 3-layer neon tube per branch (smooth path with U-turn curves)
      const layers: { width: number; color: number; alpha: number }[] = [
        { width: LINE_TRACK_WIDTH + 6, color: lineColor, alpha: 0.08 },
        { width: LINE_TRACK_WIDTH + 2, color: lineColorDark, alpha: 0.5 },
        { width: LINE_TRACK_WIDTH, color: lineColor, alpha: 0.5 },
      ];

      for (const layer of layers) {
        const gfx = new Graphics();
        gfx.moveTo(smoothPath[0].x, smoothPath[0].y);
        for (let i = 1; i < smoothPath.length; i++) {
          const seg = smoothPath[i];
          if (seg.type === 'quadratic' && seg.cpx !== undefined && seg.cpy !== undefined) {
            gfx.quadraticCurveTo(seg.cpx, seg.cpy, seg.x, seg.y);
          } else {
            gfx.lineTo(seg.x, seg.y);
          }
        }
        gfx.stroke({ width: layer.width, color: layer.color, alpha: layer.alpha });
        this.container!.addChild(gfx);
      }
    }
  }
}
