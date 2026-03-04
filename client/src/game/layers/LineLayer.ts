// client/src/game/layers/LineLayer.ts
// Renders the 8 branch lines extending from the main board toward the center.
// KEY FIX: Removed Math.min(line.cellCount, 5) cap — now renders ALL cells.

import { Container, Graphics } from 'pixi.js';
import type { GameState } from '@nannaricher/shared';
import { LINE_CONFIGS } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import {
  BOARD_SIZE,
  CENTER_AREA_SIZE,
  LINE_CELL_SIZE,
  LINE_SPACING,
  getCellPosition,
  getLineColor,
  getLineColorDark,
} from '../layout/BoardLayout';

export class LineLayer implements RenderLayer {
  private container: Container | null = null;

  init(stage: Container): void {
    this.container = new Container();
    this.container.x = BOARD_SIZE / 2;
    this.container.y = BOARD_SIZE / 2;
    stage.addChild(this.container);

    this.drawAllLines();
  }

  // Lines are static — no per-frame update needed
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

  // ------ Private Drawing ------

  private drawAllLines(): void {
    LINE_CONFIGS.forEach(line => {
      const entryPos = getCellPosition(line.entryIndex);
      const lineColor = getLineColor(line.id);
      const lineColorDark = getLineColorDark(line.id);

      // FIX: Render ALL cells in the line, not just Math.min(cellCount, 5)
      for (let i = 0; i < line.cellCount; i++) {
        let x = entryPos.x;
        let y = entryPos.y;

        switch (line.direction) {
          case 'up':
            y = entryPos.y - (i + 1) * LINE_SPACING;
            break;
          case 'down':
            y = entryPos.y + (i + 1) * LINE_SPACING;
            break;
          case 'left':
            x = entryPos.x - (i + 1) * LINE_SPACING;
            break;
          case 'right':
            x = entryPos.x + (i + 1) * LINE_SPACING;
            break;
        }

        // Skip cells that overlap with the center info area
        const absX = Math.abs(x);
        const absY = Math.abs(y);
        if (absX < CENTER_AREA_SIZE / 2 && absY < CENTER_AREA_SIZE / 2) continue;

        const cellGfx = new Graphics();

        // Dark base fill
        cellGfx.roundRect(
          -LINE_CELL_SIZE / 2,
          -LINE_CELL_SIZE / 2,
          LINE_CELL_SIZE,
          LINE_CELL_SIZE,
          4,
        );
        cellGfx.fill({ color: lineColorDark, alpha: 0.7 });

        // Lighter top highlight
        cellGfx.roundRect(
          -LINE_CELL_SIZE / 2,
          -LINE_CELL_SIZE / 2,
          LINE_CELL_SIZE,
          LINE_CELL_SIZE * 0.5,
          4,
        );
        cellGfx.fill({ color: lineColor, alpha: 0.3 });

        // Border using line theme color
        cellGfx.roundRect(
          -LINE_CELL_SIZE / 2,
          -LINE_CELL_SIZE / 2,
          LINE_CELL_SIZE,
          LINE_CELL_SIZE,
          4,
        );
        cellGfx.stroke({ width: 1, color: lineColor, alpha: 0.4 });

        cellGfx.x = x;
        cellGfx.y = y;

        this.container!.addChild(cellGfx);
      }
    });
  }
}
