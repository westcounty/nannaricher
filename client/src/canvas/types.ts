// client/src/canvas/types.ts
// Types for canvas board rendering

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface CellRenderInfo {
  id: string;
  name: string;
  type: 'corner' | 'event' | 'chance' | 'line_entry';
  position: Point;
  size: number;
  color: string;
  cornerType?: 'start' | 'hospital' | 'ding' | 'waiting_room';
  lineId?: string;
}

export interface LineRenderInfo {
  id: string;
  name: string;
  cells: CellRenderInfo[];
  entryPoint: Point;
  direction: 'inward' | 'outward';
}

export interface BoardRenderConfig {
  // Canvas dimensions
  canvasWidth: number;
  canvasHeight: number;

  // Board layout
  centerX: number;
  centerY: number;
  mainBoardRadius: number;
  cellSize: number;
  cornerSize: number;

  // Line routes
  lineCellSize: number;
  lineSpacing: number;
}

export const defaultRenderConfig: BoardRenderConfig = {
  canvasWidth: 1000,
  canvasHeight: 800,
  centerX: 500,
  centerY: 400,
  mainBoardRadius: 320,
  cellSize: 70,
  cornerSize: 90,
  lineCellSize: 55,
  lineSpacing: 60,
};

export interface PlayerRenderInfo {
  id: string;
  name: string;
  position: Point;
  color: string;
  currentCellIndex: number;
  isInLine: boolean;
  lineId?: string;
  lineCellIndex?: number;
}
