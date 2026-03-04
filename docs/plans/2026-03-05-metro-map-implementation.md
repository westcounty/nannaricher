# Metro Map Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current 700×700 square-ring board with a 1200×1000 metro route map featuring bezier-curved branch lines, commercial-grade visual effects, and station illustration support.

**Architecture:** Pure math coordinate module (`MetroLayout.ts`) provides all positions. New rendering layers (`TrackLayer`, `StationLayer`, `MetroBackgroundLayer`) replace the old `BoardLayer`, `LineLayer`, `BackgroundLayer`. The `PlayerLayer` is updated to use the new coordinate API. The `GameStage` resize logic is updated for the new canvas size.

**Tech Stack:** PixiJS v8 (Graphics API v8 style), TypeScript strict mode, Vitest for unit tests

**Design doc:** `docs/plans/2026-03-05-metro-map-design.md`

---

## Phase 1: Coordinate Foundation

### Task 1: Create MetroLayout coordinate module with tests

This is the most critical file — all rendering depends on it. Pure math, no PixiJS imports, fully testable.

**Files:**
- Create: `client/src/game/layout/MetroLayout.ts`
- Create: `client/src/game/layout/__tests__/MetroLayout.test.ts`

**Step 1: Write failing tests for core functions**

```typescript
// client/src/game/layout/__tests__/MetroLayout.test.ts
import { describe, it, expect } from 'vitest';
import {
  METRO_BOARD_WIDTH,
  METRO_BOARD_HEIGHT,
  getMainStationPosition,
  getLineStationPosition,
  getBezierPoint,
  getLineBezierConfig,
} from '../MetroLayout';
import { MAIN_BOARD_CELLS, LINE_CONFIGS, LINE_EXIT_MAP } from '@nannaricher/shared';

describe('MetroLayout', () => {
  describe('constants', () => {
    it('should define board dimensions', () => {
      expect(METRO_BOARD_WIDTH).toBe(1200);
      expect(METRO_BOARD_HEIGHT).toBe(1000);
    });
  });

  describe('getMainStationPosition', () => {
    it('should return position for all 28 main stations', () => {
      for (let i = 0; i < 28; i++) {
        const pos = getMainStationPosition(i);
        expect(pos).toBeDefined();
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.y).toBe('number');
        // All positions should be within board bounds (center-relative)
        expect(Math.abs(pos.x)).toBeLessThanOrEqual(METRO_BOARD_WIDTH / 2);
        expect(Math.abs(pos.y)).toBeLessThanOrEqual(METRO_BOARD_HEIGHT / 2);
      }
    });

    it('should place corner stations at the 4 corners of the rounded rect', () => {
      const start = getMainStationPosition(0);       // bottom-right
      const hospital = getMainStationPosition(7);     // bottom-left
      const ding = getMainStationPosition(14);        // top-left
      const waitingRoom = getMainStationPosition(21); // top-right

      // Corners should be at extremes
      expect(start.x).toBeGreaterThan(0);
      expect(start.y).toBeGreaterThan(0);
      expect(hospital.x).toBeLessThan(0);
      expect(hospital.y).toBeGreaterThan(0);
      expect(ding.x).toBeLessThan(0);
      expect(ding.y).toBeLessThan(0);
      expect(waitingRoom.x).toBeGreaterThan(0);
      expect(waitingRoom.y).toBeLessThan(0);
    });

    it('should place bottom-side stations with decreasing x (right to left)', () => {
      // Bottom side: indices 0-6
      for (let i = 0; i < 6; i++) {
        const current = getMainStationPosition(i);
        const next = getMainStationPosition(i + 1);
        expect(current.x).toBeGreaterThan(next.x);
      }
    });

    it('should space stations roughly evenly along each side', () => {
      // Check left side (indices 7-13, bottom to top → y decreases)
      const spacings: number[] = [];
      for (let i = 7; i < 13; i++) {
        const a = getMainStationPosition(i);
        const b = getMainStationPosition(i + 1);
        spacings.push(Math.abs(a.y - b.y));
      }
      const avgSpacing = spacings.reduce((s, v) => s + v, 0) / spacings.length;
      for (const s of spacings) {
        expect(s).toBeGreaterThan(avgSpacing * 0.5); // within 50% tolerance
        expect(s).toBeLessThan(avgSpacing * 1.5);
      }
    });
  });

  describe('getBezierPoint', () => {
    it('should return start point at t=0', () => {
      const p = getBezierPoint(0, 0, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 });
      expect(p.x).toBeCloseTo(0, 1);
      expect(p.y).toBeCloseTo(0, 1);
    });

    it('should return end point at t=1', () => {
      const p = getBezierPoint(1, 0, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 });
      expect(p.x).toBeCloseTo(100, 1);
      expect(p.y).toBeCloseTo(100, 1);
    });

    it('should return midpoint roughly between control points at t=0.5', () => {
      const p = getBezierPoint(0.5, 0, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 });
      expect(p.x).toBeGreaterThan(20);
      expect(p.x).toBeLessThan(80);
      expect(p.y).toBeGreaterThan(20);
      expect(p.y).toBeLessThan(80);
    });
  });

  describe('getLineBezierConfig', () => {
    it('should return bezier config for all 8 lines', () => {
      for (const line of LINE_CONFIGS) {
        const config = getLineBezierConfig(line.id);
        expect(config).toBeDefined();
        expect(config.start).toBeDefined();
        expect(config.end).toBeDefined();
        expect(config.cp1).toBeDefined();
        expect(config.cp2).toBeDefined();
        // Start should match entry station position
        const entryPos = getMainStationPosition(line.entryIndex);
        expect(config.start.x).toBeCloseTo(entryPos.x, 0);
        expect(config.start.y).toBeCloseTo(entryPos.y, 0);
        // End should match exit station position
        const exitIndex = LINE_EXIT_MAP[line.id];
        const exitPos = getMainStationPosition(exitIndex);
        expect(config.end.x).toBeCloseTo(exitPos.x, 0);
        expect(config.end.y).toBeCloseTo(exitPos.y, 0);
      }
    });

    it('should curve bottom lines downward (positive y control points)', () => {
      const pukou = getLineBezierConfig('pukou');
      // Control points should have larger y than start/end (curve downward)
      expect(pukou.cp1.y).toBeGreaterThan(pukou.start.y);
      expect(pukou.cp2.y).toBeGreaterThan(pukou.end.y);
    });
  });

  describe('getLineStationPosition', () => {
    it('should return positions for all cells in a line', () => {
      for (const line of LINE_CONFIGS) {
        // cellCount includes experience card
        for (let i = 0; i < line.cellCount; i++) {
          const pos = getLineStationPosition(line.id, i);
          expect(pos).toBeDefined();
          expect(typeof pos.x).toBe('number');
          expect(typeof pos.y).toBe('number');
        }
      }
    });

    it('should place first station near the entry point', () => {
      const pukou = LINE_CONFIGS.find(l => l.id === 'pukou')!;
      const entryPos = getMainStationPosition(pukou.entryIndex);
      const firstStation = getLineStationPosition('pukou', 0);
      const dist = Math.sqrt(
        (firstStation.x - entryPos.x) ** 2 + (firstStation.y - entryPos.y) ** 2,
      );
      // First station should be close to entry (within reasonable distance)
      expect(dist).toBeLessThan(200);
    });

    it('should place last station near the exit point', () => {
      const pukou = LINE_CONFIGS.find(l => l.id === 'pukou')!;
      const exitIndex = LINE_EXIT_MAP['pukou'];
      const exitPos = getMainStationPosition(exitIndex);
      const lastStation = getLineStationPosition('pukou', pukou.cellCount - 1);
      const dist = Math.sqrt(
        (lastStation.x - exitPos.x) ** 2 + (lastStation.y - exitPos.y) ** 2,
      );
      expect(dist).toBeLessThan(200);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd client && npx vitest run src/game/layout/__tests__/MetroLayout.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement MetroLayout.ts**

```typescript
// client/src/game/layout/MetroLayout.ts
// Pure math coordinate module for metro-style board layout.
// No PixiJS dependencies — only math. Fully testable.

import {
  CORNER_INDICES,
  CELLS_PER_SIDE,
  LINE_CONFIGS,
  LINE_EXIT_MAP,
  type LineConfig,
} from '@nannaricher/shared';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';

// ============================================
// Board Dimensions
// ============================================
export const METRO_BOARD_WIDTH = 1200;
export const METRO_BOARD_HEIGHT = 1000;

// Main ring: rounded rectangle inscribed with some margin
const RING_MARGIN_X = 160; // horizontal margin from board edge
const RING_MARGIN_Y = 120; // vertical margin from board edge

// Half-extents of the rounded rectangle (from center)
const RING_HALF_W = METRO_BOARD_WIDTH / 2 - RING_MARGIN_X;  // ~440
const RING_HALF_H = METRO_BOARD_HEIGHT / 2 - RING_MARGIN_Y; // ~380
const CORNER_RADIUS = 80; // rounded corners of the ring

// Station sizes
export const MAIN_STATION_SIZE = 80;     // main ring station card width
export const MAIN_STATION_HEIGHT = 100;  // main ring station card height
export const CORNER_STATION_SIZE = 120;  // corner station card width
export const CORNER_STATION_HEIGHT = 140;
export const LINE_STATION_SIZE = 50;     // branch line station width
export const LINE_STATION_HEIGHT = 60;
export const EXP_STATION_SIZE = 65;      // experience card station width
export const EXP_STATION_HEIGHT = 75;

// Track widths
export const MAIN_TRACK_WIDTH = 6;
export const LINE_TRACK_WIDTH = 4;

// Branch line arc depth scaling
const ARC_DEPTH_PER_CELL = 25; // how far each cell pushes the arc outward
const ARC_MIN_DEPTH = 100;
const ARC_MAX_DEPTH = 350;

// ============================================
// Point type
// ============================================
export interface Point {
  x: number;
  y: number;
}

// ============================================
// Main Ring Station Positions
// ============================================

/**
 * Calculate the (x, y) position of a main board station.
 * Coordinates are center-relative (0,0 = board center).
 *
 * The main ring is a rounded rectangle with 4 sides:
 *   Bottom (0-6):   right to left
 *   Left (7-13):    bottom to top
 *   Top (14-20):    left to right
 *   Right (21-27):  top to bottom
 */
export function getMainStationPosition(index: number): Point {
  const side = Math.floor(index / CELLS_PER_SIDE);
  const posInSide = index % CELLS_PER_SIDE;

  // Corner stations at each rounded corner
  if (posInSide === 0) {
    switch (side) {
      case 0: return { x: RING_HALF_W, y: RING_HALF_H };         // bottom-right (start)
      case 1: return { x: -RING_HALF_W, y: RING_HALF_H };        // bottom-left (hospital)
      case 2: return { x: -RING_HALF_W, y: -RING_HALF_H };       // top-left (ding)
      case 3: return { x: RING_HALF_W, y: -RING_HALF_H };        // top-right (waiting_room)
    }
  }

  // Regular stations: 6 per side, evenly spaced between corners
  // t goes from ~0 to ~1 across the side (excluding corners)
  const stationsPerSide = CELLS_PER_SIDE - 1; // 6 regular stations
  const t = posInSide / stationsPerSide; // 1/6, 2/6, ... 6/6

  switch (side) {
    case 0: // Bottom: right to left, y = +RING_HALF_H
      return {
        x: RING_HALF_W - t * (2 * RING_HALF_W),
        y: RING_HALF_H,
      };
    case 1: // Left: bottom to top, x = -RING_HALF_W
      return {
        x: -RING_HALF_W,
        y: RING_HALF_H - t * (2 * RING_HALF_H),
      };
    case 2: // Top: left to right, y = -RING_HALF_H
      return {
        x: -RING_HALF_W + t * (2 * RING_HALF_W),
        y: -RING_HALF_H,
      };
    case 3: // Right: top to bottom, x = +RING_HALF_W
      return {
        x: RING_HALF_W,
        y: -RING_HALF_H + t * (2 * RING_HALF_H),
      };
  }

  return { x: 0, y: 0 };
}

// ============================================
// Cubic Bezier Curve Utilities
// ============================================

/**
 * Evaluate a cubic Bezier curve at parameter t ∈ [0, 1].
 * P(t) = (1-t)³·P0 + 3(1-t)²t·P1 + 3(1-t)t²·P2 + t³·P3
 */
export function getBezierPoint(
  t: number,
  p0: number | Point,
  p1: Point,
  p2: Point,
  p3: Point,
): Point {
  // Handle overload: if p0 is a number, it's x=p0,y=0 (shouldn't happen in practice)
  const start: Point = typeof p0 === 'number' ? { x: p0, y: 0 } : p0;
  const u = 1 - t;
  return {
    x: u * u * u * start.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * start.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/**
 * Approximate the arc length of a cubic Bezier by sampling N segments.
 */
export function bezierArcLength(p0: Point, p1: Point, p2: Point, p3: Point, samples = 64): number {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const cur = getBezierPoint(t, p0, p1, p2, p3);
    length += Math.sqrt((cur.x - prev.x) ** 2 + (cur.y - prev.y) ** 2);
    prev = cur;
  }
  return length;
}

/**
 * Find the parameter t that corresponds to a given arc-length fraction.
 * Uses binary search for accuracy.
 */
function tAtArcFraction(
  fraction: number,
  p0: Point, p1: Point, p2: Point, p3: Point,
  totalLength: number,
  samples = 64,
): number {
  const targetLen = fraction * totalLength;
  let accLen = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const cur = getBezierPoint(t, p0, p1, p2, p3);
    const segLen = Math.sqrt((cur.x - prev.x) ** 2 + (cur.y - prev.y) ** 2);
    if (accLen + segLen >= targetLen) {
      // Interpolate within this segment
      const overshoot = targetLen - accLen;
      const frac = overshoot / segLen;
      return (i - 1 + frac) / samples;
    }
    accLen += segLen;
    prev = cur;
  }
  return 1;
}

// ============================================
// Branch Line Bezier Configuration
// ============================================

export interface BezierConfig {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
}

/**
 * Get the bezier curve config for a branch line.
 * The curve goes from the entry station outward in an arc,
 * then curves back to the exit station.
 */
export function getLineBezierConfig(lineId: string): BezierConfig {
  const line = LINE_CONFIGS.find(l => l.id === lineId);
  if (!line) return { start: { x: 0, y: 0 }, cp1: { x: 0, y: 0 }, cp2: { x: 0, y: 0 }, end: { x: 0, y: 0 } };

  const entryPos = getMainStationPosition(line.entryIndex);
  const exitIndex = LINE_EXIT_MAP[line.id];
  const exitPos = getMainStationPosition(exitIndex);

  // Arc depth proportional to cell count
  const depth = Math.min(ARC_MAX_DEPTH, Math.max(ARC_MIN_DEPTH, line.cellCount * ARC_DEPTH_PER_CELL));

  // Determine arc direction based on which side of the ring the line is on
  const side = Math.floor(line.entryIndex / CELLS_PER_SIDE);

  // Midpoint between entry and exit
  const midX = (entryPos.x + exitPos.x) / 2;
  const midY = (entryPos.y + exitPos.y) / 2;

  let cp1: Point;
  let cp2: Point;

  switch (side) {
    case 0: // Bottom side → arc downward (+y)
      cp1 = { x: entryPos.x, y: entryPos.y + depth };
      cp2 = { x: exitPos.x, y: exitPos.y + depth };
      break;
    case 1: // Left side → arc leftward (-x)
      cp1 = { x: entryPos.x - depth, y: entryPos.y };
      cp2 = { x: exitPos.x - depth, y: exitPos.y };
      break;
    case 2: // Top side → arc upward (-y)
      cp1 = { x: entryPos.x, y: entryPos.y - depth };
      cp2 = { x: exitPos.x, y: exitPos.y - depth };
      break;
    case 3: // Right side → arc rightward (+x)
      cp1 = { x: entryPos.x + depth, y: entryPos.y };
      cp2 = { x: exitPos.x + depth, y: exitPos.y };
      break;
    default:
      cp1 = { x: midX, y: midY };
      cp2 = { x: midX, y: midY };
  }

  return { start: entryPos, cp1, cp2, end: exitPos };
}

/**
 * Get the position of a station within a branch line.
 * Stations are evenly distributed along the bezier curve arc length.
 */
export function getLineStationPosition(lineId: string, cellIndex: number): Point {
  const line = LINE_CONFIGS.find(l => l.id === lineId);
  if (!line) return { x: 0, y: 0 };

  const bezier = getLineBezierConfig(lineId);
  const totalLength = bezierArcLength(bezier.start, bezier.cp1, bezier.cp2, bezier.end);

  // Distribute cellCount stations evenly along the curve
  // t goes from a small offset (not 0 = entry station) to near 1 (not 1 = exit station)
  const padding = 0.05; // avoid overlap with entry/exit stations
  const range = 1 - 2 * padding;
  const fraction = padding + (cellIndex / (line.cellCount - 1)) * range;

  const t = tAtArcFraction(fraction, bezier.start, bezier.cp1, bezier.cp2, bezier.end, totalLength);
  return getBezierPoint(t, bezier.start, bezier.cp1, bezier.cp2, bezier.end);
}

// ============================================
// Color Helpers (re-exported for rendering layers)
// ============================================

export function getStationColor(cellId: string, cellType: string, index: number): number {
  const ct = DESIGN_TOKENS.color.cell;
  if (CORNER_INDICES.includes(index)) {
    switch (cellId) {
      case 'start': return hexToPixi(ct.corner.start[1]);
      case 'hospital': return hexToPixi(ct.corner.hospital[1]);
      case 'ding': return hexToPixi(ct.corner.ding[1]);
      case 'waiting_room': return hexToPixi(ct.corner.waitingRoom[1]);
    }
  }
  switch (cellType) {
    case 'event': return hexToPixi(ct.event[1]);
    case 'chance': return hexToPixi(ct.chance[1]);
    case 'line_entry': return 0x78909C; // default, overridden by line color
  }
  return 0xffffff;
}

export function getStationColorDark(cellId: string, cellType: string, index: number): number {
  const ct = DESIGN_TOKENS.color.cell;
  if (CORNER_INDICES.includes(index)) {
    switch (cellId) {
      case 'start': return hexToPixi(ct.corner.start[0]);
      case 'hospital': return hexToPixi(ct.corner.hospital[0]);
      case 'ding': return hexToPixi(ct.corner.ding[0]);
      case 'waiting_room': return hexToPixi(ct.corner.waitingRoom[0]);
    }
  }
  switch (cellType) {
    case 'event': return hexToPixi(ct.event[0]);
    case 'chance': return hexToPixi(ct.chance[0]);
    case 'line_entry': return 0x455A64;
  }
  return 0xcccccc;
}

export function getLineThemeColor(lineId: string): number {
  const ct = DESIGN_TOKENS.color.cell.lineEntry;
  const key = lineId as keyof typeof ct;
  if (key in ct) return hexToPixi(ct[key][1]);
  return hexToPixi(ct.pukou[1]);
}

export function getLineThemeColorDark(lineId: string): number {
  const ct = DESIGN_TOKENS.color.cell.lineEntry;
  const key = lineId as keyof typeof ct;
  if (key in ct) return hexToPixi(ct[key][0]);
  return hexToPixi(ct.pukou[0]);
}

// ============================================
// Ring Path (for track rendering)
// ============================================

/**
 * Generate points along the rounded rectangle ring for track rendering.
 * Returns an array of points tracing the full ring path.
 */
export function getRingPath(segments = 200): Point[] {
  const points: Point[] = [];
  // Perimeter: 4 straight sides + 4 quarter-circle corners
  // We parameterize the full ring from 0 to 1

  const straightH = 2 * RING_HALF_W - 2 * CORNER_RADIUS; // horizontal straight length
  const straightV = 2 * RING_HALF_H - 2 * CORNER_RADIUS; // vertical straight length
  const arcLen = (Math.PI / 2) * CORNER_RADIUS;           // quarter circle arc length
  const perimeter = 2 * straightH + 2 * straightV + 4 * arcLen;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const dist = t * perimeter;
    const p = pointOnRoundedRect(dist, perimeter, straightH, straightV, arcLen);
    points.push(p);
  }

  return points;
}

function pointOnRoundedRect(
  dist: number,
  _perimeter: number,
  straightH: number,
  straightV: number,
  arcLen: number,
): Point {
  let remaining = dist;

  // Start at bottom-right corner, go counterclockwise
  // Segment order (matching station traversal): bottom(R→L), BL-corner, left(B→T), TL-corner, top(L→R), TR-corner, right(T→B), BR-corner

  // 1. Bottom straight (right to left)
  if (remaining <= straightH) {
    return {
      x: RING_HALF_W - CORNER_RADIUS - remaining,
      y: RING_HALF_H,
    };
  }
  remaining -= straightH;

  // 2. Bottom-left corner arc
  if (remaining <= arcLen) {
    const angle = (remaining / arcLen) * (Math.PI / 2); // 0 to π/2
    return {
      x: -RING_HALF_W + CORNER_RADIUS - CORNER_RADIUS * Math.cos(angle),
      y: RING_HALF_H - CORNER_RADIUS + CORNER_RADIUS * Math.cos(Math.PI / 2 - angle),
    };
  }
  remaining -= arcLen;

  // 3. Left straight (bottom to top)
  if (remaining <= straightV) {
    return {
      x: -RING_HALF_W,
      y: RING_HALF_H - CORNER_RADIUS - remaining,
    };
  }
  remaining -= straightV;

  // 4. Top-left corner arc
  if (remaining <= arcLen) {
    const angle = (remaining / arcLen) * (Math.PI / 2);
    return {
      x: -RING_HALF_W + CORNER_RADIUS - CORNER_RADIUS * Math.cos(angle),
      y: -RING_HALF_H + CORNER_RADIUS - CORNER_RADIUS * Math.sin(angle),
    };
  }
  remaining -= arcLen;

  // 5. Top straight (left to right)
  if (remaining <= straightH) {
    return {
      x: -RING_HALF_W + CORNER_RADIUS + remaining,
      y: -RING_HALF_H,
    };
  }
  remaining -= straightH;

  // 6. Top-right corner arc
  if (remaining <= arcLen) {
    const angle = (remaining / arcLen) * (Math.PI / 2);
    return {
      x: RING_HALF_W - CORNER_RADIUS + CORNER_RADIUS * Math.sin(angle),
      y: -RING_HALF_H + CORNER_RADIUS - CORNER_RADIUS * Math.cos(angle),
    };
  }
  remaining -= arcLen;

  // 7. Right straight (top to bottom)
  if (remaining <= straightV) {
    return {
      x: RING_HALF_W,
      y: -RING_HALF_H + CORNER_RADIUS + remaining,
    };
  }
  remaining -= straightV;

  // 8. Bottom-right corner arc (closes the ring)
  if (remaining <= arcLen) {
    const angle = (remaining / arcLen) * (Math.PI / 2);
    return {
      x: RING_HALF_W - CORNER_RADIUS + CORNER_RADIUS * Math.cos(angle),
      y: RING_HALF_H - CORNER_RADIUS + CORNER_RADIUS * Math.sin(angle),
    };
  }

  // Shouldn't reach here
  return { x: RING_HALF_W, y: RING_HALF_H };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd client && npx vitest run src/game/layout/__tests__/MetroLayout.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add client/src/game/layout/MetroLayout.ts client/src/game/layout/__tests__/MetroLayout.test.ts
git commit -m "feat(metro): add MetroLayout coordinate module with bezier curves"
```

---

## Phase 2: Track Rendering

### Task 2: Create TrackLayer (main ring + branch bezier tracks)

**Files:**
- Create: `client/src/game/layers/TrackLayer.ts`

**Step 1: Implement TrackLayer**

```typescript
// client/src/game/layers/TrackLayer.ts
// Renders the metro tracks: main ring line + 8 branch bezier curves.
// Multi-layer rendering for premium "neon tube" effect.

import { Container, Graphics } from 'pixi.js';
import type { GameState } from '@nannaricher/shared';
import { LINE_CONFIGS, LINE_EXIT_MAP } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import {
  METRO_BOARD_WIDTH,
  METRO_BOARD_HEIGHT,
  getMainStationPosition,
  getLineBezierConfig,
  getBezierPoint,
  getLineThemeColor,
  getLineThemeColorDark,
  MAIN_TRACK_WIDTH,
  LINE_TRACK_WIDTH,
} from '../layout/MetroLayout';

export class TrackLayer implements RenderLayer {
  private container: Container | null = null;

  init(stage: Container): void {
    this.container = new Container();
    this.container.x = METRO_BOARD_WIDTH / 2;
    this.container.y = METRO_BOARD_HEIGHT / 2;
    stage.addChild(this.container);

    this.drawMainRingTrack();
    this.drawBranchTracks();
  }

  update(_state: GameState, _currentPlayerId: string | null): void {
    // Static layer — no per-frame updates
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

  // ------ Main Ring ------

  private drawMainRingTrack(): void {
    // Layer 1: Glow (wide, semi-transparent)
    const glow = new Graphics();
    this.traceMainRing(glow);
    glow.stroke({ width: MAIN_TRACK_WIDTH + 10, color: 0x4A4A5A, alpha: 0.15 });
    this.container!.addChild(glow);

    // Layer 2: Dark base (thick)
    const base = new Graphics();
    this.traceMainRing(base);
    base.stroke({ width: MAIN_TRACK_WIDTH + 4, color: 0x2A2A3A, alpha: 0.9 });
    this.container!.addChild(base);

    // Layer 3: Main color
    const main = new Graphics();
    this.traceMainRing(main);
    main.stroke({ width: MAIN_TRACK_WIDTH, color: 0x5A5A6A, alpha: 0.9 });
    this.container!.addChild(main);

    // Layer 4: Highlight (thin, offset up)
    const highlight = new Graphics();
    this.traceMainRing(highlight);
    highlight.stroke({ width: 2, color: 0xffffff, alpha: 0.12 });
    this.container!.addChild(highlight);
  }

  private traceMainRing(gfx: Graphics): void {
    // Trace a rounded rectangle ring path connecting all 28 stations
    // We'll draw it as 4 straight segments + 4 rounded corners
    const positions = [];
    for (let i = 0; i < 28; i++) {
      positions.push(getMainStationPosition(i));
    }

    // Draw as a closed path through all stations
    // Bottom side (0→6): right to left
    gfx.moveTo(positions[0].x, positions[0].y);
    for (let i = 1; i <= 6; i++) {
      gfx.lineTo(positions[i].x, positions[i].y);
    }

    // Bottom-left corner to hospital (7)
    gfx.lineTo(positions[7].x, positions[7].y);

    // Left side (7→13)
    for (let i = 8; i <= 13; i++) {
      gfx.lineTo(positions[i].x, positions[i].y);
    }

    // Top-left corner to ding (14)
    gfx.lineTo(positions[14].x, positions[14].y);

    // Top side (14→20)
    for (let i = 15; i <= 20; i++) {
      gfx.lineTo(positions[i].x, positions[i].y);
    }

    // Top-right corner to waiting room (21)
    gfx.lineTo(positions[21].x, positions[21].y);

    // Right side (21→27)
    for (let i = 22; i <= 27; i++) {
      gfx.lineTo(positions[i].x, positions[i].y);
    }

    // Close back to start
    gfx.lineTo(positions[0].x, positions[0].y);
  }

  // ------ Branch Tracks ------

  private drawBranchTracks(): void {
    for (const line of LINE_CONFIGS) {
      const color = getLineThemeColor(line.id);
      const colorDark = getLineThemeColorDark(line.id);
      const bezier = getLineBezierConfig(line.id);

      // Layer 1: Glow
      const glow = new Graphics();
      this.traceBezier(glow, bezier);
      glow.stroke({ width: LINE_TRACK_WIDTH + 6, color, alpha: 0.12 });
      this.container!.addChild(glow);

      // Layer 2: Dark base
      const base = new Graphics();
      this.traceBezier(base, bezier);
      base.stroke({ width: LINE_TRACK_WIDTH + 2, color: colorDark, alpha: 0.8 });
      this.container!.addChild(base);

      // Layer 3: Main color
      const main = new Graphics();
      this.traceBezier(main, bezier);
      main.stroke({ width: LINE_TRACK_WIDTH, color, alpha: 0.9 });
      this.container!.addChild(main);
    }
  }

  private traceBezier(
    gfx: Graphics,
    bezier: { start: { x: number; y: number }; cp1: { x: number; y: number }; cp2: { x: number; y: number }; end: { x: number; y: number } },
  ): void {
    const steps = 60;
    const first = getBezierPoint(0, bezier.start, bezier.cp1, bezier.cp2, bezier.end);
    gfx.moveTo(first.x, first.y);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = getBezierPoint(t, bezier.start, bezier.cp1, bezier.cp2, bezier.end);
      gfx.lineTo(p.x, p.y);
    }
  }
}
```

**Step 2: Run build to verify no type errors**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add client/src/game/layers/TrackLayer.ts
git commit -m "feat(metro): add TrackLayer with neon-tube main ring and bezier branch tracks"
```

---

### Task 3: Create StationLayer (station cards)

**Files:**
- Create: `client/src/game/layers/StationLayer.ts`

**Step 1: Implement StationLayer**

```typescript
// client/src/game/layers/StationLayer.ts
// Renders all station cards (main ring + branch line stations).
// Supports icon/illustration slots, hover effects, and click interaction.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState, Position } from '@nannaricher/shared';
import { MAIN_BOARD_CELLS, CORNER_INDICES, LINE_CONFIGS, LINE_EXIT_MAP } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import {
  METRO_BOARD_WIDTH,
  METRO_BOARD_HEIGHT,
  getMainStationPosition,
  getLineStationPosition,
  getStationColor,
  getStationColorDark,
  getLineThemeColor,
  getLineThemeColorDark,
  MAIN_STATION_SIZE,
  MAIN_STATION_HEIGHT,
  CORNER_STATION_SIZE,
  CORNER_STATION_HEIGHT,
  LINE_STATION_SIZE,
  LINE_STATION_HEIGHT,
} from '../layout/MetroLayout';
import { DESIGN_TOKENS } from '../../styles/tokens';

export interface StationLayerOptions {
  onCellClick?: (cellId: string, position: Position) => void;
}

export class StationLayer implements RenderLayer {
  private container: Container | null = null;
  private options: StationLayerOptions;

  constructor(options: StationLayerOptions = {}) {
    this.options = options;
  }

  init(stage: Container): void {
    this.container = new Container();
    this.container.x = METRO_BOARD_WIDTH / 2;
    this.container.y = METRO_BOARD_HEIGHT / 2;
    stage.addChild(this.container);

    this.drawMainStations();
    this.drawLineStations();
  }

  update(_state: GameState, _currentPlayerId: string | null): void {
    // Static — no per-frame update
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

  // ------ Main Ring Stations ------

  private drawMainStations(): void {
    MAIN_BOARD_CELLS.forEach((cell, index) => {
      const pos = getMainStationPosition(index);
      const isCorner = CORNER_INDICES.includes(index);
      const w = isCorner ? CORNER_STATION_SIZE : MAIN_STATION_SIZE;
      const h = isCorner ? CORNER_STATION_HEIGHT : MAIN_STATION_HEIGHT;
      const colorLight = getStationColor(cell.id, cell.type, index);
      const colorDark = getStationColorDark(cell.id, cell.type, index);

      const station = new Container();
      station.x = pos.x;
      station.y = pos.y;

      // Card background (frosted glass effect)
      const card = new Graphics();

      // Dark base with type color tint
      card.roundRect(-w / 2, -h / 2, w, h, 12);
      card.fill({ color: colorDark, alpha: 0.25 });

      // Glass overlay
      card.roundRect(-w / 2, -h / 2, w, h, 12);
      card.fill({ color: 0x1A1230, alpha: 0.6 });

      // Border glow
      card.roundRect(-w / 2, -h / 2, w, h, 12);
      card.stroke({ width: isCorner ? 2.5 : 1.5, color: colorLight, alpha: 0.6 });

      // Icon placeholder area (will be replaced by sprites later)
      const iconSize = isCorner ? 48 : 32;
      const iconY = -h / 2 + (isCorner ? 20 : 12) + iconSize / 2;

      // Icon background circle
      card.circle(0, iconY, iconSize / 2 + 4);
      card.fill({ color: colorDark, alpha: 0.4 });
      card.circle(0, iconY, iconSize / 2 + 4);
      card.stroke({ width: 1, color: colorLight, alpha: 0.3 });

      // Force entry marker (red dot at top-right corner)
      if (cell.forceEntry) {
        card.circle(w / 2 - 8, -h / 2 + 8, 5);
        card.fill({ color: 0xEF5350, alpha: 0.9 });
        card.circle(w / 2 - 8, -h / 2 + 8, 5);
        card.stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
      }

      station.addChild(card);

      // Icon emoji placeholder text
      const iconEmoji = this.getCellEmoji(cell.id, cell.type);
      const iconText = new Text({
        text: iconEmoji,
        style: new TextStyle({
          fontSize: isCorner ? 24 : 16,
          align: 'center',
        }),
      });
      iconText.anchor.set(0.5);
      iconText.y = iconY;
      station.addChild(iconText);

      // Station name
      const displayName = this.getShortName(cell.name);
      const nameText = new Text({
        text: displayName,
        style: new TextStyle({
          fontFamily: DESIGN_TOKENS.typography.fontFamily,
          fontSize: isCorner ? 14 : 11,
          fill: isCorner ? 0xE0C55E : 0xffffff,
          fontWeight: 'bold',
          align: 'center',
        }),
      });
      nameText.anchor.set(0.5);
      nameText.y = iconY + iconSize / 2 + (isCorner ? 14 : 10);
      station.addChild(nameText);

      // Effect summary (smaller text below name)
      if (isCorner && cell.description) {
        const descText = new Text({
          text: this.getShortDesc(cell.description),
          style: new TextStyle({
            fontFamily: DESIGN_TOKENS.typography.fontFamily,
            fontSize: 9,
            fill: 0xB0B0B0,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: w - 16,
          }),
        });
        descText.anchor.set(0.5);
        descText.y = nameText.y + 16;
        station.addChild(descText);
      }

      // Interaction
      station.eventMode = 'static';
      station.cursor = 'pointer';
      station.on('pointerdown', () => {
        this.options.onCellClick?.(cell.id, { type: 'main', index });
      });
      station.on('pointerover', () => {
        station.scale.set(1.08);
        station.alpha = 1;
      });
      station.on('pointerout', () => {
        station.scale.set(1);
        station.alpha = 0.95;
      });

      station.alpha = 0.95;
      this.container!.addChild(station);
    });
  }

  // ------ Branch Line Stations ------

  private drawLineStations(): void {
    for (const line of LINE_CONFIGS) {
      const lineColor = getLineThemeColor(line.id);
      const lineColorDark = getLineThemeColorDark(line.id);

      for (let i = 0; i < line.cellCount; i++) {
        const pos = getLineStationPosition(line.id, i);
        const isExpCard = i === line.cellCount - 1; // last cell is often experience card area
        const w = isExpCard ? 60 : LINE_STATION_SIZE;
        const h = isExpCard ? 70 : LINE_STATION_HEIGHT;

        const station = new Container();
        station.x = pos.x;
        station.y = pos.y;

        const card = new Graphics();

        // Background
        card.roundRect(-w / 2, -h / 2, w, h, 8);
        card.fill({ color: lineColorDark, alpha: 0.2 });

        card.roundRect(-w / 2, -h / 2, w, h, 8);
        card.fill({ color: 0x1A1230, alpha: 0.5 });

        // Border
        card.roundRect(-w / 2, -h / 2, w, h, 8);
        card.stroke({
          width: isExpCard ? 2 : 1,
          color: isExpCard ? 0xC9A227 : lineColor,
          alpha: isExpCard ? 0.8 : 0.5,
        });

        station.addChild(card);

        // Station index label
        const label = new Text({
          text: `${i + 1}`,
          style: new TextStyle({
            fontFamily: DESIGN_TOKENS.typography.fontFamily,
            fontSize: 10,
            fill: 0xffffff,
            fontWeight: 'bold',
          }),
        });
        label.anchor.set(0.5);
        station.addChild(label);

        // Experience card star marker
        if (isExpCard) {
          const star = new Text({
            text: '★',
            style: new TextStyle({ fontSize: 14, fill: 0xE0C55E }),
          });
          star.anchor.set(0.5);
          star.y = -h / 2 + 12;
          station.addChild(star);
        }

        station.alpha = 0.9;
        this.container!.addChild(station);
      }

      // Line name label (near the arc apex)
      const midPos = getLineStationPosition(line.id, Math.floor(line.cellCount / 2));
      const lineName = new Text({
        text: line.name,
        style: new TextStyle({
          fontFamily: DESIGN_TOKENS.typography.fontFamily,
          fontSize: 12,
          fill: lineColor,
          fontWeight: 'bold',
        }),
      });
      lineName.anchor.set(0.5);
      lineName.x = midPos.x;
      lineName.y = midPos.y - LINE_STATION_HEIGHT / 2 - 12;
      lineName.alpha = 0.7;
      this.container!.addChild(lineName);
    }
  }

  // ------ Helpers ------

  private getShortName(name: string): string {
    const map: Record<string, string> = {
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
    return map[name] || name;
  }

  private getShortDesc(desc: string): string {
    // Truncate to ~20 chars for card display
    return desc.length > 20 ? desc.slice(0, 18) + '...' : desc;
  }

  private getCellEmoji(id: string, type: string): string {
    const map: Record<string, string> = {
      start: '🏠', hospital: '🏥', ding: '🏛️', waiting_room: '🚉',
      tuition: '📚', zijing: '🌺', qingong: '💼', retake: '📝',
      jiang_gong: '🎭', society: '🎪', kechuang: '🔬', nanna_cp: '🛍️',
      chuangmen: '🚪',
    };
    if (map[id]) return map[id];
    if (type === 'chance') return '🎲';
    if (type === 'line_entry') return '🚇';
    return '📍';
  }
}
```

**Step 2: Run build to verify no type errors**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add client/src/game/layers/StationLayer.ts
git commit -m "feat(metro): add StationLayer with frosted-glass station cards and emoji icons"
```

---

## Phase 3: Background & Center

### Task 4: Create MetroBackgroundLayer

**Files:**
- Create: `client/src/game/layers/MetroBackgroundLayer.ts`

**Step 1: Implement MetroBackgroundLayer**

```typescript
// client/src/game/layers/MetroBackgroundLayer.ts
// Premium multi-layer background: deep space gradient, subtle grid, decorative border,
// and center information panel.

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameState } from '@nannaricher/shared';
import type { RenderLayer } from '../GameStage';
import { METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT } from '../layout/MetroLayout';
import { DESIGN_TOKENS } from '../../styles/tokens';

export class MetroBackgroundLayer implements RenderLayer {
  private container: Container | null = null;
  private roundText: Text | null = null;
  private currentPlayerText: Text | null = null;

  init(stage: Container): void {
    this.container = new Container();
    this.container.x = METRO_BOARD_WIDTH / 2;
    this.container.y = METRO_BOARD_HEIGHT / 2;
    stage.addChild(this.container);

    this.drawDeepSpaceGradient();
    this.drawSubtleGrid();
    this.drawDecorativeBorder();
    this.drawCenterPanel();
  }

  update(state: GameState, _currentPlayerId: string | null): void {
    // Update center panel text
    if (this.roundText) {
      const totalRounds = state.totalRounds || 20;
      this.roundText.text = `第 ${state.roundNumber}/${totalRounds} 回合`;
    }
    if (this.currentPlayerText && state.players.length > 0) {
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer) {
        this.currentPlayerText.text = `🎲 ${currentPlayer.name}`;
      }
    }
  }

  destroy(): void {
    this.roundText = null;
    this.currentPlayerText = null;
    if (this.container) {
      if (this.container.parent) {
        this.container.parent.removeChild(this.container);
      }
      this.container.destroy({ children: true });
      this.container = null;
    }
  }

  // ------ Drawing ------

  private drawDeepSpaceGradient(): void {
    const hw = METRO_BOARD_WIDTH / 2;
    const hh = METRO_BOARD_HEIGHT / 2;

    // Outermost dark background
    const bg = new Graphics();
    bg.rect(-hw - 40, -hh - 40, METRO_BOARD_WIDTH + 80, METRO_BOARD_HEIGHT + 80);
    bg.fill({ color: 0x080515 });
    this.container!.addChild(bg);

    // Slightly lighter center area (simulated radial gradient with concentric rects)
    const steps = 5;
    for (let i = steps; i >= 0; i--) {
      const frac = i / steps;
      const layerW = hw * 2 * (0.3 + 0.7 * frac);
      const layerH = hh * 2 * (0.3 + 0.7 * frac);
      const layer = new Graphics();
      layer.roundRect(-layerW / 2, -layerH / 2, layerW, layerH, 20);
      // Blend from 0x080515 (outer) to 0x16102A (inner)
      const r = Math.round(0x08 + (0x16 - 0x08) * (1 - frac));
      const g = Math.round(0x05 + (0x10 - 0x05) * (1 - frac));
      const b = Math.round(0x15 + (0x2A - 0x15) * (1 - frac));
      layer.fill({ color: (r << 16) | (g << 8) | b, alpha: 0.3 });
      this.container!.addChild(layer);
    }
  }

  private drawSubtleGrid(): void {
    const hw = METRO_BOARD_WIDTH / 2;
    const hh = METRO_BOARD_HEIGHT / 2;
    const gridSpacing = 60;
    const gfx = new Graphics();

    // Vertical lines
    for (let x = -hw; x <= hw; x += gridSpacing) {
      gfx.moveTo(x, -hh);
      gfx.lineTo(x, hh);
    }
    // Horizontal lines
    for (let y = -hh; y <= hh; y += gridSpacing) {
      gfx.moveTo(-hw, y);
      gfx.lineTo(hw, y);
    }
    gfx.stroke({ width: 0.5, color: 0x5E3A8D, alpha: 0.08 });

    // Intersection glow points
    for (let x = -hw; x <= hw; x += gridSpacing) {
      for (let y = -hh; y <= hh; y += gridSpacing) {
        gfx.circle(x, y, 1.5);
        gfx.fill({ color: 0x5E3A8D, alpha: 0.15 });
      }
    }

    this.container!.addChild(gfx);
  }

  private drawDecorativeBorder(): void {
    const hw = METRO_BOARD_WIDTH / 2;
    const hh = METRO_BOARD_HEIGHT / 2;
    const margin = 20;
    const gfx = new Graphics();

    // Outer border
    gfx.roundRect(-hw - margin, -hh - margin, METRO_BOARD_WIDTH + margin * 2, METRO_BOARD_HEIGHT + margin * 2, 16);
    gfx.stroke({ width: 2, color: 0xC9A227, alpha: 0.25 });

    // Inner accent border
    gfx.roundRect(-hw + 10, -hh + 10, METRO_BOARD_WIDTH - 20, METRO_BOARD_HEIGHT - 20, 12);
    gfx.stroke({ width: 1, color: 0x5E3A8D, alpha: 0.3 });

    // Corner decorations (small diamond shapes at 4 corners)
    const corners = [
      { x: -hw + 4, y: -hh + 4 },
      { x: hw - 4, y: -hh + 4 },
      { x: -hw + 4, y: hh - 4 },
      { x: hw - 4, y: hh - 4 },
    ];
    for (const c of corners) {
      gfx.moveTo(c.x, c.y - 8);
      gfx.lineTo(c.x + 8, c.y);
      gfx.lineTo(c.x, c.y + 8);
      gfx.lineTo(c.x - 8, c.y);
      gfx.closePath();
      gfx.fill({ color: 0xC9A227, alpha: 0.3 });
    }

    this.container!.addChild(gfx);
  }

  private drawCenterPanel(): void {
    const panelW = 280;
    const panelH = 160;

    // Panel background
    const panel = new Graphics();
    panel.roundRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    panel.fill({ color: 0x1A1230, alpha: 0.7 });
    panel.roundRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    panel.stroke({ width: 1.5, color: 0xC9A227, alpha: 0.35 });
    this.container!.addChild(panel);

    // Title
    const title = new Text({
      text: '菜根人生',
      style: new TextStyle({
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
        fontSize: 28,
        fill: 0xE0C55E,
        fontWeight: 'bold',
      }),
    });
    title.anchor.set(0.5);
    title.y = -panelH / 2 + 35;
    this.container!.addChild(title);

    // Subtitle
    const subtitle = new Text({
      text: '南哪大富翁',
      style: new TextStyle({
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
        fontSize: 13,
        fill: 0xB0B0B0,
      }),
    });
    subtitle.anchor.set(0.5);
    subtitle.y = -panelH / 2 + 60;
    this.container!.addChild(subtitle);

    // Divider line
    const divider = new Graphics();
    divider.moveTo(-panelW / 2 + 30, -panelH / 2 + 78);
    divider.lineTo(panelW / 2 - 30, -panelH / 2 + 78);
    divider.stroke({ width: 1, color: 0xC9A227, alpha: 0.2 });
    this.container!.addChild(divider);

    // Round info (dynamic)
    this.roundText = new Text({
      text: '第 1/20 回合',
      style: new TextStyle({
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
        fontSize: 14,
        fill: 0xffffff,
      }),
    });
    this.roundText.anchor.set(0.5);
    this.roundText.y = -panelH / 2 + 98;
    this.container!.addChild(this.roundText);

    // Current player (dynamic)
    this.currentPlayerText = new Text({
      text: '🎲 等待开始',
      style: new TextStyle({
        fontFamily: DESIGN_TOKENS.typography.fontFamily,
        fontSize: 12,
        fill: 0xB0B0B0,
      }),
    });
    this.currentPlayerText.anchor.set(0.5);
    this.currentPlayerText.y = -panelH / 2 + 122;
    this.container!.addChild(this.currentPlayerText);
  }
}
```

**Step 2: Run build check**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add client/src/game/layers/MetroBackgroundLayer.ts
git commit -m "feat(metro): add MetroBackgroundLayer with deep-space gradient and center panel"
```

---

## Phase 4: Integration

### Task 5: Update GameStage for new board dimensions

**Files:**
- Modify: `client/src/game/GameStage.ts`

**Step 1: Update resize logic for 1200×1000 board**

Replace the resize method to use `METRO_BOARD_WIDTH` and `METRO_BOARD_HEIGHT`:

```typescript
// In GameStage.ts, change import:
import { METRO_BOARD_WIDTH, METRO_BOARD_HEIGHT } from './layout/MetroLayout';

// Replace resize method:
resize(viewWidth: number, viewHeight: number): void {
  const maxCanvasW = Math.min(viewWidth, 1400);
  const maxCanvasH = Math.min(viewHeight, 1100);

  const scaleX = maxCanvasW / (METRO_BOARD_WIDTH + 100);
  const scaleY = maxCanvasH / (METRO_BOARD_HEIGHT + 100);
  const scale = Math.max(0.1, Math.min(scaleX, scaleY));

  this.mainContainer.x = viewWidth / 2 - (METRO_BOARD_WIDTH / 2) * scale;
  this.mainContainer.y = viewHeight / 2 - (METRO_BOARD_HEIGHT / 2) * scale;
  this.mainContainer.scale.set(scale);
}
```

Also remove the old `BOARD_SIZE` import.

**Step 2: Run build check**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add client/src/game/GameStage.ts
git commit -m "refactor(metro): update GameStage resize for 1200x1000 metro board"
```

---

### Task 6: Update PlayerLayer to use MetroLayout coordinates

**Files:**
- Modify: `client/src/game/layers/PlayerLayer.ts`

**Step 1: Replace imports and position calculation**

Change the imports from old `BoardLayout` to new `MetroLayout`:

```typescript
// Replace old imports:
// import { BOARD_SIZE, getCellPosition, getLineCellPosition, PLAYER_COLORS_HEX } from '../layout/BoardLayout';

// With:
import {
  METRO_BOARD_WIDTH,
  METRO_BOARD_HEIGHT,
  getMainStationPosition,
  getLineStationPosition,
} from '../layout/MetroLayout';

// Keep PLAYER_COLORS_HEX from BoardLayout for now (or move to MetroLayout)
const PLAYER_COLORS_HEX = [0xE53935, 0x1E88E5, 0x43A047, 0xFB8C00, 0x8E24AA, 0x00897B];
```

Update `init()`:
```typescript
init(stage: Container): void {
  this.layerContainer = new Container();
  this.layerContainer.x = METRO_BOARD_WIDTH / 2;
  this.layerContainer.y = METRO_BOARD_HEIGHT / 2;
  stage.addChild(this.layerContainer);
}
```

Update `calculatePosition()`:
```typescript
private calculatePosition(player: Player): { x: number; y: number; inLine: boolean } {
  if (player.position.type === 'main') {
    return { ...getMainStationPosition(player.position.index), inLine: false };
  } else {
    return { ...getLineStationPosition(player.position.lineId, player.position.index), inLine: true };
  }
}
```

**Step 2: Run build check**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add client/src/game/layers/PlayerLayer.ts
git commit -m "refactor(metro): update PlayerLayer to use MetroLayout coordinates"
```

---

### Task 7: Wire everything in GameCanvas

**Files:**
- Modify: `client/src/game/GameCanvas.tsx`

**Step 1: Replace old layers with new metro layers**

```typescript
// Replace imports:
// import { BackgroundLayer } from './layers/BackgroundLayer';
// import { BoardLayer } from './layers/BoardLayer';
// import { LineLayer } from './layers/LineLayer';

import { MetroBackgroundLayer } from './layers/MetroBackgroundLayer';
import { TrackLayer } from './layers/TrackLayer';
import { StationLayer } from './layers/StationLayer';
```

In the initialization `then()` block, replace:
```typescript
// OLD:
// stage.addLayer(new BackgroundLayer());
// stage.addLayer(new LineLayer());
// stage.addLayer(new BoardLayer({ onCellClick }));

// NEW:
stage.addLayer(new MetroBackgroundLayer());
stage.addLayer(new TrackLayer());
stage.addLayer(new StationLayer({ onCellClick }));
```

**Step 2: Start dev server and verify visually**

Run: `cd client && npm run dev`
Expected: Board renders with metro layout, stations visible, branch curves visible.

**Step 3: Commit**

```bash
git add client/src/game/GameCanvas.tsx
git commit -m "feat(metro): wire metro layers into GameCanvas, replacing old square-ring board"
```

---

### Task 8: Update ViewportController for new board size

**Files:**
- Modify: `client/src/game/interaction/ViewportController.ts` (if needed)

**Step 1: Check if ViewportController has hardcoded BOARD_SIZE references**

The ViewportController captures `baseContainerX/Y/Scale` from the container at construction time, so it should auto-adapt. But verify there are no hardcoded `700` or `BOARD_SIZE` references.

Run: search the file for `700`, `BOARD_SIZE`, or `850`.

If found, update to reference the new dimensions. If not, no changes needed.

**Step 2: Commit if changes were made**

```bash
git add client/src/game/interaction/ViewportController.ts
git commit -m "refactor(metro): update ViewportController for new board dimensions"
```

---

## Phase 5: Cleanup

### Task 9: Remove legacy rendering code

**Files:**
- Delete: `client/src/canvas/BoardRenderer.ts`
- Delete: `client/src/canvas/CanvasController.ts`
- Delete: `client/src/canvas/colors.ts`
- Delete: `client/src/canvas/types.ts`
- Delete: `client/src/game/board/BoardRenderer.tsx`
- Delete: `client/src/game/board/CellSprite.tsx`
- Keep (but mark deprecated): `client/src/game/layers/BoardLayer.ts` — may be referenced elsewhere
- Keep (but mark deprecated): `client/src/game/layers/LineLayer.ts`
- Keep (but mark deprecated): `client/src/game/layers/BackgroundLayer.ts`
- Keep: `client/src/game/layout/BoardLayout.ts` — may be imported by other modules

**Step 1: Check for imports of legacy files**

Run: `grep -r "canvas/BoardRenderer\|canvas/CanvasController\|canvas/colors\|canvas/types\|board/BoardRenderer\|board/CellSprite" client/src/ --include="*.ts" --include="*.tsx"`

Delete only files that have zero imports.

**Step 2: Delete confirmed dead files**

```bash
rm client/src/canvas/BoardRenderer.ts
rm client/src/canvas/CanvasController.ts
rm client/src/canvas/colors.ts
rm client/src/canvas/types.ts
rm client/src/game/board/BoardRenderer.tsx
rm client/src/game/board/CellSprite.tsx
```

**Step 3: Run build to verify nothing broke**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy canvas2D and @pixi/react board renderers"
```

---

### Task 10: Run full test suite

**Step 1: Run client tests**

Run: `cd client && npx vitest run`
Expected: All tests pass (including new MetroLayout tests)

**Step 2: Run server tests**

Run: `cd server && npm test`
Expected: All tests pass (no server changes)

**Step 3: Run e2e if available**

Run: `npx playwright test` (if configured)

**Step 4: Commit any test fixes**

---

## Phase 6: Visual Polish (Post-Integration)

### Task 11: Add connector markers for line entry/exit stations

After the basic metro layout is working, add visual **换乘标记** (transfer markers) on main ring stations that are line entry/exit points — two interlocking circles showing the connection.

**Files:**
- Modify: `client/src/game/layers/StationLayer.ts`

Add a method `drawTransferMarkers()` called after `drawMainStations()` that draws transfer symbols at all `line_entry` stations and their corresponding exit stations.

**Step 1: Add transfer markers**

For each line, draw two small interlocking circles at the entry and exit stations on the main ring, colored in the line's theme color.

**Step 2: Commit**

```bash
git add client/src/game/layers/StationLayer.ts
git commit -m "feat(metro): add transfer markers at line entry/exit stations"
```

---

### Task 12: Fine-tune layout constants

After visual testing, adjust:
- `RING_MARGIN_X/Y` — spacing of main ring from board edge
- `ARC_DEPTH_PER_CELL` — how far branch arcs extend
- `CORNER_RADIUS` — roundness of main ring corners
- Station sizes — may need per-side adjustments
- Label positions — ensure no overlaps

This is an iterative visual tuning task. Use the dev server (`npm run dev`) and adjust constants in `MetroLayout.ts` until the layout looks optimal.

**Step 1: Visual iteration**

Run dev server, adjust constants, reload.

**Step 2: Commit final tuned values**

```bash
git add client/src/game/layout/MetroLayout.ts
git commit -m "style(metro): fine-tune layout constants for visual balance"
```

---

## Summary: Task Dependency Order

```
Task 1 (MetroLayout + tests)
  ↓
Task 2 (TrackLayer)  ──┐
Task 3 (StationLayer)  ├── can be parallel
Task 4 (BackgroundLayer)┘
  ↓
Task 5 (GameStage resize)
  ↓
Task 6 (PlayerLayer update)
  ↓
Task 7 (GameCanvas wiring)
  ↓
Task 8 (ViewportController check)
  ↓
Task 9 (Cleanup legacy)
  ↓
Task 10 (Full test suite)
  ↓
Task 11 (Transfer markers)
  ↓
Task 12 (Visual tuning)
```

Tasks 2, 3, 4 can be done in parallel after Task 1 is complete.
Tasks 5-8 must be sequential.
Tasks 11-12 are polish after everything works.
