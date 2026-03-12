// client/src/game/layers/BoardLayer.ts
// Renders the 28 main board cells (corners, events, chances, line entries).

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState, Position } from '@nannaricher/shared';
import { MAIN_BOARD_CELLS, CORNER_INDICES } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import {
  BOARD_SIZE,
  CELL_SIZE,
  CORNER_SIZE,
  getCellPosition,
  getCellColor,
  getCellColorDark,
} from '../layout/BoardLayout';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';

export interface BoardLayerOptions {
  onCellClick?: (cellId: string, position: Position) => void;
}

export class BoardLayer implements RenderLayer {
  private container: Container | null = null;
  private options: BoardLayerOptions;

  constructor(options: BoardLayerOptions = {}) {
    this.options = options;
  }

  init(stage: Container): void {
    this.container = new Container();
    this.container.x = BOARD_SIZE / 2;
    this.container.y = BOARD_SIZE / 2;
    stage.addChild(this.container);

    this.drawAllCells();
  }

  // Main board cells are static — no per-frame update needed
  update(_state: GameState, _currentPlayerId: string | null): void {
    // no-op (cells don't change)
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

  private drawAllCells(): void {
    MAIN_BOARD_CELLS.forEach((cell, index) => {
      const pos = getCellPosition(index);
      const isCorner = CORNER_INDICES.includes(index);
      const size = isCorner ? CORNER_SIZE : CELL_SIZE;
      const colorLight = getCellColor(cell, index);
      const colorDark = getCellColorDark(cell, index);
      const cornerRadius = isCorner ? 12 : 6;

      // Cell shape with gradient-simulated fill
      const cellGfx = new Graphics();

      // Dark base fill
      cellGfx.roundRect(-size / 2, -size / 2, size, size, cornerRadius);
      cellGfx.fill({ color: colorDark, alpha: 0.9 });

      // Lighter top highlight overlay
      cellGfx.roundRect(-size / 2, -size / 2, size, size * 0.6, cornerRadius);
      cellGfx.fill({ color: colorLight, alpha: 0.4 });

      // Border
      cellGfx.roundRect(-size / 2, -size / 2, size, size, cornerRadius);
      cellGfx.stroke({ width: isCorner ? 2 : 1.5, color: colorLight, alpha: 0.5 });

      // Force-entry marker (red dot)
      if (cell.forceEntry) {
        cellGfx.circle(0, size / 2 - 10, 5);
        cellGfx.fill({ color: hexToPixi(DESIGN_TOKENS.color.text.danger), alpha: 0.8 });
      }

      cellGfx.x = pos.x;
      cellGfx.y = pos.y;
      cellGfx.eventMode = 'static';
      cellGfx.cursor = 'pointer';
      cellGfx.on('pointerdown', () => {
        this.options.onCellClick?.(cell.id, { type: 'main', index });
      });

      this.container!.addChild(cellGfx);

      // Cell label — use the short display name
      const displayName = this.getShortName(cell.name);
      const nameText = new Text({
        text: displayName,
        style: new TextStyle({
          fontFamily: DESIGN_TOKENS.typography.fontFamily,
          fontSize: isCorner ? 13 : 9,
          fill: hexToPixi(DESIGN_TOKENS.color.text.primary),
          fontWeight: 'bold',
          align: 'center',
        }),
      });
      nameText.anchor.set(0.5);
      nameText.x = pos.x;
      nameText.y = pos.y - (isCorner ? 4 : 0);
      this.container!.addChild(nameText);
    });
  }

  /**
   * Shorten cell names for rendering (the shared data has longer names).
   */
  private getShortName(name: string): string {
    // Map long shared names to short display names
    const shortNames: Record<string, string> = {
      '起点/低保日': '起点',
      '机会/命运': '机会',
      '所有人交学费': '交学费',
      '浦口线入口': '浦口线',
      '学在南哪入口': '学在南哪',
      '赚在南哪入口': '赚在南哪',
      '苏州线入口': '苏州线',
      '乐在南哪入口': '乐在南哪',
      '仙林线入口': '仙林线',
      '鼓楼线入口': '鼓楼线',
      '食堂线入口': '食堂线',
      '蒋公的面子': '蒋公面子',
    };
    return shortNames[name] || name;
  }
}
