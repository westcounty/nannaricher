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
  getMainStationPosition,
  getLineTrackPath,
  getLineThemeColor,
  getLineThemeColorDark,
  MAIN_TRACK_WIDTH,
  LINE_TRACK_WIDTH,
} from '../layout/MetroLayout';

const MAIN_STATION_COUNT = 28;

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
    // Pre-compute all 28 station positions
    const stations = [];
    for (let i = 0; i < MAIN_STATION_COUNT; i++) {
      stations.push(getMainStationPosition(i));
    }

    // 4-layer neon tube effect
    const layers: { width: number; color: number; alpha: number }[] = [
      { width: MAIN_TRACK_WIDTH + 10, color: 0x4A4A5A, alpha: 0.15 },
      { width: MAIN_TRACK_WIDTH + 4, color: 0x2A2A3A, alpha: 0.9 },
      { width: MAIN_TRACK_WIDTH, color: 0x5A5A6A, alpha: 0.9 },
      { width: 2, color: 0xffffff, alpha: 0.12 },
    ];

    for (const layer of layers) {
      const gfx = new Graphics();
      gfx.moveTo(stations[0].x, stations[0].y);
      for (let i = 1; i < MAIN_STATION_COUNT; i++) {
        gfx.lineTo(stations[i].x, stations[i].y);
      }
      // Close back to station[0]
      gfx.lineTo(stations[0].x, stations[0].y);
      gfx.stroke({ width: layer.width, color: layer.color, alpha: layer.alpha });
      this.container!.addChild(gfx);
    }
  }

  private drawBranchTracks(): void {
    for (const line of LINE_CONFIGS) {
      const path = getLineTrackPath(line.id);
      if (path.length < 2) continue;

      const lineColor = getLineThemeColor(line.id);
      const lineColorDark = getLineThemeColorDark(line.id);

      // 3-layer neon tube per branch (polyline through snake path)
      const layers: { width: number; color: number; alpha: number }[] = [
        { width: LINE_TRACK_WIDTH + 6, color: lineColor, alpha: 0.12 },
        { width: LINE_TRACK_WIDTH + 2, color: lineColorDark, alpha: 0.8 },
        { width: LINE_TRACK_WIDTH, color: lineColor, alpha: 0.9 },
      ];

      for (const layer of layers) {
        const gfx = new Graphics();
        gfx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          gfx.lineTo(path[i].x, path[i].y);
        }
        gfx.stroke({ width: layer.width, color: layer.color, alpha: layer.alpha });
        this.container!.addChild(gfx);
      }
    }
  }
}
