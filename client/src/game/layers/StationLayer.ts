// client/src/game/layers/StationLayer.ts
// Renders all station cards (main ring + branch line stations) with frosted-glass card effect.

import { Container, Graphics, Text, TextStyle, Sprite, Assets, Texture } from 'pixi.js';
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
  imageUrl?: string;
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

// ============================================
// Cell Illustration Map — maps cell id / type to image file
// ============================================
const CELL_IMAGE_MAP: Record<string, string> = {
  // Corner stations
  start: '/art/cells/start_gen.png',
  hospital: '/art/cells/hospital.jpg',
  ding: '/art/cells/ding.jpg',
  waiting_room: '/art/cells/waiting_room.jpg',
  // Main ring events
  tuition: '/art/cells/tuition.jpg',
  zijing: '/art/cells/zijing.jpg',
  qingong: '/art/cells/qingong.jpg',
  retake: '/art/cells/retake.png',
  jiang_gong: '/art/cells/jiang_gong.png',
  society: '/art/cells/society.png',
  kechuang: '/art/cells/kechuang.png',
  nanna_cp: '/art/cells/nanna_cp.jpg',
  chuangmen: '/art/cells/chuangmen.jpg',
};

// Line entry images
const LINE_IMAGE_MAP: Record<string, string> = {
  study: '/art/cells/line_study.jpg',
  money: '/art/cells/line_money.jpg',
  pukou: '/art/cells/line_pukou.jpg',
  suzhou: '/art/cells/line_suzhou.png',
  explore: '/art/cells/line_explore_gen.png',
  xianlin: '/art/cells/line_xianlin.jpg',
  gulou: '/art/cells/line_gulou.jpg',
  food: '/art/cells/line_food.jpg',
};

// Chance card image
const CHANCE_IMAGE = '/art/cells/chance.jpg';

// Texture cache
const textureCache = new Map<string, Texture>();

async function loadCellTexture(url: string): Promise<Texture | null> {
  if (textureCache.has(url)) return textureCache.get(url)!;
  try {
    const texture = await Assets.load<Texture>(url);
    textureCache.set(url, texture);
    return texture;
  } catch {
    return null;
  }
}

/**
 * Convert a full-size image URL to its thumbnail URL.
 * e.g. /art/cells/start_gen.png  -> /art/thumb/start_gen.webp
 *      /art/cells/line/foo.png   -> /art/thumb/line/foo.webp   (not currently used for branch cells)
 */
function toThumbUrl(fullUrl: string): string {
  return fullUrl
    .replace('/art/cells/', '/art/thumb/')
    .replace(/\.(png|jpg|jpeg)$/i, '.webp');
}

/** Hi-res zoom threshold: load full images when zoom exceeds this. */
const HIRES_ZOOM_THRESHOLD = 2.5;

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
  // LOD state for zoom-dependent detail
  private currentLOD: 'near' | 'mid' | 'far' = 'near';
  // References to branch line station name texts (for LOD show/hide)
  private branchTexts: Text[] = [];
  // Hi-res image tracking: maps card key -> { thumbSprite, hiResUrl, loaded }
  private hiResState: Map<string, { sprite: Sprite; hiResUrl: string; loaded: boolean; cardW: number; cardH: number; isCorner: boolean }> = new Map();
  // Whether hi-res images have been triggered
  private hiResTriggered = false;
  // Loading pulse animation frame id
  private pulseAnimFrame: number | null = null;
  // Sprites currently pulsing (loading)
  private pulsingSprites: Set<Sprite> = new Set();

  constructor(options: StationLayerOptions = {}) {
    this.options = options;
  }

  /** Inject TweenEngine for unified hover animations. */
  setTweenEngine(engine: TweenEngine): void {
    this.tweenEngine = engine;
  }

  /** Update level-of-detail based on current zoom scale. */
  updateLOD(zoom: number): void {
    const newLOD = zoom > 2.0 ? 'near' : zoom > 1.0 ? 'mid' : 'far';
    if (newLOD !== this.currentLOD) {
      this.currentLOD = newLOD;
      this.applyLOD();
    }

    // Trigger hi-res image loading when zoom exceeds threshold
    if (!this.hiResTriggered && zoom > HIRES_ZOOM_THRESHOLD) {
      this.hiResTriggered = true;
      this.loadAllHiRes();
    }
  }

  /** Apply LOD: show/hide branch line text labels based on zoom level. */
  private applyLOD(): void {
    const textAlpha = this.currentLOD === 'near' ? 1 : 0;
    for (const t of this.branchTexts) {
      t.alpha = textAlpha;
    }
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
    this.branchTexts = [];
    this.hiResState.clear();
    this.pulsingSprites.clear();
    if (this.pulseAnimFrame !== null) {
      cancelAnimationFrame(this.pulseAnimFrame);
      this.pulseAnimFrame = null;
    }
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
      const cornerRadius = isCorner ? 16 : 10;
      const borderWidth = isCorner ? 5 : 2.5;

      // Card container
      const card = new Container();
      card.x = pos.x;
      card.y = pos.y;

      // --- Card background ---
      const bg = new Graphics();

      // Solid colored background (much more visible than old translucent style)
      bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
      bg.fill({ color: colorDark, alpha: 0.95 });

      // Bold colored border
      bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
      bg.stroke({ width: borderWidth, color: colorLight, alpha: 1.0 });

      // Inner glow (thicker, low-alpha stroke for soft glow effect)
      bg.roundRect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, cardH - 2, cornerRadius - 1);
      bg.stroke({ color: colorLight, width: 6, alpha: 0.15 });

      // Corner glow halo
      if (isCorner) {
        const glowRadius = Math.max(cardW, cardH) * 0.75;
        bg.circle(0, 0, glowRadius);
        bg.fill({ color: colorLight, alpha: 0.12 });
      }

      // Force-entry red dot
      if (cell.forceEntry) {
        bg.circle(cardW / 2 - 10, -cardH / 2 + 10, 7);
        bg.fill({ color: 0xEF5350 });
      }

      // Left color bar for line entries
      if (cell.type === 'line_entry') {
        bg.roundRect(-cardW / 2, -cardH / 2 + 4, 6, cardH - 8, 3);
        bg.fill({ color: colorLight });
      }

      card.addChild(bg);

      // --- Illustration image (main visual) ---
      const imgUrl = this.getCellImageUrl(cell.id, cell.type, cell.lineId);
      if (imgUrl) {
        this.loadAndAddImage(card, imgUrl, cardW, cardH, isCorner, colorDark, `main:${index}`);
      } else {
        // Fallback: large emoji
        const emoji = this.getCellEmoji(cell.id, cell.type);
        const emojiText = new Text({
          text: emoji,
          style: new TextStyle({ fontSize: isCorner ? 56 : 36, align: 'center' }),
        });
        emojiText.anchor.set(0.5);
        emojiText.y = isCorner ? -20 : -14;
        card.addChild(emojiText);
      }

      // --- Station name (large, bold, at bottom) ---
      const displayName = this.getShortName(cell.name);
      // Name background bar for readability
      const nameBgH = isCorner ? 40 : 28;
      const nameBg = new Graphics();
      nameBg.roundRect(-cardW / 2 + 2, cardH / 2 - nameBgH - 2, cardW - 4, nameBgH, cornerRadius - 2);
      nameBg.fill({ color: 0x000000, alpha: 0.7 });
      card.addChild(nameBg);

      const nameColor = isCorner ? 0xE8CC6E : (cell.type === 'event') ? 0x1A1230 : 0xFFFFFF;
      const nameText = new Text({
        text: displayName,
        style: new TextStyle({
          fontFamily: DESIGN_TOKENS.typography.fontFamily,
          fontSize: isCorner ? 24 : 15,
          fill: nameColor,
          fontWeight: 'bold',
          align: 'center',
          dropShadow: { alpha: 0.9, blur: 2, color: 0x000000, distance: 1 },
        }),
      });
      nameText.anchor.set(0.5);
      nameText.y = cardH / 2 - nameBgH / 2 - 2;
      card.addChild(nameText);

      // --- Transfer marker (换乘标记) ---
      const transferLines = this.getTransferLines(index);
      if (transferLines.length > 0) {
        const transferLabel = new Text({
          text: transferLines.map(t => t.symbol).join(' '),
          style: new TextStyle({
            fontFamily: DESIGN_TOKENS.typography.fontFamily,
            fontSize: 11,
            fill: colorLight,
            fontWeight: 'bold',
            align: 'center',
          }),
        });
        transferLabel.anchor.set(0.5);
        transferLabel.y = -cardH / 2 + 10;
        card.addChild(transferLabel);
      }

      // --- Interaction ---
      card.eventMode = 'static';
      card.cursor = 'pointer';
      card.alpha = 1.0;
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
            imageUrl: imgUrl ?? undefined,
          });
        }
      });
      card.on('pointerout', () => {
        animateScale(card, 1.0, this.tweenEngine);
        card.alpha = 1.0;
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
        const cornerRadius = 8;

        const card = new Container();
        card.x = pos.x;
        card.y = pos.y;

        // --- Card background (frosted glass style) ---
        const bg = new Graphics();

        // Dark tint
        bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
        bg.fill({ color: colorDark, alpha: 0.25 });

        // Glass overlay (higher opacity for readability)
        bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
        bg.fill({ color: 0x1A1230, alpha: 0.82 });

        // Border (gold for experience, line color for regular)
        bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
        bg.stroke({ width: isExperience ? 2.5 : 2, color: isExperience ? 0xE8CC6E : colorLight, alpha: isExperience ? 0.8 : 0.6 });

        // Experience card gold star marker
        if (isExperience) {
          bg.circle(0, -cardH / 2 + 18, 11);
          bg.fill({ color: 0xE8CC6E, alpha: 0.5 });
        }

        // Line color indicator bar (left edge)
        const barColor = isExperience ? 0xE8CC6E : colorLight;
        bg.roundRect(-cardW / 2, -cardH / 2 + 5, 5, cardH - 10, 3);
        bg.fill({ color: barColor, alpha: 0.8 });

        card.addChild(bg);

        // --- Resolve station name from boardData ---
        const lineData = boardData.lines[line.id];
        const stationName = isExperience
          ? lineData?.experienceCard?.name ?? '体验卡'
          : lineData?.cells?.[i]?.name ?? `站点`;

        // --- Station name (centered vertically, no image for branch cells) ---
        const nameText = new Text({
          text: this.getShortName(stationName),
          style: new TextStyle({
            fontFamily: DESIGN_TOKENS.typography.fontFamily,
            fontSize: isExperience ? 11 : 9,
            fill: isExperience ? 0xE8CC6E : 0xFFFFFF,
            fontWeight: 'bold',
            align: 'center',
            wordWrap: true,
            wordWrapWidth: cardW - 12,
          }),
        });
        nameText.anchor.set(0.5);
        nameText.y = 0; // centered vertically
        card.addChild(nameText);

        // Track branch text for LOD visibility
        this.branchTexts.push(nameText);

        // --- Interaction ---
        card.eventMode = 'static';
        card.cursor = 'pointer';
        card.alpha = 1.0;
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
              imageUrl: LINE_IMAGE_MAP[line.id] ?? undefined,
            });
          }
        });
        card.on('pointerout', () => {
          animateScale(card, 1.0, this.tweenEngine);
          card.alpha = 1.0;
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
        fontSize: 14,
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
      const cr = isCorner ? 16 : isMain ? 10 : 8;

      const glow = new Graphics();
      glow.roundRect(-cardW / 2 - 4, -cardH / 2 - 4, cardW + 8, cardH + 8, cr + 3);
      glow.stroke({ width: 3, color: 0xE8CC6E, alpha: 0.9 });
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

  /** Get illustration image URL for a cell. */
  private getCellImageUrl(id: string, type: string, lineId?: string): string | null {
    // Direct cell id match
    if (CELL_IMAGE_MAP[id]) return CELL_IMAGE_MAP[id];
    // Line entry: use line image
    if (type === 'line_entry' && lineId && LINE_IMAGE_MAP[lineId]) return LINE_IMAGE_MAP[lineId];
    // Chance cards
    if (type === 'chance') return CHANCE_IMAGE;
    return null;
  }

  /** Load an image and add it as a sprite to a card container. Loads thumbnail first, hi-res on demand. */
  private loadAndAddImage(card: Container, url: string, cardW: number, cardH: number, isCorner: boolean, cellBgColor?: number, cardKey?: string): void {
    const thumbUrl = toThumbUrl(url);

    // Load thumbnail first (fast, small file)
    loadCellTexture(thumbUrl).then(texture => {
      if (!texture || !card.parent) return; // card may have been destroyed

      const sprite = this.createImageSprite(texture, cardW, cardH, isCorner);

      // Insert after bg (index 1) but before name text
      card.addChildAt(sprite, 1);

      // Add dark gradient overlays to blend white-bg illustrations with dark theme
      this.addImageOverlays(card, cardW, cardH, isCorner, cellBgColor);

      // Track for hi-res upgrade
      if (cardKey) {
        this.hiResState.set(cardKey, {
          sprite,
          hiResUrl: url,
          loaded: false,
          cardW,
          cardH,
          isCorner,
        });
      }

      // If hi-res was already triggered (e.g., card loaded after zoom), load immediately
      if (this.hiResTriggered && cardKey) {
        this.loadHiResForCard(cardKey);
      }
    }).catch(() => {
      // Thumbnail failed — try full-size image directly as fallback
      loadCellTexture(url).then(texture => {
        if (!texture || !card.parent) return;

        const sprite = this.createImageSprite(texture, cardW, cardH, isCorner);
        card.addChildAt(sprite, 1);
        this.addImageOverlays(card, cardW, cardH, isCorner, cellBgColor);

        // Mark as already hi-res
        if (cardKey) {
          this.hiResState.set(cardKey, {
            sprite,
            hiResUrl: url,
            loaded: true,
            cardW,
            cardH,
            isCorner,
          });
        }
      }).catch(() => {
        // Both failed — cell shows just its colored background (default behavior)
      });
    });
  }

  /** Create and position an image sprite within a card. */
  private createImageSprite(texture: Texture, cardW: number, cardH: number, isCorner: boolean): Sprite {
    const sprite = new Sprite(texture);
    const nameBgH = isCorner ? 40 : 28;
    const imgAreaH = cardH - nameBgH - 6;
    const imgAreaW = cardW - 8;
    const padding = 4;

    const scaleX = (imgAreaW - padding * 2) / texture.width;
    const scaleY = (imgAreaH - padding * 2) / texture.height;
    const scale = Math.min(scaleX, scaleY);
    sprite.width = texture.width * scale;
    sprite.height = texture.height * scale;
    sprite.anchor.set(0.5);
    sprite.x = 0;
    const imgY = -cardH / 2 + padding;
    sprite.y = imgY + imgAreaH / 2;

    return sprite;
  }

  /** Add dark gradient overlays for non-corner cards. */
  private addImageOverlays(card: Container, cardW: number, cardH: number, isCorner: boolean, cellBgColor?: number): void {
    if (isCorner) return;

    const nameBgH = 28;
    const imgAreaH = cardH - nameBgH - 6;
    const padding = 4;
    const imgY = -cardH / 2 + padding;
    const blendColor = cellBgColor ?? 0x1A1230;

    const overlayH = imgAreaH * 0.4;
    const bottomOverlay = new Graphics();
    bottomOverlay.rect(-cardW / 2 + 2, imgY + imgAreaH - overlayH, cardW - 4, overlayH);
    bottomOverlay.fill({ color: blendColor, alpha: 0.35 });
    card.addChildAt(bottomOverlay, 2);

    const topOverlay = new Graphics();
    topOverlay.rect(-cardW / 2 + 2, imgY, cardW - 4, imgAreaH * 0.15);
    topOverlay.fill({ color: blendColor, alpha: 0.2 });
    card.addChildAt(topOverlay, 3);
  }

  /** Load hi-res images for all tracked cards. */
  private loadAllHiRes(): void {
    for (const key of this.hiResState.keys()) {
      this.loadHiResForCard(key);
    }
  }

  /** Load hi-res image for a single card, replacing the thumbnail sprite. */
  private loadHiResForCard(cardKey: string): void {
    const state = this.hiResState.get(cardKey);
    if (!state || state.loaded) return;

    const { sprite, hiResUrl, cardW, cardH, isCorner } = state;

    // Start pulsing animation on the sprite to indicate loading
    this.startPulse(sprite);

    loadCellTexture(hiResUrl).then(texture => {
      this.stopPulse(sprite);

      if (!texture || !sprite.parent) return;

      // Swap the texture on the existing sprite
      const newSprite = this.createImageSprite(texture, cardW, cardH, isCorner);
      const parent = sprite.parent;
      const index = parent.getChildIndex(sprite);
      parent.removeChildAt(index);
      parent.addChildAt(newSprite, index);

      state.sprite = newSprite;
      state.loaded = true;
    }).catch(() => {
      this.stopPulse(sprite);
      // Keep showing thumbnail — it's already visible as fallback
    });
  }

  /** Start a subtle pulsing alpha animation on a sprite to indicate loading. */
  private startPulse(sprite: Sprite): void {
    this.pulsingSprites.add(sprite);
    if (this.pulseAnimFrame === null) {
      const pulse = () => {
        const t = performance.now() / 600; // ~1.7 Hz
        const alpha = 0.6 + 0.4 * Math.abs(Math.sin(t));
        for (const s of this.pulsingSprites) {
          if (s.parent) {
            s.alpha = alpha;
          }
        }
        if (this.pulsingSprites.size > 0) {
          this.pulseAnimFrame = requestAnimationFrame(pulse);
        } else {
          this.pulseAnimFrame = null;
        }
      };
      this.pulseAnimFrame = requestAnimationFrame(pulse);
    }
  }

  /** Stop pulsing on a sprite and reset alpha. */
  private stopPulse(sprite: Sprite): void {
    this.pulsingSprites.delete(sprite);
    sprite.alpha = 1;
    if (this.pulsingSprites.size === 0 && this.pulseAnimFrame !== null) {
      cancelAnimationFrame(this.pulseAnimFrame);
      this.pulseAnimFrame = null;
    }
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
