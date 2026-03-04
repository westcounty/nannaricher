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
 *
 * Layout:
 *   Bottom side (0-6):  right to left
 *   Left side (7-13):   bottom to top
 *   Top side (14-20):   left to right
 *   Right side (21-27): top to bottom
 */
export function getCellPosition(
  index: number,
  boardSize = BOARD_SIZE,
  cellWidth = CELL_SIZE,
  cornerSize = CORNER_SIZE,
): { x: number; y: number } {
  const boardCenter = boardSize / 2;
  const side = Math.floor(index / CELLS_PER_SIDE);
  const posInSide = index % CELLS_PER_SIDE;

  let x = 0;
  let y = 0;

  switch (side) {
    case 0: // Bottom (right to left)
      x = boardCenter + cornerSize / 2 + (CELLS_PER_SIDE - 1 - posInSide) * cellWidth;
      y = boardCenter + cornerSize / 2;
      break;
    case 1: // Left (bottom to top)
      x = boardCenter - cornerSize / 2;
      y = boardCenter + cornerSize / 2 - (posInSide + 1) * cellWidth;
      break;
    case 2: // Top (left to right)
      x = boardCenter - cornerSize / 2 - (CELLS_PER_SIDE - 1 - posInSide) * cellWidth;
      y = boardCenter - cornerSize / 2;
      break;
    case 3: // Right (top to bottom)
      x = boardCenter + cornerSize / 2;
      y = boardCenter - cornerSize / 2 + (posInSide + 1) * cellWidth;
      break;
  }

  return { x, y };
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
  if (!line) return { x: boardSize / 2, y: boardSize / 2 };

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
  if (CORNER_INDICES.includes(index)) {
    switch (cell.id) {
      case 'start': return 0x4CAF50;
      case 'hospital': return 0xF44336;
      case 'ding': return 0xFFC107;
      case 'waiting_room': return 0x2196F3;
    }
  }
  switch (cell.type) {
    case 'event': return 0xFF9800;
    case 'chance': return 0x9C27B0;
    case 'line_entry': {
      const line = LINE_CONFIGS.find(l => l.id === cell.lineId);
      return line?.color || 0x607D8B;
    }
  }
  return 0xffffff;
}

// ============================================
// Player Colors (PixiJS hex)
// ============================================
export const PLAYER_COLORS_HEX = [0xE53935, 0x1E88E5, 0x43A047, 0xFB8C00, 0x8E24AA, 0x00897B];
