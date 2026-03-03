// server/src/data/board.ts
import { BoardData } from '@nannaricher/shared';
import { allLines } from './lines/index.js';

// MainCell interface
export interface MainCell {
  id: string;
  index: number;
  name: string;
  type: 'corner' | 'event' | 'chance' | 'line_entry';
  lineId?: string;        // 如果是线路入口
  forceEntry?: boolean;   // 是否强制进入
  entryFee?: number;      // 入场费
  description: string;
}

// 主棋盘格子配置 - 28格，每边7格
export const MAIN_BOARD_CELLS: MainCell[] = [
  // 底边（索引 0-6，从右往左：起点 → 校医院方向）
  { id: 'start', index: 0, name: '起点/低保日', type: 'corner', description: '经过+500金，停留+600金' },
  { id: 'chance_1', index: 1, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'tuition', index: 2, name: '所有人交学费', type: 'event', description: '交(5.0-GPA)×100元' },
  { id: 'chance_2', index: 3, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_pukou', index: 4, name: '浦口线入口', type: 'line_entry', lineId: 'pukou', forceEntry: true, entryFee: 0, description: '强制进入，入场费0' },
  { id: 'zijing', index: 5, name: '紫荆站', type: 'event', description: '选择：-100金抽培养方案 或 抽卡' },
  { id: 'line_study', index: 6, name: '学在南哪入口', type: 'line_entry', lineId: 'study', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },

  // 左边（索引 7-13，从下往上：校医院 → 鼎方向）
  { id: 'hospital', index: 7, name: '校医院', type: 'corner', description: '投到3或付250金出院' },
  { id: 'line_money', index: 8, name: '赚在南哪入口', type: 'line_entry', lineId: 'money', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'qingong', index: 9, name: '勤工助学', type: 'event', description: '+240金暂停1回合，最穷者额外+240' },
  { id: 'chance_3', index: 10, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_suzhou', index: 11, name: '苏州线入口', type: 'line_entry', lineId: 'suzhou', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'retake', index: 12, name: '重修', type: 'event', description: 'GPA<3.5可选：-100金投骰，偶数+0.2GPA' },
  { id: 'chance_4', index: 13, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },

  // 顶边（索引 14-20，从左往右：鼎 → 候车厅方向）
  { id: 'ding', index: 14, name: '鼎', type: 'corner', description: '暂停1回合（本回合骰子最大的玩家可免）' },
  { id: 'line_explore', index: 15, name: '乐在南哪入口', type: 'line_entry', lineId: 'explore', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'jiang_gong', index: 16, name: '蒋公的面子', type: 'event', description: '必选一项：-300金+3探索 或 +200金-2探索' },
  { id: 'chance_5', index: 17, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_xianlin', index: 18, name: '仙林线入口', type: 'line_entry', lineId: 'xianlin', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'society', index: 19, name: '社团', type: 'event', description: '可选：-200金或-0.2GPA，投骰得1×点数探索值' },
  { id: 'chance_6', index: 20, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },

  // 右边（索引 21-27，从上往下：候车厅 → 起点方向）
  { id: 'waiting_room', index: 21, name: '候车厅', type: 'corner', description: '可选：-200金传送到任意大格子并执行事件' },
  { id: 'line_gulou', index: 22, name: '鼓楼线入口', type: 'line_entry', lineId: 'gulou', forceEntry: false, entryFee: 200, description: '可选进入，入场费200金' },
  { id: 'kechuang', index: 23, name: '科创赛事', type: 'event', description: '可选：-0.3GPA投骰，+0.1×点数GPA' },
  { id: 'chance_7', index: 24, name: '机会/命运', type: 'chance', description: '抽一张机会卡或命运卡' },
  { id: 'line_food', index: 25, name: '食堂线入口', type: 'line_entry', lineId: 'food', forceEntry: true, entryFee: 0, description: '强制进入，入场费0' },
  { id: 'nanna_cp', index: 26, name: '南哪诚品', type: 'event', description: '给场上每位其他玩家50金' },
  { id: 'chuangmen', index: 27, name: '闯门', type: 'event', description: '选择：停留1回合+0.2GPA 或 -0.1GPA向前1格到起点' },
];

// 角落格索引
export const CORNER_INDICES = [0, 7, 14, 21];

// 线路入口到出口的映射
export const LINE_EXIT_MAP: Record<string, number> = {
  'pukou': 5,      // 浦口线出口 → 紫荆站
  'study': 7,      // 学在南哪出口 → 校医院
  'money': 9,      // 赚在南哪出口 → 勤工助学
  'suzhou': 12,    // 苏州线出口 → 重修
  'explore': 16,   // 乐在南哪出口 → 蒋公的面子
  'xianlin': 19,   // 仙林线出口 → 社团
  'gulou': 23,     // 鼓楼线出口 → 科创赛事
  'food': 26,      // 食堂线出口 → 南哪诚品
};

// 强制进入的线路
export const FORCED_LINES = ['pukou', 'food'];

// 获取格子信息
export function getCellByIndex(index: number): MainCell | undefined {
  return MAIN_BOARD_CELLS.find(cell => cell.index === index);
}

// 判断是否为角落格
export function isCorner(index: number): boolean {
  return CORNER_INDICES.includes(index);
}

// BoardData 导出（保持与现有代码兼容）
export const boardData: BoardData = {
  mainBoard: MAIN_BOARD_CELLS.map(cell => ({
    index: cell.index,
    id: cell.id,
    name: cell.name,
    type: cell.type,
    ...(cell.lineId ? { lineId: cell.lineId } : {}),
    ...(cell.forceEntry !== undefined ? { forceEntry: cell.forceEntry } : {}),
    ...(cell.entryFee !== undefined ? { entryFee: cell.entryFee } : {}),
    ...(cell.type === 'corner' ? { cornerType: cell.id as 'start' | 'hospital' | 'ding' | 'waiting_room' } : {}),
  })),
  lines: allLines,
};

export const MAIN_BOARD_SIZE = boardData.mainBoard.length;
