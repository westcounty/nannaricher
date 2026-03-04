// client/src/game/layers/StationLayer.ts
// Renders all station cards (main ring + branch line stations) with frosted-glass card effect.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState, Position } from '@nannaricher/shared';
import { MAIN_BOARD_CELLS, CORNER_INDICES, LINE_CONFIGS, LINE_EXIT_MAP } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import { boardData } from '../../data/board';
import {
  METRO_BOARD_WIDTH,
  METRO_BOARD_HEIGHT,
  getMainStationPosition,
  getLineStationPosition,
  getStationColor,
  getStationColorDark,
  getLineThemeColor,
  getLineThemeColorDark,
  getLineTrackPath,
  MAIN_STATION_SIZE,
  MAIN_STATION_HEIGHT,
  CORNER_STATION_SIZE,
  CORNER_STATION_HEIGHT,
  LINE_STATION_SIZE,
  LINE_STATION_HEIGHT,
  EXP_STATION_SIZE,
  EXP_STATION_HEIGHT,
} from '../layout/MetroLayout';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';
import type { TweenEngine } from '../animations/TweenEngine';
import { AnimationConfig } from '../animations/AnimationConfig';

// ============================================
// Options
// ============================================

export interface CellHoverInfo {
  cellId: string;
  position: Position;
  screenX: number;
  screenY: number;
}

export interface StationLayerOptions {
  onCellClick?: (cellId: string, position: Position) => void;
  onCellHover?: (info: CellHoverInfo | null) => void;
}

// ============================================
// Emoji & Name Maps
// ============================================

const SHORT_NAME_MAP: Record<string, string> = {
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

const EMOJI_BY_ID: Record<string, string> = {
  start: '\u{1F3E0}',       // 🏠
  hospital: '\u{1F3E5}',    // 🏥
  ding: '\u{1F3DB}\uFE0F',  // 🏛️
  waiting_room: '\u{1F689}', // 🚉
  tuition: '\u{1F4DA}',     // 📚
  zijing: '\u{1F33A}',      // 🌺
  qingong: '\u{1F4BC}',     // 💼
  retake: '\u{1F4DD}',      // 📝
  jiang_gong: '\u{1F3AD}',  // 🎭
  society: '\u{1F3EA}',     // 🎪  (closest to circus tent)
  kechuang: '\u{1F52C}',    // 🔬
  nanna_cp: '\u{1F6CD}\uFE0F', // 🛍️
  chuangmen: '\u{1F6AA}',   // 🚪
};

const EMOJI_BY_TYPE: Record<string, string> = {
  chance: '\u{1F3B2}',      // 🎲
  line_entry: '\u{1F687}',  // 🚇
};

const DEFAULT_EMOJI = '\u{1F4CD}'; // 📍

/**
 * Smooth scale animation for card hover.
 * Uses TweenEngine when available, falls back to RAF.
 * Respects prefers-reduced-motion via AnimationConfig.
 */
const scaleAnimMap = new WeakMap<Container, number>();
function animateScale(card: Container, target: number, tweenEngine?: TweenEngine | null, duration = 150): void {
  const scaledDuration = AnimationConfig.scaleDuration(duration);
  if (scaledDuration <= 0) {
    card.scale.set(target);
    return;
  }

  if (tweenEngine) {
    // Use TweenEngine — cancel any previous tween on this card's scale
    tweenEngine.cancelTarget(card.scale as unknown as Record<string, unknown>);
    tweenEngine.to(
      card.scale as unknown as Record<string, number>,
      { x: target, y: target },
      scaledDuration,
    );
    return;
  }

  // Fallback: RAF-based animation
  const start = card.scale.x;
  const diff = target - start;
  if (Math.abs(diff) < 0.001) return;
  const prevId = scaleAnimMap.get(card);
  if (prevId) cancelAnimationFrame(prevId);
  const startTime = performance.now();
  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / scaledDuration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    card.scale.set(start + diff * eased);
    if (progress < 1) {
      scaleAnimMap.set(card, requestAnimationFrame(step));
    } else {
      scaleAnimMap.delete(card);
    }
  };
  scaleAnimMap.set(card, requestAnimationFrame(step));
}

// ============================================
// StationLayer
// ============================================

export class StationLayer implements RenderLayer {
  private container: Container | null = null;
  private options: StationLayerOptions;
  // Card references keyed by position string (e.g., "main:0", "line:pukou:3")
  private stationCards: Map<string, Container> = new Map();
  // Badge references for player count
  private badges: Map<string, Container> = new Map();
  // Highlight overlays for destination cells
  private highlights: Map<string, Graphics> = new Map();
  // TweenEngine for hover animations (injected after init)
  private tweenEngine: TweenEngine | null = null;

  constructor(options: StationLayerOptions = {}) {
    this.options = options;
  }

  /** Inject TweenEngine for unified hover animations. */
  setTweenEngine(engine: TweenEngine): void {
    this.tweenEngine = engine;
  }

  init(stage: Container): void {
    this.container = new Container();
    this.container.x = METRO_BOARD_WIDTH / 2;
    this.container.y = METRO_BOARD_HEIGHT / 2;
    stage.addChild(this.container);

    this.drawMainRingStations();
    this.drawBranchLineStations();
  }

  update(state: GameState, _currentPlayerId: string | null): void {
    // Count players per cell
    const cellCounts = new Map<string, number>();
    for (const player of state.players) {
      const key = player.position.type === 'main'
        ? `main:${player.position.index}`
        : `line:${player.position.lineId}:${player.position.index}`;
      cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
    }

    // Remove badges for cells that no longer have players
    for (const [key, badge] of this.badges) {
      if (!cellCounts.has(key) || cellCounts.get(key)! <= 0) {
        if (badge.parent) badge.parent.removeChild(badge);
        badge.destroy({ children: true });
        this.badges.delete(key);
      }
    }

    // Add or update badges for cells with players
    for (const [key, count] of cellCounts) {
      if (count <= 0) continue;
      const card = this.stationCards.get(key);
      if (!card) continue;

      const existing = this.badges.get(key);
      if (existing) {
        // Update text if count changed
        const textChild = existing.getChildAt(1) as Text;
        if (textChild && textChild.text !== `${count}`) {
          textChild.text = `${count}`;
        }
      } else {
        // Create new badge - use known card dimensions to avoid expensive getLocalBounds()
        const badge = new Container();
        const isMain = key.startsWith('main:');
        const isCorner = isMain && CORNER_INDICES.includes(parseInt(key.split(':')[1]));
        const badgeCardW = isCorner ? CORNER_STATION_SIZE : isMain ? MAIN_STATION_SIZE : LINE_STATION_SIZE;
        const badgeCardH = isCorner ? CORNER_STATION_HEIGHT : isMain ? MAIN_STATION_HEIGHT : LINE_STATION_HEIGHT;
        badge.x = badgeCardW / 2 - 6;
        badge.y = -badgeCardH / 2 - 2;

        const bg = new Graphics();
        bg.circle(0, 0, 8);
        bg.fill({ color: 0xE53935 });
        badge.addChild(bg);

        const text = new Text({
          text: `${count}`,
          style: new TextStyle({
            fontSize: 9,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
          }),
        });
        text.anchor.set(0.5);
        badge.addChild(text);

        card.addChild(badge);
        this.badges.set(key, badge);
      }
    }
  }

  destroy(): void {
    this.stationCards.clear();
    this.badges.clear();
    if (this.container) {
      if (this.container.parent) {
        this.container.parent.removeChild(this.container);
      }
      this.container.destroy({ children: true });
      this.container = null;
    }
  }

  // ============================================
  // Main Ring Stations (28 cards)
  // ============================================

  private drawMainRingStations(): void {
    MAIN_BOARD_CELLS.forEach((cell, index) => {
      const pos = getMainStationPosition(index);
      const isCorner = CORNER_INDICES.includes(index);
      const colorLight = getStationColor(index);
      const colorDark = getStationColorDark(index);

      const cardW = isCorner ? CORNER_STATION_SIZE : MAIN_STATION_SIZE;
      const cardH = isCorner ? CORNER_STATION_HEIGHT : MAIN_STATION_HEIGHT;
      const cornerRadius = isCorner ? 12 : 8;
      const borderWidth = isCorner ? 2.5 : 1.5;
      const iconRadius = isCorner ? 18 : 12;

      // Card container
      const card = new Container();
      card.x = pos.x;
      card.y = pos.y;

      // --- Card background graphics ---
      const bg = new Graphics();

      // 1. Dark type-color tint
      bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
      bg.fill({ color: colorDark, alpha: 0.25 });

      // 2. Glass overlay
      bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
      bg.fill({ color: 0x1A1230, alpha: 0.6 });

      // 3. Border (stronger for event stations)
      const borderAlpha = cell.type === 'event' ? 0.8 : 0.6;
      bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
      bg.stroke({ width: borderWidth, color: colorLight, alpha: borderAlpha });

      // 4. Icon background circle
      const iconY = isCorner ? -cardH / 2 + 30 : -cardH / 2 + 24;
      bg.circle(0, iconY, iconRadius);
      bg.fill({ color: colorDark, alpha: 0.4 });

      // 5. Force-entry red dot
      if (cell.forceEntry) {
        bg.circle(cardW / 2 - 8, -cardH / 2 + 8, 5);
        bg.fill({ color: hexToPixi(DESIGN_TOKENS.color.text.danger), alpha: 0.85 });
      }

      // 6. Type-specific visual enhancements
      if (isCorner) {
        // Corner glow: radial halo effect
        const glowRadius = Math.max(cardW, cardH) * 0.8;
        bg.circle(0, 0, glowRadius);
        bg.fill({ color: colorLight, alpha: 0.08 });
      } else if (cell.type === 'line_entry') {
        // Line entry: left color bar indicator
        bg.roundRect(-cardW / 2, -cardH / 2 + 4, 4, cardH - 8, 2);
        bg.fill({ color: colorLight, alpha: 0.8 });
      } else if (cell.type === 'event') {
        // Event station: stronger border + larger emoji
        bg.roundRect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, cardH - 2, cornerRadius - 1);
        bg.stroke({ width: 1, color: colorLight, alpha: 0.3 });
      } else if (cell.type === 'chance') {
        // Chance station: dashed border effect (simulated with short segments)
        const dashLen = 6;
        const gapLen = 4;
        const hw = cardW / 2 - 2;
        const hh = cardH / 2 - 2;
        // Top edge
        for (let dx = -hw; dx < hw; dx += dashLen + gapLen) {
          bg.moveTo(dx, -hh);
          bg.lineTo(Math.min(dx + dashLen, hw), -hh);
        }
        // Bottom edge
        for (let dx = -hw; dx < hw; dx += dashLen + gapLen) {
          bg.moveTo(dx, hh);
          bg.lineTo(Math.min(dx + dashLen, hw), hh);
        }
        // Left edge
        for (let dy = -hh; dy < hh; dy += dashLen + gapLen) {
          bg.moveTo(-hw, dy);
          bg.lineTo(-hw, Math.min(dy + dashLen, hh));
        }
        // Right edge
        for (let dy = -hh; dy < hh; dy += dashLen + gapLen) {
          bg.moveTo(hw, dy);
          bg.lineTo(hw, Math.min(dy + dashLen, hh));
        }
        bg.stroke({ width: 1.5, color: colorLight, alpha: 0.5 });
      }

      card.addChild(bg);

      // --- Emoji icon ---
      const emoji = this.getCellEmoji(cell.id, cell.type);
      const isEvent = cell.type === 'event';
      const emojiText = new Text({
        text: emoji,
        style: new TextStyle({
          fontSize: isCorner ? 20 : isEvent ? 16 : 14,
          align: 'center',
        }),
      });
      emojiText.anchor.set(0.5);
      emojiText.x = 0;
      emojiText.y = iconY;
      card.addChild(emojiText);

      // --- Station name ---
      const displayName = this.getShortName(cell.name);
      const nameColor = isCorner ? 0xE0C55E : 0xFFFFFF;
      const nameText = new Text({
        text: displayName,
        style: new TextStyle({
          fontFamily: DESIGN_TOKENS.typography.fontFamily,
          fontSize: isCorner ? 13 : 9,
          fill: nameColor,
          fontWeight: 'bold',
          align: 'center',
        }),
      });
      nameText.anchor.set(0.5);
      nameText.y = isCorner ? iconY + 30 : iconY + 22;
      card.addChild(nameText);

      // --- Effect summary (corners only) ---
      if (isCorner) {
        const desc = this.getShortDesc(cell.description);
        const descText = new Text({
          text: desc,
          style: new TextStyle({
            fontFamily: DESIGN_TOKENS.typography.fontFamily,
            fontSize: 9,
            fill: hexToPixi(DESIGN_TOKENS.color.text.secondary),
            align: 'center',
            wordWrap: true,
            wordWrapWidth: cardW - 16,
          }),
        });
        descText.anchor.set(0.5);
        descText.y = cardH / 2 - 18;
        card.addChild(descText);
      }

      // --- Transfer marker (换乘标记) ---
      const transferLines = this.getTransferLines(index);
      if (transferLines.length > 0) {
        const transferBg = new Graphics();
        transferBg.roundRect(-cardW / 2 + 2, cardH / 2 - 14, cardW - 4, 12, 3);
        transferBg.fill({ color: 0x000000, alpha: 0.4 });
        card.addChild(transferBg);

        const transferLabel = new Text({
          text: transferLines.map(t => t.symbol).join(' '),
          style: new TextStyle({
            fontFamily: DESIGN_TOKENS.typography.fontFamily,
            fontSize: 9,
            fill: 0xFFFFFF,
            fontWeight: 'bold',
            align: 'center',
          }),
        });
        transferLabel.anchor.set(0.5);
        transferLabel.y = cardH / 2 - 8;
        card.addChild(transferLabel);
      }

      // --- Interaction ---
      card.eventMode = 'static';
      card.cursor = 'pointer';
      card.alpha = 0.95;
      card.cullable = true; // enable off-screen culling for performance

      card.on('pointerdown', () => {
        this.options.onCellClick?.(cell.id, { type: 'main', index });
      });
      card.on('pointerover', (e: import('pixi.js').FederatedPointerEvent) => {
        animateScale(card, 1.08, this.tweenEngine);
        if (this.options.onCellHover) {
          this.options.onCellHover({
            cellId: cell.id,
            position: { type: 'main', index },
            screenX: e.globalX,
            screenY: e.globalY,
          });
        }
      });
      card.on('pointerout', () => {
        animateScale(card, 1.0, this.tweenEngine);
        card.alpha = 0.95;
        this.options.onCellHover?.(null);
      });

      this.container!.addChild(card);
      this.stationCards.set(`main:${index}`, card);
    });
  }

  // ============================================
  // Branch Line Stations
  // ============================================

  private drawBranchLineStations(): void {
    LINE_CONFIGS.forEach((line) => {
      const colorLight = getLineThemeColor(line.id);
      const colorDark = getLineThemeColorDark(line.id);

      for (let i = 0; i < line.cellCount; i++) {
        const pos = getLineStationPosition(line.id, i);
        const isExperience = i === line.cellCount - 1;

        const cardW = isExperience ? EXP_STATION_SIZE : LINE_STATION_SIZE;
        const cardH = isExperience ? EXP_STATION_HEIGHT : LINE_STATION_HEIGHT;
        const cornerRadius = 6;

        const card = new Container();
        card.x = pos.x;
        card.y = pos.y;

        // --- Card background (frosted glass style) ---
        const bg = new Graphics();

        // Dark tint
        bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
        bg.fill({ color: colorDark, alpha: 0.25 });

        // Glass overlay
        bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
        bg.fill({ color: 0x1A1230, alpha: 0.6 });

        // Border (gold for experience, line color for regular)
        bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
        bg.stroke({ width: isExperience ? 2 : 1.5, color: isExperience ? 0xE0C55E : colorLight, alpha: isExperience ? 0.7 : 0.5 });

        // Experience card gold star marker
        if (isExperience) {
          bg.circle(0, -cardH / 2 + 14, 9);
          bg.fill({ color: 0xE0C55E, alpha: 0.5 });
        }

        // Line color indicator bar (left edge)
        const barColor = isExperience ? 0xE0C55E : colorLight;
        bg.roundRect(-cardW / 2, -cardH / 2 + 4, 4, cardH - 8, 2);
        bg.fill({ color: barColor, alpha: 0.8 });

        card.addChild(bg);

        // --- Resolve station name from boardData ---
        const lineData = boardData.lines[line.id];
        const stationName = isExperience
          ? lineData?.experienceCard?.name ?? '体验卡'
          : lineData?.cells?.[i]?.name ?? `${i + 1}`;

        // --- Icon / index label ---
        const labelText = isExperience ? '\u2B50' : `${i + 1}`;
        const label = new Text({
          text: labelText,
          style: new TextStyle({
            fontFamily: DESIGN_TOKENS.typography.fontFamily,
            fontSize: isExperience ? 14 : 12,
            fill: isExperience ? 0xE0C55E : 0xFFFFFF,
            fontWeight: 'bold',
            align: 'center',
          }),
        });
        label.anchor.set(0.5);
        label.y = isExperience ? -cardH / 2 + 14 : -cardH / 2 + 14;
        card.addChild(label);

        // --- Station name text ---
        const nameText = new Text({
          text: this.getShortName(stationName),
          style: new TextStyle({
            fontFamily: DESIGN_TOKENS.typography.fontFamily,
            fontSize: isExperience ? 12 : 10,
            fill: isExperience ? 0xE0C55E : 0xFFFFFF,
            fontWeight: 'bold',
            align: 'center',
            wordWrap: true,
            wordWrapWidth: cardW - 8,
          }),
        });
        nameText.anchor.set(0.5);
        nameText.y = isExperience ? 10 : 6;
        card.addChild(nameText);

        // --- Interaction ---
        card.eventMode = 'static';
        card.cursor = 'pointer';
        card.alpha = 0.95;
        card.cullable = true; // enable off-screen culling for performance

        card.on('pointerdown', () => {
          this.options.onCellClick?.(`${line.id}_${i}`, { type: 'line', lineId: line.id, index: i });
        });
        card.on('pointerover', (e: import('pixi.js').FederatedPointerEvent) => {
          animateScale(card, 1.08, this.tweenEngine);
          if (this.options.onCellHover) {
            this.options.onCellHover({
              cellId: `${line.id}_${i}`,
              position: { type: 'line', lineId: line.id, index: i },
              screenX: e.globalX,
              screenY: e.globalY,
            });
          }
        });
        card.on('pointerout', () => {
          animateScale(card, 1.0, this.tweenEngine);
          card.alpha = 0.95;
          this.options.onCellHover?.(null);
        });

        this.container!.addChild(card);
        this.stationCards.set(`line:${line.id}:${i}`, card);
      }

      // --- Line name label near arc midpoint ---
      this.drawLineNameLabel(line.id, line.name, colorLight);
    });
  }

  private drawLineNameLabel(lineId: string, name: string, color: number): void {
    const path = getLineTrackPath(lineId);
    if (path.length < 2) return;

    // Get midpoint of the track path
    const midIdx = Math.floor(path.length / 2);
    const mid = path[midIdx];

    const label = new Text({
      text: name,
      style: new TextStyle({
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
        fontSize: 11,
        fill: color,
        fontWeight: 'bold',
        align: 'center',
      }),
    });
    label.anchor.set(0.5);
    label.x = mid.x;
    label.y = mid.y;
    label.alpha = 0.7;
    this.container!.addChild(label);
  }

  // ============================================
  // Highlight API (for destination preview)
  // ============================================

  /** Highlight specific station cards with a gold pulse border. */
  highlightCells(keys: string[]): void {
    this.clearHighlights();
    for (const key of keys) {
      const card = this.stationCards.get(key);
      if (!card) continue;

      // Determine card size from key
      const isMain = key.startsWith('main:');
      const mainIndex = isMain ? parseInt(key.split(':')[1]) : -1;
      const isCorner = isMain && CORNER_INDICES.includes(mainIndex);
      const cardW = isCorner ? CORNER_STATION_SIZE : isMain ? MAIN_STATION_SIZE : key.includes('exp') ? EXP_STATION_SIZE : LINE_STATION_SIZE;
      const cardH = isCorner ? CORNER_STATION_HEIGHT : isMain ? MAIN_STATION_HEIGHT : key.includes('exp') ? EXP_STATION_HEIGHT : LINE_STATION_HEIGHT;
      const cr = isCorner ? 12 : isMain ? 8 : 6;

      const glow = new Graphics();
      glow.roundRect(-cardW / 2 - 3, -cardH / 2 - 3, cardW + 6, cardH + 6, cr + 2);
      glow.stroke({ width: 2.5, color: 0xE0C55E, alpha: 0.9 });
      card.addChild(glow);
      this.highlights.set(key, glow);
    }
  }

  /** Remove all destination highlights. */
  clearHighlights(): void {
    for (const [, glow] of this.highlights) {
      if (glow.parent) glow.parent.removeChild(glow);
      glow.destroy();
    }
    this.highlights.clear();
  }

  // ============================================
  // Helper Methods
  // ============================================

  private getShortName(name: string): string {
    return SHORT_NAME_MAP[name] || name;
  }

  private getShortDesc(desc: string): string {
    if (desc.length <= 20) return desc;
    return desc.substring(0, 18) + '...';
  }

  private getCellEmoji(id: string, type: string): string {
    if (EMOJI_BY_ID[id]) return EMOJI_BY_ID[id];
    if (EMOJI_BY_TYPE[type]) return EMOJI_BY_TYPE[type];
    return DEFAULT_EMOJI;
  }

  /** Returns transfer line info for a main ring station (entry or exit point). */
  private getTransferLines(mainIndex: number): Array<{ lineId: string; symbol: string; isEntry: boolean }> {
    const results: Array<{ lineId: string; symbol: string; isEntry: boolean }> = [];
    for (const line of LINE_CONFIGS) {
      const shortName = line.name.split(' ')[0]; // e.g. "浦口线" from "浦口线 - 浦口校区"
      if (line.entryIndex === mainIndex) {
        results.push({ lineId: line.id, symbol: `\u{21AA}${shortName}`, isEntry: true });
      }
      const exitIndex = LINE_EXIT_MAP[line.id];
      if (exitIndex === mainIndex) {
        results.push({ lineId: line.id, symbol: `${shortName}\u{21A9}`, isEntry: false });
      }
    }
    return results;
  }
}
