// client/src/game/layout/MetroLayout.ts
// Pure math module for metro-style board layout.
// No PixiJS imports — only math and design tokens for colors.

import {
  CORNER_INDICES,
  CELLS_PER_SIDE,
  LINE_CONFIGS,
  LINE_EXIT_MAP,
  MAIN_BOARD_CELLS,
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
export const METRO_BOARD_WIDTH = 1200;
export const METRO_BOARD_HEIGHT = 1000;

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
export const LINE_STATION_SIZE = 50;
export const LINE_STATION_HEIGHT = 60;
export const EXP_STATION_SIZE = 65;
export const EXP_STATION_HEIGHT = 75;

// Track widths — used by TrackLayer
export const MAIN_TRACK_WIDTH = 6;
export const LINE_TRACK_WIDTH = 4;

// ============================================
// Ring Geometry Constants
// ============================================
const HALF_WIDTH = 440;   // half-width of rounded rect ring
const HALF_HEIGHT = 380;  // half-height of rounded rect ring

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

  // Regular cells: 6 per side, evenly distributed between corners
  const cellSpacing = (CELLS_PER_SIDE - 1);
  // posInSide goes from 1 to 6
  // fraction: 1/6 to 6/6 — progress from first corner toward next corner
  const fraction = posInSide / cellSpacing;

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
 * Uses Gaussian quadrature with a subdivision approach for accuracy.
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

/**
 * Build an arc-length parameterization lookup table for a bezier curve.
 * Returns an array of { t, len } where len is cumulative arc length at parameter t.
 */
function buildArcLengthTable(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  segments = 64,
): { t: number; len: number }[] {
  const table: { t: number; len: number }[] = [{ t: 0, len: 0 }];
  let totalLen = 0;
  let prev = p0;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const curr = getBezierPoint(t, p0, p1, p2, p3);
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    totalLen += Math.sqrt(dx * dx + dy * dy);
    table.push({ t, len: totalLen });
    prev = curr;
  }
  return table;
}

/**
 * Given a target arc length, find the parameter t using the lookup table.
 * Uses binary search + linear interpolation.
 */
function tAtArcLength(
  targetLen: number,
  table: { t: number; len: number }[],
): number {
  const totalLen = table[table.length - 1].len;
  if (targetLen <= 0) return 0;
  if (targetLen >= totalLen) return 1;

  // Binary search
  let lo = 0;
  let hi = table.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid].len < targetLen) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Linear interpolation between lo and hi
  const segLen = table[hi].len - table[lo].len;
  if (segLen < 1e-10) return table[lo].t;
  const frac = (targetLen - table[lo].len) / segLen;
  return table[lo].t + frac * (table[hi].t - table[lo].t);
}

// ============================================
// Branch Line Bezier Configs
// ============================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get the bezier curve configuration for a branch line.
 * The curve arcs outward from the ring:
 *   bottom side lines arc downward (+y)
 *   left side lines arc leftward (-x)
 *   top side lines arc upward (-y)
 *   right side lines arc rightward (+x)
 */
export function getLineBezierConfig(lineId: string): BezierConfig | undefined {
  const line = LINE_CONFIGS.find(l => l.id === lineId);
  if (!line) return undefined;

  const exitIndex = LINE_EXIT_MAP[lineId];
  if (exitIndex === undefined) return undefined;

  const entryPos = getMainStationPosition(line.entryIndex);
  const exitPos = getMainStationPosition(exitIndex);

  // Arc depth proportional to cell count
  const depth = clamp(line.cellCount * 25, 100, 350);

  // Determine arc direction based on which side of the ring
  const side = Math.floor(line.entryIndex / CELLS_PER_SIDE);

  let cp1: Point;
  let cp2: Point;

  switch (side) {
    case 0: // Bottom side -> arc downward (+y)
      cp1 = { x: entryPos.x, y: entryPos.y + depth };
      cp2 = { x: exitPos.x, y: exitPos.y + depth };
      break;
    case 1: // Left side -> arc leftward (-x)
      cp1 = { x: entryPos.x - depth, y: entryPos.y };
      cp2 = { x: exitPos.x - depth, y: exitPos.y };
      break;
    case 2: // Top side -> arc upward (-y)
      cp1 = { x: entryPos.x, y: entryPos.y - depth };
      cp2 = { x: exitPos.x, y: exitPos.y - depth };
      break;
    case 3: // Right side -> arc rightward (+x)
      cp1 = { x: entryPos.x + depth, y: entryPos.y };
      cp2 = { x: exitPos.x + depth, y: exitPos.y };
      break;
    default:
      cp1 = entryPos;
      cp2 = exitPos;
  }

  return {
    start: { x: entryPos.x, y: entryPos.y },
    cp1,
    cp2,
    end: { x: exitPos.x, y: exitPos.y },
  };
}

// ============================================
// Branch Station Positions
// ============================================

/**
 * Get the position of a station along a branch line bezier curve.
 * Stations are evenly distributed by arc length (not by parameter t).
 * cellIndex is 0-based.
 */
export function getLineStationPosition(lineId: string, cellIndex: number): Point {
  const config = getLineBezierConfig(lineId);
  if (!config) return { x: 0, y: 0 };

  const line = LINE_CONFIGS.find(l => l.id === lineId);
  if (!line) return { x: 0, y: 0 };

  const { start, cp1, cp2, end } = config;
  const table = buildArcLengthTable(start, cp1, cp2, end);
  const totalLen = table[table.length - 1].len;

  // Distribute cellCount stations evenly along the arc.
  // Station 0 is near entry (but not at entry — offset inward),
  // Station (cellCount-1) is near exit.
  // We place them at equal arc-length intervals across the full arc.
  const numStations = line.cellCount;
  const segmentLen = totalLen / (numStations + 1);
  const targetLen = segmentLen * (cellIndex + 1);

  const t = tAtArcLength(targetLen, table);
  return getBezierPoint(t, start, cp1, cp2, end);
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
// Ring Path
// ============================================

/**
 * Get the ring path as an array of points for track rendering.
 * Returns a closed loop following the rounded rectangle with enough
 * resolution for smooth curves at the corners.
 */
export function getRingPath(pointsPerCorner = 8): Point[] {
  const path: Point[] = [];

  // Straight segments with corner arcs
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
