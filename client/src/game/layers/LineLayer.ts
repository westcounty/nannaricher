// client/src/game/layers/LineLayer.ts
// Renders the 8 branch lines extending from the main board toward the center.
// Each branch line shows: entry cells → inward path → exit connector back to main board.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState } from '@nannaricher/shared';
import { LINE_CONFIGS, LINE_EXIT_MAP } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';
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

  update(_state: GameState, _currentPlayerId: string | null): void {}

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
      const exitIndex = LINE_EXIT_MAP[line.id];
      const exitPos = exitIndex !== undefined ? getCellPosition(exitIndex) : null;

      // Track the last cell position for exit connector
      let lastCellX = entryPos.x;
      let lastCellY = entryPos.y;

      for (let i = 0; i < line.cellCount; i++) {
        let x = entryPos.x;
        let y = entryPos.y;

        switch (line.direction) {
          case 'up': y = entryPos.y - (i + 1) * LINE_SPACING; break;
          case 'down': y = entryPos.y + (i + 1) * LINE_SPACING; break;
          case 'left': x = entryPos.x - (i + 1) * LINE_SPACING; break;
          case 'right': x = entryPos.x + (i + 1) * LINE_SPACING; break;
        }

        // Always track furthest cell (even if hidden by center area)
        lastCellX = x;
        lastCellY = y;

        // Skip cells that overlap with the center info area
        if (Math.abs(x) < CENTER_AREA_SIZE / 2 && Math.abs(y) < CENTER_AREA_SIZE / 2) continue;

        const cellGfx = new Graphics();

        // Dark base fill
        cellGfx.roundRect(-LINE_CELL_SIZE / 2, -LINE_CELL_SIZE / 2, LINE_CELL_SIZE, LINE_CELL_SIZE, 4);
        cellGfx.fill({ color: lineColorDark, alpha: 0.7 });

        // Lighter top highlight
        cellGfx.roundRect(-LINE_CELL_SIZE / 2, -LINE_CELL_SIZE / 2, LINE_CELL_SIZE, LINE_CELL_SIZE * 0.5, 4);
        cellGfx.fill({ color: lineColor, alpha: 0.3 });

        // Border
        cellGfx.roundRect(-LINE_CELL_SIZE / 2, -LINE_CELL_SIZE / 2, LINE_CELL_SIZE, LINE_CELL_SIZE, 4);
        cellGfx.stroke({ width: 1, color: lineColor, alpha: 0.4 });

        cellGfx.x = x;
        cellGfx.y = y;
        this.container!.addChild(cellGfx);
      }

      // Draw exit connector from last branch cell back to main board exit cell
      if (exitPos) {
        this.drawExitConnector(lastCellX, lastCellY, exitPos.x, exitPos.y, lineColor, line.direction);
      }
    });
  }

  /**
   * Draw an L-shaped connector from the last branch cell to the exit cell on the main board.
   * Also draws an exit marker and arrowhead to clearly show the return path.
   */
  private drawExitConnector(
    fromX: number, fromY: number,
    toX: number, toY: number,
    color: number,
    direction: string,
  ): void {
    const gfx = new Graphics();

    // Calculate L-shaped bend point
    let bendX: number, bendY: number;
    if (direction === 'up' || direction === 'down') {
      // Branch goes vertically — bend horizontal first, then vertical
      bendX = toX;
      bendY = fromY;
    } else {
      // Branch goes horizontally — bend vertical first, then horizontal
      bendX = fromX;
      bendY = toY;
    }

    // Draw L-shaped connector line
    gfx.moveTo(fromX, fromY);
    gfx.lineTo(bendX, bendY);
    gfx.lineTo(toX, toY);
    gfx.stroke({ width: 2, color, alpha: 0.35 });

    // Draw exit marker circle at exit cell
    gfx.circle(toX, toY, LINE_CELL_SIZE / 2 + 3);
    gfx.fill({ color, alpha: 0.2 });
    gfx.stroke({ width: 2, color, alpha: 0.5 });

    // Draw arrowhead pointing from bend toward exit cell
    const dx = toX - bendX;
    const dy = toY - bendY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const nx = dx / len;
      const ny = dy / len;
      const arrowSize = 8;
      const tipX = toX - nx * (LINE_CELL_SIZE / 2 + 5);
      const tipY = toY - ny * (LINE_CELL_SIZE / 2 + 5);

      gfx.moveTo(tipX, tipY);
      gfx.lineTo(
        tipX - nx * arrowSize + ny * arrowSize * 0.5,
        tipY - ny * arrowSize - nx * arrowSize * 0.5,
      );
      gfx.lineTo(
        tipX - nx * arrowSize - ny * arrowSize * 0.5,
        tipY - ny * arrowSize + nx * arrowSize * 0.5,
      );
      gfx.closePath();
      gfx.fill({ color, alpha: 0.5 });
    }

    // "出口" label near exit marker
    const label = new Text({
      text: '出',
      style: new TextStyle({ fontSize: 8, fill: hexToPixi(DESIGN_TOKENS.color.white), fontWeight: 'bold' }),
    });
    label.anchor.set(0.5);
    label.x = toX;
    label.y = toY;
    label.alpha = 0.6;

    this.container!.addChild(gfx);
    this.container!.addChild(label);
  }
}
