// client/src/game/layout/BoardLayout.ts
// Pure functions for board coordinate calculations.
// No PixiJS dependencies — only math.

import {
  CORNER_INDICES,
  CELLS_PER_SIDE,
  LINE_CONFIGS,
  type BoardCellData,
  type LineConfig,
} from '@nannaricher/shared';
import { DESIGN_TOKENS, hexToPixi } from '../../styles/tokens';

// ============================================
// Layout Constants
// ============================================
export const BOARD_SIZE = 700;
export const CELL_SIZE = 70;
export const CORNER_SIZE = 90;
export const CENTER_AREA_SIZE = 200;
export const LINE_CELL_SIZE = 30;
export const LINE_SPACING = 38;
export const LINE_PLAYER_CELL_SIZE = 35;
export const LINE_PLAYER_SPACING = 40;

// ============================================
// Main Board Cell Position
// ============================================

/**
 * Calculate the (x, y) position of a main board cell.
 * Coordinates are relative to board center (0, 0).
 * Layer containers are positioned at (BOARD_SIZE/2, BOARD_SIZE/2),
 * so these center-relative coords map directly to screen space.
 *
 * Layout (square ring):
 *   Bottom side (0-6):  right to left   y = +halfExtent
 *   Left side (7-13):   bottom to top   x = -halfExtent
 *   Top side (14-20):   left to right   y = -halfExtent
 *   Right side (21-27): top to bottom   x = +halfExtent
 */
export function getCellPosition(
  index: number,
  boardSize = BOARD_SIZE,
  cellWidth = CELL_SIZE,
  cornerSize = CORNER_SIZE,
): { x: number; y: number } {
  const side = Math.floor(index / CELLS_PER_SIDE);
  const posInSide = index % CELLS_PER_SIDE;

  // Distance from center to each corner cell center
  const halfExtent = (boardSize - cornerSize) / 2;

  // Corner cells (posInSide === 0) sit at the 4 corners of the square ring
  if (posInSide === 0) {
    switch (side) {
      case 0: return { x: +halfExtent, y: +halfExtent }; // bottom-right (start)
      case 1: return { x: -halfExtent, y: +halfExtent }; // bottom-left (hospital)
      case 2: return { x: -halfExtent, y: -halfExtent }; // top-left (ding)
      case 3: return { x: +halfExtent, y: -halfExtent }; // top-right (waiting_room)
    }
  }

  // Regular cells: 6 cells per side, centered between adjacent corners
  // Center-to-center span of 6 cells = (6-1) * cellWidth = 5 * 70 = 350
  const halfSpan = ((CELLS_PER_SIDE - 2) * cellWidth) / 2;
  // posInSide 1 → offset = +halfSpan (near the side's first corner)
  // posInSide 6 → offset = -halfSpan (near the next corner)
  const cellOffset = halfSpan - (posInSide - 1) * cellWidth;

  switch (side) {
    case 0: // Bottom (right to left): x decreases, y fixed at +halfExtent
      return { x: cellOffset, y: +halfExtent };
    case 1: // Left (bottom to top): y decreases, x fixed at -halfExtent
      return { x: -halfExtent, y: cellOffset };
    case 2: // Top (left to right): x increases (negate offset), y fixed at -halfExtent
      return { x: -cellOffset, y: -halfExtent };
    case 3: // Right (top to bottom): y increases (negate offset), x fixed at +halfExtent
      return { x: +halfExtent, y: -cellOffset };
  }

  return { x: 0, y: 0 };
}

// ============================================
// Line Cell Positions
// ============================================

/**
 * Calculate positions for all cells in a line.
 * Returns an array of (x, y) for each cell index (0-based).
 */
export function calculateLineCellPositions(
  lineConfig: LineConfig,
  boardSize = BOARD_SIZE,
  cellSize = CELL_SIZE,
  cornerSize = CORNER_SIZE,
  spacing = LINE_SPACING,
): { x: number; y: number }[] {
  const entryPos = getCellPosition(lineConfig.entryIndex, boardSize, cellSize, cornerSize);
  const positions: { x: number; y: number }[] = [];

  for (let i = 0; i < lineConfig.cellCount; i++) {
    let x = entryPos.x;
    let y = entryPos.y;

    switch (lineConfig.direction) {
      case 'up':
        y = entryPos.y - (i + 1) * spacing;
        break;
      case 'down':
        y = entryPos.y + (i + 1) * spacing;
        break;
      case 'left':
        x = entryPos.x - (i + 1) * spacing;
        break;
      case 'right':
        x = entryPos.x + (i + 1) * spacing;
        break;
    }

    positions.push({ x, y });
  }

  return positions;
}

/**
 * Get a single line cell position (for player piece placement).
 * Uses slightly wider spacing than rendering for clarity.
 */
export function getLineCellPosition(
  lineId: string,
  cellIndex: number,
  boardSize = BOARD_SIZE,
  cellSize = CELL_SIZE,
  cornerSize = CORNER_SIZE,
): { x: number; y: number } {
  const line = LINE_CONFIGS.find(l => l.id === lineId);
  if (!line) return { x: 0, y: 0 };

  const entryPos = getCellPosition(line.entryIndex, boardSize, cellSize, cornerSize);
  const spacing = LINE_PLAYER_SPACING;

  let x = entryPos.x;
  let y = entryPos.y;

  switch (line.direction) {
    case 'up':
      y = entryPos.y - (cellIndex + 1) * spacing;
      break;
    case 'down':
      y = entryPos.y + (cellIndex + 1) * spacing;
      break;
    case 'left':
      x = entryPos.x - (cellIndex + 1) * spacing;
      break;
    case 'right':
      x = entryPos.x + (cellIndex + 1) * spacing;
      break;
  }

  return { x, y };
}

// ============================================
// Cell Color Mapping
// ============================================

export function getCellColor(cell: BoardCellData, index: number): number {
  const ct = DESIGN_TOKENS.color.cell;
  if (CORNER_INDICES.includes(index)) {
    switch (cell.id) {
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

/** Get the darker shade of a cell color (for gradient base) */
export function getCellColorDark(cell: BoardCellData, index: number): number {
  const ct = DESIGN_TOKENS.color.cell;
  if (CORNER_INDICES.includes(index)) {
    switch (cell.id) {
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

/** Get line theme color from design tokens */
export function getLineColor(lineId: string): number {
  const ct = DESIGN_TOKENS.color.cell.lineEntry;
  const key = lineId as keyof typeof ct;
  if (key in ct) {
    return hexToPixi(ct[key][1]);
  }
  return hexToPixi(ct.pukou[1]);
}

/** Get line dark theme color from design tokens */
export function getLineColorDark(lineId: string): number {
  const ct = DESIGN_TOKENS.color.cell.lineEntry;
  const key = lineId as keyof typeof ct;
  if (key in ct) {
    return hexToPixi(ct[key][0]);
  }
  return hexToPixi(ct.pukou[0]);
}

// ============================================
// Player Colors (PixiJS hex)
// ============================================
export const PLAYER_COLORS_HEX = [0xE53935, 0x1E88E5, 0x43A047, 0xFB8C00, 0x8E24AA, 0x00897B];
