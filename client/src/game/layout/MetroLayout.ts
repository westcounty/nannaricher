// client/src/game/layout/MetroLayout.ts
// Pure math module for metro-style board layout.
// No PixiJS imports — only math and design tokens for colors.

import {
  CORNER_INDICES,
  CELLS_PER_SIDE,
  LINE_CONFIGS,
  LINE_EXIT_MAP,
  MAIN_BOARD_CELLS,
  MAIN_BOARD_SIZE,
} from '@nannaricher/shared';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';

// ============================================
// Types
// ============================================
export interface Point {
  x: number;
  y: number;
}

export interface BezierConfig {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
}

// ============================================
// Board Dimensions
// ============================================
export const METRO_BOARD_WIDTH = 2500;
export const METRO_BOARD_HEIGHT = 2500;

// ============================================
// Station Size Constants
// ============================================
export const STATION_RADIUS = 18;
export const CORNER_STATION_RADIUS = 28;
export const LINE_STATION_RADIUS = 14;

// Station card dimensions (width × height) — used by StationLayer
export const MAIN_STATION_SIZE = 80;
export const MAIN_STATION_HEIGHT = 100;
export const CORNER_STATION_SIZE = 120;
export const CORNER_STATION_HEIGHT = 140;
// Branch line stations — sized for readable Chinese text
export const LINE_STATION_SIZE = 62;
export const LINE_STATION_HEIGHT = 72;
export const EXP_STATION_SIZE = 72;
export const EXP_STATION_HEIGHT = 82;

// Track widths — used by TrackLayer
export const MAIN_TRACK_WIDTH = 6;
export const LINE_TRACK_WIDTH = 4;

// ============================================
// Ring Geometry Constants
// ============================================
const HALF_WIDTH = 540;   // half-width of rounded rect ring
const HALF_HEIGHT = 540;  // half-height of rounded rect ring (same as width for uniform spacing)

// ============================================
// Main Ring Station Positions
// ============================================

/**
 * Calculate the (x, y) position of a main board station on the metro ring.
 * Coordinates are center-relative (0, 0 = board center).
 *
 * Layout (rounded rectangle ring):
 *   Bottom side (0-6):  right to left   y = +HALF_HEIGHT
 *   Left side (7-13):   bottom to top   x = -HALF_WIDTH
 *   Top side (14-20):   left to right   y = -HALF_HEIGHT
 *   Right side (21-27): top to bottom   x = +HALF_WIDTH
 *
 * Each side has 7 stations: 1 corner (posInSide=0) + 6 regular.
 * Regular stations are placed at fractions 1/7 to 6/7 between corners,
 * so the last regular station does NOT land on the next corner.
 */
export function getMainStationPosition(index: number): Point {
  const side = Math.floor(index / CELLS_PER_SIDE);
  const posInSide = index % CELLS_PER_SIDE;

  // Corner stations
  if (posInSide === 0) {
    switch (side) {
      case 0: return { x: +HALF_WIDTH, y: +HALF_HEIGHT }; // bottom-right (start)
      case 1: return { x: -HALF_WIDTH, y: +HALF_HEIGHT }; // bottom-left (hospital)
      case 2: return { x: -HALF_WIDTH, y: -HALF_HEIGHT }; // top-left (ding)
      case 3: return { x: +HALF_WIDTH, y: -HALF_HEIGHT }; // top-right (waiting_room)
    }
  }

  // Regular cells: 6 per side, placed at 1/7 to 6/7 between this corner and the next.
  // This ensures station 6 (last on each side) does NOT overlap with the next corner.
  const fraction = posInSide / CELLS_PER_SIDE;

  switch (side) {
    case 0: {
      // Bottom (right to left): x from +HALF_WIDTH to -HALF_WIDTH
      const x = HALF_WIDTH - fraction * (2 * HALF_WIDTH);
      return { x, y: +HALF_HEIGHT };
    }
    case 1: {
      // Left (bottom to top): y from +HALF_HEIGHT to -HALF_HEIGHT
      const y = HALF_HEIGHT - fraction * (2 * HALF_HEIGHT);
      return { x: -HALF_WIDTH, y };
    }
    case 2: {
      // Top (left to right): x from -HALF_WIDTH to +HALF_WIDTH
      const x = -HALF_WIDTH + fraction * (2 * HALF_WIDTH);
      return { x, y: -HALF_HEIGHT };
    }
    case 3: {
      // Right (top to bottom): y from -HALF_HEIGHT to +HALF_HEIGHT
      const y = -HALF_HEIGHT + fraction * (2 * HALF_HEIGHT);
      return { x: +HALF_WIDTH, y };
    }
  }

  return { x: 0, y: 0 };
}

// ============================================
// Bezier Curve Utilities
// ============================================

/**
 * Evaluate a cubic bezier curve at parameter t.
 * B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
 */
export function getBezierPoint(
  t: number,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
): Point {
  const u = 1 - t;
  const uu = u * u;
  const uuu = uu * u;
  const tt = t * t;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

/**
 * Approximate the arc length of a cubic bezier curve using numerical integration.
 */
export function bezierArcLength(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  segments = 64,
): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const curr = getBezierPoint(t, p0, p1, p2, p3);
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    length += Math.sqrt(dx * dx + dy * dy);
    prev = curr;
  }
  return length;
}

// ============================================
// Branch Line Bezier Layout
// ============================================

// Minimum spacing between adjacent branch stations (px)
const MIN_CELL_SPACING = 80;

/**
 * Get the outward direction for a branch based on which side of the ring it's on.
 */
function getOutwardDir(side: number): Point {
  switch (side) {
    case 0: return { x: 0, y: +1 }; // bottom → down
    case 1: return { x: -1, y: 0 }; // left → left
    case 2: return { x: 0, y: -1 }; // top → up
    case 3: return { x: +1, y: 0 }; // right → right
    default: return { x: 0, y: +1 };
  }
}

/**
 * Compute bezier control point depth so that the arc is long enough
 * for all cells to be spaced at least MIN_CELL_SPACING apart.
 */
function computeBezierDepth(
  p0: Point, p3: Point, outDir: Point, cellCount: number,
): number {
  const targetArc = (cellCount + 1) * MIN_CELL_SPACING;
  let lo = 80, hi = 800;
  for (let iter = 0; iter < 30; iter++) {
    const mid = (lo + hi) / 2;
    const p1 = { x: p0.x + outDir.x * mid, y: p0.y + outDir.y * mid };
    const p2 = { x: p3.x + outDir.x * mid, y: p3.y + outDir.y * mid };
    const arc = bezierArcLength(p0, p1, p2, p3);
    if (arc < targetArc) lo = mid; else hi = mid;
  }
  return hi;
}

/**
 * Distribute `count` points evenly along a cubic bezier by arc length.
 * Returns positions at arc fractions i/(count+1) for i=1..count,
 * so the first cell is spaced from entry and the last from exit.
 */
function distributeAlongBezier(
  p0: Point, p1: Point, p2: Point, p3: Point, count: number,
): Point[] {
  // Build arc-length lookup table
  const N = 256;
  const arcLen: number[] = [0];
  let prev = p0;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const curr = getBezierPoint(t, p0, p1, p2, p3);
    arcLen.push(arcLen[i - 1] + Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2));
    prev = curr;
  }
  const totalLen = arcLen[N];

  const positions: Point[] = [];
  for (let i = 1; i <= count; i++) {
    const target = (i / (count + 1)) * totalLen;
    // Binary search for the table index
    let lo = 0, hi = N;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (arcLen[mid] < target) lo = mid; else hi = mid;
    }
    const frac = (target - arcLen[lo]) / (arcLen[hi] - arcLen[lo] || 1);
    const t = (lo + frac) / N;
    positions.push(getBezierPoint(t, p0, p1, p2, p3));
  }
  return positions;
}

// Cache for bezier positions per line (computed once)
const bezierCache = new Map<string, { positions: Point[]; p0: Point; p1: Point; p2: Point; p3: Point }>();

function getOrBuildBezier(lineId: string) {
  if (bezierCache.has(lineId)) return bezierCache.get(lineId)!;

  const line = LINE_CONFIGS.find(l => l.id === lineId);
  if (!line) return null;

  const exitIndex = LINE_EXIT_MAP[lineId];
  if (exitIndex === undefined) return null;

  const p0 = getMainStationPosition(line.entryIndex);
  const p3 = getMainStationPosition(exitIndex);
  const side = Math.floor(line.entryIndex / CELLS_PER_SIDE);
  const outDir = getOutwardDir(side);
  const depth = computeBezierDepth(p0, p3, outDir, line.cellCount);

  const p1 = { x: p0.x + outDir.x * depth, y: p0.y + outDir.y * depth };
  const p2 = { x: p3.x + outDir.x * depth, y: p3.y + outDir.y * depth };
  const positions = distributeAlongBezier(p0, p1, p2, p3, line.cellCount);

  const result = { positions, p0, p1, p2, p3 };
  bezierCache.set(lineId, result);
  return result;
}

/**
 * Get the position of a station along a branch line.
 * Cells are evenly distributed along a bezier arc from entry to exit.
 * cellIndex is 0-based.
 */
export function getLineStationPosition(lineId: string, cellIndex: number): Point {
  const data = getOrBuildBezier(lineId);
  if (!data || cellIndex < 0 || cellIndex >= data.positions.length) return { x: 0, y: 0 };
  return data.positions[cellIndex];
}

/**
 * Get the track path for a branch line as sampled points along the bezier curve.
 * Returns array of Points: [entryPos, ...curve samples..., exitPos]
 */
export function getLineTrackPath(lineId: string): Point[] {
  const data = getOrBuildBezier(lineId);
  if (!data) return [];

  const { p0, p1, p2, p3 } = data;
  // Sample the bezier at high resolution for smooth rendering
  const SAMPLES = 40;
  const path: Point[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    path.push(getBezierPoint(i / SAMPLES, p0, p1, p2, p3));
  }
  return path;
}

/**
 * Get the bezier config for a branch line (entry, control points, exit).
 */
export function getLineBezierConfig(lineId: string): BezierConfig | undefined {
  const data = getOrBuildBezier(lineId);
  if (!data) return undefined;
  return { start: data.p0, cp1: data.p1, cp2: data.p2, end: data.p3 };
}

// ============================================
// Smooth Path for Branch Tracks
// ============================================

export interface PathSegment {
  type: 'line' | 'quadratic';
  x: number;
  y: number;
  cpx?: number;
  cpy?: number;
}

/**
 * Generate a smooth path for branch track rendering.
 * With bezier layout, the track is already smooth — just convert to PathSegments.
 */
export function getLineSmoothPath(lineId: string): PathSegment[] {
  const trackPath = getLineTrackPath(lineId);
  return trackPath.map(p => ({ type: 'line' as const, x: p.x, y: p.y }));
}

// ============================================
// Color Helpers
// ============================================

/**
 * Get the station color (lighter shade) for a main board cell by index.
 */
export function getStationColor(index: number): number {
  const cell = MAIN_BOARD_CELLS[index];
  if (!cell) return 0xffffff;

  const ct = DESIGN_TOKENS.color.cell;

  if (CORNER_INDICES.includes(index)) {
    switch (cell.cornerType) {
      case 'start': return hexToPixi(ct.corner.start[1]);
      case 'hospital': return hexToPixi(ct.corner.hospital[1]);
      case 'ding': return hexToPixi(ct.corner.ding[1]);
      case 'waiting_room': return hexToPixi(ct.corner.waitingRoom[1]);
    }
  }

  switch (cell.type) {
    case 'event': return hexToPixi(ct.event[1]);
    case 'chance': return hexToPixi(ct.chance[1]);
    case 'line_entry': {
      const lineId = cell.lineId as keyof typeof ct.lineEntry | undefined;
      if (lineId && lineId in ct.lineEntry) {
        return hexToPixi(ct.lineEntry[lineId][1]);
      }
      return hexToPixi(ct.lineEntry.pukou[1]);
    }
  }

  return 0xffffff;
}

/**
 * Get the station dark color (darker shade) for a main board cell by index.
 */
export function getStationColorDark(index: number): number {
  const cell = MAIN_BOARD_CELLS[index];
  if (!cell) return 0xcccccc;

  const ct = DESIGN_TOKENS.color.cell;

  if (CORNER_INDICES.includes(index)) {
    switch (cell.cornerType) {
      case 'start': return hexToPixi(ct.corner.start[0]);
      case 'hospital': return hexToPixi(ct.corner.hospital[0]);
      case 'ding': return hexToPixi(ct.corner.ding[0]);
      case 'waiting_room': return hexToPixi(ct.corner.waitingRoom[0]);
    }
  }

  switch (cell.type) {
    case 'event': return hexToPixi(ct.event[0]);
    case 'chance': return hexToPixi(ct.chance[0]);
    case 'line_entry': {
      const lineId = cell.lineId as keyof typeof ct.lineEntry | undefined;
      if (lineId && lineId in ct.lineEntry) {
        return hexToPixi(ct.lineEntry[lineId][0]);
      }
      return hexToPixi(ct.lineEntry.pukou[0]);
    }
  }

  return 0xcccccc;
}

/**
 * Get theme color for a branch line (lighter shade).
 */
export function getLineThemeColor(lineId: string): number {
  const ct = DESIGN_TOKENS.color.cell.lineEntry;
  const key = lineId as keyof typeof ct;
  if (key in ct) {
    return hexToPixi(ct[key][1]);
  }
  return hexToPixi(ct.pukou[1]);
}

/**
 * Get theme dark color for a branch line (darker shade).
 */
export function getLineThemeColorDark(lineId: string): number {
  const ct = DESIGN_TOKENS.color.cell.lineEntry;
  const key = lineId as keyof typeof ct;
  if (key in ct) {
    return hexToPixi(ct[key][0]);
  }
  return hexToPixi(ct.pukou[0]);
}

// ============================================
// Main Ring Step-by-Step Path
// ============================================

/**
 * Get all station positions from 'from' to 'to' walking clockwise around the main ring.
 * Includes the destination but NOT the starting position.
 * Used for step-by-step movement animation.
 */
export function getMainRingPath(from: number, to: number): Point[] {
  const path: Point[] = [];
  let current = from;
  let safety = MAIN_BOARD_SIZE;
  while (current !== to && safety-- > 0) {
    current = (current + 1) % MAIN_BOARD_SIZE;
    path.push(getMainStationPosition(current));
  }
  return path;
}

// ============================================
// Ring Path
// ============================================

/**
 * Get the ring path as an array of points for track rendering.
 * Returns a closed loop following the rounded rectangle with enough
 * resolution for smooth curves at the corners.
 */
export function getRingPath(pointsPerCorner = 8): Point[] {
  const path: Point[] = [];

  // Corner radius for the rounded rectangle
  const cornerRadius = 60;

  // Bottom side: right to left (y = +HALF_HEIGHT)
  path.push({ x: HALF_WIDTH - cornerRadius, y: HALF_HEIGHT });
  path.push({ x: -HALF_WIDTH + cornerRadius, y: HALF_HEIGHT });

  // Bottom-left corner arc (hospital corner)
  for (let i = 0; i <= pointsPerCorner; i++) {
    const angle = Math.PI / 2 + (Math.PI / 2) * (i / pointsPerCorner);
    path.push({
      x: -HALF_WIDTH + cornerRadius + cornerRadius * Math.cos(angle),
      y: HALF_HEIGHT - cornerRadius + cornerRadius * Math.sin(angle),
    });
  }

  // Left side: bottom to top (x = -HALF_WIDTH)
  path.push({ x: -HALF_WIDTH, y: HALF_HEIGHT - cornerRadius });
  path.push({ x: -HALF_WIDTH, y: -HALF_HEIGHT + cornerRadius });

  // Top-left corner arc (ding corner)
  for (let i = 0; i <= pointsPerCorner; i++) {
    const angle = Math.PI + (Math.PI / 2) * (i / pointsPerCorner);
    path.push({
      x: -HALF_WIDTH + cornerRadius + cornerRadius * Math.cos(angle),
      y: -HALF_HEIGHT + cornerRadius + cornerRadius * Math.sin(angle),
    });
  }

  // Top side: left to right (y = -HALF_HEIGHT)
  path.push({ x: -HALF_WIDTH + cornerRadius, y: -HALF_HEIGHT });
  path.push({ x: HALF_WIDTH - cornerRadius, y: -HALF_HEIGHT });

  // Top-right corner arc (waiting_room corner)
  for (let i = 0; i <= pointsPerCorner; i++) {
    const angle = -Math.PI / 2 + (Math.PI / 2) * (i / pointsPerCorner);
    path.push({
      x: HALF_WIDTH - cornerRadius + cornerRadius * Math.cos(angle),
      y: -HALF_HEIGHT + cornerRadius + cornerRadius * Math.sin(angle),
    });
  }

  // Right side: top to bottom (x = +HALF_WIDTH)
  path.push({ x: HALF_WIDTH, y: -HALF_HEIGHT + cornerRadius });
  path.push({ x: HALF_WIDTH, y: HALF_HEIGHT - cornerRadius });

  // Bottom-right corner arc (start corner)
  for (let i = 0; i <= pointsPerCorner; i++) {
    const angle = 0 + (Math.PI / 2) * (i / pointsPerCorner);
    path.push({
      x: HALF_WIDTH - cornerRadius + cornerRadius * Math.cos(angle),
      y: HALF_HEIGHT - cornerRadius + cornerRadius * Math.sin(angle),
    });
  }

  // Close the loop
  path.push({ x: HALF_WIDTH - cornerRadius, y: HALF_HEIGHT });

  return path;
}
