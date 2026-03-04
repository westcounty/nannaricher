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
export const METRO_BOARD_WIDTH = 1400;
export const METRO_BOARD_HEIGHT = 1200;

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
// Branch line stations — compact but readable
export const LINE_STATION_SIZE = 50;
export const LINE_STATION_HEIGHT = 60;
export const EXP_STATION_SIZE = 60;
export const EXP_STATION_HEIGHT = 70;

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
// Branch Line Snake Layout
// ============================================

// Snake layout parameters
const SNAKE_COLS = 4;           // max stations per row
const SNAKE_STATION_GAP = 62;   // distance between stations in a row
const SNAKE_ROW_GAP = 70;       // distance between rows
const SNAKE_FIRST_OFFSET = 55;  // offset from ring to first row

/**
 * For a branch line, compute the outward direction and the row direction
 * based on which side of the ring the entry station is on.
 *
 * Row direction matches the ring travel direction so the snake extends
 * "along" the ring edge, and outward direction goes away from center.
 */
function getSnakeDirections(side: number): { outDir: Point; rowDir: Point } {
  switch (side) {
    case 0: return { outDir: { x: 0, y: +1 }, rowDir: { x: -1, y: 0 } }; // bottom → down, rows go left
    case 1: return { outDir: { x: -1, y: 0 }, rowDir: { x: 0, y: -1 } }; // left → left, rows go up
    case 2: return { outDir: { x: 0, y: -1 }, rowDir: { x: +1, y: 0 } }; // top → up, rows go right
    case 3: return { outDir: { x: +1, y: 0 }, rowDir: { x: 0, y: +1 } }; // right → right, rows go down
    default: return { outDir: { x: 0, y: +1 }, rowDir: { x: -1, y: 0 } };
  }
}

/**
 * Build the full snake path for a branch line.
 *
 * The snake starts at the entry station, extends outward, folds back and forth,
 * and the last station ends up near the exit station.
 *
 * Layout example (pukou, 12 stations, bottom side, entry=4, exit=5):
 *
 *   主线: ... [entry=4] [exit=5] ...
 *                |          ↑
 *          ① ── ② ── ③ ── ④     (row 0: extends from entry, going in rowDir)
 *                              |
 *          ⑧ ── ⑦ ── ⑥ ── ⑤     (row 1: folds back in -rowDir)
 *          |
 *          ⑨ ── ⑩ ── ⑪ ── ⑫     (row 2: folds again, ends near exit column)
 *                              ↑
 *                         back to exit
 *
 * Key: row 0 starts aligned with entry, and the snake folds such that
 * the last station is near the exit column. This is achieved by choosing
 * the row direction and fold pattern based on the relative positions of
 * entry and exit.
 */
function buildSnakePositions(
  entryPos: Point,
  _exitPos: Point,
  cellCount: number,
  outDir: Point,
  rowDir: Point,
): Point[] {
  const positions: Point[] = [];
  const cols = Math.min(SNAKE_COLS, cellCount);

  // Row 0 starts from entry, extending in rowDir
  // The first station is offset outward from entry
  const row0Start: Point = {
    x: entryPos.x + outDir.x * SNAKE_FIRST_OFFSET,
    y: entryPos.y + outDir.y * SNAKE_FIRST_OFFSET,
  };

  for (let i = 0; i < cellCount; i++) {
    const row = Math.floor(i / cols);
    const posInRow = i % cols;
    const colsInRow = Math.min(cols, cellCount - row * cols);

    // Even rows: go in rowDir from entry side
    // Odd rows: go in -rowDir (fold back)
    let col: number;
    if (row % 2 === 0) {
      col = posInRow;
    } else {
      col = colsInRow - 1 - posInRow;
    }

    positions.push({
      x: row0Start.x + outDir.x * row * SNAKE_ROW_GAP + rowDir.x * col * SNAKE_STATION_GAP,
      y: row0Start.y + outDir.y * row * SNAKE_ROW_GAP + rowDir.y * col * SNAKE_STATION_GAP,
    });
  }

  return positions;
}

// Cache for snake positions per line (computed once)
const snakeCache = new Map<string, Point[]>();

function getOrBuildSnake(lineId: string): Point[] {
  if (snakeCache.has(lineId)) return snakeCache.get(lineId)!;

  const line = LINE_CONFIGS.find(l => l.id === lineId);
  if (!line) return [];

  const exitIndex = LINE_EXIT_MAP[lineId];
  if (exitIndex === undefined) return [];

  const entryPos = getMainStationPosition(line.entryIndex);
  const exitPos = getMainStationPosition(exitIndex);
  const side = Math.floor(line.entryIndex / CELLS_PER_SIDE);
  const { outDir, rowDir } = getSnakeDirections(side);

  const positions = buildSnakePositions(entryPos, exitPos, line.cellCount, outDir, rowDir);
  snakeCache.set(lineId, positions);
  return positions;
}

/**
 * Get the position of a station along a branch line.
 * Uses snake/zigzag layout: stations arranged in rows that fold back,
 * extending outward from the main ring.
 * cellIndex is 0-based.
 */
export function getLineStationPosition(lineId: string, cellIndex: number): Point {
  const positions = getOrBuildSnake(lineId);
  if (cellIndex < 0 || cellIndex >= positions.length) return { x: 0, y: 0 };
  return positions[cellIndex];
}

/**
 * Get the track path for a branch line as a polyline through all station positions,
 * with entry and exit connection points.
 * Returns array of Points: [entryPos, station0, station1, ..., stationN-1, exitPos]
 */
export function getLineTrackPath(lineId: string): Point[] {
  const line = LINE_CONFIGS.find(l => l.id === lineId);
  if (!line) return [];

  const exitIndex = LINE_EXIT_MAP[lineId];
  if (exitIndex === undefined) return [];

  const entryPos = getMainStationPosition(line.entryIndex);
  const exitPos = getMainStationPosition(exitIndex);
  const positions = getOrBuildSnake(lineId);

  return [entryPos, ...positions, exitPos];
}

/**
 * @deprecated Use getLineTrackPath() instead for snake layout.
 * Kept for backward compatibility with tests and line name label positioning.
 */
export function getLineBezierConfig(lineId: string): BezierConfig | undefined {
  const line = LINE_CONFIGS.find(l => l.id === lineId);
  if (!line) return undefined;

  const exitIndex = LINE_EXIT_MAP[lineId];
  if (exitIndex === undefined) return undefined;

  const entryPos = getMainStationPosition(line.entryIndex);
  const exitPos = getMainStationPosition(exitIndex);
  const side = Math.floor(line.entryIndex / CELLS_PER_SIDE);
  const { outDir } = getSnakeDirections(side);

  const rows = Math.ceil(line.cellCount / SNAKE_COLS);
  const depth = SNAKE_FIRST_OFFSET + (rows - 1) * SNAKE_ROW_GAP;

  const cp1: Point = {
    x: entryPos.x + outDir.x * depth,
    y: entryPos.y + outDir.y * depth,
  };
  const cp2: Point = {
    x: exitPos.x + outDir.x * depth,
    y: exitPos.y + outDir.y * depth,
  };

  return { start: entryPos, cp1, cp2, end: exitPos };
}

// ============================================
// Smooth Path for Branch Tracks
// ============================================

export interface PathSegment {
  type: 'line' | 'quadratic';
  x: number;
  y: number;
  cpx?: number; // control point for quadratic
  cpy?: number;
}

/**
 * Check if the path makes a sharp turn (> 120 degrees) at the middle point.
 * Used to detect fold/reversal points in the snake layout.
 */
function isDirectionReversal(prev: Point, curr: Point, next: Point): boolean {
  const dx1 = curr.x - prev.x;
  const dy1 = curr.y - prev.y;
  const dx2 = next.x - curr.x;
  const dy2 = next.y - curr.y;
  // Dot product of direction vectors
  const dot = dx1 * dx2 + dy1 * dy2;
  const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
  if (mag1 === 0 || mag2 === 0) return false;
  const cosAngle = dot / (mag1 * mag2);
  // Direction reversal if angle > ~120 degrees (cos < -0.5)
  return cosAngle < -0.5;
}

/**
 * Generate a smooth path for branch track rendering.
 * At fold points (where the snake reverses direction), uses quadratic curves
 * to create smooth U-turns instead of sharp V-shaped zigzags.
 * Returns an array of PathSegments starting with the first point.
 */
export function getLineSmoothPath(lineId: string): PathSegment[] {
  const trackPath = getLineTrackPath(lineId);
  if (trackPath.length < 3) return trackPath.map(p => ({ type: 'line' as const, x: p.x, y: p.y }));

  const segments: PathSegment[] = [{ type: 'line', x: trackPath[0].x, y: trackPath[0].y }];

  for (let i = 1; i < trackPath.length - 1; i++) {
    const prev = trackPath[i - 1];
    const curr = trackPath[i];
    const next = trackPath[i + 1];

    if (isDirectionReversal(prev, curr, next)) {
      // At fold point: use quadratic curve to create smooth U-turn
      // Skip the current point as vertex, use it as control point
      segments.push({
        type: 'quadratic',
        x: next.x,  // curve to next point
        y: next.y,
        cpx: curr.x, // using the fold vertex as control point
        cpy: curr.y,
      });
      i++; // skip next point since we already included it
    } else {
      segments.push({ type: 'line', x: curr.x, y: curr.y });
    }
  }

  // Add last point if not already included
  const last = trackPath[trackPath.length - 1];
  const lastSeg = segments[segments.length - 1];
  if (lastSeg.x !== last.x || lastSeg.y !== last.y) {
    segments.push({ type: 'line', x: last.x, y: last.y });
  }

  return segments;
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
