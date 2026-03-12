// client/src/game/layers/MetroBackgroundLayer.ts
// Premium multi-layer background for the metro-style board:
// deep space gradient, subtle grid, decorative border, and center info panel.

import { Container, Graphics, Text, TextStyle, Sprite, Assets, Texture } from 'pixi.js';
import type { GameState } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import { METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT } from '../layout/MetroLayout';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';

export class MetroBackgroundLayer implements RenderLayer {
  private container: Container | null = null;
  private roundText: Text | null = null;
  private currentPlayerText: Text | null = null;
  private lastRound = '';
  private lastCurrentPlayerText = '';
  private phaseText: Text | null = null;
  private lastPhase = '';
  private turnOverlay: Graphics | null = null;
  private lastIsMyTurn: boolean | null = null;

  init(stage: Container): void {
    this.container = new Container();
    this.container.x = METRO_BOARD_WIDTH / 2;
    this.container.y = METRO_BOARD_HEIGHT / 2;
    stage.addChild(this.container);

    this.drawDeepSpaceGradient();
    this.drawSubtleGrid();
    this.drawDecorativeBorder();
    this.drawTurnOverlay();
    this.drawCenterPanel();
  }

  update(state: GameState, currentPlayerId: string | null): void {
    // Update turn overlay tint
    const currentPlayer = state.players[state.currentPlayerIndex];
    const isMyTurn = currentPlayer?.id === currentPlayerId;
    if (this.turnOverlay && isMyTurn !== this.lastIsMyTurn) {
      this.lastIsMyTurn = isMyTurn;
      const hw = METRO_BOARD_WIDTH / 2;
      const hh = METRO_BOARD_HEIGHT / 2;
      this.turnOverlay.clear();
      this.turnOverlay.roundRect(-hw, -hh, METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT, 0);
      if (isMyTurn) {
        // Your turn: warm gold tint
        this.turnOverlay.fill({ color: hexToPixi(DESIGN_TOKENS.color.brand.accent), alpha: 0.05 });
      } else {
        // Waiting: cool blue-gray
        this.turnOverlay.fill({ color: hexToPixi(DESIGN_TOKENS.color.white), alpha: 0.15 });
      }
    }
    if (this.roundText) {
      const totalRounds = (state as GameState & { totalRounds?: number }).totalRounds || 20;
      const roundStr = `第 ${state.roundNumber}/${totalRounds} 回合`;
      if (roundStr !== this.lastRound) {
        this.roundText.text = roundStr;
        this.lastRound = roundStr;
      }
    }
    if (this.currentPlayerText && state.players.length > 0) {
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer) {
        const playerText = `🎲 ${currentPlayer.name}`;
        if (playerText !== this.lastCurrentPlayerText) {
          this.currentPlayerText.text = playerText;
          this.lastCurrentPlayerText = playerText;
        }
      }
    }
    // Update phase text
    if (this.phaseText) {
      const phaseLabels: Record<string, string> = {
        waiting: '等待开始',
        playing: '进行中',
        finished: '游戏结束',
      };
      const phaseStr = phaseLabels[state.phase] || state.phase;
      if (phaseStr !== this.lastPhase) {
        this.phaseText.text = phaseStr;
        this.lastPhase = phaseStr;
      }
    }
  }

  destroy(): void {
    this.roundText = null;
    this.currentPlayerText = null;
    this.phaseText = null;
    this.turnOverlay = null;
    if (this.container) {
      if (this.container.parent) {
        this.container.parent.removeChild(this.container);
      }
      this.container.destroy({ children: true });
      this.container = null;
    }
  }

  // ------ Private Drawing Methods ------

  private drawDeepSpaceGradient(): void {
    const hw = METRO_BOARD_WIDTH / 2;
    const hh = METRO_BOARD_HEIGHT / 2;

    // Outermost cream rect
    const outerBg = new Graphics();
    outerBg.roundRect(-hw, -hh, METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT, 0);
    outerBg.fill({ color: hexToPixi(DESIGN_TOKENS.color.bg.main) });
    this.container!.addChild(outerBg);

    // Concentric rounded rects blending from outer (bg.main) to inner (bg.board)
    // Intentional: RGB components extracted for per-step interpolation
    const steps = 6;
    const outerColor = { r: 0xF5, g: 0xED, b: 0xE0 }; // DESIGN_TOKENS.color.bg.main
    const innerColor = { r: 0xED, g: 0xE4, b: 0xD4 }; // DESIGN_TOKENS.color.bg.board

    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const inset = t * 80; // max 80px inset for the innermost layer
      const r = Math.round(outerColor.r + (innerColor.r - outerColor.r) * t);
      const g = Math.round(outerColor.g + (innerColor.g - outerColor.g) * t);
      const b = Math.round(outerColor.b + (innerColor.b - outerColor.b) * t);
      const color = (r << 16) | (g << 8) | b;
      const cornerRadius = 8 + t * 12;

      const gfx = new Graphics();
      gfx.roundRect(
        -hw + inset,
        -hh + inset,
        METRO_BOARD_WIDTH - inset * 2,
        METRO_BOARD_HEIGHT - inset * 2,
        cornerRadius,
      );
      gfx.fill({ color, alpha: 0.3 });
      this.container!.addChild(gfx);
    }
  }

  private drawSubtleGrid(): void {
    const hw = METRO_BOARD_WIDTH / 2;
    const hh = METRO_BOARD_HEIGHT / 2;
    const spacing = 60;
    const lineColor = hexToPixi(DESIGN_TOKENS.color.brand.primary);

    const gridGfx = new Graphics();

    // Vertical lines
    for (let x = -hw; x <= hw; x += spacing) {
      gridGfx.moveTo(x, -hh);
      gridGfx.lineTo(x, hh);
    }
    // Horizontal lines
    for (let y = -hh; y <= hh; y += spacing) {
      gridGfx.moveTo(-hw, y);
      gridGfx.lineTo(hw, y);
    }
    gridGfx.stroke({ width: 0.5, color: lineColor, alpha: 0.08 });

    // Intersection glow dots
    const dotsGfx = new Graphics();
    for (let x = -hw; x <= hw; x += spacing) {
      for (let y = -hh; y <= hh; y += spacing) {
        dotsGfx.circle(x, y, 1.5);
      }
    }
    dotsGfx.fill({ color: lineColor, alpha: 0.15 });

    this.container!.addChild(gridGfx);
    this.container!.addChild(dotsGfx);
  }

  private drawDecorativeBorder(): void {
    const hw = METRO_BOARD_WIDTH / 2;
    const hh = METRO_BOARD_HEIGHT / 2;
    const margin = 20;

    // Outer border: gold stroke
    const outerBorder = new Graphics();
    outerBorder.roundRect(
      -hw + margin,
      -hh + margin,
      METRO_BOARD_WIDTH - margin * 2,
      METRO_BOARD_HEIGHT - margin * 2,
      12,
    );
    outerBorder.stroke({ width: 2, color: hexToPixi(DESIGN_TOKENS.color.brand.accent), alpha: 0.25 });
    this.container!.addChild(outerBorder);

    // Inner accent border: purple stroke, 10px inset from outer
    const innerInset = margin + 10;
    const innerBorder = new Graphics();
    innerBorder.roundRect(
      -hw + innerInset,
      -hh + innerInset,
      METRO_BOARD_WIDTH - innerInset * 2,
      METRO_BOARD_HEIGHT - innerInset * 2,
      10,
    );
    innerBorder.stroke({ width: 1, color: hexToPixi(DESIGN_TOKENS.color.brand.primary), alpha: 0.3 });
    this.container!.addChild(innerBorder);

    // Corner decorations: diamond shapes at the 4 corners
    const corners = [
      { x: -hw + margin, y: -hh + margin },  // top-left
      { x: hw - margin, y: -hh + margin },   // top-right
      { x: -hw + margin, y: hh - margin },   // bottom-left
      { x: hw - margin, y: hh - margin },    // bottom-right
    ];
    const diamondSize = 8;

    for (const corner of corners) {
      const diamond = new Graphics();
      diamond.moveTo(corner.x, corner.y - diamondSize);
      diamond.lineTo(corner.x + diamondSize, corner.y);
      diamond.lineTo(corner.x, corner.y + diamondSize);
      diamond.lineTo(corner.x - diamondSize, corner.y);
      diamond.closePath();
      diamond.fill({ color: hexToPixi(DESIGN_TOKENS.color.brand.accent), alpha: 0.3 });
      this.container!.addChild(diamond);
    }
  }

  private drawTurnOverlay(): void {
    const hw = METRO_BOARD_WIDTH / 2;
    const hh = METRO_BOARD_HEIGHT / 2;
    this.turnOverlay = new Graphics();
    this.turnOverlay.roundRect(-hw, -hh, METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT, 0);
    this.turnOverlay.fill({ color: hexToPixi(DESIGN_TOKENS.color.white), alpha: 0.15 }); // default: waiting
    this.container!.addChild(this.turnOverlay);
  }

  private drawCenterPanel(): void {
    const panelW = 360;
    const panelH = 260;
    const fontFamily = DESIGN_TOKENS.typography.fontFamily;

    // Panel background
    const panel = new Graphics();
    panel.roundRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
    panel.fill({ color: hexToPixi(DESIGN_TOKENS.color.white), alpha: 0.7 });
    panel.stroke({ width: 1.5, color: hexToPixi(DESIGN_TOKENS.color.brand.accent), alpha: 0.4 });
    this.container!.addChild(panel);

    // Title
    const title = new Text({
      text: '菜根人生',
      style: new TextStyle({
        fontSize: 36,
        fill: hexToPixi(DESIGN_TOKENS.color.brand.accentLight),
        fontWeight: 'bold',
        fontFamily,
      }),
    });
    title.anchor.set(0.5);
    title.y = -panelH / 2 + 40;
    this.container!.addChild(title);

    // Subtitle
    const subtitle = new Text({
      text: '南哪大富翁',
      style: new TextStyle({
        fontSize: 16,
        fill: hexToPixi(DESIGN_TOKENS.color.text.secondary),
        fontFamily,
      }),
    });
    subtitle.anchor.set(0.5);
    subtitle.y = -panelH / 2 + 72;
    this.container!.addChild(subtitle);

    // Divider line
    const divider = new Graphics();
    divider.moveTo(-panelW / 2 + 30, -panelH / 2 + 95);
    divider.lineTo(panelW / 2 - 30, -panelH / 2 + 95);
    divider.stroke({ width: 1, color: hexToPixi(DESIGN_TOKENS.color.brand.accent), alpha: 0.3 });
    this.container!.addChild(divider);

    // Dynamic round text
    this.roundText = new Text({
      text: '第 1/20 回合',
      style: new TextStyle({
        fontSize: 16,
        fill: hexToPixi(DESIGN_TOKENS.color.text.secondary),
        fontFamily,
      }),
    });
    this.roundText.anchor.set(0.5);
    this.roundText.y = -panelH / 2 + 120;
    this.container!.addChild(this.roundText);

    // Dynamic current player text
    this.currentPlayerText = new Text({
      text: '🎲 —',
      style: new TextStyle({
        fontSize: 16,
        fill: hexToPixi(DESIGN_TOKENS.color.text.secondary),
        fontFamily,
      }),
    });
    this.currentPlayerText.anchor.set(0.5);
    this.currentPlayerText.y = -panelH / 2 + 150;
    this.container!.addChild(this.currentPlayerText);

    // Dynamic phase text
    this.phaseText = new Text({
      text: '',
      style: new TextStyle({
        fontSize: 14,
        fill: hexToPixi(DESIGN_TOKENS.color.text.muted),
        fontFamily,
      }),
    });
    this.phaseText.anchor.set(0.5);
    this.phaseText.y = -panelH / 2 + 180;
    this.container!.addChild(this.phaseText);

    // Load emblem watermark
    Assets.load<Texture>('/art/nanna-emblem/best.webp').then((texture) => {
      if (texture && this.container) {
        const emblem = new Sprite(texture);
        emblem.anchor.set(0.5);
        emblem.width = 280;
        emblem.height = 280;
        emblem.x = 0; // center of board
        emblem.y = 0;
        emblem.alpha = 0.06;
        // Add below the text, as a background element
        this.container.addChildAt(emblem, 0);
      }
    }).catch(() => {});
  }
}
