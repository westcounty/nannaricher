// client/src/game/layers/BackgroundLayer.ts
// Renders the static board background: outer frame, inner area, and center info zone.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import { BOARD_SIZE, CORNER_SIZE, CENTER_AREA_SIZE } from '../layout/BoardLayout';

export class BackgroundLayer implements RenderLayer {
  private container: Container | null = null;

  init(stage: Container): void {
    this.container = new Container();
    // Position at board center (stage container is already offset)
    this.container.x = BOARD_SIZE / 2;
    this.container.y = BOARD_SIZE / 2;
    stage.addChild(this.container);

    this.drawOuterFrame();
    this.drawInnerArea();
    this.drawCenterInfo();
  }

  // Background is static — no update needed
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

  private drawOuterFrame(): void {
    const bg = new Graphics();

    // Dark board frame (design token: bg.board #16102A)
    bg.roundRect(
      -BOARD_SIZE / 2 - 20,
      -BOARD_SIZE / 2 - 20,
      BOARD_SIZE + 40,
      BOARD_SIZE + 40,
      16,
    );
    bg.fill({ color: 0x1E1610 });
    bg.stroke({ width: 2, color: 0x5B2D8E, alpha: 0.4 });

    this.container!.addChild(bg);
  }

  private drawInnerArea(): void {
    const inner = new Graphics();
    const innerSize = BOARD_SIZE - CORNER_SIZE * 2;

    // Dark inner area (design token: bg.surface #1A1230)
    inner.roundRect(-innerSize / 2, -innerSize / 2, innerSize, innerSize, 12);
    inner.fill({ color: 0x241C18 });

    this.container!.addChild(inner);
  }

  private drawCenterInfo(): void {
    // Center area background with subtle purple glow
    const centerGfx = new Graphics();
    centerGfx.roundRect(
      -CENTER_AREA_SIZE / 2,
      -CENTER_AREA_SIZE / 2,
      CENTER_AREA_SIZE,
      CENTER_AREA_SIZE,
      12,
    );
    centerGfx.fill({ color: 0x5B2D8E, alpha: 0.15 });
    centerGfx.stroke({ width: 2, color: 0x5B2D8E, alpha: 0.5 });
    this.container!.addChild(centerGfx);

    // Title — gold accent on dark background
    const titleText = new Text({
      text: '菜根人生',
      style: new TextStyle({
        fontSize: 20,
        fill: 0xE8CC6E,
        fontWeight: 'bold',
      }),
    });
    titleText.anchor.set(0.5);
    this.container!.addChild(titleText);

    // Subtitle
    const subtitleText = new Text({
      text: '南哪大富翁',
      style: new TextStyle({
        fontSize: 12,
        fill: 0xB8AA98,
      }),
    });
    subtitleText.anchor.set(0.5);
    subtitleText.y = 22;
    this.container!.addChild(subtitleText);
  }
}
