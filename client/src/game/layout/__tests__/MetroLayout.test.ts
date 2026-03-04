// client/src/game/layout/__tests__/MetroLayout.test.ts
import { describe, it, expect } from 'vitest';
import {
  METRO_BOARD_WIDTH,
  METRO_BOARD_HEIGHT,
  getMainStationPosition,
  getBezierPoint,
  bezierArcLength,
  getLineBezierConfig,
  getLineStationPosition,
  getStationColor,
  getStationColorDark,
  getLineThemeColor,
  getLineThemeColorDark,
  getRingPath,
  STATION_RADIUS,
  CORNER_STATION_RADIUS,
  LINE_STATION_RADIUS,
  MAIN_STATION_SIZE,
  MAIN_STATION_HEIGHT,
  CORNER_STATION_SIZE,
  CORNER_STATION_HEIGHT,
  LINE_STATION_SIZE,
  LINE_STATION_HEIGHT,
  EXP_STATION_SIZE,
  EXP_STATION_HEIGHT,
  MAIN_TRACK_WIDTH,
  LINE_TRACK_WIDTH,
} from '../MetroLayout';
import { CORNER_INDICES, LINE_CONFIGS, LINE_EXIT_MAP } from '@nannaricher/shared';

// ============================================
// Board Dimensions
// ============================================
describe('Board dimensions', () => {
  it('exports correct board width and height', () => {
    expect(METRO_BOARD_WIDTH).toBe(1400);
    expect(METRO_BOARD_HEIGHT).toBe(1200);
  });

  it('exports station size constants', () => {
    expect(STATION_RADIUS).toBeGreaterThan(0);
    expect(CORNER_STATION_RADIUS).toBeGreaterThan(STATION_RADIUS);
    expect(LINE_STATION_RADIUS).toBeGreaterThan(0);
  });

  it('exports station card dimensions', () => {
    expect(MAIN_STATION_SIZE).toBe(80);
    expect(MAIN_STATION_HEIGHT).toBe(100);
    expect(CORNER_STATION_SIZE).toBe(120);
    expect(CORNER_STATION_HEIGHT).toBe(140);
    expect(LINE_STATION_SIZE).toBe(44);
    expect(LINE_STATION_HEIGHT).toBe(52);
    expect(EXP_STATION_SIZE).toBe(65);
    expect(EXP_STATION_HEIGHT).toBe(75);
  });

  it('exports track width constants', () => {
    expect(MAIN_TRACK_WIDTH).toBe(6);
    expect(LINE_TRACK_WIDTH).toBe(4);
  });
});

// ============================================
// Main Station Positions
// ============================================
describe('getMainStationPosition', () => {
  it('returns { x, y } for all 28 stations', () => {
    for (let i = 0; i < 28; i++) {
      const pos = getMainStationPosition(i);
      expect(pos).toHaveProperty('x');
      expect(pos).toHaveProperty('y');
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
    }
  });

  it('all 28 stations are within board bounds', () => {
    const halfW = METRO_BOARD_WIDTH / 2;
    const halfH = METRO_BOARD_HEIGHT / 2;
    for (let i = 0; i < 28; i++) {
      const pos = getMainStationPosition(i);
      expect(pos.x).toBeGreaterThanOrEqual(-halfW);
      expect(pos.x).toBeLessThanOrEqual(halfW);
      expect(pos.y).toBeGreaterThanOrEqual(-halfH);
      expect(pos.y).toBeLessThanOrEqual(halfH);
    }
  });

  it('corner stations are at the 4 corners of rounded rect', () => {
    // Corner 0 = bottom-right (start)
    const c0 = getMainStationPosition(0);
    expect(c0.x).toBeGreaterThan(0);
    expect(c0.y).toBeGreaterThan(0);

    // Corner 7 = bottom-left (hospital)
    const c1 = getMainStationPosition(7);
    expect(c1.x).toBeLessThan(0);
    expect(c1.y).toBeGreaterThan(0);

    // Corner 14 = top-left (ding)
    const c2 = getMainStationPosition(14);
    expect(c2.x).toBeLessThan(0);
    expect(c2.y).toBeLessThan(0);

    // Corner 21 = top-right (waiting_room)
    const c3 = getMainStationPosition(21);
    expect(c3.x).toBeGreaterThan(0);
    expect(c3.y).toBeLessThan(0);
  });

  it('bottom side stations (0-6) have decreasing x (right to left)', () => {
    for (let i = 0; i < 6; i++) {
      const curr = getMainStationPosition(i);
      const next = getMainStationPosition(i + 1);
      expect(curr.x).toBeGreaterThan(next.x);
    }
  });

  it('left side stations (7-13) have decreasing y (bottom to top)', () => {
    for (let i = 7; i < 13; i++) {
      const curr = getMainStationPosition(i);
      const next = getMainStationPosition(i + 1);
      expect(curr.y).toBeGreaterThan(next.y);
    }
  });

  it('top side stations (14-20) have increasing x (left to right)', () => {
    for (let i = 14; i < 20; i++) {
      const curr = getMainStationPosition(i);
      const next = getMainStationPosition(i + 1);
      expect(curr.x).toBeLessThan(next.x);
    }
  });

  it('right side stations (21-27) have increasing y (top to bottom)', () => {
    for (let i = 21; i < 27; i++) {
      const curr = getMainStationPosition(i);
      const next = getMainStationPosition(i + 1);
      expect(curr.y).toBeLessThan(next.y);
    }
  });

  it('bottom side stations share approximately the same y', () => {
    const ys = [];
    for (let i = 0; i < 7; i++) ys.push(getMainStationPosition(i).y);
    const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
    for (const y of ys) {
      expect(Math.abs(y - avg)).toBeLessThan(5);
    }
  });

  it('left side stations share approximately the same x', () => {
    const xs = [];
    for (let i = 7; i < 14; i++) xs.push(getMainStationPosition(i).x);
    const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
    for (const x of xs) {
      expect(Math.abs(x - avg)).toBeLessThan(5);
    }
  });
});

// ============================================
// Bezier Utilities
// ============================================
describe('getBezierPoint', () => {
  const p0 = { x: 0, y: 0 };
  const p1 = { x: 0, y: 100 };
  const p2 = { x: 100, y: 100 };
  const p3 = { x: 100, y: 0 };

  it('returns start point at t=0', () => {
    const pt = getBezierPoint(0, p0, p1, p2, p3);
    expect(pt.x).toBeCloseTo(0, 5);
    expect(pt.y).toBeCloseTo(0, 5);
  });

  it('returns end point at t=1', () => {
    const pt = getBezierPoint(1, p0, p1, p2, p3);
    expect(pt.x).toBeCloseTo(100, 5);
    expect(pt.y).toBeCloseTo(0, 5);
  });

  it('returns midpoint at t=0.5 for symmetric curve', () => {
    const pt = getBezierPoint(0.5, p0, p1, p2, p3);
    expect(pt.x).toBeCloseTo(50, 0);
    expect(pt.y).toBeCloseTo(75, 0);
  });
});

describe('bezierArcLength', () => {
  it('returns a positive arc length', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 0, y: 100 };
    const p2 = { x: 100, y: 100 };
    const p3 = { x: 100, y: 0 };
    const len = bezierArcLength(p0, p1, p2, p3);
    expect(len).toBeGreaterThan(0);
  });

  it('straight line bezier has arc length equal to distance', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 33, y: 0 };
    const p2 = { x: 66, y: 0 };
    const p3 = { x: 100, y: 0 };
    const len = bezierArcLength(p0, p1, p2, p3);
    expect(len).toBeCloseTo(100, 0);
  });
});

// ============================================
// Line Bezier Config
// ============================================
describe('getLineBezierConfig', () => {
  it('returns config for all 8 line IDs', () => {
    const lineIds = ['pukou', 'study', 'money', 'suzhou', 'explore', 'xianlin', 'gulou', 'food'];
    for (const id of lineIds) {
      const config = getLineBezierConfig(id);
      expect(config).toBeDefined();
      expect(config).toHaveProperty('start');
      expect(config).toHaveProperty('cp1');
      expect(config).toHaveProperty('cp2');
      expect(config).toHaveProperty('end');
    }
  });

  it('returns undefined for unknown line ID', () => {
    const config = getLineBezierConfig('nonexistent');
    expect(config).toBeUndefined();
  });

  it('bezier start (p0) matches entry station position', () => {
    for (const line of LINE_CONFIGS) {
      const config = getLineBezierConfig(line.id);
      if (!config) continue;
      const entryPos = getMainStationPosition(line.entryIndex);
      expect(config.start.x).toBeCloseTo(entryPos.x, 0);
      expect(config.start.y).toBeCloseTo(entryPos.y, 0);
    }
  });

  it('bezier end (p3) matches exit station position', () => {
    for (const line of LINE_CONFIGS) {
      const exitIndex = LINE_EXIT_MAP[line.id];
      if (exitIndex === undefined) continue;
      const config = getLineBezierConfig(line.id);
      if (!config) continue;
      const exitPos = getMainStationPosition(exitIndex);
      expect(config.end.x).toBeCloseTo(exitPos.x, 0);
      expect(config.end.y).toBeCloseTo(exitPos.y, 0);
    }
  });

  it('bottom lines (pukou, study) arc downward (control points have larger y)', () => {
    for (const id of ['pukou', 'study']) {
      const config = getLineBezierConfig(id);
      if (!config) continue;
      // Control points should extend further in y (downward = positive y)
      expect(config.cp1.y).toBeGreaterThan(config.start.y);
      expect(config.cp2.y).toBeGreaterThan(config.end.y);
    }
  });

  it('top lines (explore, xianlin) arc upward (control points have smaller y)', () => {
    for (const id of ['explore', 'xianlin']) {
      const config = getLineBezierConfig(id);
      if (!config) continue;
      expect(config.cp1.y).toBeLessThan(config.start.y);
      expect(config.cp2.y).toBeLessThan(config.end.y);
    }
  });

  it('left lines (money, suzhou) arc leftward (control points have smaller x)', () => {
    for (const id of ['money', 'suzhou']) {
      const config = getLineBezierConfig(id);
      if (!config) continue;
      expect(config.cp1.x).toBeLessThan(config.start.x);
      expect(config.cp2.x).toBeLessThan(config.end.x);
    }
  });

  it('right lines (gulou, food) arc rightward (control points have larger x)', () => {
    for (const id of ['gulou', 'food']) {
      const config = getLineBezierConfig(id);
      if (!config) continue;
      expect(config.cp1.x).toBeGreaterThan(config.start.x);
      expect(config.cp2.x).toBeGreaterThan(config.end.x);
    }
  });
});

// ============================================
// Line Station Positions
// ============================================
describe('getLineStationPosition', () => {
  it('returns positions for all cells in each line', () => {
    for (const line of LINE_CONFIGS) {
      for (let i = 0; i < line.cellCount; i++) {
        const pos = getLineStationPosition(line.id, i);
        expect(pos).toHaveProperty('x');
        expect(pos).toHaveProperty('y');
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
      }
    }
  });

  it('stations are evenly spaced along the bezier arc', () => {
    for (const line of LINE_CONFIGS) {
      if (line.cellCount < 3) continue;
      const positions = [];
      for (let i = 0; i < line.cellCount; i++) {
        positions.push(getLineStationPosition(line.id, i));
      }

      // Calculate distances between consecutive stations
      const dists: number[] = [];
      for (let i = 1; i < positions.length; i++) {
        const dx = positions[i].x - positions[i - 1].x;
        const dy = positions[i].y - positions[i - 1].y;
        dists.push(Math.sqrt(dx * dx + dy * dy));
      }

      // All distances should be approximately equal
      const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length;
      for (const d of dists) {
        // Allow 15% tolerance for arc-length parameterization approximation
        expect(d).toBeGreaterThan(avgDist * 0.85);
        expect(d).toBeLessThan(avgDist * 1.15);
      }
    }
  });

  it('returns { x: 0, y: 0 } for unknown line ID', () => {
    const pos = getLineStationPosition('nonexistent', 0);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });
});

// ============================================
// Color Helpers
// ============================================
describe('Color helpers', () => {
  it('getStationColor returns a number for main board indices', () => {
    for (let i = 0; i < 28; i++) {
      const color = getStationColor(i);
      expect(typeof color).toBe('number');
      expect(color).toBeGreaterThanOrEqual(0);
    }
  });

  it('getStationColorDark returns a number for main board indices', () => {
    for (let i = 0; i < 28; i++) {
      const color = getStationColorDark(i);
      expect(typeof color).toBe('number');
      expect(color).toBeGreaterThanOrEqual(0);
    }
  });

  it('corner stations get distinct colors', () => {
    const cornerColors = CORNER_INDICES.map(i => getStationColor(i));
    const unique = new Set(cornerColors);
    expect(unique.size).toBe(4);
  });

  it('getLineThemeColor returns a number for each line', () => {
    for (const line of LINE_CONFIGS) {
      const color = getLineThemeColor(line.id);
      expect(typeof color).toBe('number');
      expect(color).toBeGreaterThanOrEqual(0);
    }
  });

  it('getLineThemeColorDark returns a number for each line', () => {
    for (const line of LINE_CONFIGS) {
      const color = getLineThemeColorDark(line.id);
      expect(typeof color).toBe('number');
      expect(color).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============================================
// Ring Path
// ============================================
describe('getRingPath', () => {
  it('returns an array of points forming the ring', () => {
    const path = getRingPath();
    expect(Array.isArray(path)).toBe(true);
    expect(path.length).toBeGreaterThan(4);
    for (const pt of path) {
      expect(pt).toHaveProperty('x');
      expect(pt).toHaveProperty('y');
    }
  });

  it('ring path forms a closed loop (first ~= last)', () => {
    const path = getRingPath();
    const first = path[0];
    const last = path[path.length - 1];
    expect(first.x).toBeCloseTo(last.x, 0);
    expect(first.y).toBeCloseTo(last.y, 0);
  });
});
