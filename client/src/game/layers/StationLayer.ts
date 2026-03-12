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
  // 支线长名称缩短
  '野猪学长和狐獴学弟': '野猪与狐獴',
  '图书馆空调没有开放': '图书馆空调',
  '带高中同学游览仙林': '同学游仙林',
  '带同学游览鼓楼': '同学游鼓楼',
  '违反校规开办考研辅导': '考研辅导',
  '半壁江山竟仍是工地': '半壁工地',
  '培养计划套娃盲盒': '套娃盲盒',
  '北大楼草坪集体婚礼': '草坪婚礼',
  '摄像头麦克风事故': '摄像头事故',
  '录取通知盒流水线': '录取流水线',
  '快递寄到车大成贤': '快递寄错',
  '被子被鸟屎污染': '被子鸟屎',
  '室内雪世界的饼': '雪世界饼',
  '吃出高质量蛋白质': '高质量蛋白',
  '课没修够两地奔波': '两地奔波',
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
  // Sprites currently pulsing (loading)

  constructor(options: StationLayerOptions = {}) {
    this.options = options;
  }

  /** Inject TweenEngine for unified hover animations. */
  setTweenEngine(engine: TweenEngine): void {
    this.tweenEngine = engine;
  }

  /** Update level-of-detail based on current zoom scale. */
  updateLOD(zoom: number): void {
    const newLOD = zoom > 1.2 ? 'near' : zoom > 0.6 ? 'mid' : 'far';
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
        bg.fill({ color: hexToPixi(DESIGN_TOKENS.color.player[0]) }); // player red for badge
        badge.addChild(bg);

        const text = new Text({
          text: `${count}`,
          style: new TextStyle({
            fontSize: 9,
            fill: hexToPixi(DESIGN_TOKENS.color.white),
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

      // --- Card background (warm white + color tint) ---
      const bg = new Graphics();

      // Warm white base (matches illustration background tone)
      bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
      bg.fill({ color: hexToPixi(DESIGN_TOKENS.color.bg.main), alpha: 0.96 });

      // Theme color tint overlay
      bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
      bg.fill({ color: colorLight, alpha: 0.12 });

      // Bold colored border
      bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
      bg.stroke({ width: borderWidth, color: colorLight, alpha: 0.9 });

      // Top color band (header strip for type identification)
      const bandH = isCorner ? 10 : 7;
      bg.roundRect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, bandH, cornerRadius - 1);
      bg.fill({ color: colorLight, alpha: 0.65 });

      // Corner glow halo
      if (isCorner) {
        const glowRadius = Math.max(cardW, cardH) * 0.7;
        bg.circle(0, 0, glowRadius);
        bg.fill({ color: colorLight, alpha: 0.08 });
      }

      // Force-entry red dot
      if (cell.forceEntry) {
        bg.circle(cardW / 2 - 10, -cardH / 2 + 10, 7);
        bg.fill({ color: hexToPixi(DESIGN_TOKENS.color.semantic.danger) });
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
      // Name background bar with theme color
      const nameBgH = isCorner ? 40 : 28;
      const nameBg = new Graphics();
      nameBg.roundRect(-cardW / 2 + 2, cardH / 2 - nameBgH - 2, cardW - 4, nameBgH, cornerRadius - 2);
      nameBg.fill({ color: colorDark, alpha: 0.88 });
      card.addChild(nameBg);

      const nameColor = isCorner ? hexToPixi(DESIGN_TOKENS.color.brand.accentLight) : hexToPixi(DESIGN_TOKENS.color.white);
      const nameText = new Text({
        text: displayName,
        style: new TextStyle({
          fontFamily: DESIGN_TOKENS.typography.fontFamily,
          fontSize: isCorner ? 24 : 15,
          fill: nameColor,
          fontWeight: 'bold',
          align: 'center',
          dropShadow: { alpha: 0.9, blur: 2, color: hexToPixi(DESIGN_TOKENS.color.black), distance: 1 },
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

        const cardW = LINE_STATION_SIZE;
        const cardH = LINE_STATION_HEIGHT;
        const cornerRadius = 8;

        const card = new Container();
        card.x = pos.x;
        card.y = pos.y;

        // --- Card background (colored theme per line) ---
        const bg = new Graphics();

        // Warm white base (matches illustration background tone)
        bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
        bg.fill({ color: hexToPixi(DESIGN_TOKENS.color.bg.main), alpha: 0.96 });

        // Line color tint overlay (soft wash of the line's theme color)
        bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
        bg.fill({ color: colorLight, alpha: 0.15 });

        // Bold colored border for strong line identity
        bg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
        bg.stroke({ width: 2.5, color: colorLight, alpha: 0.85 });

        // Top color band (thin header strip for quick line identification)
        bg.roundRect(-cardW / 2 + 1, -cardH / 2 + 1, cardW - 2, 6, cornerRadius - 1);
        bg.fill({ color: colorLight, alpha: 0.7 });

        card.addChild(bg);

        // --- Branch cell illustration (each cell has its own image) ---
        const branchImgUrl = `/art/cells/line/${line.id}_${i}.png`;
        const cardKey = `line:${line.id}:${i}`;
        this.loadBranchImage(card, branchImgUrl, cardW, cardH, cardKey);

        // --- Resolve station name from boardData ---
        const lineData = boardData.lines[line.id];
        const stationName = lineData?.cells?.[i]?.name ?? `站点`;

        // --- Station name with line-themed background bar ---
        const nameBgH = 26;
        const branchNameBg = new Graphics();
        branchNameBg.roundRect(-cardW / 2 + 2, cardH / 2 - nameBgH - 2, cardW - 4, nameBgH, 5);
        branchNameBg.fill({ color: colorDark, alpha: 0.88 });
        card.addChild(branchNameBg);

        const nameText = new Text({
          text: this.getShortName(stationName),
          style: new TextStyle({
            fontFamily: DESIGN_TOKENS.typography.fontFamily,
            fontSize: 13,
            fill: hexToPixi(DESIGN_TOKENS.color.white),
            fontWeight: 'bold',
            align: 'center',
            wordWrap: true,
            wordWrapWidth: cardW - 14,
            dropShadow: { alpha: 0.9, blur: 2, color: hexToPixi(DESIGN_TOKENS.color.black), distance: 1 },
          }),
        });
        nameText.anchor.set(0.5);
        nameText.y = cardH / 2 - nameBgH / 2 - 2;
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
      const cardW = isCorner ? CORNER_STATION_SIZE : isMain ? MAIN_STATION_SIZE : LINE_STATION_SIZE;
      const cardH = isCorner ? CORNER_STATION_HEIGHT : isMain ? MAIN_STATION_HEIGHT : LINE_STATION_HEIGHT;
      const cr = isCorner ? 16 : isMain ? 10 : 8;

      const glow = new Graphics();
      glow.roundRect(-cardW / 2 - 4, -cardH / 2 - 4, cardW + 8, cardH + 8, cr + 3);
      glow.stroke({ width: 3, color: hexToPixi(DESIGN_TOKENS.color.brand.accentLight), alpha: 0.9 });
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
  /** Create a main ring image sprite with mask to clip within card bounds. */
  private createMainSprite(texture: Texture, cardW: number, cardH: number, isCorner: boolean, cornerRadius: number): Sprite {
    const sprite = this.createImageSprite(texture, cardW, cardH, isCorner);
    // Clip sprite within card rounded rect
    const mask = new Graphics();
    mask.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
    mask.fill({ color: 0xffffff });
    sprite.mask = mask;
    return sprite;
  }

  private loadAndAddImage(card: Container, url: string, cardW: number, cardH: number, isCorner: boolean, _cellBgColor?: number, cardKey?: string): void {
    const thumbUrl = toThumbUrl(url);
    const cornerRadius = isCorner ? 16 : 10;

    // Load thumbnail first (fast, small file)
    loadCellTexture(thumbUrl).then(texture => {
      if (!texture || !card.parent) return;

      const sprite = this.createMainSprite(texture, cardW, cardH, isCorner, cornerRadius);
      // Insert mask + sprite after bg
      card.addChildAt(sprite.mask as Graphics, 1);
      card.addChildAt(sprite, 2);

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

      if (this.hiResTriggered && cardKey) {
        this.loadHiResForCard(cardKey);
      }
    }).catch(() => {
      loadCellTexture(url).then(texture => {
        if (!texture || !card.parent) return;

        const sprite = this.createMainSprite(texture, cardW, cardH, isCorner, cornerRadius);
        card.addChildAt(sprite.mask as Graphics, 1);
        card.addChildAt(sprite, 2);

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
      }).catch(() => {});
    });
  }

  /** Load and add image for branch cells (cover-fill style). */
  /** Create a branch image sprite with mask, fitted into the image area above the name bar. */
  private createBranchSprite(texture: Texture, cardW: number, cardH: number): Sprite {
    const nameBgH = 18;
    const imgAreaH = cardH - nameBgH - 4;
    const padding = 2;
    const cornerRadius = 8;
    const imgAreaW = cardW - padding * 2;
    const scaleX = imgAreaW / texture.width;
    const scaleY = (imgAreaH - padding) / texture.height;
    const scale = Math.min(scaleX, scaleY);

    const sprite = new Sprite(texture);
    sprite.width = texture.width * scale;
    sprite.height = texture.height * scale;
    sprite.anchor.set(0.5);
    sprite.y = -cardH / 2 + padding + imgAreaH / 2;

    // Clip sprite within card rounded rect so white image backgrounds don't bleed out
    const mask = new Graphics();
    mask.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cornerRadius);
    mask.fill({ color: 0xffffff });
    sprite.mask = mask;

    return sprite;
  }

  private loadBranchImage(card: Container, url: string, cardW: number, cardH: number, cardKey: string): void {
    const thumbUrl = toThumbUrl(url);

    loadCellTexture(thumbUrl).then(texture => {
      if (!texture || !card.parent) return;

      const sprite = this.createBranchSprite(texture, cardW, cardH);
      // Add mask as child of card so it gets positioned correctly
      card.addChildAt(sprite.mask as Graphics, 1);
      card.addChildAt(sprite, 2);

      // Track for hi-res upgrade
      this.hiResState.set(cardKey, {
        sprite,
        hiResUrl: url,
        loaded: false,
        cardW,
        cardH,
        isCorner: false,
      });
    }).catch(() => {
      // Try full-size as fallback
      loadCellTexture(url).then(texture => {
        if (!texture || !card.parent) return;
        const sprite = this.createBranchSprite(texture, cardW, cardH);
        card.addChildAt(sprite.mask as Graphics, 1);
        card.addChildAt(sprite, 2);
        if (cardKey) {
          this.hiResState.set(cardKey, { sprite, hiResUrl: url, loaded: true, cardW, cardH, isCorner: false });
        }
      }).catch(() => {});
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

    const isBranch = cardKey.startsWith('line:');

    loadCellTexture(hiResUrl).then(texture => {

      if (!texture || !sprite.parent) return;

      const parent = sprite.parent;
      const index = parent.getChildIndex(sprite);

      // Remove old mask if present
      if (sprite.mask) {
        const oldMask = sprite.mask as Graphics;
        parent.removeChild(oldMask);
        oldMask.destroy();
      }
      parent.removeChildAt(parent.getChildIndex(sprite));

      let newSprite: Sprite;
      if (isBranch) {
        newSprite = this.createBranchSprite(texture, cardW, cardH);
      } else {
        const cornerRadius = isCorner ? 16 : 10;
        newSprite = this.createMainSprite(texture, cardW, cardH, isCorner, cornerRadius);
      }
      // Re-insert mask + sprite at correct position
      const insertIdx = Math.min(index > 0 ? index - 1 : 0, parent.children.length);
      parent.addChildAt(newSprite.mask as Graphics, insertIdx);
      parent.addChildAt(newSprite, insertIdx + 1);

      state.sprite = newSprite;
      state.loaded = true;
    }).catch(() => {
      // Keep showing thumbnail — it's already visible as fallback
    });
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
