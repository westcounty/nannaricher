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

    // Outer white frame
    bg.roundRect(
      -BOARD_SIZE / 2 - 20,
      -BOARD_SIZE / 2 - 20,
      BOARD_SIZE + 40,
      BOARD_SIZE + 40,
      16,
    );
    bg.fill({ color: 0xffffff });
    bg.stroke({ width: 2, color: 0xe0e0e0 });

    this.container!.addChild(bg);
  }

  private drawInnerArea(): void {
    const inner = new Graphics();
    const innerSize = BOARD_SIZE - CORNER_SIZE * 2;

    inner.roundRect(-innerSize / 2, -innerSize / 2, innerSize, innerSize, 12);
    inner.fill({ color: 0xfafafa });

    this.container!.addChild(inner);
  }

  private drawCenterInfo(): void {
    // Center area background
    const centerGfx = new Graphics();
    centerGfx.roundRect(
      -CENTER_AREA_SIZE / 2,
      -CENTER_AREA_SIZE / 2,
      CENTER_AREA_SIZE,
      CENTER_AREA_SIZE,
      12,
    );
    centerGfx.fill({ color: 0x5E3A8D, alpha: 0.1 });
    centerGfx.stroke({ width: 2, color: 0x5E3A8D, alpha: 0.3 });
    this.container!.addChild(centerGfx);

    // Title
    const titleText = new Text({
      text: '菜根人生',
      style: new TextStyle({
        fontSize: 18,
        fill: 0x5E3A8D,
        fontWeight: 'bold',
      }),
    });
    titleText.anchor.set(0.5);
    this.container!.addChild(titleText);

    // Subtitle
    const subtitleText = new Text({
      text: '搞得人心黄黄',
      style: new TextStyle({
        fontSize: 12,
        fill: 0x666666,
      }),
    });
    subtitleText.anchor.set(0.5);
    subtitleText.y = 20;
    this.container!.addChild(subtitleText);
  }
}
