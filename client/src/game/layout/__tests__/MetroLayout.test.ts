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
  getLineTrackPath,
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
    expect(METRO_BOARD_WIDTH).toBe(2500);
    expect(METRO_BOARD_HEIGHT).toBe(2500);
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
    expect(LINE_STATION_SIZE).toBe(62);
    expect(LINE_STATION_HEIGHT).toBe(72);
    expect(EXP_STATION_SIZE).toBe(72);
    expect(EXP_STATION_HEIGHT).toBe(82);
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

  it('last regular station on each side does NOT overlap with next corner', () => {
    // Station 6 should NOT be at corner 7's position
    const s6 = getMainStationPosition(6);
    const s7 = getMainStationPosition(7);
    const dist67 = Math.sqrt((s6.x - s7.x) ** 2 + (s6.y - s7.y) ** 2);
    expect(dist67).toBeGreaterThan(50); // significant distance

    // Station 13 should NOT be at corner 14's position
    const s13 = getMainStationPosition(13);
    const s14 = getMainStationPosition(14);
    const dist1314 = Math.sqrt((s13.x - s14.x) ** 2 + (s13.y - s14.y) ** 2);
    expect(dist1314).toBeGreaterThan(50);

    // Station 20 should NOT be at corner 21's position
    const s20 = getMainStationPosition(20);
    const s21 = getMainStationPosition(21);
    const dist2021 = Math.sqrt((s20.x - s21.x) ** 2 + (s20.y - s21.y) ** 2);
    expect(dist2021).toBeGreaterThan(50);

    // Station 27 should NOT be at corner 0's position
    const s27 = getMainStationPosition(27);
    const s0 = getMainStationPosition(0);
    const dist270 = Math.sqrt((s27.x - s0.x) ** 2 + (s27.y - s0.y) ** 2);
    expect(dist270).toBeGreaterThan(50);
  });

  it('no two adjacent main ring stations overlap (min distance > card size)', () => {
    for (let i = 0; i < 28; i++) {
      const curr = getMainStationPosition(i);
      const next = getMainStationPosition((i + 1) % 28);
      const dist = Math.sqrt((curr.x - next.x) ** 2 + (curr.y - next.y) ** 2);
      // Min distance should be > half the diagonal of the larger card (corner: 120x140)
      expect(dist).toBeGreaterThan(80);
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
// Line Bezier Config (deprecated, kept for compat)
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
});

// ============================================
// Line Station Positions (Snake Layout)
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

  it('no two adjacent stations in same line overlap (distance > min threshold)', () => {
    for (const line of LINE_CONFIGS) {
      for (let i = 0; i < line.cellCount - 1; i++) {
        const curr = getLineStationPosition(line.id, i);
        const next = getLineStationPosition(line.id, i + 1);
        const dist = Math.sqrt((curr.x - next.x) ** 2 + (curr.y - next.y) ** 2);
        // 甲-shape: columns span entry-exit distance, spacing may be tight
        // but stations must still be > 40px apart (readable)
        expect(dist).toBeGreaterThan(40);
      }
    }
  });

  it('all branch stations are within board bounds', () => {
    const halfW = METRO_BOARD_WIDTH / 2;
    const halfH = METRO_BOARD_HEIGHT / 2;
    for (const line of LINE_CONFIGS) {
      for (let i = 0; i < line.cellCount; i++) {
        const pos = getLineStationPosition(line.id, i);
        expect(pos.x).toBeGreaterThanOrEqual(-halfW);
        expect(pos.x).toBeLessThanOrEqual(halfW);
        expect(pos.y).toBeGreaterThanOrEqual(-halfH);
        expect(pos.y).toBeLessThanOrEqual(halfH);
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
// Line Track Path
// ============================================
describe('getLineTrackPath', () => {
  it('returns path starting at entry and ending at exit for each line', () => {
    for (const line of LINE_CONFIGS) {
      const path = getLineTrackPath(line.id);
      // Path has entry + stations + optional routing waypoint + exit
      expect(path.length).toBeGreaterThanOrEqual(line.cellCount + 2);

      const entryPos = getMainStationPosition(line.entryIndex);
      expect(path[0].x).toBeCloseTo(entryPos.x, 0);
      expect(path[0].y).toBeCloseTo(entryPos.y, 0);

      const exitIndex = LINE_EXIT_MAP[line.id];
      if (exitIndex !== undefined) {
        const exitPos = getMainStationPosition(exitIndex);
        const last = path[path.length - 1];
        expect(last.x).toBeCloseTo(exitPos.x, 0);
        expect(last.y).toBeCloseTo(exitPos.y, 0);
      }
    }
  });

  it('returns empty array for unknown line', () => {
    expect(getLineTrackPath('nonexistent')).toEqual([]);
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
