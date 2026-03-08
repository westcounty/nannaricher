// shared/src/board-data.ts
// Shared board definitions used by both server and client.
// This is the single source of truth for board layout and line configurations.

import type { CellType } from './board-types.js';

// ============================================
// Board Cell (main board)
// ============================================
export interface BoardCellData {
  index: number;
  id: string;
  name: string;
  type: CellType;
  cornerType?: 'start' | 'hospital' | 'ding' | 'waiting_room';
  lineId?: string;
  forceEntry?: boolean;
  entryFee?: number;
  description: string;
}

// ============================================
// Line Configuration (for rendering)
// ============================================
export interface LineConfig {
  id: string;
  name: string;
  entryIndex: number;    // main board entry cell index
  cellCount: number;     // total cells in line (including experience card)
  forceEntry: boolean;
  entryFee: number;
  direction: 'up' | 'down' | 'left' | 'right';
  color: number;         // PixiJS hex color
}

// ============================================
// Board Layout Constants
// ============================================
export const CORNER_INDICES = [0, 7, 14, 21];
export const CELLS_PER_SIDE = 7;
export const MAIN_BOARD_SIZE = 28;

// ============================================
// Main Board Cells (28 cells)
// ============================================
export const MAIN_BOARD_CELLS: BoardCellData[] = [
  // Bottom side (index 0-6, right to left: start -> hospital direction)
  { id: 'start', index: 0, name: '起点/低保日', type: 'corner', cornerType: 'start', description: '经过+500金，停留+600金' },
  { id: 'line_study', index: 1, name: '学在南哪入口', type: 'line_entry', lineId: 'study', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'tuition', index: 2, name: '所有人交学费', type: 'event', description: '交(5.0-GPA)×100元' },
  { id: 'chance_2', index: 3, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_pukou', index: 4, name: '浦口线入口', type: 'line_entry', lineId: 'pukou', forceEntry: true, entryFee: 0, description: '强制进入，入场费0' },
  { id: 'zijing', index: 5, name: '紫荆站', type: 'event', description: '选择：-100金抽培养方案 或 抽卡' },
  { id: 'chance_1', index: 6, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },

  // Left side (index 7-13, bottom to top: hospital -> ding direction)
  { id: 'hospital', index: 7, name: '校医院', type: 'corner', cornerType: 'hospital', description: '投到3或付250金出院' },
  { id: 'line_money', index: 8, name: '赚在南哪入口', type: 'line_entry', lineId: 'money', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'qingong', index: 9, name: '勤工助学', type: 'event', description: '+240金暂停1回合，最穷者额外+240' },
  { id: 'chance_3', index: 10, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_suzhou', index: 11, name: '苏州线入口', type: 'line_entry', lineId: 'suzhou', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'retake', index: 12, name: '重修', type: 'event', description: 'GPA<3.5可选：-100金投骰，偶数+0.2GPA' },
  { id: 'chance_4', index: 13, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },

  // Top side (index 14-20, left to right: ding -> waiting_room direction)
  { id: 'ding', index: 14, name: '鼎', type: 'corner', cornerType: 'ding', description: '暂停1回合（本回合骰子最大的玩家可免）' },
  { id: 'line_explore', index: 15, name: '乐在南哪入口', type: 'line_entry', lineId: 'explore', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'jiang_gong', index: 16, name: '蒋公的面子', type: 'event', description: '必选一项：-300金+3探索 或 +200金-2探索' },
  { id: 'chance_5', index: 17, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_xianlin', index: 18, name: '仙林线入口', type: 'line_entry', lineId: 'xianlin', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'society', index: 19, name: '社团', type: 'event', description: '可选：-200金或-0.2GPA，投骰得1×点数探索值' },
  { id: 'chance_6', index: 20, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },

  // Right side (index 21-27, top to bottom: waiting_room -> start direction)
  { id: 'waiting_room', index: 21, name: '候车厅', type: 'corner', cornerType: 'waiting_room', description: '可选：-200金传送到任意大格子并执行事件' },
  { id: 'line_gulou', index: 22, name: '鼓楼线入口', type: 'line_entry', lineId: 'gulou', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'kechuang', index: 23, name: '科创赛事', type: 'event', description: '可选：-0.3GPA投骰，+0.1×点数GPA' },
  { id: 'chance_7', index: 24, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_food', index: 25, name: '食堂线入口', type: 'line_entry', lineId: 'food', forceEntry: true, entryFee: 0, description: '强制进入，入场费0' },
  { id: 'nanna_cp', index: 26, name: '南哪诚品', type: 'event', description: '给场上每位其他玩家50金' },
  { id: 'chuangmen', index: 27, name: '闯门', type: 'event', description: '选择：停留1回合+0.2GPA 或 -0.1GPA向前1格到起点' },
];

// ============================================
// Line Exit Map (line id -> main board exit index)
// ============================================
export const LINE_EXIT_MAP: Record<string, number> = {
  'pukou': 6,      // pukou@4 → exit=6 (机会1)
  'study': 3,      // study@1 → exit=3
  'money': 10,     // money@8 → exit=10 (机会3)
  'suzhou': 13,    // suzhou@11 → exit=13
  'explore': 17,   // explore@15 → exit=17
  'xianlin': 20,   // xianlin@18 → exit=20
  'gulou': 24,     // gulou@22 → exit=24 (机会7)
  'food': 27,      // food@25 → exit=27
};

// ============================================
// Forced Entry Lines
// ============================================
export const FORCED_LINES = ['pukou', 'food'];

// ============================================
// Line Configurations (for rendering & game logic)
// ============================================
export const LINE_CONFIGS: LineConfig[] = [
  { id: 'pukou', name: '浦口线', entryIndex: 4, cellCount: 13, forceEntry: true, entryFee: 0, direction: 'up', color: 0x607D8B },
  { id: 'study', name: '学在南哪', entryIndex: 1, cellCount: 10, forceEntry: false, entryFee: 200, direction: 'up', color: 0x3F51B5 },
  { id: 'money', name: '赚在南哪', entryIndex: 8, cellCount: 11, forceEntry: false, entryFee: 200, direction: 'right', color: 0xFF9800 },
  { id: 'suzhou', name: '苏州线', entryIndex: 11, cellCount: 11, forceEntry: false, entryFee: 200, direction: 'right', color: 0x2196F3 },
  { id: 'explore', name: '乐在南哪', entryIndex: 15, cellCount: 10, forceEntry: false, entryFee: 200, direction: 'down', color: 0xE91E63 },
  { id: 'xianlin', name: '仙林线', entryIndex: 18, cellCount: 8, forceEntry: false, entryFee: 200, direction: 'down', color: 0x4CAF50 },
  { id: 'gulou', name: '鼓楼线', entryIndex: 22, cellCount: 10, forceEntry: false, entryFee: 200, direction: 'left', color: 0x795548 },
  { id: 'food', name: '食堂线', entryIndex: 25, cellCount: 10, forceEntry: true, entryFee: 0, direction: 'left', color: 0xFF5722 },
];

// ============================================
// Utility Functions
// ============================================

/** Get a main board cell by index */
export function getCellByIndex(index: number): BoardCellData | undefined {
  return MAIN_BOARD_CELLS.find(cell => cell.index === index);
}

/** Check if a main board index is a corner cell */
export function isCornerIndex(index: number): boolean {
  return CORNER_INDICES.includes(index);
}

/** Get a line config by line id */
export function getLineConfig(lineId: string): LineConfig | undefined {
  return LINE_CONFIGS.find(l => l.id === lineId);
}

/** Get the main board exit index for a line */
export function getLineExitIndex(lineId: string): number | undefined {
  return LINE_EXIT_MAP[lineId];
}
